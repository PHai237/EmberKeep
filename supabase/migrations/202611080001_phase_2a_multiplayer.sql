create extension if not exists pgcrypto;
create schema if not exists private;

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  owner_id uuid not null references auth.users(id) on delete restrict,
  version bigint not null default 1 check (version >= 1),
  snapshot jsonb not null,
  exploration_policy text not null default 'open' check (exploration_policy in ('open', 'designated', 'all')),
  designated_character_id text check (designated_character_id in ('pc-aria', 'pc-borin')),
  pending_actions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_members (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  seat text not null check (seat in ('player-a', 'player-b')),
  character_id text not null check (character_id in ('pc-aria', 'pc-borin')),
  connected boolean not null default true,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat),
  unique (room_id, character_id)
);

create table public.campaign_events (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  seq bigint not null,
  event_id text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  command_id text not null,
  public_event jsonb not null,
  created_at timestamptz not null default now(),
  primary key (room_id, seq),
  unique (room_id, event_id)
);

create table public.processed_commands (
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  command_id text not null,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  response jsonb not null default '{"ok":true}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (room_id, command_id)
);

create index campaign_events_room_command_idx on public.campaign_events(room_id, command_id);
create index room_members_user_idx on public.room_members(user_id, room_id);

alter table public.game_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.campaign_events enable row level security;
alter table public.processed_commands enable row level security;

create or replace function private.is_room_member(target_room uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists(select 1 from public.room_members where room_id = target_room and user_id = target_user);
$$;

revoke all on function private.is_room_member(uuid, uuid) from public;
grant execute on function private.is_room_member(uuid, uuid) to authenticated, service_role;

create policy rooms_member_read on public.game_rooms for select to authenticated
  using (private.is_room_member(id));
create policy members_same_room_read on public.room_members for select to authenticated
  using (private.is_room_member(room_id));
create policy events_member_read on public.campaign_events for select to authenticated
  using (private.is_room_member(room_id));
create policy own_processed_command_read on public.processed_commands for select to authenticated
  using (actor_user_id = auth.uid() and private.is_room_member(room_id));

-- Authenticated browser clients receive SELECT only through RLS. All mutations are
-- performed by the game-api Edge Function using server-only credentials.
revoke insert, update, delete on public.game_rooms, public.room_members, public.campaign_events, public.processed_commands from anon, authenticated;
grant select on public.game_rooms, public.room_members, public.campaign_events, public.processed_commands to authenticated;

create or replace function public.queue_exploration_action(
  p_room_id uuid, p_actor_user_id uuid, p_expected_version bigint, p_command jsonb
) returns jsonb
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  locked_room public.game_rooms%rowtype;
  actor_seat text;
  pending jsonb;
  member_count integer;
  pending_count integer;
begin
  select * into locked_room from public.game_rooms where id = p_room_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND'); end if;
  select seat into actor_seat from public.room_members where room_id = p_room_id and user_id = p_actor_user_id;
  if actor_seat is null then return jsonb_build_object('ok', false, 'code', 'FORBIDDEN'); end if;
  if locked_room.version <> p_expected_version then return jsonb_build_object('ok', false, 'code', 'CONFLICT'); end if;
  if locked_room.exploration_policy <> 'all' then return jsonb_build_object('ok', false, 'code', 'INVALID'); end if;
  pending := locked_room.pending_actions || jsonb_build_object(actor_seat, p_command);
  update public.game_rooms set pending_actions = pending, updated_at = now() where id = p_room_id;
  select count(*) into member_count from public.room_members where room_id = p_room_id;
  select count(*) into pending_count from jsonb_object_keys(pending);
  return jsonb_build_object('ok', true, 'ready', pending_count >= member_count, 'actions', pending);
end;
$$;

create or replace function public.commit_game_command(
  p_room_id uuid,
  p_actor_user_id uuid,
  p_expected_version bigint,
  p_new_version bigint,
  p_record jsonb,
  p_events jsonb,
  p_command_ids jsonb
) returns jsonb
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  locked_room public.game_rooms%rowtype;
  event_value jsonb;
  command_value jsonb;
  event_count integer;
begin
  if not private.is_room_member(p_room_id, p_actor_user_id) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;
  select * into locked_room from public.game_rooms where id = p_room_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'ROOM_NOT_FOUND'); end if;
  if exists(
    select 1 from public.processed_commands
    where room_id = p_room_id and command_id in (select value->>'id' from jsonb_array_elements(p_command_ids))
  ) then return jsonb_build_object('ok', true, 'replayed', true); end if;
  if locked_room.version <> p_expected_version then return jsonb_build_object('ok', false, 'code', 'CONFLICT'); end if;
  if p_new_version <= p_expected_version then return jsonb_build_object('ok', false, 'code', 'INVALID_VERSION'); end if;
  select count(*) into event_count from jsonb_array_elements(p_events);
  if event_count <> p_new_version - p_expected_version then return jsonb_build_object('ok', false, 'code', 'INVALID_EVENT_SEQUENCE'); end if;

  for event_value in select value from jsonb_array_elements(p_events) loop
    if (event_value->>'campaignId')::uuid <> p_room_id then raise exception 'campaign scope mismatch'; end if;
    insert into public.campaign_events(room_id, seq, event_id, actor_user_id, command_id, public_event, created_at)
    values (
      p_room_id, (event_value->>'seq')::bigint, event_value->>'id',
      (select user_id from public.room_members where room_id = p_room_id and seat = event_value->>'actorId'),
      event_value->>'commandId', event_value, coalesce((event_value->>'createdAt')::timestamptz, now())
    );
  end loop;

  update public.game_rooms set version = p_new_version, snapshot = p_record, pending_actions = '{}'::jsonb, updated_at = now() where id = p_room_id;
  for command_value in select value from jsonb_array_elements(p_command_ids) loop
    insert into public.processed_commands(room_id, command_id, actor_user_id)
    values (p_room_id, command_value->>'id', (command_value->>'userId')::uuid)
    on conflict (room_id, command_id) do nothing;
  end loop;
  return jsonb_build_object('ok', true, 'replayed', false);
end;
$$;

revoke all on function public.queue_exploration_action(uuid, uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.commit_game_command(uuid, uuid, bigint, bigint, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.queue_exploration_action(uuid, uuid, bigint, jsonb) to service_role;
grant execute on function public.commit_game_command(uuid, uuid, bigint, bigint, jsonb, jsonb, jsonb) to service_role;

alter publication supabase_realtime add table public.game_rooms;

create or replace function public.create_game_room(
  p_room_id uuid, p_invite_code text, p_owner_id uuid, p_display_name text, p_record jsonb, p_events jsonb, p_version bigint
) returns void
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare event_value jsonb;
begin
  insert into public.game_rooms(id, invite_code, owner_id, version, snapshot)
  values (p_room_id, p_invite_code, p_owner_id, p_version, p_record);
  insert into public.room_members(room_id, user_id, display_name, seat, character_id)
  values (p_room_id, p_owner_id, left(trim(p_display_name), 40), 'player-a', 'pc-aria');
  for event_value in select value from jsonb_array_elements(p_events) loop
    insert into public.campaign_events(room_id, seq, event_id, actor_user_id, command_id, public_event, created_at)
    values (p_room_id, (event_value->>'seq')::bigint, event_value->>'id', null, event_value->>'commandId', event_value, (event_value->>'createdAt')::timestamptz);
  end loop;
end;
$$;

create or replace function public.join_game_room(p_invite_code text, p_user_id uuid, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_room public.game_rooms%rowtype; existing_room uuid; member_count integer;
begin
  select room_id into existing_room from public.room_members where user_id = p_user_id and room_id = (select id from public.game_rooms where invite_code = upper(trim(p_invite_code)));
  if existing_room is not null then
    update public.room_members set connected = true, last_seen_at = now() where room_id = existing_room and user_id = p_user_id;
    return existing_room;
  end if;
  select * into target_room from public.game_rooms where invite_code = upper(trim(p_invite_code)) for update;
  if not found then raise exception using errcode = 'P0002', message = 'ROOM_NOT_FOUND'; end if;
  select count(*) into member_count from public.room_members where room_id = target_room.id;
  if member_count >= 2 then raise exception using errcode = 'P0001', message = 'ROOM_FULL'; end if;
  insert into public.room_members(room_id, user_id, display_name, seat, character_id)
  values (target_room.id, p_user_id, left(trim(p_display_name), 40), 'player-b', 'pc-borin');
  return target_room.id;
end;
$$;

create or replace function public.set_room_exploration(
  p_room_id uuid, p_actor_user_id uuid, p_policy text, p_designated_character_id text
) returns void
language plpgsql security definer set search_path = public, private, pg_temp as $$
declare target_room public.game_rooms%rowtype;
begin
  select * into target_room from public.game_rooms where id = p_room_id for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if target_room.owner_id <> p_actor_user_id then raise exception 'FORBIDDEN'; end if;
  if p_policy not in ('open','designated','all') then raise exception 'INVALID_POLICY'; end if;
  if p_policy = 'designated' and not exists(
    select 1 from public.room_members where room_id = p_room_id and character_id = p_designated_character_id
  ) then raise exception 'INVALID_DESIGNATED_CHARACTER'; end if;
  update public.game_rooms set exploration_policy = p_policy,
    designated_character_id = case when p_policy = 'designated' then p_designated_character_id else null end,
    pending_actions = '{}'::jsonb, updated_at = now()
  where id = p_room_id;
end;
$$;

revoke all on function public.create_game_room(uuid, text, uuid, text, jsonb, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.join_game_room(text, uuid, text) from public, anon, authenticated;
revoke all on function public.set_room_exploration(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_game_room(uuid, text, uuid, text, jsonb, jsonb, bigint) to service_role;
grant execute on function public.join_game_room(text, uuid, text) to service_role;
grant execute on function public.set_room_exploration(uuid, uuid, text, text) to service_role;

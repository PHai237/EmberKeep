# Phase 2A — Multiplayer Foundation Report

Ngày thực hiện: **2026-11-08**  
Phiên bản source: **Emberkeep v0.6.0**

## Kết quả

Phase 2A đã thêm multiplayer foundation mà không thay thế game engine event-sourced hiện tại. Offline/MockDM và save Phase 1 vẫn hoạt động. Network mode dùng Supabase Anonymous Auth, PostgreSQL, Realtime và một Edge Function làm authority.

## Đã triển khai

- Tạo phòng và tham gia bằng mã mời 8 ký tự.
- Hai seat cố định: `player-a → pc-aria`, `player-b → pc-borin`.
- Client gửi command không có `actorId`, `characterId` hoặc kết quả dice; Edge Function tự gắn authority từ authenticated membership.
- Engine hiện tại tiếp tục xác thực ownership, optimistic version, idempotency, HP, inventory, vàng, XP, dice và combat initiative.
- Snapshot và event log được đồng bộ qua server; Realtime update chỉ kích hoạt tải lại state đã commit.
- Reload/reconnect dùng Supabase auth session đã persist và room id local.
- Exploration policy:
  - `open`: người nào cũng có thể phản hồi.
  - `designated`: chủ phòng chọn một character.
  - `all`: queue command và chỉ commit khi đủ hai người.
- MockDM chạy trong authoritative command flow; chưa có Gemini.
- Settings vẫn export JSON. Import save cũ vẫn hoạt động trong offline mode; browser không được import để ghi đè multiplayer state.
- UI hiện tại được giữ; chỉ thêm nút/phần tạo-tham gia phòng, connection status, member list và exploration policy.

## Kiến trúc authoritative

```text
Browser command (không có actor/character/state delta)
  → Supabase Anonymous Auth JWT
  → game-api Edge Function
  → room membership gắn seat + character
  → GameEngine dispatch + server RNG + MockDM
  → commit_game_command RPC
  → một transaction ghi event log + snapshot + version + idempotency ledger
  → Realtime báo room update
  → cả hai client tải snapshot đã commit
```

Browser authenticated chỉ có quyền `SELECT` dữ liệu thuộc room qua RLS. Migration thu hồi `INSERT`, `UPDATE`, `DELETE` trực tiếp trên các bảng authoritative. Service-role key chỉ được Edge Function đọc từ server environment.

## PostgreSQL

Migration: `supabase/migrations/202611080001_phase_2a_multiplayer.sql`

- `game_rooms`: invite, owner, version, snapshot, exploration policy, queued actions.
- `room_members`: user, seat, character, presence metadata.
- `campaign_events`: append-only public events theo `(room_id, seq)`.
- `processed_commands`: command idempotency ledger.
- RPC transaction cho create/join, exploration queue/config và atomic command commit.
- RLS giới hạn room/member/event reads theo authenticated membership.

## Test đã chạy thành công

### Baseline trước khi sửa

```text
npm test       → 5 files, 29 tests passed
npm run build  → Vite production build passed
```

### Kết quả cuối

```text
npm test
→ 6 test files passed
→ 35 tests passed

npm run typecheck
→ tsc -b passed

npx --yes deno check supabase/functions/game-api/index.ts
→ Edge Function type check passed

npm run build
→ TypeScript + Vite passed
→ 69 modules transformed
→ JS 488.17 kB, 140.32 kB gzip

npm run dev -- --host 127.0.0.1
→ Vite ready
→ HTTP GET / returned 200
```

`npm install @supabase/supabase-js` và lần cập nhật lockfile audit **97 packages, 0 vulnerabilities**.

Integration tests mới xác minh:

- Hai identity tạo/join room và nhận đúng character, không có impersonation control.
- Payload giả mạo authority bị server ghi đè bằng membership.
- Hai client gửi cùng version: một command commit, command còn lại nhận `CONFLICT`.
- Retry cùng command id không tạo event trùng.
- Wrong-turn combat bị từ chối; initiative vẫn do engine quyết định.
- Designated responder và wait-for-both exploration.
- Disconnect, action khi vắng mặt, reconnect và phục hồi đúng snapshot/event log.
- Hai người mua đồng thời, conflict/retry, inventory/vàng nhất quán và bán vật phẩm được đồng bộ.

## Kiểm tra Supabase local chưa chạy được

Đã chạy:

```text
npx --yes supabase@latest --version
→ 3.0.0

npx --yes supabase@latest start
→ DockerLifecycleInspectError
→ failed to connect to dockerDesktopLinuxEngine

npx --yes supabase@latest functions serve game-api --no-verify-jwt
→ ServeLocalDbInspectError
→ failed to connect to dockerDesktopLinuxEngine
```

Docker Desktop được thử khởi động lại và từng trả `Server Version: 29.9.2`, nhưng daemon tự dừng khi Supabase stack khởi tạo. Edge Function đã qua `deno check`, nhưng migration SQL, RLS và Edge Function **chưa được runtime-verified cùng database** trong môi trường này. Không có Supabase cloud credentials nào được cung cấp hoặc tạo tự động.

## Cấu hình bên ngoài còn cần

1. Docker Desktop hoạt động ổn định hoặc một Supabase project do người vận hành chủ động tạo.
2. Chạy migration/database reset.
3. Serve/deploy `game-api` Edge Function.
4. Cấu hình `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` theo `.env.example`.
5. Nếu dùng cloud: xác nhận Anonymous Sign-Ins, Realtime publication và chính sách Free Tier hiện hành; không bật billing tự động.

Hướng dẫn chi tiết: `docs/PHASE_2A_SETUP.md`.

## Tương thích và đường lui

- `CampaignRecord` vẫn là schema version 1.
- Campaign id đã đổi từ literal Phase 1 thành string để mỗi room có scope riêng; save `phase-1-demo` cũ vẫn hợp lệ.
- Reducer migration XP/vàng cũ được giữ nguyên.
- Offline `localStorage` và import/export JSON không bị xóa.
- Không sửa hoặc import dữ liệu từ dự án Story.

## Giới hạn Phase 2A

- Chưa có Gemini hoặc AI provider thật.
- Chưa có private clue/DM-only payload trong network API.
- Presence hiện là trạng thái kết nối best-effort; mất nguồn đột ngột có thể hiển thị member online cho tới lần heartbeat/reconnect sau.
- Hosted two-device test chưa chạy vì không có credentials/project. Integration behavior đã được test bằng hai client độc lập dùng cùng authoritative server contract.
- Không triển khai Phase 2B.

## Git và secrets

- Workspace không phải Git repository: `git status` trả `fatal: not a git repository`; không thể cung cấp Git diff hoặc commit hash.
- Secret scan không tìm thấy API key, service-role key, webhook hoặc token thật trong source. `.env.example` chỉ chứa placeholder và `.env*` bị ignore, trừ template.

# AGENTS — Emberkeep (low-resource, no Docker / no Codex)

Trước khi chỉnh code phải đọc `docs/LOCAL_SAFETY.md`, `docs/PROJECT_STATUS.md`, `rules/DM_CONTRACT.md`, `docs/STATE_AND_EVENTS.md`, `docs/ACCEPTANCE_TESTS.md`. `docs/history/` chỉ để tra cứu; không làm theo prompt cũ.

## Ràng buộc bắt buộc

- Không dùng Codex cho dự án này. Người dùng đã quyết định dừng Codex do tiêu hao hạn mức.
- Không Docker, WSL2, container, VM, local Supabase, `supabase start`, `supabase db reset`, `supabase functions serve`. Không tự cài đặt hoặc chạy dịch vụ nền hay benchmark.
- Không tự thực hiện lệnh cục bộ, cài dependencies, deploy lên cloud hoặc bật billing; cần sự đồng ý rõ ràng của chủ sở hữu cho từng việc.
- Không xóa save, backup hoặc chỉnh dự án Story gốc. Không dùng `git reset --hard`, `git clean`, force push.
- Không mô tả MockDM là AI live; không mô tả Phase 2A là multiplayer đã hoạt động trên internet khi chưa chạy thật.
- Không đưa secret hoặc dữ kiện bí mật của GM vào frontend. Không tin các trường client gửi như roll, HP, vàng, inventory delta hay actor id.
- Mỗi lần sửa chỉ làm scope nhỏ, so diff, tránh file hay text thừa trong UI, test bằng cách ít tài nguyên nhất ở môi trường thích hợp.

## Thứ tự authority

1. Quyền điều khiển nhân vật và hành động rõ ràng của người chơi (trong giới hạn luật hợp lệ).
2. Trạng thái và sự kiện đã commit trên server / canon đã xác nhận.
3. Luật và cấu hình chiến dịch.
4. Narrative policy được duyệt.
5. Đề xuất của AI, luôn được coi là dữ liệu chưa đáng tin.

Hành động từ AI phải qua kiểm tra schema, quyền, điều kiện, nguồn xúc xắc, inventory, HP, version và idempotency trước khi ghi event.

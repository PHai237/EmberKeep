# Emberkeep — Project status (2026-11-08)

## Phiên bản tham chiếu
- Mã nguồn: v0.6 / Phase 2A Multiplayer Foundation trên UI v0.5.
- Trạng thái: **Offline playable; multiplayer source complete, cần Supabase runtime được cấu hình**.
- Nguồn sự thật offline: `src/domain/` + `src/persistence/`; multiplayer: Edge Function + PostgreSQL events/snapshot.
- UI: `src/ui/App.tsx`, `src/ui/styles.css`.

## Đã triển khai trong source
- Hai nhân vật mẫu, HP, tiền, vật phẩm, XP/level; engine xử lý dice, event, combat và economy mẫu.
- MockDM và action choices; lưu/tải trên trình duyệt và JSON export/import.
- UI dạng hội thoại, sidebar công cụ, mở dữ liệu nhân vật và cài đặt.
- Room/invite, fixed authenticated seat, Realtime reconnect, exploration coordination và server command adapter.
- Migration PostgreSQL có RLS, membership, event log, snapshot, idempotency ledger và transaction RPC.
- Integration server/test local cho hai client, conflict, reconnect và concurrent economy.

## Chưa triển khai
- AI DM live; truy vấn trí nhớ/canon tự động; quản lý kiến thức bí mật trên server.
- D&D SRD đầy đủ; logic tạo nhân vật và lên cấp có lựa chọn chi tiết.
- Supabase cloud project/credentials trong repository; người vận hành phải tự cấu hình nếu muốn network runtime.

## Điều kiện trước khi nâng cấp
1. Người dùng duyệt UI trên Windows thực tế và kiểm tra font tiếng Việt (không dựa vào mockup).
2. Chạy `npm ci`, `npm test`, `npm run build` tại source hiện tại; ghi kết quả thật.
3. Sao lưu campaign JSON trước khi thay trạng thái hoặc persistence.
4. Khi kết nối AI, không cho model tự ghi HP/vàng/vật phẩm; phải qua engine kiểm tra.
5. Khi làm multiplayer, loại bỏ mô phỏng hai nhân vật trên một client làm nguồn quyền hạn.

## Phase 2A
Không thay save schema Phase 1. Multiplayer lưu cùng `CampaignRecord` trong PostgreSQL; Edge Function tự gắn authority fields, chạy engine hiện tại và commit events/snapshot bằng optimistic version.

# Emberkeep — D&D Co-op (Phase 2A)

Emberkeep là bản thử nghiệm D&D co-op với MockDM, xây dựng trên React, TypeScript, Vite và một multiplayer boundary dùng Supabase. Game engine quản lý xúc xắc, lượt, nhân vật và các sự kiện được xác nhận.

> **Chưa có AI DM thật.** Offline mode vẫn chạy không cần dịch vụ. Multiplayer cần một project Supabase Cloud do chủ sở hữu **chủ động cấu hình**; repository không chứa credentials và không tự tạo dịch vụ cloud.

> **QUAN TRỌNG:** Vì máy chủ sở hữu có lịch sử treo/reset, không sử dụng Docker, WSL2, Supabase local hoặc tác vụ nền tự động. Xem `docs/LOCAL_SAFETY.md`.

## Khởi chạy (chỉ khi máy ổn định và chủ sở hữu chủ động chọn)

Yêu cầu Node.js tương thích với phiên bản Vite đã khóa trong `package-lock.json` (nên dùng Node.js 22.12+).

```powershell
npm ci  # chỉ nếu thực sự thiếu node_modules và chủ sở hữu đồng ý
npm run dev
```

Mở URL được Vite hiển thị (thường là `http://localhost:5173`). Để kiểm tra:

```powershell
npm test
npm run typecheck
npm run build
```

Kết quả test từng phiên bản trước được lưu ở `docs/history/`. **Không coi các kết quả đó là kết quả test mới của bản v0.5.**

## Đang có

- Luồng hội thoại GM/người chơi, lựa chọn có sẵn và ô nhập hành động tự do (MockDM).
- Tổ đội hai nhân vật mẫu, HP, cấp độ, XP, túi đồ, vàng, mua bán mẫu và lượt chiến đấu.
- Xúc xắc và kiểm tra hành động qua game engine; event log làm nguồn dữ liệu chuẩn.
- Tự lưu trên `localStorage`; import/export JSON nằm trong Cài đặt.
- Giao diện desktop/mobile định hướng dark fantasy, không dùng font trang trí cho nội dung tiếng Việt.
- Tạo/tham gia phòng bằng mã mời; Supabase Anonymous Auth gắn mỗi user với đúng một seat/character.
- Edge Function chạy engine, RPC transaction lưu PostgreSQL, RLS chặn client ghi state trực tiếp và Realtime kích hoạt đồng bộ/reconnect.
- Exploration policy `open`, `designated` hoặc `all`; combat tiếp tục dùng initiative của engine.

## Chưa có

- Gemini hoặc bất kỳ model AI nào hoạt động trong game.
- Bộ D&D 5e hoàn chỉnh (spell, đầy đủ class feature, level-up choices, v.v.).
- AI-generated DM và quản lý secret/canon dành cho model.

## Bố cục dự án

```text
src/
  domain/        Game state, commands, reducer, event log
  rules/         Dice và luật demo
  dm/            Giao diện DMProvider và MockDM
  persistence/   Local save, replay, import/export
  ui/            React UI và CSS
  test/          Test helpers
  multiplayer/   Room/session contract, local integration server, Supabase client
supabase/        Migration, RLS/RPC và Edge Function authoritative
rules/           Hợp đồng quyền DM và phong cách kể chuyện
docs/            Kiến trúc, kế hoạch, yêu cầu kiểm thử
  history/       Báo cáo và prompt của các phiên bản cũ (chỉ tham khảo)
public/          Asset tĩnh dùng offline
```

- `AGENTS.md`: quy tắc an toàn cho bất kỳ tác nhân viết code nào (Codex đã dừng).
- `docs/PROJECT_STATUS.md`: những gì thật sự đã có và việc tiếp theo.
- `docs/PHASE_2A_SETUP.md`: hướng dẫn cấu hình Supabase Cloud tùy chọn, không chạy Docker.
- `docs/FOLDER_GUIDE.md`: quy tắc tổ chức thư mục và file trong các đợt phát triển sau.
- `docs/CHANGELOG.md`: lịch sử phiên bản tóm tắt.
- `docs/ARCHITECTURE.md` và `docs/STATE_AND_EVENTS.md`: kiến trúc mục tiêu, **không đồng nghĩa đã triển khai đầy đủ**.
- `rules/DM_CONTRACT.md` và `rules/NARRATIVE_POLICY.md`: các ràng buộc khi đưa AI DM thật vào game.

## Dữ liệu và an toàn

Trước khi thay source hoặc đổi localhost origin, hãy **export chiến dịch thành JSON** trong phần Cài đặt. Save offline Phase 1 vẫn import được. Trong multiplayer, export lấy snapshot server hiện tại; browser không được import trực tiếp để ghi đè server.

Dự án hiện không cần Google Cloud Billing, API key hay tài khoản trả phí. Không đặt secret vào frontend hoặc commit `.env`.

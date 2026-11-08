# Emberkeep UI — Patch v0.1.1

Ngày: 2026-11-08

## Phạm vi

Thiết kế lại **UI Phase 1 offline** mà không thay đổi engine hoặc định dạng save/event.

### Thay đổi

- Thay `src/ui/App.tsx`: trình bày lại thành **Tổ đội / Cảnh & hành động / Nhật ký**; có phân loại nhật ký, chỉ báo tiến độ, visual hierarchy rõ, kiểm soát trạng thái disabled/busy.
- Thay `src/ui/styles.css`: bộ màu xanh than – đồng thau, breakpoint 1350/900/690/470px, layout cho mobile, keyboard focus và reduced-motion.
- Sửa xử lý lưu character sheet: luôn gửi đúng `character.id` của thẻ đang chỉnh, kể cả khi nhân vật khác đang active.
- Hành động tự do không xóa nội dung khi engine từ chối. Có `Ctrl+Enter` để gửi.
- Bố cục không dùng ảnh/font/biểu tượng tải ngoài, giữ khả năng offline.
- `index.html`: cập nhật theme-color để khớp nền.

### Tiếng Việt

- Source UTF-8 và Unicode NFC; không có dấu kết hợp tách rời trong 2 file UI.
- Bỏ sự phụ thuộc vào `Inter` / `Crimson Pro` chưa nạp; dùng font có sẵn trên Windows: `Segoe UI`, `Tahoma`, `Arial`, và `Cambria` cho phần kể chuyện.
- Bỏ tracking âm của headline và ép `line-height:1`; đặt tracking tự nhiên cho nội dung tiếng Việt.
- Nếu máy người dùng có thay thế font Windows hoặc Chrome rendering khác thường, cần đối chiếu màn hình thực tế để khẳng định lỗi hiển thị đã hết hoàn toàn.

### Kiểm thử ở môi trường sửa

- `tsc -b`: **PASS**.
- `postcss.parse(styles.css)`: **PASS**.
- React server render smoke test: **PASS** (tạo markup 15,118 ký tự, không lỗi runtime tại lần render đầu).
- Unicode normalization của hai file UI: **NFC PASS**.
- **Chưa chạy được** `npm test` và `npm run build` trọn vẹn: ZIP gửi lên chứa binary `@rolldown/binding-win32-x64-msvc`; môi trường sửa là Linux và không tải được binary Linux cần thiết. Đây là giới hạn môi trường kiểm thử, không phải kết luận hai lệnh thất bại trên Windows.

### Kiểm thử tại máy của bạn

Trong thư mục dự án (đã có `node_modules`):

```powershell
npm test
npm run build
npm run dev
```

Mở địa chỉ localhost Vite thông báo, sau đó nhấn `Ctrl + F5` để tải UI mới.

Vì Campaign tự lưu trong `localStorage`, việc thay UI **không chủ động xóa bản lưu**. Trước khi thử thay đổi lớn, vẫn nên dùng nút **Xuất bản lưu** để sao lưu.

### Giữ nguyên

`src/domain/**`, `src/rules/**`, `src/dm/**`, `src/persistence/**`, API, checksum, save schema, event format, quest sample, hệ thống chiến đấu.

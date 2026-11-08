# Quy tắc tổ chức thư mục Emberkeep

## Chỉ một nơi chứa mã nguồn hiện tại
- `src/`: source chạy thật, phân theo `domain`, `rules`, `dm`, `persistence`, `ui`, `test`.
- `rules/`: luật thiết kế DM, không lẫn với `src/rules/` (logic kiểm tra bằng code).
- `docs/`: tài liệu đang áp dụng; `docs/history/`: tài liệu lưu từ phiên bản cũ.
- `public/`: asset dùng thật trong ứng dụng.
- Root chỉ dành cho `README.md`, `AGENTS.md`, cấu hình Vite/TypeScript, `package.json`, `package-lock.json`, `.gitignore`, `index.html`.

## Đừng đưa các thứ này vào source/commit
- `node_modules/`, `dist/`, `coverage/`, `.vite/`, cache, report build tạm.
- ZIP patch, ảnh chụp, mockup, bản xem trước độc lập: lưu **ngoài root dự án**, ví dụ `C:\My Future\DnD_Archive\`.
- Bản lưu game cá nhân, API keys, `.env`, file có thông tin bí mật.

## Quy trình cho mỗi phiên bản
1. Sửa code trong **cùng một** thư mục source; không tạo hàng loạt `DnD_v0.4`, `DnD_v0.5` lẫn trong root.
2. Cập nhật `docs/PROJECT_STATUS.md` theo trạng thái thật và `docs/CHANGELOG.md` với thay đổi.
3. Test/build, ghi lại lệnh đã chạy và lỗi thực tế.
4. Tạo bản phát hành ZIP **bên ngoài** dự án nếu cần chia sẻ.
5. Git commit cho mỗi cột mốc; muốn quay lại bản cũ thì dùng Git, không ghi đè ngẫu nhiên ZIP.

## Dữ liệu campaign
`localStorage` trong trình duyệt **không nằm trong thư mục source**. Nếu cần di chuyển, export save JSON trong Cài đặt rồi lưu riêng.

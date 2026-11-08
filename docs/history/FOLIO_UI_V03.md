# Emberkeep · The Adventurer's Folio (v0.3 UI)

## Định hướng
Giao diện D&D được thiết kế như cuốn biên niên sử trên bàn chơi tabletop fantasy, **không** phải bản sao ChatGPT. Giữ cách tương tác bằng hội thoại, nhưng dùng ngôn ngữ thị giác của giấy da, bàn gỗ, ấn sáp, đồng cổ và hầm ngục.

- Sidebar: bảng nhân vật, HP, cấp độ, túi đồ, xúc xắc, hồ sơ và cửa hàng.
- Trung tâm: trang sách dành cho phần kể chuyện của Dungeon Master. Lời GM là đoạn văn; hành động của người chơi là ghi chú của nhà phiêu lưu; kết quả engine là ghi chú bên lề.
- Các lựa chọn tương tác có hình thức ghi chú trong sách, và ô nhập hành động là bàn viết ở đáy màn hình.
- Dùng font hệ thống có hỗ trợ tiếng Việt (Georgia / Segoe UI), không phụ thuộc tải font hay ảnh qua mạng. Không ép chữ tiếng Việt vào kiểu chữ hoa siêu hẹp.
- Minh họa `/public/cellar-scene.svg` do code SVG tạo ra; sử dụng offline.

## Không thay đổi
- Engine, character state, XP, level, vàng, inventory, thương mại, event log, checksum và save/load từ v0.2.
- MockDM vẫn là MockDM. Nhập hành động tự do được ghi lại nhưng **chưa** được AI diễn giải thành tác động game tự động.
- Không có Gemini API hoặc multiplayer thật trong bản này.

## Xác minh
- TypeScript `tsc -b`: thành công trên bộ source đã sửa.
- Chưa thể xác minh Vite/Vitest build trong môi trường thực hiện: các native package đã cài thuộc Windows, môi trường hiện tại là Linux và npm registry không hoàn tất download.
- Khi cập nhật trên Windows: chạy `npm test`, `npm run build`, `npm run dev` và kiểm tra UI trên màn hình của bạn.

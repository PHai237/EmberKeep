# Quy tắc phát triển an toàn — Emberkeep

**Ưu tiên cao nhất: giữ máy Windows ổn định.** Máy của người dùng từng nhiều lần tự reset; Docker Desktop có liên hệ về thời điểm với các lần hệ thống bị treo, nhưng chưa xác định nguyên nhân gốc.

## Cấm tuyệt đối trong workflow dự án này
- Không khởi chạy Docker Desktop, `docker`, Docker Compose, container, WSL2, Hyper-V, VM, Supabase local stack hoặc `supabase start`/`supabase db reset`/`supabase functions serve`.
- Không chạy stress test, benchmark, parallel build hoặc dịch vụ nền cục bộ.
- Không tự cài package, tự bật billing, tự tạo dịch vụ đám mây hoặc nâng cấp dependency.
- Không tự dùng Codex. Nếu có agent khác, không được tự chạy lệnh trên máy chủ sở hữu khi chưa được chủ sở hữu chấp thuận.

## Phát triển tiếp
- Chỉ sửa từng phần nhỏ; giữ nguyên code và dữ liệu người chơi nếu không cần đổi.
- Bất cứ thao tác có thể làm mất file/lưu game đều phải sao lưu trước.
- Multiplayer thật dùng dịch vụ cloud Free Tier **chỉ khi chủ sở hữu chủ động tạo và chấp thuận**. Không có cloud credentials thì giữ offline mode.
- Kiểm thử ban đầu nên thực hiện ở môi trường cô lập khác, không ép máy người dùng chạy tác vụ nặng.
- `npm run dev`, `npm test`, `npm run build` cũng chỉ chạy trên máy chủ sở hữu khi họ chủ động quyết định; không tự chạy trong nền.

## Tình trạng kỹ thuật (2026-11-08)
- Version `0.6.0`, bản bàn giao này chỉ sửa hướng dẫn an toàn và loại các thư mục sinh ra khỏi ZIP.
- Offline + MockDM là chế độ chạy được theo báo cáo Phase 2A.
- Supabase multiplayer đã có code/migration nhưng **chưa được xác thực runtime với PostgreSQL/cloud**, không được tuyên bố là đã chơi online được.
- Không có AI DM thật.

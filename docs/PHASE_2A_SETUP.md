# Phase 2A — Cấu hình Multiplayer (cloud-only, không Docker)

> **DỪNG chạy local Supabase.** Máy của chủ sở hữu đã gặp sự cố khi Docker/WSL stack khởi động. Tuyệt đối không thực hiện `supabase start`, `supabase db reset`, `supabase functions serve`, Docker Desktop hoặc WSL2 trong dự án này.

## Trạng thái hiện tại

- Offline: không cần môi trường Supabase, giữ `localStorage` và MockDM.
- Multiplayer: **mới có source** cho Supabase Auth / PostgreSQL / Realtime / Edge Function; chưa kiểm tra live database hoặc hai thiết bị thật.
- Không yêu cầu bật billing, không thêm thẻ hoặc nạp tiền.

## Nếu về sau chủ sở hữu tự quyết định bật cloud Free Tier

1. Chủ sở hữu **tự** tạo dự án Supabase Cloud Free trên web, xác minh hạn mức và điều kiện sử dụng. Không để agent tự tạo tài khoản hoặc kích hoạt thanh toán.
2. Áp dụng migration `supabase/migrations/202611080001_phase_2a_multiplayer.sql` lên dự án cloud **sau khi review SQL và RLS**.
3. Deploy Edge Function `game-api` lên Supabase Cloud chỉ sau khi có xác nhận riêng. Bước này chưa được kiểm nghiệm runtime.
4. Cấu hình **chỉ hai biến public** trong `.env.local`: `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`. Tuyệt đối không đưa service role key hoặc database password vào biến `VITE_` hay frontend.
5. Kiểm tra auth, RLS, room ownership, concurrency, rate limits và tự phục hồi **trên cloud** trước khi cho hai người chơi sử dụng.

**Không có project cloud thì không làm các bước trên.** Không được biến việc kiểm thử local thành lý do kích hoạt Docker.

## Giữ dữ liệu

Trước mọi thay đổi import/persistence: Export save JSON từ Settings. Trong multiplayer, client chỉ được export snapshot, không được ghi thẳng state từ file JSON vào server.

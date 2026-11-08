# Phase 1 Implementation Report

Ngày xác minh: **2026-11-08**  
Phạm vi: offline deterministic vertical slice, hai nhân vật trên cùng trình duyệt, chỉ dùng MockDM.

## Tính năng hoàn thành

- Giao diện React responsive cho hai PC, scene, mục tiêu, action controls và event log.
- Tạo/chỉnh sửa/lưu các trường character sheet cơ bản; stats cơ chế mẫu do engine quản lý.
- `DMProvider` interface và `MockDM` offline, chỉ kể lại event đã commit.
- Command handler xác thực controller, expected version, idempotency, precondition và action economy.
- State gồm HP, AC, inventory, vị trí, NPC, quest và combat turn.
- Dice d4/d6/d8/d10/d12/d20/d100; RNG inject được để test deterministic.
- Investigation check, modifier/proficiency, DC, attack roll, natural 1/20, damage và HP bounds.
- Append-only event log, reducer/replay và clone boundary chống sửa dữ liệu bằng reference.
- Tự lưu `localStorage`; export/import JSON có schema version, checksum và full replay validation.
- Nhiệm vụ “Hai Người, Một Ngọn Đèn”: Sera, hầm rượu, rương/chìa khóa, Chuột Tro, combat và lối thoát.
- Inventory pickup/drop; unique item conflict và retry idempotency.

## Cấu trúc thư mục

```text
src/
├── domain/
│   ├── engine.ts          # validate command, roll, commit events
│   ├── fixtures.ts        # campaign mẫu
│   ├── reducer.ts         # pure event fold/replay
│   ├── types.ts           # domain contracts
│   └── engine.test.ts
├── rules/
│   ├── dice.ts            # injectable RNG
│   ├── srd.ts             # modifier/check/attack/damage rules
│   └── dice.test.ts
├── dm/                    # DMProvider + MockDM
├── persistence/           # storage + tests
├── test/helpers.ts
├── ui/App.tsx
├── ui/styles.css
└── main.tsx
```

## Kiểm thử đã chạy

- `npm install`: cài 87 packages, audit 88 packages, **0 vulnerabilities**.
- `npm test`: **3 files passed, 23 tests passed**.
- `npm run build`: TypeScript check và Vite production build **thành công**; bundle chính khoảng 243.71 kB (77.08 kB gzip).

Test bao phủ dice/modifier, damage/HP bounds, ownership, immutable dice, unique pickup/idempotency/concurrency, inventory add/drop, turn order/action economy, NPC death continuity, invalid action, immutable returned data, save/load/checksum/replay, và 60 hành động hai người với reload ở giữa.

Lần build đầu phát hiện lỗi type trong test helper và cấu hình TypeScript; đã sửa, chạy lại test, rồi build thành công. Không tính lần lỗi là pass.

## Đối chiếu acceptance tests

Đã tự động hóa trong Phase 1: player agency/ownership (1–2), immutable dice (3), HP bounds (4), inventory idempotency (5), simulated concurrent pickup (6), action economy (7), NPC death continuity (9), source-of-truth thắng false summary (12), item causality (13), save/load replay equivalence (14), và 50+ action simulation.

Hoãn đúng phạm vi:

- Private clue filtering giữa hai browser, campaign isolation qua database/RLS và HTTP 403 thật: cần Phase 3.
- Spell validation: Phase 1 chưa có spell system.
- Gemini timeout/quota: chưa gọi Gemini; adapter đã tách cho Phase 2.
- Prose rubric (no cheerleading, distinct voice, casual session): cần manual grading ở Phase 2; không dùng regex để tuyên bố chất lượng văn xuôi.

## Giả định và giới hạn

- “Server-authoritative” được mô phỏng bằng domain authority offline. Trình duyệt vẫn không phải trust boundary; checksum phát hiện thay đổi nhưng không phải chữ ký mật mã.
- Initiative mẫu là thứ tự deterministic Aria → Borin → Chuột Tro để dễ học và test ổn định.
- Character creation là chỉnh sheet mẫu, chưa phải builder SRD đầy đủ.
- Không có backend, auth, network multiplayer, Gemini, paid API, billing hoặc secret.
- Không đọc, import hay chỉnh sửa dự án Story gốc.

## Kiểm tra an toàn

- Không thêm API key, token, webhook hoặc `.env`.
- MockDM không trực tiếp mutate state.
- HP, inventory, dice, ownership, version và turn đều được engine xác thực trước commit.

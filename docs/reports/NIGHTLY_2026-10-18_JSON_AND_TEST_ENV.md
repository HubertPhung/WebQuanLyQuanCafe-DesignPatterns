# Nightly 2026-10-18: JSON input và môi trường test

## Phạm vi

Khảo sát README, kiến trúc, tài liệu kiểm thử, CI, cấu hình Maven/Next.js và Git status trên nhánh `feature/hoai-bo`. Working tree có nhiều thay đổi sẵn và tiếp tục thay đổi song song trong phiên. Chỉ sửa các file trước đó sạch: `Json.java`, `scripts/test-ui-ux.mjs`; thêm hai lớp test và báo cáo này. Không commit, push, deploy hay sửa schema/cấu hình production.

## Kết quả

1. Bộ đọc JSON trước đây chấp nhận số sai cú pháp (`+1`, `01`, `.5`, `1.`), khoảng trắng ngoài cú pháp JSON và escape Unicode không phải bốn chữ số hex ASCII. Bổ sung kiểm tra trước khi chuyển đổi; vẫn giữ kiểu số Double và giới hạn số hữu hạn hiện có.
2. Thêm 32 test parser và 6 test qua HTTP thật trên cổng tạm. Trước sửa, 14 trường hợp test parser thất bại vì dữ liệu sai được chấp nhận; sau sửa cả 38 đạt. JSON sai trả `400 INVALID_INPUT`; dữ liệu hợp lệ giữ nguyên response envelope.
3. Runner UI không nạp `.env.local` nên ký cookie bằng khóa dev khi server dùng khóa riêng, gây lỗi giỏ hàng/phân quyền và chuyển hướng tới login. Runner nay nạp file nếu tồn tại, không ghi đè biến môi trường đã được truyền vào. Không đưa giá trị cấu hình hoặc bí mật vào diff/log.

## Kiểm chứng thực tế

| Lệnh | Kết quả |
| --- | --- |
| `mvn -q test` | 300 test đạt, 0 failure/error/skipped; gồm PostgreSQL nhúng |
| `npm test` | 40/40 đạt sau sửa runner; trước sửa 24/37 đạt do cookie không hợp lệ |
| `npm run test:table-delivery` | Đạt |
| `npx tsc --noEmit` | Đạt ở lần kiểm tra cuối |
| `npm run build` | Đạt, gồm TypeScript và sinh trang |
| `git diff --check` trên các file sửa | Đạt |

Môi trường: Windows, Node 24.21.0. PostgreSQL nhúng không khởi động trong sandbox; chạy lại ngoài sandbox đạt. Build cũng cần chạy ngoài sandbox sau lỗi `spawn EPERM`. Lần kiểm tra TypeScript đầu báo lỗi trong dashboard đang được chỉnh song song; lỗi không còn ở lần kiểm tra cuối, không thuộc bản sửa này.

UI suite dùng server local đang chạy tại cổng 3000; kết quả phản ánh working tree đang thay đổi, không phải một snapshot commit cố định. Các test Server Action thao tác dữ liệu mock theo thiết kế của suite. Không có script lint riêng trong package.json. Runner dùng API `loadEnvFile` của Node, có trên Node 22 dùng trong CI (yêu cầu tối thiểu API này: Node 20.12).

Các thay đổi bàn, giao hàng, tài khoản và đơn online có sẵn được giữ nguyên; không nhận chúng là kết quả phiên này. Dừng mở rộng phạm vi sau khi hai lỗi độc lập đã được xác minh để tránh xung đột với công việc song song.

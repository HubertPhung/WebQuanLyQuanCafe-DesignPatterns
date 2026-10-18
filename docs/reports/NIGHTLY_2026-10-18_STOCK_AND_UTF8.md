# Nightly 2026-10-18: cập nhật kho và UTF-8

## Phạm vi và ưu tiên

Đã đọc README, kiến trúc, hướng dẫn agent frontend, tài liệu kiểm thử, Maven/package.json và CI. Repository đang ở `feature/hoai-bo`, có nhiều thay đổi sẵn. Chỉ sửa bốn file tracked ban đầu sạch và thêm `Utf8RequestTest.java` cùng báo cáo này; giữ nguyên các thay đổi trước phiên. Làm việc trong workspace được cấp; không dùng các worktree khác không được cấp cho phiên này. Không commit, push, PR, deploy, sửa schema hoặc cấu hình production.

Ưu tiên: lỗi làm thay đổi tồn kho khi request bị từ chối; lỗi âm thầm biến đổi dữ liệu request; sau đó là test đồng thời không ổn định được phát hiện khi chạy toàn bộ suite. Giữ phạm vi nhỏ vì working tree đang có nhiều công việc khác.

## Thay đổi và bằng chứng

1. `MenuHandler`: kiểm tra kiểu `inStock` trước khi ghi kho. Trước sửa, request cộng/trừ/đặt số lượng kèm `inStock` sai kiểu trả 400 nhưng vẫn đổi kho từ 10 thành 13/7/4. Cả ba test HTTP mới thất bại trước sửa, đạt sau sửa; vẫn kiểm tra trạng thái bán không bị thay đổi.
2. `ApiHandler`: giải mã UTF-8 nghiêm ngặt, trả `400 INVALID_INPUT` khi byte lỗi thay vì thay bằng ký tự U+FFFD rồi tiếp tục xử lý. Năm test HTTP byte lỗi đều nhận 200 trước sửa, nhận 400 sau sửa. Test riêng xác minh tiếng Việt, emoji và ký tự U+FFFD được mã hóa hợp lệ vẫn giữ nguyên; response envelope không đổi.
3. `ReservationHandlerTest`: test cũ giả định request đầu tiên luôn thắng. Handler hiện quét phiếu hết hạn trước bước tạo đơn, nên request thứ hai có thể tới khóa tạo phiếu trước. Kiểm tra lại đúng bất biến: hai response gồm đúng một 201 và một 400, response bị từ chối có `CHAIN_VALIDATION_FAILED`, chỉ một phiếu được lưu. Không thay đổi code đặt bàn hay bỏ kiểm tra chống đặt trùng.

## Kiểm chứng thực tế

| Lệnh | Kết quả cuối |
| --- | --- |
| `mvn -q '-Dtest=MenuHandlerTest,Utf8RequestTest,ReservationHandlerTest' test` | 13 test đạt |
| `mvn -B test` | BUILD SUCCESS; 314 test, 0 failure/error/skipped, gồm PostgreSQL nhúng |
| `npm test` | 40/40 đạt trên server local đang chạy ở cổng 3000 |
| `npx tsc --noEmit` | Đạt |
| `npm run build` | Đạt, TypeScript và sinh trang hoàn tất |
| `git diff --check` | Đạt; có cảnh báo LF/CRLF của Git |

PostgreSQL nhúng bị connection refused trong sandbox; chạy ngoài sandbox khởi động được. Build Next.js bị `spawn EPERM` sau bước compile trong sandbox; chạy ngoài sandbox đạt. Một lần chuyển hướng log Maven bằng PowerShell báo `NativeCommandError` dù XML ghi toàn bộ test đạt; lần chạy trực tiếp `mvn -B test` xác nhận BUILD SUCCESS. Các log kiểm tra lỗi khóa ngoại/observer là ca kiểm thử cố ý, không phải test thất bại.

Không có script lint được cấu hình. Không chạy E2E cần cơ sở dữ liệu dùng chung; test HTTP mới dùng server cổng tạm và kho in-memory, JDBC suite dùng PostgreSQL nhúng. UI suite dùng server có sẵn nên kết quả phản ánh working tree hiện tại, không phải snapshot commit cố định. Frontend và các thay đổi có sẵn không phải sản phẩm của phiên này.

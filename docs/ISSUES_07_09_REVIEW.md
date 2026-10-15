# Review và kết quả triển khai issue #7, #9

Ngày kiểm chứng: 15/10/2026. Phạm vi: kiến trúc backend và model, DAO, Singleton, Builder liên quan đến hai issue.

## Kết quả review

- `backend-java/src/main/java/com/dalatcafe/model/Reservation.java:116` — [core-fail-fast] Setter chuyển số khách dưới 1 thành 1. Giữ tương thích theo kế hoạch; Chain chỉ có thể kiểm định giá trị còn trong model. Có test cho cả constructor nhận 0 và setter chuyển 0 thành 1.
- `backend-java/src/main/java/com/dalatcafe/model/Reservation.java:162` — [core-encapsulation] Equality dùng phép OR giữa ID và mã; hai bản ghi có ID null có thể bị coi là bằng nhau. Chain tránh dùng equality này và chỉ loại bản ghi đang sửa bằng ID khác null. Chưa sửa hợp đồng equality của model trong hai issue này.
- Tài liệu thiết kế cũ dùng thuật toán giảm theo bậc giá trị đơn, tên handler khác và điều kiện đặt trước 60 phút. Đã cập nhật phần Strategy/Chain và mô tả API để theo hợp đồng issue #7/#9.
- DAO và Singleton hiện có đủ interface cho hai pattern. Dependency được truyền vào Chain qua interface; không bổ sung framework hoặc thay đổi schema.

## Hành vi đã triển khai

- Strategy: bốn thuật toán, đổi strategy lúc chạy, kiểm tra số hữu hạn không âm và giới hạn tiền giảm trong subtotal. CustomerRank là nguồn tỷ lệ giảm theo hạng.
- Chain: giờ Việt Nam và cấu hình Singleton → số khách/số ghế → khoảng lịch 2 giờ. Fail-fast, trả lý do tiếng Việt; không ghi dữ liệu và không che lỗi DAO.
- Hai lịch cùng bàn giao nhau trong khoảng nửa mở bị từ chối; lịch nối tiếp được phép. PENDING/CONFIRMED/SEATED giữ lịch; CANCELLED giải phóng lịch.

## Kiểm chứng

- Bộ test hiện có, không chạy StrategyTest: 88 passed.
- Nhánh `feature/issue-07-discount-strategy`: 100 passed, gồm 12 lượt test Strategy mới.
- Nhánh `feature/issue-09-reservation-chain`: 117 passed, gồm 29 lượt test Chain mới.
- Nhánh tổng hợp `review/issues-07-09`: 129 passed, 0 failures, 0 errors, 0 skipped.
- Lệnh kiểm chứng tổng hợp: `mvn --batch-mode -Dmaven.compiler.release=17 clean test`.
- Môi trường: Maven 3.9.9 tải từ Maven Central vào thư mục tạm; JDK 21.0.8 đi kèm Android Studio. Compile dùng release 17; test runtime là JDK 21. Không thay đổi PATH hệ thống.
- Không có cấu hình database live; bộ DAO test dùng in-memory/fallback. Không chạy frontend vì không thay đổi frontend.

## Giới hạn tích hợp

- Kiểm tra rồi lưu chưa nguyên tử; lớp lưu đặt bàn phải ngăn hai yêu cầu đồng thời chiếm cùng lịch.
- Mọi lịch dùng cùng duration truyền cho validator, mặc định 2 giờ; model chưa lưu thời lượng từng lịch.
- Chỉ kiểm tra giờ bắt đầu; không thêm thời gian đặt trước hoặc điều kiện kết thúc trước giờ đóng cửa.
- Chưa tích hợp HTTP handler, Facade hoặc tra cứu voucher. Chưa push, tạo PR, merge master hay đóng issue trên GitHub.

# Quản lý bàn và giao hàng

## Bàn trong admin

Tại `/admin/tables`, MANAGER và ADMIN có thể thêm, sửa, xóa bàn; nhập tên, số chỗ (1–100), khu vực và ảnh. Có thể chọn khu vực đã có hoặc nhập tên khu vực mới trực tiếp trong form bàn.

Ảnh nhận URL HTTP/HTTPS hoặc tải JPG, PNG, WebP tối đa 2 MB. Có xem trước và gỡ ảnh. File tải lên nằm ở `frontend-nextjs/.data/table-images`; cần lưu thư mục này trên ổ đĩa bền vững khi triển khai. File không được đưa vào Git. Gỡ ảnh khỏi bàn không xóa file vật lý.

Thao tác bàn ưu tiên Java; tải lại trang vẫn giữ dữ liệu và ảnh khi dùng JDBC. Khi Java tắt hoặc không truy cập được, thao tác dùng đúng kho dự phòng mà danh sách bàn đang đọc: PostgreSQL `admin_tables` nếu đã cấu hình, hoặc mock store trong bộ nhớ nếu chưa có database. Lỗi từ chối nghiệp vụ/quyền truy cập của Java vẫn được trả về, không chuyển sang kho dự phòng. PostgreSQL tự bổ sung cột `admin_tables.image_url`; không xóa dữ liệu cũ.

Form thêm/sửa hỗ trợ kéo thả hoặc chọn một ảnh JPG, PNG, WebP tối đa 2 MB; xem trước và gỡ ảnh. Trong sơ đồ bàn và dashboard, thẻ bàn có dạng chữ nhật ngang, dùng ảnh làm nền toàn bộ thẻ với lớp sáng để giữ chữ dễ đọc. Lỗi lưu/xóa hiển thị ngay trong hộp thoại.

Khởi động lại backend Java sau khi cập nhật code. Cơ chế nâng cấp schema hiện có tự thêm cột nullable `tables.image_url`, `tables.deleted_at`; kho frontend thêm `admin_tables.deleted_at`. Không xóa dữ liệu cũ, chưa áp migration vào database production trong phiên này.

Xóa bàn là xóa mềm: bàn biến mất khỏi sơ đồ, POS và danh sách đặt mới; dòng dữ liệu, hóa đơn và lịch đặt cũ được giữ nguyên. Bàn có lịch sử hoàn tất/đã hủy vẫn xóa được. Chặn xóa khi bàn đang có khách/giữ chỗ, còn đơn chưa hoàn tất/chưa thanh toán hoặc lịch đặt đang chờ/đã xác nhận, kể cả bàn phụ trong nhóm. Mã bàn đã xóa không được tái sử dụng. Không giảm tổng sức chứa nhóm bàn dưới số khách đang ngồi hoặc đã đặt. STAFF vẫn đổi trạng thái bàn như trước nhưng không có quyền CRUD thông tin bàn.

API mới: `POST /api/tables`, `PUT /api/tables/{id}/details`, `DELETE /api/tables/{id}`. Body thêm/sửa: `{ name, seats, zone, imageUrl }`, `imageUrl: null` để gỡ ảnh. `GET /api/tables` trả thêm `imageUrl`.

## Giao hàng

- Giao trong Đà Lạt: phí cố định **10.000đ**, cộng sau giảm giá và VAT của món.
- Tự đến lấy: không thu phí giao hàng.
- Server nhận diện Đà Lạt ở bất kỳ vị trí nào trong địa chỉ, không phân biệt hoa thường hoặc dấu; chấp nhận `Da Lat`, `Dalat`, `ĐL`, `Đ.L.`. Ví dụ hợp lệ: `Số 07, An Sơn, Phường Xuân Hương - Đà Lạt, Lâm Đồng`. Ngoài khu vực, khách chọn tự đến lấy.
- Kiểm tra dựa trên địa chỉ người dùng nhập, chưa tích hợp geocoding để xác minh tọa độ thực tế.
- Phí áp dụng cho COD, QR, thẻ và đơn delivery ở POS, kể cả fallback cục bộ. Java tính phí trước khi thanh toán, frontend lưu đúng tổng từ biên nhận Java.

## Đặt bàn và thanh toán gộp

- Bảng đặt bàn mở sát mép phải, giữ nguyên nút mở. Một hộp chọn chứa các giờ từ 07:00 đến 22:00, cách nhau 30 phút theo giờ Việt Nam.
- Một lịch đặt chọn tối đa 10 bàn; kiểm tra tổng sức chứa và lịch trùng trên từng bàn. Danh sách bàn lấy từ hệ thống quản lý, không cố định trong giao diện.
- Sau giờ hẹn 15 phút, lịch chưa đón khách tự hủy; lịch đã chuyển sang POS không bị hủy. Backend kiểm tra mỗi 30 giây và khi nhận yêu cầu đặt bàn. Môi trường mock kiểm tra khi đọc/thay đổi dữ liệu.
- POS cho chọn nhiều bàn thanh toán một lần, gồm toàn bộ đơn chưa trả tiền của các bàn được chọn. Phải chọn đủ bàn thuộc cùng một nhóm đặt; kiểm tra tổng tiền và tiền mặt trước khi thu. Các phiếu bếp được giữ riêng, không nhân đôi món.
- JDBC tự bổ sung `table_ids` cho đơn và lịch đặt; frontend bổ sung cột tương ứng khi truy cập dữ liệu đơn.

## Voucher và điểm

- `WELCOME10` giảm 10% cho đơn online đầu tiên của tài khoản. Đơn đầu không dùng mã cũng kết thúc quyền ưu đãi; đổi số điện thoại không khôi phục quyền. Đơn thất bại trước khi ghi nhận/thanh toán có thể thử lại. Khóa đồng thời và dấu ghi nhận trong PostgreSQL ngăn dùng lặp qua nhiều tiến trình; dấu được giữ khi tiến trình bị ngắt giữa giao dịch để tránh cấp trùng.
- Theo cấu hình mặc định, mỗi 10.000đ thực trả được 1 điểm (làm tròn xuống); mỗi điểm đổi 1.000đ. Tổng thực trả gồm VAT và phí ship.

## Kiểm thử

- Backend: `cd backend-java` rồi `mvn -B test`.
- Frontend: `npm run test:table-delivery` và `npx tsc --noEmit --incremental false`.
- Đặt bàn: `npx tsx scripts/test-reservation-groups.ts` kiểm tra khung giờ, sức chứa, trùng bàn phụ, mốc hủy 15 phút, bảo vệ lịch đã đón khách và thanh toán gộp.
- Voucher: `npm run test:first-order` (môi trường kiểm thử riêng).
- `node scripts/test-table-delivery-http.mjs --browser --ui`: ngoài kiểm tra HTTP/UI, chạy Chrome headless đã cài sẵn (có thể chỉ định `CHROME_PATH`) để bấm thêm/sửa/xóa, kéo thả ảnh sai/đúng, kiểm tra ảnh tải được, kích thước thẻ ngang và dữ liệu sau tải lại. Ảnh chụp kiểm thử ở `.data/table-card-browser.png`.
- `node --conditions=react-server --import tsx scripts/test-table-database.ts`: chỉ chạy trên PostgreSQL local cô lập, trống; kiểm tra CRUD, lưu ảnh, chống trùng tên/mã khi thêm đồng thời xóa mềm giữ lịch sử và bảo vệ bàn phụ còn đơn chưa xử lý. Không chạy script này trên database đang sử dụng.
- Build: `npm run build`.
- Sau build: `node scripts/test-table-delivery-http.mjs --ui` chạy HTTP trên cổng 3117 với database tắt và Java off, kiểm tra upload/quyền truy cập, Server Actions CRUD, dữ liệu sau tải lại, phí COD và địa chỉ ngoài Đà Lạt; đồng thời chạy bộ UI/UX hiện có.

Kết quả chạy ngày 18/10/2026: backend 317 bài đạt, frontend build và TypeScript đạt, các script kiểm thử trên đạt, UI/UX 40/40. HTTP còn kiểm tra ví dụ địa chỉ An Sơn, voucher lần đầu/thử lại/đồng thời, đặt nhiều bàn và chuyển POS, chặn thanh toán thiếu bàn/thiếu tiền/thu lại. Kiểm thử JDBC và repository bàn dùng PostgreSQL riêng; HTTP frontend dùng kho mock. Đợt sửa thẻ bàn có thêm kiểm thử click/kéo thả thực tế trên Chrome. Chưa thu tiền ngân hàng thật. Không áp dụng thay đổi lên dữ liệu production.

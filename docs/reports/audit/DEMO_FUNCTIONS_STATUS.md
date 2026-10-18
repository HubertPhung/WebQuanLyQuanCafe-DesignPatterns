# Rà soát các chức năng từng gắn nhãn demo

Ngày 18/10/2026. Gỡ nhãn khỏi giao diện theo yêu cầu; trạng thái triển khai thực tế được ghi dưới đây.

| Nhóm | Kết quả kiểm tra và thay đổi |
| --- | --- |
| Bàn, ảnh bàn | Có Server Actions, API Java và lưu JDBC; bộ HTTP kiểm tra thêm/sửa/xóa, upload/gỡ ảnh, tải lại trang và quyền truy cập. |
| Thêm khu vực | Trước đây chỉ thêm vào state rồi báo thành công. Nay mở bước thêm bàn đầu tiên vào khu vực; khu vực được lưu cùng bàn. |
| Dashboard: tiền, món bán chạy, kho, đặt bàn | Trước đây dùng số liệu và khách hàng cố định, một số nút chỉ hiện toast. Nay tổng hợp đơn đã thanh toán 7 ngày từ kho frontend, tồn kho từ menu và phiếu đặt bàn từ truy vấn hiện có. Kho và đón khách dẫn đến trang thao tác thật. Không tạo giao dịch hoặc biên bản giả. |
| Dashboard: đổi trạng thái | Chỉ cập nhật giao diện khi Server Action thành công; bàn một chỗ không còn gửi mặc định hai khách; giữ thời điểm bắt đầu ngồi khi vẫn occupied. Làm mới dữ liệu khi server cập nhật. |
| Báo cáo | Mở hộp thoại in trình duyệt với số liệu hiện có; không còn tuyên bố đã chốt ca, đồng bộ kho hoặc đã gửi máy in nhiệt. Chưa có nghiệp vụ đóng ca, kiểm kê két và lưu Z-Report. |
| Nhân sự | Thêm, sửa, khóa, tìm kiếm chỉ hoạt động trong state của trang. Chưa có backend hồ sơ/lương; tải lại sẽ mất thay đổi. Gỡ ô mật khẩu/PIN không được sử dụng để tránh hiểu nhầm là tạo tài khoản thật. Tài khoản thật vẫn quản lý ở `/admin/users`. |
| Lịch ca | Thêm, xóa, đánh dấu hoàn thành/vắng chỉ hoạt động trong state của trang. Sửa bộ lọc tháng/năm và KPI theo tháng, dùng UUID để tránh mã trùng. Chưa lưu database, chưa có chấm công thực tế. |
| QR/thẻ | Gỡ các nhãn Demo, đổi tên nút thành Xem QR/Xem thẻ. Luồng tạo đơn có kiểm thử HTTP nhưng chưa tích hợp xác minh giao dịch ngân hàng hoặc cổng thẻ. Giữ mô tả trung thực về giới hạn này, bỏ tuyên bố đang xác thực 3D-Secure. |
| Storefront cũ | Nút checkout khi không có Shopify URL nay dẫn tới `/checkout`, không còn báo hoàn tất giả. |

Không thay đổi schema hoặc dữ liệu production trong đợt rà soát này. Không bổ sung backend nhân sự/lịch ca hoặc dịch vụ thanh toán ngoài phạm vi kiểm tra và gỡ nhãn.

## Kiểm thử thực tế

- `npm run build`: đạt, gồm kiểm tra TypeScript.
- `npx --no-install tsx scripts/test-demo-audit.ts`: đạt; kiểm tra tháng/năm, tháng có/không có số 0 phía trước và chuỗi sai định dạng.
- `npm run test:table-delivery`: đạt.
- `node scripts/test-table-delivery-http.mjs --ui`: đạt. Kiểm tra HTTP các trang `/admin`, `/admin/tables`, `/admin/staff`, `/admin/schedule`, `/checkout` không còn tag demo; dashboard không còn doanh thu cố định; kiểm tra CRUD, ảnh, địa chỉ và phí giao hàng; bộ UI/UX hiện có đạt **40/40**.
- Server test tách riêng, `DATABASE_URL` rỗng và `JAVA_BACKEND_URL=off`; không ghi dữ liệu production.
- Chưa kiểm thử thao tác click trong trình duyệt thật hoặc máy in vật lý. Nhân sự/lịch ca được rà mã nguồn và kiểm tra trang, chưa có test UI tương tác cho toàn bộ form.

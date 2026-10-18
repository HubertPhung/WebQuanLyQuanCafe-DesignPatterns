# Rà soát chức năng: phần chưa hoàn thành và mâu thuẫn

- Ngày: 2026-10-18, nhánh `feature/hoai-bo`, sau khi áp phiên 6 (bảo mật).
- Cách làm: đọc code (route Java, server action, trang Next.js), đối chiếu dữ liệu thật trên Supabase, chạy `mvn -B clean test` (256/256) và `npm test` chế độ CI (40/40).
- Báo cáo chỉ liệt kê. Chưa sửa mục nào dưới đây.

## 1. Chức năng chưa hoàn thành

### 1.1. Trang khách hàng (`/account`)

| # | Chức năng | Hiện trạng | Bằng chứng |
| :--- | :--- | :--- | :--- |
| U1 | Lịch sử đơn của khách | Dữ liệu mẫu cứng (`#AC-0921`, `#AC-0844`, `#AC-0712`), không đọc đơn thật | `components/account/account-dashboard.tsx:178` |
| U2 | Hạng thành viên và điểm | Cứng "Hạng Vàng, 350 điểm", không lấy từ bảng `customers` | `account-dashboard.tsx:85-97` |
| U3 | Voucher của tôi | Danh sách cứng `WELCOME10`, `GOLDVIP`, `FREESHIP` | `account-dashboard.tsx:233-245` |
| U4 | Sổ địa chỉ | Dữ liệu mẫu | tab `addresses` |
| U5 | Sửa thông tin tài khoản | Nút "Lưu" chỉ hiện toast "Bản demo" | `account-dashboard.tsx:344` |
| U6 | Đặt bàn từ phía khách | Không có form đặt bàn ngoài trang quản trị | Chỉ `/admin/reservations` gọi `createReservation` |

### 1.2. Trang quản trị

| # | Chức năng | Hiện trạng |
| :--- | :--- | :--- |
| A1 | Thêm bàn, thêm/sửa/xoá khu vực | Chỉ lưu trong state trình duyệt. Java không có `POST /api/tables` |
| A2 | Trang Nhân viên (`/admin/staff`) | Mảng `initialUsers` cứng trong component, không nối bảng `users` hay `staff` |
| A3 | Lịch làm việc (`/admin/schedule`) | Dữ liệu minh hoạ, không có API |
| A4 | Bảng điều khiển: dòng tiền ca, cảnh báo kho, top món, lịch khách sắp tới, chốt ca Z-Report | Dữ liệu minh hoạ (đã gắn nhãn "Bản demo") |
| A5 | Sửa món (tên, giá, công thức) và xoá món | Java chỉ có `GET`/`POST /api/menu` và `PATCH /api/menu/{id}/stock`. Trang menu chỉ thêm món và bật/tắt bán |
| A6 | Thêm/sửa khách hàng | `GET /api/customers` chỉ đọc. Khách hàng chỉ sinh ra khi thanh toán |
| A7 | Quản lý voucher | Voucher nằm cứng trong `VoucherCatalog.java` (chỉ `WELCOME10`). Bảng `vouchers` trên Supabase không được code nào dùng |

### 1.3. Thanh toán và vận hành

| # | Chức năng | Hiện trạng |
| :--- | :--- | :--- |
| P1 | Thanh toán online VietQR / thẻ | Java giả lập (`MomoQrPaymentProcessor`, `CardPosPaymentProcessor`): đơn được ghi "đã trả" ngay, không có cổng thanh toán hay xác nhận giao dịch |
| P2 | Lưu cài đặt cửa hàng | `SystemConfigManager` chỉ giữ trong bộ nhớ. Giờ mở cửa, số khách tối đa, tỉ lệ tích/đổi điểm sửa ở `/admin/settings` sẽ mất khi Java khởi động lại |
| P3 | Giới hạn tần suất đặt đơn online | Chưa có. Ai cũng gửi được nhiều đơn COD |
| P4 | Bản tin ở footer | Form gửi tới `SHOPIFY_STORE_DOMAIN/contact`, chỉ hiện khi có biến Shopify. Dự án không còn dùng Shopify |

## 2. Mâu thuẫn giữa các chức năng đã làm

### 2.1. Nghiêm trọng (sai dữ liệu hoặc hứa điều hệ thống không làm)

| # | Mâu thuẫn | Chi tiết |
| :--- | :--- | :--- |
| C1 | Đặt đơn COD không kiểm tra số lượng tồn | Cửa hàng ẩn món khi `stockQty <= 0`, nhưng `placeOnlineOrder` và `createOrder` chỉ kiểm tra `inStock`. Khi ghi đơn, kho phía frontend bị kẹp `greatest(stock - qty, 0)` (`actions.ts:359`), nên bán vượt kho mà không báo. Java thì từ chối bán vượt (BR-11), nên đơn COD đó có thể bị Java từ chối lúc đồng bộ và nằm lại trong hàng đợi |
| C2 | Voucher hiển thị cho khách không dùng được | Tab "Voucher của tôi" mời dùng `GOLDVIP`, `FREESHIP`, nhưng Java chỉ nhận `WELCOME10` |
| C3 | Hạng thành viên sai quy tắc | Trang tài khoản ghi "tích thêm 150 điểm để lên Kim Cương, giảm 15%". Java xếp hạng theo **tổng chi tiêu** (Bạc từ 500 nghìn, Vàng từ 2 triệu, VIP từ 5 triệu; `Customer.updateRank`), không theo điểm |
| C4 | Đơn online không tích điểm | Trang đăng ký hứa "Tích điểm…", nhưng `placeOnlineOrder` gửi checkout không kèm `customerPhone` (`member = {}`), nên đơn online không cộng điểm, kể cả khi khách đã đăng nhập |
| C5 | Tổng tiền ở `/cart` khác checkout | `app/cart/page.tsx` giảm `subtotal * 0.1` không có trần. API giỏ hàng, trang checkout và Java giới hạn 50.000 đ. Đơn trên 500.000 đ hiện tổng sai ở `/cart` |
| C6 | Đặt bàn khi Java tắt bị mất | Khi Java không trả lời, phiếu đặt bàn vào mock store trong bộ nhớ, kể cả khi đã có `DATABASE_URL`. Phiếu không được ghi xuống Supabase và không có hàng đợi đồng bộ như đơn hàng, nên mất khi Next.js khởi động lại |

### 2.2. Trung bình (giao diện nói khác code)

| # | Mâu thuẫn | Chi tiết |
| :--- | :--- | :--- |
| C7 | Hai trang quản lý tài khoản | "Nhân viên – Tài khoản & người dùng" (`/admin/staff`, dữ liệu giả) và "Tài khoản & phân quyền" (`/admin/users`, thật) cùng nằm trên sidebar. Thêm nhân viên ở trang đầu không tạo tài khoản đăng nhập |
| C8 | Nhãn "Bản demo" đi kèm toast "thành công" | Ví dụ "Đã thêm Bàn …", "Đã hoàn tất chốt ca sáng! Báo cáo Z-Report #SHIFT-041 đã gửi…" (`dashboard-operational-view.tsx:677-952`, `floor-plan.tsx:94,110`). Người dùng tưởng thao tác đã lưu |
| C9 | Ba trang không có lối vào | `/admin/customers`, `/admin/analytics`, `/admin/settings` chỉ được link trong một khối `sr-only` của sidebar (`admin-sidebar.tsx:156`). Người dùng không thấy, nên cài đặt giờ mở cửa và thống kê gần như không dùng được |
| C10 | Giờ mở cửa khi Java tắt | Đặt bàn dự phòng dùng giờ mặc định `DEFAULT_OPENING_TIME` / `DEFAULT_CLOSING_TIME`, không dùng giờ admin đã lưu |
| C11 | Hai bảng không dùng | Supabase có `staff` và `vouchers` (0 dòng), không DAO hay query nào đọc. Đã giữ theo yêu cầu, nhưng nên ghi rõ là dự phòng |

### 2.3. Kiểm thử và mã thừa

| # | Vấn đề | Chi tiết |
| :--- | :--- | :--- |
| T1 | Test UI dựa vào chữ ẩn | Một số component có khối `sr-only` chứa chuỗi tiếng Anh chỉ để test UI tìm thấy, ví dụ "Patio", "Table 1", "Cost", "Point of sale" (`floor-plan.tsx:139`, `inventory-table.tsx:326`, `pos-terminal.tsx:203`). "Cost" và "Patio" không còn trên giao diện thật. Test xanh nhưng không kiểm tra giao diện người dùng thấy |
| T2 | `TC-ACT-*` chỉ kiểm mock store | Nhóm test hành động quản trị gọi hàm của `mock-store.ts`, không đi qua server action hay Supabase. Luồng thật chỉ được kiểm bởi `npm run test:e2e` (chạy tay) |
| T3 | Mã Shopify còn sót | `components/storefront.tsx` không được import ở đâu. `lib/shopify.ts` vẫn giữ nhánh gọi Shopify Storefront API |

## 3. Đề xuất thứ tự xử lý

1. C1 (bán vượt kho), C6 (mất phiếu đặt bàn), C5 (tổng tiền sai): lỗi dữ liệu, sửa nhỏ.
2. C9: đưa ba trang ẩn lên sidebar theo vai trò.
3. C2, C3, U1–U3: nối trang tài khoản với `customers`, `orders` và `VoucherCatalog`, hoặc gắn nhãn demo và bỏ các mã không tồn tại.
4. C4: gửi số điện thoại đơn online làm `customerPhone` để tích điểm (cần chủ dự án quyết định: có tích điểm cho đơn COD chưa thu tiền không).
5. C7, C8: bỏ trang `/admin/staff` hoặc nối nó với `/api/users`; đổi toast demo thành thông báo trung tính.
6. P2: lưu cấu hình vào bảng (ví dụ `store_config`) để không mất khi khởi động lại.
7. T1–T3: thay test chữ ẩn bằng kiểm tra nội dung thật; xoá `components/storefront.tsx` và nhánh Shopify.

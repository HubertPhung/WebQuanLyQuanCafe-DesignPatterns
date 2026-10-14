# BỘ TEST CASE KIỂM THỬ UI/UX & TÍNH NĂNG - ĐÀ LẠT CAFE

Dự án: **Đà Lạt Cafe & Operations Web App**  
Nền tảng: **Next.js 16 (App Router + Turbopack), React 19, Tailwind CSS**  
Bộ test tự động: `npm test` hoặc `node scripts/test-ui-ux.mjs`  
Trạng thái kiểm thử: **25 / 25 Test Cases Passed (100% Đạt)**

---

## 1. PHÂN HỆ STOREFRONT (TRẢI NGHIỆM KHÁCH HÀNG)

| Mã Test Case | Tên chức năng / Tiêu chí UI/UX | Các bước thực hiện (Test Steps) | Kết quả mong đợi (Expected Result) | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **TC-SF-01** | Header, Thương hiệu & Điều hướng | 1. Truy cập `http://localhost:3000/`<br>2. Quan sát Logo, Announcement Bar, Menu điều hướng desktop & mobile. | Header hiển thị logo Đà Lạt Cafe, thanh thông báo ưu đãi, các liên kết Home, Menu, Story, Locations, Journal và liên kết "Staff Portal" chuyển nhanh sang Admin. | **PASS** |
| **TC-SF-02** | Hero Section & Lời kêu gọi hành động (CTA) | 1. Xem màn hình chính.<br>2. Nhấn "Find your cup" hoặc "Explore our beans". | Hero hiển thị tiêu đề lớn thẩm mỹ, tem chứng nhận 100% Arabica, ảnh chất lượng cao. Nút CTA cuộn mượt xuống khu vực Menu hoặc chọn danh mục Cà phê hạt. | **PASS** |
| **TC-SF-03** | Hiển thị Menu & Cơ chế Fallback Catalog | 1. Xem danh sách sản phẩm khi không có Shopify API.<br>2. Kiểm tra ảnh, tên món, giá tiền và tag. | Catalog tự động hiển thị danh sách sản phẩm mẫu sắc nét (Latte, Cold Brew, Pour Over, Croissant,...) thay vì bị màn hình trống hay báo lỗi cửa hàng đóng cửa. | **PASS** |
| **TC-SF-04** | Thanh công cụ & Bộ lọc danh mục (Tabs) | 1. Nhấp lần lượt vào các tab: "Espresso", "Cold Brew", "Pour Over", "Pastries", "Whole Bean".<br>2. Chọn "All favorites". | Lưới sản phẩm lọc tức thì theo đúng phân loại mà không bị giật lag trang. Tab đang chọn có hiệu ứng làm nổi bật (selected). | **PASS** |
| **TC-SF-05** | Tìm kiếm & Bộ lọc nâng cao (Search & Filter) | 1. Gõ từ khóa vào ô tìm kiếm (vd: "Latte", "Croissant").<br>2. Mở "Filters" chọn Roast Level hoặc Max Price.<br>3. Nhấn "Reset filters". | Danh sách tự động lọc theo từ khóa và tiêu chí mức giá/độ rang. Nhấn Reset sẽ khôi phục toàn bộ menu. | **PASS** |
| **TC-SF-06** | Yêu thích & Wishlist | 1. Nhấn icon Trái tim trên góc thẻ sản phẩm.<br>2. Bật nút lọc "Wishlist" trên thanh công cụ. | Icon trái tim chuyển màu đỏ/nâu đậm, ID lưu vào cookie bảo mật. Nút lọc danh sách chỉ hiển thị những món khách đã đánh dấu yêu thích. | **PASS** |
| **TC-SF-07** | Tùy biến món đồ uống (Customization Dialog) | 1. Bấm vào sản phẩm hoặc nút "Customize".<br>2. Chọn kích cỡ, loại sữa (Whole, Oat, Almond), độ ngọt (Regular, Less sweet), mức đá (Ice). | Modal mở mượt mà, các tùy chọn thay đổi tương tác trực tiếp, cập nhật giá tiền tương ứng theo kích cỡ/tùy chọn. | **PASS** |
| **TC-SF-08** | Giỏ hàng dạng trượt (Slide-out Cart Bag) | 1. Nhấn icon Giỏ hàng trên thanh header.<br>2. Xem danh sách món, nút tăng/giảm số lượng (+/-).<br>3. Nhập ghi chú cho barista. | Slide-out Drawer xuất hiện từ cạnh phải. Thay đổi số lượng tính lại tổng tiền ngay lập tức. Ghi chú được lưu trữ an toàn. | **PASS** |
| **TC-SF-09** | Áp dụng mã ưu đãi (Promo Voucher) | 1. Trong giỏ hàng, nhập mã `WELCOME10`.<br>2. Nhấn "Apply". | Hệ thống kiểm tra mã hợp lệ, áp dụng giảm giá 10% vào tổng tiền đơn hàng và hiển thị thông báo thành công. | **PASS** |
| **TC-SF-10** | Tiếp tục thanh toán (Checkout UX Safe Handling) | 1. Nhấn nút "Proceed to checkout".<br>2. Kiểm tra phản hồi khi ở chế độ Demo/Shopify. | Ở chế độ demo, hệ thống hiển thị thông báo mô phỏng thân thiện thay vì crash URL. Khi gắn domain Shopify thật sẽ chuyển hướng sang cổng thanh toán bảo mật. | **PASS** |
| **TC-SF-11** | Chuyên mục Nhật ký (Journal) & Chân trang (Footer) | 1. Cuộn xuống cuối trang.<br>2. Xem 3 bài viết chia sẻ về pha chế.<br>3. Kiểm tra thông tin bản quyền và liên kết "Staff portal". | Bố cục chân trang cân đối, bản quyền cập nhật năm hiện tại, cung cấp lối tắt truy cập phân hệ quản lý cho nhân viên. | **PASS** |

---

## 2. PHÂN HỆ QUẢN TRỊ ADMIN (OPERATIONS & POS)

| Mã Test Case | Tên chức năng / Tiêu chí UI/UX | Các bước thực hiện (Test Steps) | Kết quả mong đợi (Expected Result) | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **TC-ADM-01** | Bảng điều khiển tổng quan (Dashboard) | 1. Truy cập `/admin`.<br>2. Xem 4 thẻ chỉ số chính và 2 biểu đồ trực quan. | Hiển thị đầy đủ: Doanh thu hôm nay vs hôm qua, Tổng đơn hàng, Tỉ lệ bàn đang phục vụ, Thời gian pha chế trung bình, biểu đồ doanh thu theo ngày và top đồ uống bán chạy. | **PASS** |
| **TC-ADM-02** | Dòng đơn hàng trực tiếp (Live Order Stream) | 1. Cuộn xuống bảng Live order stream trên Dashboard.<br>2. Xem trạng thái từng đơn (Pending, Brewing, Ready, Completed). | Bảng hiển thị mã đơn, tên khách, số lượng món, hình thức thanh toán, badge trạng thái có thể cập nhật trực tiếp. | **PASS** |
| **TC-ADM-03** | Màn hình bán hàng tại quầy (POS Terminal) | 1. Truy cập `/admin/pos`.<br>2. Chọn món theo danh mục.<br>3. Tùy chọn bàn phục vụ, hình thức (Dine-in / Takeaway / Delivery).<br>4. Nhập tiền khách đưa trên bàn phím số. | Món được thêm vào hóa đơn bên phải, tự động tính thuế VAT (8%) và tổng thanh toán. Hiển thị chính xác tiền thừa trả khách. | **PASS** |
| **TC-ADM-04** | Gửi đơn & Cập nhật trừ kho POS | 1. Nhấn "Charge" hoặc "Open tab" trên POS.<br>2. Kiểm tra thông báo và dữ liệu. | Đơn hàng tạo thành công với mã `AC-xxxx`, tự động trừ số lượng tồn kho của nguyên liệu/món, tự động chuyển bàn sang trạng thái Occupied. | **PASS** |
| **TC-ADM-05** | Màn hình bếp pha chế (Kitchen Display System - KDS) | 1. Truy cập `/admin/pos?tab=kitchen`.<br>2. Xem các cột: Pending, Brewing, Ready.<br>3. Thử bấm "Start brewing" -> "Mark ready" -> "Hand off". | Đơn hàng chuyển cột tức thì. Các đơn quá 10 phút được viền đỏ nổi bật cảnh báo trễ đơn. Nhấn hoàn thành sẽ lưu giờ xong đơn. | **PASS** |
| **TC-ADM-06** | Sơ đồ bàn thời gian thực (Floor Plan) | 1. Truy cập `/admin/tables`.<br>2. Xem 12 bàn chia theo 3 khu vực: Main Floor, Patio, Coffee Bar.<br>3. Nhấp chọn một bàn đang có khách. | Bàn hiển thị màu theo trạng thái (Xanh: Available, Vàng: Occupied, Xanh dương: Reserved, Xám: Cleaning). Bảng bên phải hiện danh sách món bàn đó đã gọi, tổng bill, thời gian ngồi. | **PASS** |
| **TC-ADM-07** | Đổi trạng thái bàn & Thanh toán tại bàn | 1. Tại drawer chi tiết bàn, bấm đổi trạng thái sang "Cleaning" hoặc "Available".<br>2. Nhấn "Mark paid" đối với đơn chưa thanh toán. | Trạng thái bàn đổi ngay lập tức, đơn hàng được cập nhật thành đã thanh toán. | **PASS** |
| **TC-ADM-08** | Quản lý kho hàng & Thực đơn (Inventory) | 1. Truy cập `/admin/inventory`.<br>2. Xem cảnh báo món sắp hết hàng (Low stock alert).<br>3. Thử tìm kiếm món hoặc lọc theo loại tồn kho. | Banner màu vàng cảnh báo chính xác các món có tồn kho <= ngưỡng an toàn. Bảng hỗ trợ sắp xếp theo tên, danh mục, giá vốn, giá bán, tồn kho. | **PASS** |
| **TC-ADM-09** | Công tắc bật/tắt bán & Thêm món mới | 1. Gạt công tắc "On sale" của một món.<br>2. Bấm nút "Add item", điền form và lưu. | Công tắc cập nhật trạng thái bán ngay. Modal thêm món mới tạo sản phẩm vào kho và xuất hiện ngay trên màn hình POS. | **PASS** |
| **TC-ADM-10** | Quản lý khách hàng quen (Customer CRM) | 1. Truy cập `/admin/customers`.<br>2. Xem bảng xếp hạng khách hàng theo mức chi tiêu. | Hiển thị avatar viết tắt tên, tổng số đơn đã đặt, tổng số tiền chi tiêu tích lũy và ngày ghé quán gần nhất. | **PASS** |
| **TC-ADM-11** | Báo cáo phân tích chuyên sâu (Analytics) | 1. Truy cập `/admin/analytics`.<br>2. Xem 3 biểu đồ: Doanh thu 7 ngày, Top 5 món bán chạy nhất, Cơ cấu thanh toán (Tiền mặt, QR, Thẻ). | Biểu đồ Recharts vẽ chuẩn xác số liệu dạng trực quan, có tooltip khi rê chuột vào từng cột. | **PASS** |
| **TC-ADM-12** | Cấu hình quán & Chuyển đổi giao diện (Settings & Theme) | 1. Truy cập `/admin/settings`.<br>2. Nhấp avatar Admin trên góc phải Header, chọn Dark Mode / Light Mode. | Giao diện chuyển đổi tức thì giữa chế độ sáng và tối với bảng màu nâu cà phê đồng bộ, độ tương phản cao, bảo vệ mắt nhân viên khi làm việc ca tối. | **PASS** |
| **TC-ADM-13** | Phân hệ nhân sự (Staff Schedule Placeholder) | 1. Truy cập `/admin/staff`. | Hiển thị thẻ trạng thái thông báo sẵn sàng tích hợp khi triển khai phân quyền tài khoản ca làm việc. | **PASS** |
| **TC-ADM-14** | Khả năng tự phục hồi khi mất kết nối Database | 1. Chạy hệ thống khi PostgreSQL chưa bật.<br>2. Thao tác trên Admin và Storefront. | Toàn bộ ứng dụng tự động chuyển sang In-memory Store mà không bị gián đoạn, 0% tỉ lệ lỗi crash 500. | **PASS** |

---

## 3. LỆNH CHẠY KIỂM THỬ TỰ ĐỘNG

Để chạy toàn bộ kiểm thử bất cứ lúc nào:
```powershell
npm test
```
hoặc
```powershell
npx pnpm test
```


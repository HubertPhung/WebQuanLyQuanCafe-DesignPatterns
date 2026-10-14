# DANH MỤC TÍNH NĂNG HỆ THỐNG (FEATURE MATRIX & BACKLOG)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

---

**Phiên bản tài liệu:** 1.0.0  
**Ngày cập nhật:** 14/10/2026  
**Mục tiêu:** Cung cấp danh mục toàn diện các tính năng của hệ thống theo từng phân hệ nghiệp vụ, phân định rõ trạng thái triển khai giữa Frontend Next.js và Backend Java thuần, làm cơ sở để phân rã thành các Issue phát triển có phạm vi rõ ràng.

---

## 1. Bảng Quy ước Trạng thái Tính năng

| Ký hiệu Trạng thái | Ý nghĩa | Hành động tiếp theo |
| :---: | :--- | :--- |
| 🟢 **ĐÃ CÓ (Completed)** | Đã triển khai hoàn chỉnh giao diện UI/UX và logic xử lý (trên Frontend Next.js) | Duy trì, viết test case hồi quy hoặc tích hợp API |
| 🟡 **ĐANG LÀM (In Progress)**| Đang trong quá trình thiết kế chi tiết hoặc triển khai mã nguồn (Backend Java thuần) | Lập trình các class Java OOP theo đúng bản SPEC |
| ⚪ **CHƯA TRIỂN KHAI (Pending)**| Mới dừng ở mức đặc tả định hướng hoặc đề xuất mở rộng nâng cao | Đưa vào backlog các sprint tiếp theo |

---

## 2. Ma trận Tính năng Chi tiết theo Phân hệ

### 2.1. Phân hệ 1: Xác thực & Quản trị Nhân sự, Hệ thống (Auth, Staff & Settings)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-AUTH-01` | Chế độ Preview Access | Cấu hình cho phép truy cập nhanh phân hệ Admin qua biến `REQUIRE_ADMIN_AUTH` | - | 🟢 Đã có (`access.ts`) | ⚪ Chưa áp dụng | `[Frontend] Tối ưu hóa access guard` |
| `FEAT-AUTH-02` | Đăng nhập Phân quyền RBAC | Đăng nhập phân quyền 4 vai trò (Admin, Manager, Staff, Customer) | - | 🟢 Đã có UI vai trò (`staff-management.tsx`) / Auth guard: ⚪ | 🟡 Đang làm (Đặc tả thiết kế) | `[Backend] Xây dựng bộ lọc xác thực phân quyền thuần Java` |
| `FEAT-AUTH-03` | Cấu hình Quán Cà phê | Quản lý giờ mở/đóng cửa, tỷ lệ tích điểm, thời gian tự hủy đặt bàn | **Singleton** | 🟢 Đã có giao diện (`settings/page.tsx`) | 🟡 Đang làm (`SystemConfigManager`) | `[Backend] Triển khai Singleton SystemConfigManager` |
| `FEAT-AUTH-04` | Đổi Giao diện Dark/Light | Chuyển đổi bảng màu Sáng / Tối bảo vệ mắt nhân viên làm việc ca đêm | - | 🟢 Đã có (`theme-provider`) | - | `[Frontend] Kiểm tra độ tương phản Dark Mode` |
| `FEAT-AUTH-05` | Quản lý Hồ sơ Nhân sự | Danh sách nhân viên, thông tin liên lạc, gán vai trò (Admin, Manager, Staff, Barista) | - | 🟢 Đã có (`staff-management.tsx`) | 🟡 Đang làm (`staff` DAO) | `[Backend] Tầng DAO quản lý nhân sự` |
| `FEAT-AUTH-06` | Quản lý Lịch ca làm việc | Lập lịch làm việc tuần, phân ca (Sáng, Chiều, Tối) và theo dõi trạng thái ca | - | 🟢 Đã có (`schedule-management.tsx`) | ⚪ Chưa áp dụng | `[Frontend] Tối ưu bộ chọn ca làm việc` |

---

### 2.2. Phân hệ 2: Storefront Khách hàng & Giỏ hàng (Customer Storefront)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-SF-01` | Duyệt Thực đơn & Bộ lọc | Xem menu phân loại (Espresso, Cold Brew, Pour Over, Pastries, Whole Bean) | - | 🟢 Đã có (`DrinkMenu.tsx`) | 🟡 Đang làm (`GET /api/menu`) | `[Backend] Cung cấp API GET /api/menu` |
| `FEAT-SF-02` | Tìm kiếm & Lọc Nâng cao | Tìm món theo từ khóa, lọc theo độ rang (Roast Level) và giá tiền tối đa | - | 🟢 Đã có (`DrinkMenu.tsx`) | - | `[Frontend] Tối ưu hóa thanh tìm kiếm debounce` |
| `FEAT-SF-03` | Tùy biến Đồ uống (Modal) | Khách chọn Size (Nhỏ/Vừa/Lớn), độ ngọt, mức đá, loại sữa (Whole/Oat) | **Decorator** | 🟢 Đã có (Modal UI) | 🟡 Đang làm (`ToppingDecorator`) | `[Backend] Cài đặt Decorator Pattern cho đồ uống` |
| `FEAT-SF-04` | Danh sách Yêu thích (Wishlist)| Đánh dấu và lọc nhanh các món yêu thích lưu trữ qua Cookie bảo mật | - | 🟢 Đã có (`/api/favorites`) | - | `[Frontend] Đồng bộ danh sách yêu thích local` |
| `FEAT-SF-05` | Ngăn kéo Giỏ hàng (Slide-out)| Giỏ hàng trượt từ phải sang, tăng/giảm số lượng, xóa món, lưu ghi chú | - | 🟢 Đã có (`CartSheet.tsx`) | 🟡 Đang làm | `[Frontend] Hoàn thiện hiệu ứng mở giỏ hàng` |
| `FEAT-SF-06` | Áp dụng Voucher Giỏ hàng | Nhập mã `WELCOME10` giảm ngay 10% tổng tiền giỏ hàng | **Strategy** | 🟢 Đã có (`cart-store.ts`) | 🟡 Đang làm (`DiscountStrategy`) | `[Backend] Xây dựng Strategy tính chiết khấu` |

---

### 2.3. Phân hệ 3: Bán hàng tại Quầy (POS Terminal)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-POS-01` | Lên đơn nhanh tại quầy | Chọn món theo danh mục, thêm ghi chú, chọn số bàn hoặc chọn Mang đi | **Builder** | 🟢 Đã có (`pos-terminal.tsx`) | 🟡 Đang làm (`OrderBuilder`) | `[Backend] Hoàn thiện Builder Pattern OrderBuilder` |
| `FEAT-POS-02` | Bàn phím số & Tiền thừa | Bàn phím số ảo cảm ứng, nhập tiền khách đưa, tự động tính tiền thừa trả khách | - | 🟢 Đã có (`pos-terminal.tsx`) | - | `[Frontend] Kiểm thử bàn phím số POS trên tablet` |
| `FEAT-POS-03` | Tính Thuế VAT (8%) | Tự động tính thuế giá trị gia tăng chuẩn 8% trên tổng tiền món sau chiết khấu | - | 🟢 Đã có (`format.ts`) | 🟡 Đang làm | `[Backend] Đồng bộ công thức tính thuế VAT` |
| `FEAT-POS-04` | Trừ điểm Khách hàng quen | Tra cứu điểm thành viên qua SĐT và trừ tiền trực tiếp vào hóa đơn (1đ = 1.000đ)| **Singleton** | 🟢 Đã có (`pos-terminal.tsx`) | 🟡 Đang làm (`SystemConfigManager`) | `[Integration] Tích hợp API trừ điểm loyalty tại POS` |
| `FEAT-POS-05` | Chốt đơn & Thanh toán đa kênh| Nút "Thanh toán & In hóa đơn" gọi Facade tổng hợp toàn bộ quy trình | **Facade, Factory** | 🟢 Đã có (`pos-terminal.tsx`) | 🟡 Đang làm (`PosCheckoutFacade`) | `[Backend] Cài đặt Facade PosCheckoutFacade` |
| `FEAT-POS-06` | Quản lý Đơn hàng Trực tuyến | Tiếp nhận, lọc theo trạng thái và xác nhận đơn đặt từ Storefront | - | 🟢 Đã có (`online-orders.tsx`) | 🟡 Đang làm (`IOrderDao`) | `[Integration] Đồng bộ luồng đơn online` |

---

### 2.4. Phân hệ 4: Màn hình Bếp Pha chế (Kitchen Display System - KDS)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-KDS-01` | Bảng Kanban Điều phối | Hiển thị đơn theo các cột trạng thái: `Pending` ➔ `Brewing` ➔ `Ready` ➔ `Completed` | **State Pattern** | 🟢 Đã có (`kds-board.tsx`) | 🟡 Đang làm (`State Pattern`) | `[Backend] Thiết kế State Pattern cho chu kỳ đơn hàng` |
| `FEAT-KDS-02` | Thao tác 1 chạm Barista | Nút "Bắt đầu pha", "Báo xong", "Giao khách" chuyển trạng thái đơn tức thời | - | 🟢 Đã có (`actions.ts`) | 🟡 Đang làm (`PATCH /api/orders/:id/status`) | `[Integration] Kết nối API cập nhật trạng thái KDS` |
| `FEAT-KDS-03` | Cảnh báo Đơn hàng Trễ | Tự động viền đỏ nhấp nháy cho các đơn có thời gian chờ vượt quá 10 phút | - | 🟢 Đã có (`kds-board.tsx`) | - | `[Frontend] Tối ưu hóa bộ đếm thời gian pha chế` |

---

### 2.5. Phân hệ 5: Sơ đồ Bàn & Quản lý Chỗ ngồi (Floor Plan & Tables)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-TBL-01` | Sơ đồ Bàn Trực quan | Quản lý 15 bàn theo 3 phân khu: Main Floor, Patio Sân vườn, Coffee Bar | - | 🟢 Đã có (`floor-plan.tsx`) | 🟡 Đang làm (`GET /api/tables`) | `[Backend] Xây dựng TableDAO và API lấy sơ đồ bàn` |
| `FEAT-TBL-02` | Màu sắc Trạng thái Bàn | 4 màu trực quan: Xanh (Available), Vàng (Occupied), Lam (Reserved), Xám (Cleaning)| **State Pattern** | 🟢 Đã có (`TableGrid.tsx`) | 🟡 Đang làm | `[Backend] Đồng bộ Enum TableStatus` |
| `FEAT-TBL-03` | Xem Bill & Thanh toán tại bàn | Bấm vào bàn đang có khách để xem danh sách món đã gọi và bấm "Thanh toán" | **Observer** | 🟢 Đã có (`floor-plan.tsx`) | 🟡 Đang làm (`TableStatusObserver`) | `[Backend] Cài đặt Observer giải phóng trạng thái bàn` |

---

### 2.6. Phân hệ 6: Quản lý Đặt bàn trước (Table Reservations)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-RES-01` | Tiếp nhận Đơn Đặt bàn | Form nhập thông tin khách, khung giờ, số khách và danh sách món đặt trước | - | 🟢 Đã có giao diện | 🟡 Đang làm (`POST /api/reservations`)| `[Backend] API tiếp nhận yêu cầu đặt bàn` |
| `FEAT-RES-02` | Kiểm định Chuỗi Nghiệp vụ| Kiểm tra Tên/SĐT ➔ Khung giờ mở cửa ➔ Số khách (1-20 người) | **Chain of Resp.** | 🟢 Đã có validate sơ bộ | 🟡 Đang làm (`ReservationValidator`) | `[Backend] Cài đặt Chain of Responsibility Validator` |
| `FEAT-RES-03` | Chuyển Đơn sang POS | Nút "Chuyển đơn sang POS" ánh xạ thông tin phiếu đặt bàn sang đơn POS | **Adapter** | 🟢 Đã có (`handleTransferToPOS`)| 🟡 Đang làm (`ReservationToOrderAdapter`)| `[Backend] Cài đặt Adapter chuyển đổi đặt bàn` |
| `FEAT-RES-04` | Xuất Báo cáo CSV Đặt bàn| Nút "Xuất file CSV" kết xuất danh sách đặt bàn thành file bảng tính Excel | **Template Method** | 🟢 Đã có (`handleExportCSV`) | ⚪ Chưa áp dụng | `[Frontend] Bổ sung định dạng UTF-8 BOM cho CSV` |

---

### 2.7. Phân hệ 7: Quản lý Kho & Thực đơn (Inventory & Menu Management)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-INV-01` | Danh sách Tồn kho & Menu | Bảng quản lý hiển thị tên món, danh mục, giá vốn, giá bán, số lượng tồn kho | - | 🟢 Đã có (`inventory-table.tsx`)| 🟡 Đang làm (`IMenuDao`) | `[Backend] Xây dựng tầng DAO cho Menu & Kho` |
| `FEAT-INV-02` | Cảnh báo Hết hàng (Low Stock)| Banner màu vàng cảnh báo các món có tồn kho <= ngưỡng an toàn (`threshold`)| - | 🟢 Đã có (`inventory-table.tsx`)| 🟡 Đang làm | `[Frontend] Tối ưu hóa bộ lọc món sắp hết hàng` |
| `FEAT-INV-03` | Công tắc Bật/Tắt Bán | Công tắc chuyển đổi tức thời trạng thái còn hàng/hết hàng để POS ẩn món | - | 🟢 Đã có (`actions.ts`) | 🟡 Đang làm | `[Integration] Đồng bộ công tắc bán với POS` |
| `FEAT-INV-04` | Modal Thêm món Mới | Form nhập thông tin món, phân loại, giá bán và công thức pha chế | - | 🟢 Đã có (`add-item-dialog.tsx`)| 🟡 Đang làm (`POST /api/menu`) | `[Backend] API thêm món mới vào thực đơn` |

---

### 2.8. Phân hệ 8: Khách hàng Thân thiết & Báo cáo (CRM & Analytics)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-CRM-01` | Xếp hạng Khách hàng Quen | Bảng xếp hạng khách hàng theo tổng chi tiêu và phân hạng thành viên | - | 🟢 Đã có (`customers/page.tsx`)| 🟡 Đang làm (`ICustomerDao`) | `[Backend] Tầng DAO truy vấn khách hàng thân thiết` |
| `FEAT-CRM-02` | Tự động Tích lũy Điểm | Tự động cộng 1 điểm thưởng cho mỗi 10.000 VNĐ giá trị hóa đơn đã thanh toán | **Observer** | 🟢 Đã có mô phỏng | 🟡 Đang làm (`LoyaltyPointObserver`) | `[Backend] Cài đặt Observer tích điểm thành viên` |
| `FEAT-ANA-01` | Biểu đồ Doanh thu 7 ngày | Biểu đồ cột Recharts trực quan hóa doanh thu theo từng ngày trong tuần | - | 🟢 Đã có (`RevenueChart.tsx`) | 🟡 Đang làm (`/api/analytics`) | `[Integration] API cung cấp số liệu biểu đồ doanh thu` |
| `FEAT-ANA-02` | Cơ cấu Thanh toán & Món chạy | Biểu đồ Donut thể hiện tỷ trọng Tiền mặt/MoMo/VNPay và top 3 đồ uống bán chạy | - | 🟢 Đã có (`TopDrinksDonut.tsx`) | 🟡 Đang làm | `[Frontend] Bổ sung tooltip chi tiết trên biểu đồ` |

---

## 3. Lộ trình Phân rã Backlog Thành các Nhóm Issue

Dựa trên ma trận tính năng trên, khối lượng công việc được phân rã thành 3 Epic chính:

```text
EPIC 1: HOÀN THIỆN BACKEND JAVA THUẦN (PURE JAVA OOP & 9 GOF PATTERNS)
├── Issue 1.1: Thiết lập cấu trúc dự án Java SE & Bộ nhớ In-Memory Database
├── Issue 1.2: Triển khai 3 Creational Patterns (Singleton, Factory Method, Builder)
├── Issue 1.3: Triển khai 3 Structural Patterns (Decorator, Adapter, Facade)
├── Issue 1.4: Triển khai 3 Behavioral Patterns (Strategy, Chain of Responsibility, Observer)
└── Issue 1.5: Viết bộ kiểm thử đơn vị JUnit cho 9 Design Patterns

EPIC 2: XÂY DỰNG HTTP SERVER JAVA THUẦN & REST API DISPATCHER
├── Issue 2.1: Cài đặt com.sun.net.httpserver.HttpServer trên cổng 8080
├── Issue 2.2: Cài đặt MenuHttpHandler & TableHttpHandler
├── Issue 2.3: Cài đặt ReservationHttpHandler (Gắn chuỗi Chain of Responsibility)
└── Issue 2.4: Cài đặt CheckoutHttpHandler (Gắn PosCheckoutFacade)

EPIC 3: TÍCH HỢP NEXT.JS FRONTEND VỚI BACKEND JAVA
├── Issue 3.1: Cấu hình biến môi trường JAVA_BACKEND_URL trong Next.js
├── Issue 3.2: Nối Next.js Server Actions sang Backend Java REST API
└── Issue 3.3: Kiểm thử toàn trình End-to-End (E2E) và xác thực cơ chế chịu lỗi Fallback
```


# DANH MỤC TÍNH NĂNG HỆ THỐNG (FEATURE MATRIX & BACKLOG)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

---

**Phiên bản tài liệu:** 2.1.0  
**Ngày cập nhật:** 15/10/2026  
**Mục tiêu:** Cung cấp danh mục toàn diện các tính năng của hệ thống theo từng phân hệ nghiệp vụ, phân định rõ trạng thái triển khai giữa Frontend Next.js và Backend Java thuần, làm cơ sở để phân rã thành đúng 15 GitHub Issues chuẩn mực không chồng chéo.

---

## 1. Bảng Quy ước Trạng thái Tính năng

| Ký hiệu Trạng thái | Ý nghĩa | Hành động tiếp theo |
| :---: | :--- | :--- |
| 🟢 **ĐÃ HOÀN THÀNH (Completed)** | Đã triển khai hoàn chỉnh giao diện UI/UX hoặc Backend Java code đã merge vào `master` | Duy trì, viết test case hồi quy hoặc tích hợp API |
| 🟡 **ĐANG LÀM (In Progress)**| Đang trong quá trình thiết kế chi tiết hoặc triển khai mã nguồn trên nhánh feature | Lập trình các class Java OOP theo đúng bản SPEC |
| ⚪ **CHƯA BẮT ĐẦU (Pending)**| Đã nằm trong kế hoạch 15 Issue chuẩn nhưng chưa bắt đầu code | Đưa vào sprint theo thứ tự phụ thuộc (Dependencies) |
| 🔷 **MỞ RỘNG (Optional Extension)**| Mẫu thiết kế phân tích nâng cao trong báo cáo học thuật (State Pattern, Template Method) | Ngoài phạm vi 15 Sprint Issues cốt lõi |

---

## 2. Ma trận Tính năng Chi tiết theo Phân hệ

### 2.1. Phân hệ 1: Nền tảng Thực thể, Xác thực & Cấu hình Hệ thống (Core, Auth & Settings)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-CORE-01` | Mô hình Thực thể Miền (Domain POJO) | Khởi tạo cấu trúc dự án Java SE và các thực thể lõi (`Order`, `Table`, `MenuItem`, `Reservation`, `Customer`...) | **Core OOP Foundation** | 🟢 Đã có TypeScript schemas | 🟢 Đã hoàn thành (`com.dalatcafe.model`) | `[Backend][Core] Issue #01` (PR #17) |
| `FEAT-AUTH-01` | Chế độ Preview Access | Cấu hình cho phép truy cập nhanh phân hệ Admin qua biến `REQUIRE_ADMIN_AUTH` | - | 🟢 Đã có (`access.ts`) | ⚪ Không áp dụng | `[Frontend] Tối ưu hóa access guard` |
| `FEAT-AUTH-02` | Bộ lọc Phân quyền RBAC thuần Java | Hệ thống phân quyền 4 vai trò (`ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`), kiểm tra token/header trả về 401/403 | - | 🟢 Đã có UI vai trò (`staff-management.tsx`) | ⚪ Tích hợp trong `SimpleAuthFilter` | `[Backend][Server] Issue #12` |
| `FEAT-AUTH-03` | Cấu hình Quán Cà phê Toàn cục | Quản lý giờ mở/đóng cửa (07:00-22:00), tỷ lệ tích điểm (10.000đ = 1 điểm), thời gian tự hủy đặt bàn (30 phút) | **Singleton** | 🟢 Đã có giao diện (`settings/page.tsx`) | 🟢 Đã hoàn thành (`SystemConfigManager`) | `[Backend][Singleton] Issue #03` (PR #20) |
| `FEAT-AUTH-04` | Đổi Giao diện Dark/Light | Chuyển đổi bảng màu Sáng / Tối bảo vệ mắt nhân viên làm việc ca đêm | - | 🟢 Đã có (`theme-provider`) | - | `[Frontend] Tối ưu Dark Mode` |
| `FEAT-AUTH-05` | Quản lý Hồ sơ & Chức danh Nhân sự | Danh sách nhân viên, gán chức danh nội bộ (`Admin`, `Manager`, `Staff`, `Barista` - trong đó Staff và Barista cùng thuộc vai trò hệ thống `STAFF`) | - | 🟢 Đã có (`staff-management.tsx`) | ⚪ Tích hợp trong DAO | `[Backend][DAO] Issue #02` |
| `FEAT-AUTH-06` | Quản lý Lịch ca làm việc | Lập lịch làm việc tuần, phân ca (Sáng, Chiều, Tối) và theo dõi trạng thái ca | - | 🟢 Đã có (`schedule-management.tsx`) | ⚪ Chưa áp dụng | `[Frontend] Tối ưu bộ chọn ca` |

---

### 2.2. Phân hệ 2: Storefront Khách hàng & Giỏ hàng (Customer Storefront)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-SF-01` | Duyệt Thực đơn & Bộ lọc | Xem menu phân loại (Espresso, Cold Brew, Pour Over, Pastries, Whole Bean) | - | 🟢 Đã có (`DrinkMenu.tsx`) | 🟢 Đã có `IMenuDao` | `[Backend][DAO] Issue #02`, `Issue #12` |
| `FEAT-SF-02` | Tìm kiếm & Lọc Nâng cao | Tìm món theo từ khóa, lọc theo độ rang (Roast Level) và giá tiền tối đa | - | 🟢 Đã có (`DrinkMenu.tsx`) | - | `[Frontend] Tối ưu thanh tìm kiếm debounce` |
| `FEAT-SF-03` | Tùy biến Đồ uống (Modal) | Khách chọn Size (Nhỏ/Vừa/Lớn), độ ngọt, mức đá, loại sữa (Whole/Oat), thêm trân châu | **Decorator** | 🟢 Đã có (Modal UI) | ⚪ Chưa bắt đầu | `[Backend][Decorator] Issue #05` |
| `FEAT-SF-04` | Danh sách Yêu thích (Wishlist)| Đánh dấu và lọc nhanh các món yêu thích lưu trữ qua Cookie bảo mật | - | 🟢 Đã có (`/api/favorites`) | - | `[Frontend] Đồng bộ wishlist local` |
| `FEAT-SF-05` | Ngăn kéo Giỏ hàng (Slide-out)| Giỏ hàng trượt từ phải sang, tăng/giảm số lượng, xóa món, lưu ghi chú | - | 🟢 Đã có (`CartSheet.tsx`) | - | `[Frontend] Hoàn thiện hiệu ứng mở giỏ hàng` |
| `FEAT-SF-06` | Áp dụng Voucher Giỏ hàng | Nhập mã `WELCOME10` giảm ngay 10% tổng tiền giỏ hàng (Phần trăm, Cố định, Bậc thang) | **Strategy** | 🟢 Đã có (`cart-store.ts`) | ⚪ Chưa bắt đầu | `[Backend][Strategy] Issue #07` |

---

### 2.3. Phân hệ 3: Bán hàng tại Quầy (POS Terminal)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-POS-01` | Lên đơn nhanh tại quầy | Chọn món theo danh mục, thêm ghi chú, chọn số bàn hoặc chọn Mang đi | **Builder** | 🟢 Đã có (`pos-terminal.tsx`) | ⚪ Chưa bắt đầu | `[Backend][Builder] Issue #06` |
| `FEAT-POS-02` | Bàn phím số & Tiền thừa | Bàn phím số ảo cảm ứng, nhập tiền khách đưa, tự động tính tiền thừa trả khách | - | 🟢 Đã có (`pos-terminal.tsx`) | - | `[Frontend] Kiểm thử bàn phím số POS` |
| `FEAT-POS-03` | Tính Thuế VAT (8%) | Tự động tính thuế giá trị gia tăng chuẩn 8% trên tổng tiền món sau chiết khấu | - | 🟢 Đã có (`format.ts`) | ⚪ Tích hợp trong Builder/Facade | `[Backend][Builder] Issue #06` |
| `FEAT-POS-04` | Trừ điểm Khách hàng quen | Tra cứu điểm thành viên qua SĐT và trừ tiền trực tiếp vào hóa đơn (1đ = 1.000đ)| **Singleton** | 🟢 Đã có (`pos-terminal.tsx`) | 🟢 Đã có `SystemConfigManager` | `[Backend][Singleton] Issue #03` |
| `FEAT-POS-05` | Chốt đơn & Thanh toán đa kênh| Nút "Thanh toán & In hóa đơn" gọi Facade tổng hợp: Builder, Decorator, Strategy, Factory, Observer | **Facade, Factory** | 🟢 Đã có (`pos-terminal.tsx`) | ⚪ Chưa bắt đầu | `[Backend][Facade] Issue #11`, `[Backend][Factory] Issue #04` |
| `FEAT-POS-06` | Quản lý Đơn hàng Trực tuyến | Tiếp nhận, lọc theo trạng thái và xác nhận đơn đặt từ Storefront | - | 🟢 Đã có (`online-orders.tsx`) | 🟢 Đã có `IOrderDao` | `[Backend][DAO] Issue #02` |

---

### 2.4. Phân hệ 4: Màn hình Bếp Pha chế (Kitchen Display System - KDS)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-KDS-01` | Bảng Kanban Điều phối | Hiển thị đơn theo các cột trạng thái: `Pending` ➔ `Brewing` ➔ `Ready` ➔ `Completed` | 🔷 *State Pattern (Mở rộng)* | 🟢 Đã có (`kds-board.tsx`) | 🟢 Đã có `OrderStatus` Enum | `[Backend][Core] Issue #01` |
| `FEAT-KDS-02` | Thao tác 1 chạm Barista | Nút "Bắt đầu pha", "Báo xong", "Giao khách" chuyển trạng thái đơn tức thời | - | 🟢 Đã có (`actions.ts`) | ⚪ Tích hợp trong `OrderHandler` | `[Backend][Server] Issue #12` |
| `FEAT-KDS-03` | Cảnh báo Đơn hàng Trễ | Tự động viền đỏ nhấp nháy cho các đơn có thời gian chờ vượt quá 10 phút | - | 🟢 Đã có (`kds-board.tsx`) | - | `[Frontend] Tối ưu bộ đếm thời gian KDS` |

---

### 2.5. Phân hệ 5: Sơ đồ Bàn & Quản lý Chỗ ngồi (Floor Plan & Tables)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-TBL-01` | Sơ đồ Bàn Trực quan | Quản lý 15 bàn theo 3 phân khu: Main Floor, Patio Sân vườn, Coffee Bar | - | 🟢 Đã có (`floor-plan.tsx`) | 🟢 Đã có `ITableDao` | `[Backend][DAO] Issue #02` |
| `FEAT-TBL-02` | Màu sắc Trạng thái Bàn | 4 màu trực quan: Xanh (Available), Vàng (Occupied), Lam (Reserved), Xám (Cleaning)| 🔷 *State Pattern (Mở rộng)* | 🟢 Đã có (`TableGrid.tsx`) | 🟢 Đã có `TableStatus` Enum | `[Backend][Core] Issue #01` |
| `FEAT-TBL-03` | Xem Bill & Thanh toán tại bàn | Bấm vào bàn đang có khách để xem danh sách món đã gọi và bấm "Thanh toán" | **Observer** | 🟢 Đã có (`floor-plan.tsx`) | ⚪ Chưa bắt đầu | `[Backend][Observer] Issue #08` |

---

### 2.6. Phân hệ 6: Quản lý Đặt bàn trước (Table Reservations)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-RES-01` | Tiếp nhận Đơn Đặt bàn | Form nhập thông tin khách, khung giờ, số khách và danh sách món đặt trước | - | 🟢 Đã có giao diện | 🟢 Đã có `IReservationDao` | `[Backend][DAO] Issue #02` |
| `FEAT-RES-02` | Kiểm định Chuỗi Nghiệp vụ| Giờ mở cửa ➔ Số khách/số ghế ➔ Lịch bàn không giao nhau (2 giờ) | **Chain of Resp.** | 🟢 Đã có validate sơ bộ | 🟢 Đã triển khai Chain (local) | `[Backend][Chain] Issue #09` |
| `FEAT-RES-03` | Chuyển Đơn sang POS | Nút "Chuyển đơn sang POS" ánh xạ thông tin phiếu đặt bàn sang đơn POS | **Adapter** | 🟢 Đã có (`handleTransferToPOS`)| ⚪ Chưa bắt đầu | `[Backend][Adapter] Issue #10` |
| `FEAT-RES-04` | Xuất Báo cáo CSV Đặt bàn| Nút "Xuất file CSV" kết xuất danh sách đặt bàn thành file bảng tính Excel | 🔷 *Template Method (Mở rộng)* | 🟢 Đã có (`handleExportCSV`) | ⚪ Dành cho báo cáo học thuật | `[Frontend] Bổ sung UTF-8 BOM cho CSV` |

---

### 2.7. Phân hệ 7: Quản lý Kho & Thực đơn (Inventory & Menu Management)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-INV-01` | Danh sách Tồn kho & Menu | Bảng quản lý hiển thị tên món, danh mục, giá vốn, giá bán, số lượng tồn kho | - | 🟢 Đã có (`inventory-table.tsx`)| 🟢 Đã có `IMenuDao` | `[Backend][DAO] Issue #02` |
| `FEAT-INV-02` | Cảnh báo Hết hàng (Low Stock)| Banner màu vàng cảnh báo các món có tồn kho <= ngưỡng an toàn (`threshold`)| - | 🟢 Đã có (`inventory-table.tsx`)| 🟢 Đã có model `MenuItem` | `[Backend][Core] Issue #01` |
| `FEAT-INV-03` | Công tắc Bật/Tắt Bán | Công tắc chuyển đổi tức thời trạng thái còn hàng/hết hàng để POS ẩn món | - | 🟢 Đã có (`actions.ts`) | 🟢 Đã có `IMenuDao` | `[Backend][DAO] Issue #02` |
| `FEAT-INV-04` | Modal Thêm món Mới | Form nhập thông tin món, phân loại, giá bán và công thức pha chế | - | 🟢 Đã có (`add-item-dialog.tsx`)| ⚪ Tích hợp trong `MenuHandler` | `[Backend][Server] Issue #12` |

---

### 2.8. Phân hệ 8: Khách hàng Thân thiết & Báo cáo (CRM & Analytics)

| Mã Tính năng | Tên Tính năng | Mô tả Nghiệp vụ | Design Pattern | Trạng thái Frontend | Trạng thái Backend Java | Gợi ý Issue Liên quan |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- |
| `FEAT-CRM-01` | Xếp hạng Khách hàng Quen | Bảng xếp hạng khách hàng theo tổng chi tiêu và phân hạng thành viên | - | 🟢 Đã có (`customers/page.tsx`)| 🟢 Đã có `ICustomerDao` | `[Backend][DAO] Issue #02` |
| `FEAT-CRM-02` | Tự động Tích lũy Điểm | Tự động cộng 1 điểm thưởng cho mỗi 10.000 VNĐ giá trị hóa đơn đã thanh toán | **Observer** | 🟢 Đã có mô phỏng | ⚪ Chưa bắt đầu | `[Backend][Observer] Issue #08` |
| `FEAT-ANA-01` | Biểu đồ Doanh thu 7 ngày | Biểu đồ cột Recharts trực quan hóa doanh thu theo từng ngày trong tuần | - | 🟢 Đã có (`RevenueChart.tsx`) | ⚪ Tích hợp trong `AnalyticsHandler` | `[Backend][Server] Issue #12` |
| `FEAT-ANA-02` | Cơ cấu Thanh toán & Món chạy | Biểu đồ Donut thể hiện tỷ trọng Tiền mặt/MoMo/VNPay và top 3 đồ uống bán chạy | - | 🟢 Đã có (`TopDrinksDonut.tsx`) | ⚪ Tích hợp trong `AnalyticsHandler` | `[Backend][Server] Issue #12` |

---

## 3. Lộ trình Triển khai Chuẩn hóa: 15 GitHub Issues

Toàn bộ khối lượng công việc được hợp nhất thành **15 Issue chuẩn mực** phân bổ theo 4 giai đoạn logic và gán trách nhiệm rõ ràng cho 5 thành viên trong nhóm:

| Issue | Tiêu đề Issue Tiêu chuẩn | Phân hệ / Pattern | Người phụ trách | Trạng thái |
| :---: | :--- | :---: | :---: | :---: |
| **#01** | `[Backend][Core] Initialize Java SE project structure and core POJO entities` | Core Foundation (`FEAT-CORE-01`) | `@HubertPhung` | 🟢 **ĐÃ HOÀN THÀNH (PR #17)** |
| **#02** | `[Backend][DAO] Implement DAO layer with JDBC Supabase and In-Memory Store` | Data Layer (`FEAT-SF-01`, `FEAT-CRM-01`) | `@vuong123s` | 🟢 **ĐÃ HOÀN THÀNH (PR #19)** |
| **#03** | `[Backend][Singleton] Implement SystemConfigManager for global cafe parameters` | Singleton (`FEAT-AUTH-03`, `FEAT-POS-04`) | `@HubertPhung` | 🟢 **ĐÃ HOÀN THÀNH (PR #20)** |
| **#04** | `[Backend][Factory] Implement PaymentProcessorFactory for multi-channel checkout` | Factory Method (`FEAT-POS-05`) | `@0Yaam` | ⚪ Sẵn sàng làm |
| **#05** | `[Backend][Decorator] Implement ToppingDecorator for beverage customization and Size L` | Decorator (`FEAT-SF-03`) | `@0Yaam` | ⚪ Sẵn sàng làm |
| **#06** | `[Backend][Builder] Implement OrderBuilder for flexible POS order assembly` | Builder (`FEAT-POS-01`, `FEAT-POS-03`) | `@elgthinhnguyen` | ⚪ Sẵn sàng làm |
| **#07** | `[Backend][Strategy] Implement DiscountStrategy for voucher calculation algorithms` | Strategy (`FEAT-SF-06`) | `@1convitt` | 🟢 Đã triển khai và test (local) |
| **#08** | `[Backend][Observer] Implement OrderEventSubject for CRM points and table sync` | Observer (`FEAT-TBL-03`, `FEAT-CRM-02`) | `@elgthinhnguyen` | ⚪ Cần #02 |
| **#09** | `[Backend][Chain] Implement ReservationValidator for 3-step booking validation` | Chain of Resp. (`FEAT-RES-02`) | `@1convitt` | 🟢 Đã triển khai và test (local) |
| **#10** | `[Backend][Adapter] Implement ReservationToOrderAdapter to map bookings to POS orders` | Adapter (`FEAT-RES-03`) | `@vuong123s` | ⚪ Sẵn sàng làm |
| **#11** | `[Backend][Facade] Implement PosCheckoutFacade orchestrating POS checkout workflow` | Facade (`FEAT-POS-05`) | `@HubertPhung` | ⚪ Cần #04-#08, #10 |
| **#12** | `[Backend][Server] Implement Java SE HttpServer on port 8080 with REST handlers` | Server & RBAC (`FEAT-AUTH-02`, Full API) | `@HubertPhung` & `@elgthinhnguyen` | ⚪ Cần #02, #09-#11 |
| **#13** | `[QA][JUnit5] Implement comprehensive JUnit 5 unit test suite for 9 GoF patterns` | Testing (`scope:test`) | `@vuong123s` & `@1convitt` | ⚪ Cần #11 |
| **#14** | `[Integration][API] Connect Next.js Server Actions to Java Backend on port 8080` | Integration (`scope:integration`) | `@HubertPhung` & `@0Yaam` | ⚪ Cần #12 |
| **#15** | `[QA][E2E] Execute End-to-End integration testing and complete project report` | QA & Docs (`scope:test`, `scope:docs`) | Cả 5 thành viên | ⚪ Cần #13, #14 |

> [!NOTE]
> **Ghi chú về các mẫu thiết kế mở rộng:** Mẫu **State Pattern** (quản lý trạng thái bàn & đơn hàng KDS) và **Template Method Pattern** (xuất báo cáo CSV) được trình bày như các giải pháp thiết kế mở rộng nâng cao trong tài liệu học thuật và báo cáo bảo vệ đồ án, không nằm trong 15 Issue cốt lõi trên GitHub để giữ phạm vi thực thi tinh gọn và khả thi.

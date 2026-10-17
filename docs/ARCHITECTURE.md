# KIẾN TRÚC HỆ THỐNG PHẦN MỀM (SYSTEM ARCHITECTURE)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

---

**Phiên bản tài liệu:** 1.0.0  
**Ngày lập:** 14/10/2026  
**Mục tiêu:** Mô tả chi tiết kiến trúc phân tầng, cơ chế giao tiếp giữa Next.js Frontend và Backend Java thuần SE, luồng dữ liệu nghiệp vụ, mô hình dữ liệu và phân định ranh giới phát triển (Scope Boundaries).

---

## 1. Tổng quan Kiến trúc Hệ thống

Hệ thống **Đà Lạt Cafe** được xây dựng theo kiến trúc **Phân tầng Tách biệt (Decoupled Multi-tier Architecture)**:

```mermaid
graph TB
    subgraph Client_Tier ["1. Tầng Trình diễn (Presentation Layer - Next.js 16 / React 19)"]
        StorefrontClient["Khách hàng Storefront (Browser)"]
        AdminClient["Nhân viên POS & Quản lý Admin (Browser/Tablet)"]
    end

    subgraph App_Server_Tier ["2. Tầng Máy chủ Ứng dụng Next.js (App Server - Port 3000)"]
        AppRouter["Next.js App Router (app/)"]
        ServerActions["Server Actions (app/admin/actions.ts)"]
        RouteHandlers["Route Handlers (app/api/cart, /api/favorites)"]
        ClientFallback["In-Memory Mock Store Fallback (lib/db/mock-store.ts)"]
        
        StorefrontClient --> AppRouter
        AdminClient --> AppRouter
        AppRouter --> ServerActions
        AppRouter --> RouteHandlers
        ServerActions -.->|Chế độ Standalone| ClientFallback
    end

    subgraph Core_Backend_Tier ["3. Tầng Nghiệp vụ Lõi Java thuần (Core Backend - Port 8080)"]
        JavaHttpServer["Java SE HTTP Dispatcher (com.sun.net.httpserver.HttpServer)"]
        
        subgraph Pattern_Domain ["⭐ GoF Design Patterns Domain (com.dalatcafe.patterns)"]
            Facade["Facade: PosCheckoutFacade"]
            Chain["Chain of Resp: ReservationValidatorHandler"]
            Adapter["Adapter: ReservationToOrderAdapter"]
            Factory["Factory: PaymentProcessorFactory"]
            Builder["Builder: OrderBuilder"]
            Decorator["Decorator: BeverageDecorator"]
            Strategy["Strategy: DiscountContext"]
            Observer["Observer: OrderEventSubject"]
            Singleton["Singleton: SystemConfigManager"]
        end

        DomainModel["POJO Entities (Order, Table, Reservation, MenuItem, Customer)"]
        JavaDAO["Data Access Objects (DAO Interfaces & Implementations)"]

        JavaHttpServer --> Facade
        JavaHttpServer --> Chain
        JavaHttpServer --> Strategy
        Adapter --> DomainModel
        Facade --> Factory
        Facade --> Builder
        Facade --> Decorator
        Facade --> Strategy
        Facade --> Observer
        
        Pattern_Domain --> DomainModel
        DomainModel --> JavaDAO
    end

    subgraph Persistence_Tier ["4. Tầng Dữ liệu (Persistence Layer)"]
        PostgresDB[("PostgreSQL Database (Supabase / DATABASE_URL)")]
        InMemoryDB[("Java SE In-Memory Store / Mock Data")]
        
        JavaDAO --> PostgresDB
        JavaDAO -.->|Chế độ Kiểm thử đơn vị| InMemoryDB
    end

    ServerActions ==>|"HTTP REST JSON qua lib/api-client.ts (#14)"| JavaHttpServer
```

---

## 2. Cơ chế Giao tiếp Frontend Next.js – Backend Java

### 2.1. Hiện trạng Thực tế trong Mã nguồn
- **Frontend Next.js:** Vẫn chạy được độc lập ở chế độ **Self-contained (Zero-crash)**:
  - Các thao tác đọc/ghi dữ liệu của Admin sử dụng **Next.js Server Actions** (`app/admin/actions.ts`); các thao tác POS được chuyển tiếp sang Java khi Backend hoạt động (mục 2.2).
  - Các thao tác giỏ hàng và danh sách yêu thích sử dụng **Route Handlers** (`app/api/cart/route.ts`, `app/api/favorites/route.ts`).
  - Dữ liệu hiển thị được đọc/ghi qua Drizzle ORM (nếu cấu hình `DATABASE_URL`) hoặc **In-memory Mock Store** (`lib/db/mock-store.ts`).
- **Backend Java (`backend-java/`):**
  - **Môi trường & Công cụ:** **Java SE 17+ thuần túy**, build bằng **Maven (`pom.xml`)**, kiểm thử bằng **JUnit 5**, truy xuất PostgreSQL Supabase qua **JDBC Driver** (`org.postgresql:postgresql:42.7.14`). Không phụ thuộc Spring Boot hay Hibernate.
  - **Hiện trạng thực tế:** Đã hoàn thành #01–#12: POJO (`com.dalatcafe.model`), DAO In-Memory/JDBC (`com.dalatcafe.dao`), đủ 9 GoF pattern (`com.dalatcafe.patterns`) và `HttpServer` cổng 8080 (`com.dalatcafe.server`). Bộ JUnit 5 (#13) phủ cả 9 pattern.

### 2.2. Luồng Tích hợp (Issue #14)
1. **Giao thức mạng:** HTTP/1.1 trao đổi dữ liệu định dạng **JSON (MIME type: `application/json; charset=UTF-8`)**, envelope `{ ok, data, message }` hoặc `{ ok: false, error, code }`.
2. **Cấu hình địa chỉ:** Biến môi trường ở Frontend Next.js (mặc định như dưới, đặt `off` để tắt):
   ```env
   JAVA_BACKEND_URL=http://localhost:8080
   ```
3. **Cơ chế chuyển tiếp (API Proxy tại Frontend):**
   - `lib/api-client.ts` đóng gói các lời gọi `fetch()` có kiểu dữ liệu, gửi header `X-User-Role: STAFF`, quá hạn sau 2,5 giây và trả về kết quả phân loại `ok` / `rejected` (4xx) / `unreachable` (lỗi mạng, quá hạn, 5xx) thay vì ném ngoại lệ.
   - `createOrder` → `POST /api/checkout`, `updateTableStatus` → `PUT /api/tables/{id}`, `createReservation` → `POST /api/reservations`.
   - **An toàn giao dịch tài chính (Financial Transaction Safety):** Java từ chối (4xx) thì lỗi được trả về cho nhân viên và không ghi dữ liệu. Java không phản hồi thì Server Action ghi vào kho cục bộ để giao diện không crash. Món mà Java không có hoặc tuỳ chọn có phụ thu thì đơn được giữ ở kho cục bộ thay vì gửi sang Java với giá sai. Đơn chưa thanh toán chỉ lưu cục bộ vì `/api/checkout` luôn thu tiền. Ở chế độ JDBC, nếu CSDL chính mất kết nối, Java trả `HTTP 503 (DATABASE_UNAVAILABLE)` thay vì âm thầm ghi vào bộ nhớ.

---

## 3. Các Tầng Xử lý Chi tiết (System Layers)

### 3.1. Tầng Trình diễn (Presentation Layer - Next.js Client)
- **Công nghệ:** React 19 Client Components (`'use client'`).
- **Nhiệm vụ:**
  - Render giao diện người dùng tương tác cao: Danh mục sản phẩm, bộ lọc tìm kiếm, Modal tùy biến món (Size, topping, đá, đường).
  - Quầy thu ngân POS: Lưới món ăn, bàn phím số, chọn bàn phục vụ, tính tiền thừa, trừ điểm loyalty.
  - Sơ đồ tầng Floor Plan: Hiển thị 15 bàn với màu sắc trạng thái cập nhật theo thời gian thực.
  - Màn hình Bếp KDS: Bảng Kanban 4 cột (`Pending`, `Brewing`, `Ready`, `Completed`) kèm cảnh báo trễ đơn > 10 phút.
  - Quản trị Đặt bàn: Tiếp nhận yêu cầu, xem món đặt trước và nút bấm chuyển đổi đơn sang POS.

### 3.2. Tầng Máy chủ Ứng dụng Next.js (Application Server Layer)
- **Công nghệ:** Next.js Server Components, Server Actions (`app/admin/actions.ts`), Route Handlers (`app/api/`).
- **Nhiệm vụ:**
  - Bảo vệ quyền truy cập phân hệ Admin thông qua hàm `assertAdminAccess()` (`lib/admin/access.ts`).
  - Cung cấp cơ chế revalidation bộ nhớ đệm (`revalidatePath('/admin', 'layout')`) giúp giao diện tự động đồng bộ khi có thay đổi dữ liệu.
  - Đảm bảo cơ chế tự phục hồi lỗi (Fault Tolerance) với In-Memory Mock Store.

### 3.3. Tầng Nghiệp vụ Lõi Java thuần (Core Business Domain Layer)
- **Công nghệ:** Java SE 17+ Pure OOP, không sử dụng bất kỳ framework nào (Không Spring Boot).
- **Nhiệm vụ & 9 GoF Patterns:**
  - `SystemConfigManager` (**Singleton**): Quản lý giờ mở cửa (07:00 - 22:00), tỷ lệ tích điểm (10.000đ = 1 điểm), thời gian tự hủy bàn (30 phút).
  - `PaymentProcessorFactory` (**Factory Method**): Khởi tạo bộ xử lý thanh toán Tiền mặt, QR MoMo hoặc Thẻ POS.
  - `OrderBuilder` (**Builder**): Xây dựng đối tượng Đơn hàng (`Order`) bằng chuỗi bước fluent với giá trị mặc định và kiểm tra đầu vào.
  - `BeverageDecorator` (**Decorator**): Tính giá và mô tả cho đồ uống khi cộng thêm Trân châu, Cheese Foam, nâng Size L.
  - `ReservationToOrderAdapter` (**Adapter**): Chuyển đổi Phiếu đặt bàn (`Reservation`) sang đơn hàng POS qua giao diện `IPosOrderTarget`.
  - `PosCheckoutFacade` (**Facade**): Gom toàn bộ quy trình chốt đơn POS vào một phương thức duy nhất `checkout(CheckoutRequest)`.
  - `DiscountContext` (**Strategy**): Giảm giá theo Phần trăm có trần, Số tiền cố định, Hạng thành viên hoặc Không giảm, đổi được tại thời điểm chạy.
  - `ReservationValidatorHandler` (**Chain of Responsibility**): Chuỗi kiểm tra phiếu đặt bàn (Giờ mở cửa ➔ Sức chứa bàn ➔ Lịch bàn trống).
  - `OrderEventSubject` (**Observer**): Phát sự kiện sau thanh toán để cộng điểm loyalty, chuyển bàn sang dọn dẹp và báo bếp gỡ phiếu.

### 3.4. Tầng Truy xuất Dữ liệu (Data Access Layer - DAO)
- **Giao diện:** `IOrderDao`, `ITableDao`, `IReservationDao`, `ICustomerDao`, `IMenuDao`.
- **Cài đặt:**
  - `InMemoryDatabase`: Lưu trữ dữ liệu trên các cấu trúc dữ liệu `ConcurrentHashMap`, `CopyOnWriteArrayList` phục vụ kiểm thử đơn vị độc lập.
  - `JdbcDatabase`: Kết nối cơ sở dữ liệu quan hệ (PostgreSQL / MySQL) thông qua `java.sql.Connection` và `PreparedStatement` chuẩn Java SE.

---

## 4. Cơ chế Xác thực & Phân quyền (Authentication & Authorization)

### 4.1. Hiện trạng Mã nguồn Frontend
- Cơ chế kiểm soát hiện tại được cấu hình qua biến môi trường tại file `lib/admin/access.ts`:
  - `REQUIRE_ADMIN_AUTH='false'` (mặc định cho môi trường phát triển & demo): Cho phép truy cập thẳng vào trang quản trị Admin.
  - `REQUIRE_ADMIN_AUTH='true'`: Chặn truy cập và yêu cầu đăng nhập nhân viên.
- Không có Spring Security, không có JWT trong mã nguồn hiện có.

### 4.2. Đặc tả Thiết kế Phân quyền RBAC (Role-Based Access Control)
Hệ thống được thiết kế hỗ trợ 4 vai trò độc lập:

| Vai trò (Role) | Đối tượng sử dụng | Phạm vi quyền hạn |
| :--- | :--- | :--- |
| **`ROLE_ADMIN`** | Chủ quán / Quản trị viên hệ thống | Toàn quyền cấu hình quán (`/admin/settings`), xem báo cáo tài chính (`/admin/analytics`), quản lý kho và nhân sự |
| **`ROLE_MANAGER`** | Quản lý ca | Duyệt và chuyển đơn đặt bàn, quản lý sơ đồ bàn, chỉnh sửa menu, xem danh sách đơn |
| **`ROLE_STAFF`** | Thu ngân / Barista | Thao tác bán hàng tại POS (`/admin/pos`), cập nhật tiến trình bếp KDS, đổi trạng thái bàn |
| **`ROLE_CUSTOMER`** | Khách hàng | Xem menu, đặt món giỏ hàng Storefront, lưu món yêu thích, đặt bàn trực tuyến |

---

## 5. Các Luồng Dữ liệu Chính (Core Data Flows)

### 5.1. Luồng Bán hàng tại Quầy POS & Chốt đơn (POS Checkout Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Cashier as Thu ngân (POS UI)
    participant NextAction as Server Action createOrder
    participant Handler as CheckoutHandler
    participant JavaFacade as PosCheckoutFacade
    participant Decorator as BeverageDecorator
    participant Strategy as DiscountContext
    participant Factory as PaymentProcessorFactory
    participant DAO as IOrderDao
    participant Observer as OrderEventSubject

    Cashier->>NextAction: Chọn món, bàn, phương thức thanh toán và xác nhận
    NextAction->>Handler: POST /api/checkout (qua lib/api-client.ts)
    Handler->>JavaFacade: checkout(CheckoutRequest)

    JavaFacade->>Decorator: Bọc món theo Customization (Size L, Topping)
    Decorator-->>JavaFacade: getCost() / getDescription()

    JavaFacade->>Strategy: executeDiscount(subtotal, customer)
    Strategy-->>JavaFacade: Số tiền được giảm

    JavaFacade->>JavaFacade: Giữ chỗ tồn kho
    JavaFacade->>Factory: createProcessor(paymentMethod)
    Factory-->>JavaFacade: IPaymentProcessor
    JavaFacade->>JavaFacade: processPayment(total, orderCode)

    JavaFacade->>DAO: save(order)

    JavaFacade->>Observer: notifyOrderCompleted(order)
    par Tích điểm Loyalty
        Observer->>Observer: LoyaltyPointObserver: Cộng điểm CRM
    and Đổi trạng thái bàn
        Observer->>Observer: TableStatusSyncObserver: Chuyển bàn sang "Cleaning"
    and Báo bếp
        Observer->>Observer: KitchenNotificationObserver: Gỡ phiếu khỏi KDS
    end

    JavaFacade-->>Handler: CheckoutResult (success, order, payment, warnings)
    Handler-->>NextAction: 200 { orderCode, finalTotal, ... }
    NextAction->>NextAction: Ghi bản sao đơn vào kho cục bộ với mã đơn của Java
    NextAction-->>Cashier: Thông báo thành công & làm mới giao diện
```

---

### 5.2. Luồng Đặt bàn Trước & Chuyển sang POS (Reservation & Transfer Flow)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Khách hàng / Nhân viên
    participant WebUI as Server Action createReservation
    participant Handler as ReservationHandler
    participant Chain as ReservationValidatorHandler
    participant Adapter as ReservationToOrderAdapter
    participant PosUI as Màn hình POS Terminal

    Customer->>WebUI: Nhập tên, SĐT, giờ hẹn, số khách, bàn
    WebUI->>Handler: POST /api/reservations
    Handler->>Chain: validate(reservation)

    Note over Chain: 1. OperatingHoursValidator: giờ đến trong 07:00 - 22:00<br/>2. CapacityGuestValidator: bàn tồn tại, 1 - 20 khách, không vượt số ghế<br/>3. TableAvailabilityValidator: không trùng khung 2 giờ trên cùng bàn

    alt Hợp lệ
        Chain-->>Handler: ValidationResult.valid()
        Handler->>Handler: Lưu phiếu (Trạng thái: "Chờ xác nhận")
        Handler-->>WebUI: 201 { id: "RES-xxxx" }
    else Không hợp lệ
        Chain-->>Handler: ValidationResult.invalid(lý do)
        Handler-->>WebUI: 400 CHAIN_VALIDATION_FAILED
    end

    Note over Customer,PosUI: Khách đến quán nhận bàn
    PosUI->>Adapter: new ReservationToOrderAdapter(reservation)
    Adapter-->>PosUI: toPosOrder() → Order DINE_IN, PENDING, UNPAID kèm món đặt trước
```

---

## 6. Phân chia Phạm vi Công việc (Scope Boundaries for Issues)

Để việc phát triển và giao việc qua Issue được rõ ràng, dự án chia ranh giới thành 3 nhóm phạm vi:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PHẠM VI FRONTEND NEXT.JS                        │
│ - Giao diện Storefront (DrinkMenu, CartSheet, Wishlist, Hero, Journal) │
│ - Giao diện Quản trị Admin (POS, KDS Board, Floor Plan, Tables, CRM)   │
│ - Next.js Server Actions & Route Handlers nội bộ                       │
│ - Zustand Store, SWR Cache & In-memory Fallback Store                  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Giao tiếp qua HTTP REST JSON
┌───────────────────────────────────▼────────────────────────────────────┐
│                         PHẠM VI TÍCH HỢP (INTEGRATION)                 │
│ - Chuẩn hóa Request / Response DTO giữa Next.js và Java Backend        │
│ - Cấu hình biến môi trường kết nối JAVA_BACKEND_URL                    │
│ - Cơ chế xử lý lỗi mạng & Tự động Fallback khi máy chủ Java gián đoạn  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                        PHẠM VI BACKEND JAVA THUẦN                      │
│ - Cài đặt Java SE HttpServer (com.sun.net.httpserver.HttpServer)       │
│ - Cài đặt 9 GoF Design Patterns (Gói com.dalatcafe.patterns)           │
│ - Định nghĩa các lớp thực thể POJO (Order, Table, Reservation...)      │
│ - Tầng DAO truy xuất dữ liệu (InMemoryDatabase & JDBC Connection)      │
│ - Kiểm thử đơn vị (Unit Tests JUnit) cho toàn bộ 9 mẫu thiết kế        │
└────────────────────────────────────────────────────────────────────────┘
```

Mỗi Issue tạo mới bắt buộc phải được gắn nhãn tương ứng (`scope:frontend`, `scope:backend`, `scope:integration`) để định hướng chính xác người thực hiện và tiêu chuẩn nghiệm thu.


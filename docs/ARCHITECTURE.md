# KIẾN TRÚC HỆ THỐNG (SYSTEM ARCHITECTURE)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

Đây là nguồn duy nhất cho kiến trúc tổng thể, cơ chế tích hợp Next.js ↔ Java, phân quyền và các luồng dữ liệu chính. Công nghệ và lệnh chạy xem [README](../README.md); API xem [API_SPEC.md](API_SPEC.md); dữ liệu xem [DATABASE.md](DATABASE.md); chi tiết 9 pattern xem [DESIGN_PATTERNS_SPEC.md](DESIGN_PATTERNS_SPEC.md).

---

## 1. Tổng quan kiến trúc

Hệ thống chia thành các tầng tách biệt. Frontend chạy được độc lập (zero-crash). Khi Backend Java hoạt động, các nghiệp vụ POS được chuyển sang Java xử lý.

```mermaid
graph TB
    subgraph Client_Tier ["1. Trình duyệt (Next.js 16 / React 19)"]
        StorefrontClient["Khách hàng - Storefront"]
        AdminClient["Nhân viên - POS, KDS, Admin"]
    end

    subgraph App_Server_Tier ["2. Máy chủ Next.js (cổng 3000)"]
        AppRouter["App Router (app/)"]
        ServerActions["Server Actions (app/admin/actions.ts)"]
        ApiClient["API Proxy (lib/api-client.ts)"]
        RouteHandlers["Route Handlers (/api/cart, /api/favorites)"]
        FrontStore[("Drizzle admin_* hoặc Mock Store")]

        StorefrontClient --> AppRouter
        AdminClient --> AppRouter
        AppRouter --> ServerActions
        AppRouter --> RouteHandlers
        ServerActions --> ApiClient
        ServerActions --> FrontStore
    end

    subgraph Core_Backend_Tier ["3. Backend Java SE (cổng 8080)"]
        JavaHttpServer["HttpServer + CorsHandler + SimpleAuthFilter"]

        subgraph Pattern_Domain ["GoF Design Patterns (com.dalatcafe.patterns)"]
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

        DomainModel["POJO (Order, Table, Reservation, MenuItem, Customer)"]
        JavaDAO["DAO (DaoFactory + I*Dao)"]

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

    subgraph Persistence_Tier ["4. Lưu trữ Java"]
        InMemoryDB[("InMemoryDatabase (mặc định)")]
        PostgresDB[("PostgreSQL qua JDBC (khi DATABASE_URL kết nối được)")]
        JavaDAO --> InMemoryDB
        JavaDAO -.-> PostgresDB
    end

    ApiClient ==>|"HTTP REST JSON"| JavaHttpServer
```

Lưu ý: kho của frontend và kho của Java là hai bộ dữ liệu riêng, xem [DATABASE.md](DATABASE.md).

---

## 2. Tích hợp Frontend Next.js ↔ Backend Java

### 2.1. Cấu hình
- `JAVA_BACKEND_URL` nhận giá trị mặc định `http://localhost:8080`. Đặt `off` để tắt hẳn việc gọi sang Java.
- `lib/api-client.ts` gửi JSON kèm `Authorization: Bearer <token>` lấy từ cookie phiên (xem §4), đặt timeout 2,5 giây, và không ném ngoại lệ. Mỗi lời gọi trả về một trong ba kết quả:
  - `ok`: thành công.
  - `rejected`: Java trả 4xx (lỗi nghiệp vụ).
  - `unreachable`: lỗi mạng, quá thời gian chờ, phản hồi không phải JSON, hoặc 5xx.

### 2.2. Ánh xạ Server Action → Endpoint

| Server Action | Endpoint Java | Điều kiện gửi sang Java | Sau khi Java trả lời |
| :--- | :--- | :--- | :--- |
| `createOrder` | `POST /api/checkout` | Đơn **đã thanh toán**; mọi món đều có trong menu Java (ghép theo **tên**, vì hai kho đánh số món khác nhau); không có biến thể tính phụ thu. Size L / topping được gửi dưới dạng `customizations` | Ghi một bản sao vào kho frontend, mang mã đơn của Java, để KDS và sơ đồ bàn hiển thị |
| `updateTableStatus` | `PUT /api/tables/{id}` | Luôn gửi | Cập nhật kho frontend |
| `createReservation` | `POST /api/reservations` | Luôn gửi | Java chạy chuỗi kiểm định, kết quả của Java là quyết định cuối cùng |
| `getReservations` (trang Đặt bàn) | `GET /api/reservations` | Luôn gửi | Gộp phiếu Java với phiếu cục bộ; Java không phản hồi thì chỉ hiện phiếu cục bộ |
| `transferReservationToPos` | `POST /api/reservations/{code}/transfer-pos` | Phiếu có nguồn Java | Ghi bản sao đơn vào kho frontend; phiếu cục bộ dùng bản sao Adapter phía frontend (`transferMockReservation`) |

### 2.3. Quy tắc chịu lỗi (Zero-Crash & An toàn tiền)
- **Java từ chối (4xx):** trả lỗi nghiệp vụ cho nhân viên, không ghi dữ liệu ở đâu cả.
- **Java không phản hồi:** Server Action ghi vào kho frontend (Drizzle hoặc Mock Store). Giao diện không crash.
- **Đơn chưa thanh toán:** chỉ lưu ở frontend, vì `/api/checkout` luôn thu tiền.
- **Món Java không có, hoặc biến thể có phụ thu:** đơn lưu ở frontend thay vì gửi sang Java với giá sai.
- **Chế độ JDBC mất kết nối:** Java trả `503 DATABASE_UNAVAILABLE` và không thu tiền. `api-client` xếp mã này vào loại `rejected` (không phải `unreachable`), nên nhân viên nhận lỗi và đơn **không** bị ghi cục bộ như đã thanh toán. Các lỗi 5xx khác vẫn được coi là `unreachable`.

---

## 3. Các tầng xử lý

| Tầng | Công nghệ | Trách nhiệm |
| :--- | :--- | :--- |
| Trình diễn | React 19 Client Components | Storefront (menu, tìm kiếm, tuỳ biến món, giỏ hàng); Admin: POS, KDS (4 cột, cảnh báo trễ quá 10 phút), sơ đồ 15 bàn, đặt bàn, kho, CRM, báo cáo |
| Máy chủ Next.js | Server Components, Server Actions, Route Handlers | Chặn truy cập Admin (`assertAdminAccess`), gọi sang Java qua `api-client`, ghi kho frontend, làm mới giao diện (`revalidatePath('/admin', 'layout')`) |
| Nghiệp vụ Java | Java SE 17, không dùng framework | 9 GoF pattern (bảng tóm tắt tại [DESIGN_PATTERNS_SPEC §2](DESIGN_PATTERNS_SPEC.md#2-bảng-tổng-hợp-các-design-patterns-gof)) và 4 REST handler |
| DAO Java | `DaoFactory` → `InMemory*Dao` / `Jdbc*Dao` | `InMemoryDatabase` là chế độ chạy mặc định và cũng dùng cho kiểm thử. JDBC (chỉ PostgreSQL) bật khi `DATABASE_URL` kết nối được |

---

## 4. Xác thực & phân quyền (RBAC)

**Tài khoản** nằm ở backend Java (bảng `users`, in-memory hoặc JDBC). Mật khẩu băm PBKDF2-HMAC-SHA256 (600.000 vòng, salt ngẫu nhiên). Java phát **access token JWT HS256** (`TokenService`); Next.js giữ token trong cookie `dalatcafe_session` (`httpOnly`, `sameSite=lax`, `secure` khi production) và kiểm chữ ký bằng `jose` với cùng `AUTH_JWT_SECRET`.

| Vai trò | Được làm |
| :--- | :--- |
| `CUSTOMER` | Storefront, `/account` (đơn, voucher, mật khẩu). Tự đăng ký tại `/register` hoặc tiếp tục với Google |
| `STAFF` | Thêm toàn bộ console `/admin`: POS, KDS, bàn, đặt bàn, kho, khách hàng |
| `MANAGER` | Thêm tạo món (`POST /api/menu`), thống kê, nhân sự, lịch làm việc |
| `ADMIN` | Thêm cài đặt quán (`/api/config`) và `/admin/users` (cấp tài khoản, đổi vai trò, khoá) |

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant N as Next.js (Server Action / Route Handler)
    participant G as Google
    participant J as Java (/api/auth)

    alt Email + mật khẩu (mọi vai trò)
        U->>N: signIn(email, password) hoặc signUp(...)
        N->>J: POST /api/auth/login | /api/auth/register
        J-->>N: { token, user }
    else Google (chỉ khách hàng)
        U->>N: GET /api/auth/google/start
        N-->>U: 302 tới Google (state, nonce, PKCE S256)
        U->>G: Đồng ý
        G-->>U: 302 /api/auth/google/callback?code&state
        U->>N: callback
        N->>G: Đổi code lấy id_token (kèm code_verifier)
        N->>N: Kiểm id_token bằng JWKS (iss, aud, exp, nonce, email_verified)
        N->>J: POST /api/auth/google + X-Service-Key
        J-->>N: { token, user } hoặc 403 STAFF_PASSWORD_ONLY
    end
    N-->>U: Set-Cookie dalatcafe_session (httpOnly) + chuyển trang theo vai trò
    U->>N: Mở /admin/...
    N->>N: proxy.ts kiểm cookie và vai trò
    N->>J: Gọi API với Authorization: Bearer
    J->>J: SimpleAuthFilter kiểm token, đọc lại vai trò từ tài khoản
```

**Ba lớp kiểm tra:**
1. `proxy.ts` (Next 16, thay cho middleware): chặn sớm. Chưa đăng nhập → `/login?next=…`; thiếu vai trò → về trang của vai trò đó (`/admin?denied=1` hoặc `/`). Luật đường dẫn ở `lib/auth/roles.ts`.
2. Tầng dữ liệu frontend: layout admin và các trang MANAGER/ADMIN gọi `requirePageRole`, mọi hàm dữ liệu và Server Action gọi `assertAdminAccess(vai trò)`. Đây là kiểm tra có thẩm quyền, theo hướng dẫn DAL của Next.js.
3. Java `SimpleAuthFilter`: kiểm Bearer token cho mọi endpoint, rồi đọc lại tài khoản nên đổi vai trò hay khoá tài khoản có hiệu lực ngay.

**An toàn:** cùng một câu trả lời cho email sai và mật khẩu sai; khoá email sau 5 lần sai trong 15 phút; `?next=` chỉ nhận đường dẫn nội bộ; token `alg: none` hoặc ký bằng khoá khác bị từ chối; Google chỉ đăng nhập được tài khoản khách hàng, nên tài khoản nhân viên luôn chịu cơ chế khoá khi sai mật khẩu và do quản trị viên quản lý; quản trị viên cuối cùng không thể bị hạ quyền. Lần chạy đầu, `AdminBootstrap` tạo một ADMIN từ `ADMIN_EMAIL` / `ADMIN_PASSWORD`, hoặc in mật khẩu dùng một lần vào log server.

**Giới hạn:** token có hạn 8 giờ và không thu hồi được trước hạn, nhưng Java đọc lại tài khoản ở mỗi request nên khoá tài khoản vẫn có tác dụng ngay ở phía Java; trang admin của frontend có thể còn mở cho tới khi token hết hạn (dữ liệu Java khi đó trả 401). Bộ đếm sai mật khẩu nằm trong bộ nhớ của một tiến trình Java.

---

## 5. Luồng dữ liệu chính

### 5.1. Bán hàng tại quầy & chốt đơn (POS Checkout)

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

    JavaFacade->>Observer: notifyOrderPaid(order)
    par Tích điểm Loyalty
        Observer->>Observer: LoyaltyPointObserver: Cộng điểm CRM
    and Xếp bàn
        Observer->>Observer: TableStatusSyncObserver: Bàn sang "Occupied"
    and Báo bếp
        Observer->>Observer: KitchenNotificationObserver: Phiếu mới trên KDS
    end
    Note over Observer: Khi KDS báo "completed" (PATCH /api/orders/{code}/status),<br/>notifyOrderCompleted chuyển bàn sang "Cleaning" và gỡ phiếu

    JavaFacade-->>Handler: CheckoutResult (success, order, payment, warnings)
    Handler-->>NextAction: 200 { orderCode, finalTotal, ... }
    NextAction->>NextAction: Ghi bản sao đơn vào kho cục bộ với mã đơn của Java
    NextAction-->>Cashier: Thông báo thành công & làm mới giao diện
```

### 5.2. Đặt bàn trước & chuyển sang POS

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

    Note over Customer,PosUI: Khách đến quán nhận bàn: bấm "Sang POS"
    PosUI->>Handler: POST /api/reservations/{code}/transfer-pos
    Handler->>Adapter: new ReservationToOrderAdapter(reservation).toPosOrder()
    Adapter-->>Handler: Order DINE_IN, PENDING, UNPAID kèm món đặt trước
    Handler->>Handler: Lưu đơn, phiếu → SEATED, bàn → OCCUPIED
    Handler-->>PosUI: 200 { orderCode, items, total } → đơn hiện trên KDS
```

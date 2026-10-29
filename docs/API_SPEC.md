# ĐẶC TẢ API (API SPECIFICATION)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

Tài liệu mô tả hai nhóm API: REST của **Backend Java** (`http://localhost:8080`) và Route Handler của **Next.js** (`http://localhost:3000`). Cách frontend gọi sang Java và quy tắc fallback khi lỗi xem tại [ARCHITECTURE §2](ARCHITECTURE.md#2-tích-hợp-frontend-nextjs--backend-java).

---

## 1. Quy chuẩn chung (Backend Java)

### 1.1. Định dạng phản hồi
Mọi endpoint Java trả JSON UTF-8 với cùng một khung:

```json
{ "ok": true,  "data": { }, "message": "tuỳ chọn" }
{ "ok": false, "error": "mô tả lỗi", "code": "MÃ_LỖI" }
```

Ngoại lệ: một đường dẫn nằm ngoài các nhóm đã đăng ký (`/api/menu`, `/api/tables`, `/api/reservations`, `/api/checkout`, `/api/orders`, `/api/customers`, `/api/analytics`, `/api/vouchers`, `/api/config`) sẽ nhận trang 404 mặc định của `HttpServer`, không theo khung trên.

### 1.2. Mã lỗi

| HTTP | `code` | Khi nào |
| :---: | :--- | :--- |
| 400 | `INVALID_INPUT` | Thiếu hoặc sai trường, JSON hỏng, đổi điểm mà không có SĐT thành viên, thanh toán bị từ chối (`PAYMENT_FAILED`) |
| 400 | `INSUFFICIENT_POINTS` | `useLoyaltyPoints` lớn hơn số điểm khách đang có |
| 400 | `CHAIN_VALIDATION_FAILED` | Phiếu đặt bàn không qua chuỗi kiểm định |
| 400 | `INVALID_VOUCHER` | Mã giảm giá không dùng được: không tồn tại, đã tắt, chưa tới ngày, hết hạn, hết lượt, tài khoản đã dùng hết lượt, cần đăng nhập, chỉ cho đơn online, hoặc chưa đạt đơn tối thiểu (thông báo nói rõ lý do) |
| 401 | `UNAUTHORIZED` | Thiếu, sai hoặc hết hạn Bearer token; tài khoản đã bị khoá; sai `X-Service-Key` |
| 403 | `STAFF_PASSWORD_ONLY` | Đăng nhập Google vào tài khoản nhân viên (chỉ khách hàng được dùng Google) |
| 401 | `INVALID_CREDENTIALS` | Sai email hoặc mật khẩu (cùng một câu trả lời cho cả hai trường hợp) |
| 403 | `ACCOUNT_DISABLED` | Đăng nhập đúng mật khẩu nhưng tài khoản đã bị khoá |
| 409 | `EMAIL_TAKEN` | Email đã có tài khoản |
| 429 | `TOO_MANY_ATTEMPTS` | Sai mật khẩu 5 lần trong 15 phút với cùng một email |
| 403 | `FORBIDDEN` | Vai trò không đủ quyền (ví dụ `CUSTOMER` gọi `/api/checkout`) |
| 404 | `NOT_FOUND` | Không tìm thấy bàn, món, đơn, phiếu đặt bàn hoặc khách, hoặc sai đường dẫn con |
| 405 | `INVALID_INPUT` | Sai phương thức HTTP |
| 409 | `RESOURCE_CONFLICT` | Món đang tắt bán, trùng tên món, chuyển trạng thái đơn / phiếu không hợp lệ, đơn đã thanh toán |
| 413 | `INVALID_INPUT` | Body vượt 1 MB |
| 500 | `INTERNAL_SERVER_ERROR` | Lỗi không mong đợi |
| 503 | `DATABASE_UNAVAILABLE` | Chế độ JDBC mất kết nối khi checkout hoặc khi thanh toán đơn (`/pay`), hoặc không trừ được điểm khách muốn đổi. Không thu tiền, không ghi đơn. |

### 1.3. Xác thực, phân quyền & CORS
- **Xác thực:** gửi `Authorization: Bearer <token>`, với token lấy từ `/api/auth/login`, `/api/auth/register` hoặc `/api/auth/google` (mục 3.19). Token là JWT HS256 có `sub` (id tài khoản), `email`, `name`, `role`, `exp` (mặc định 8 giờ), ký bằng `AUTH_JWT_SECRET`. Frontend dùng cùng khoá để kiểm cookie phiên.
- **Vai trò** (thấp đến cao): `CUSTOMER` < `STAFF` < `MANAGER` < `ADMIN`; vai trò cao gồm mọi quyền của vai trò thấp hơn. Mỗi request đọc lại vai trò **từ tài khoản**, không tin vai trò ghi trong token, nên đổi vai trò hay khoá tài khoản có hiệu lực ngay với cả token cũ. Chi tiết tại [ARCHITECTURE §4](ARCHITECTURE.md#4-xác-thực--phân-quyền-rbac).
- **Công khai:** `GET /api/menu`, `POST /api/reservations`, `POST /api/vouchers/validate`, `GET /api/vouchers/active`, `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/google` (cần `X-Service-Key`). Token hỏng hoặc hết hạn ở endpoint công khai bị bỏ qua, không làm lỗi request.
- **Mọi tài khoản đã đăng nhập:** `GET /api/auth/me`, `POST /api/auth/password`.
- **Chỉ ADMIN:** `/api/users`, `PUT | PATCH /api/config`.
- **Cần MANAGER hoặc ADMIN:** `POST /api/menu`, `GET /api/analytics/overview`, `/api/vouchers` (GET, POST), `/api/vouchers/{id}` (PUT, DELETE), `GET /api/vouchers/{id}/usages`.
- **Cần STAFF, MANAGER hoặc ADMIN:** mọi endpoint còn lại. `SimpleAuthFilter` từ chối theo mặc định, nên một endpoint mới không bao giờ vô tình thành công khai.
- Chỉ chính đường dẫn gốc của nhóm và đường dẫn con của nó mới thuộc nhóm đó: `/api/users`, `/api/users/7` là của `/api/users`, còn `/api/usersX` trả 404 `NOT_FOUND`. (`HttpServer` chọn handler theo tiền tố chuỗi, nên nếu không chặn, `/api/usersX` sẽ tới handler tài khoản mà chỉ cần quyền STAFF.)
- Mật khẩu ở `login` và `currentPassword` ở `/api/auth/password` được so **đúng như đã gõ**, không cắt khoảng trắng, giống lúc đăng ký và đổi mật khẩu.
- **Đơn online của khách (server tới server):** không có Bearer token, header `X-Service-Key: <AUTH_SERVICE_KEY>` được coi là một caller STAFF, nhưng **chỉ** ở `POST /api/checkout`, `POST /api/orders/sync` và `POST /api/vouchers/validate|redeem|release`. Hai endpoint giữ và nhả lượt voucher **chỉ** nhận khoá này (nhân viên gọi trả 403); `userId` trong body checkout và validate chỉ được tin khi đi kèm khoá. Frontend dùng khoá này khi khách (vãng lai hoặc đã đăng nhập) đặt hàng ở `/checkout`, và khi đó không gửi token của khách. Ở mọi endpoint khác khoá này không có tác dụng (vẫn 401). Java phải chạy với cùng `AUTH_SERVICE_KEY` như frontend.
- Thiếu token hoặc token sai trả 401 `UNAUTHORIZED`; vai trò không đủ trả 403 `FORBIDDEN`. Header `X-User-Role` tự khai **chỉ** được chấp nhận khi server chạy với `AUTH_ALLOW_ROLE_HEADER=true` (dành cho phát triển và bộ test REST cũ); khi có Bearer token thì token luôn thắng.
- **CORS:** `Access-Control-Allow-Origin: *`. Cho phép các phương thức GET, POST, PUT, PATCH, DELETE và OPTIONS. Preflight `OPTIONS` trả 204, không cần token.

### 1.4. Chi nhánh
Quán có hai chi nhánh, id cố định ở `com.dalatcafe.model.Branches` và `frontend-nextjs/lib/branches.ts`: `phan-dinh-phung` (123 Phan Đình Phùng, chi nhánh mặc định) và `bui-thi-xuan` (456 Bùi Thị Xuân).
- **Thuộc về một chi nhánh:** bàn, đơn hàng, phiếu đặt bàn (trường `branch` trong JSON). **Dùng chung:** thực đơn, khách hàng thành viên, tài khoản, cài đặt quán.
- **Lọc danh sách:** `GET /api/tables`, `/api/tables/catalog`, `/api/orders`, `/api/reservations`, `/api/analytics/overview` nhận `?branch=<id>`. Không gửi thì trả cả quán; id lạ trả 400.
- **Kiểm tra lịch bàn:** `GET /api/tables/catalog?dateTime=<ISO-8601>&endTime=<ISO-8601>&branch=<id>` thêm `available` cho từng bàn, không trả thông tin khách. `endTime` không bắt buộc (mặc định như khi đặt: +2 giờ, cắt ở giờ đóng cửa). Bàn thuộc bất kỳ phiếu chưa hủy nào có khoảng giờ chồng lên `[dateTime, endTime)` đều không chọn được, kể cả bàn phụ trong phiếu ghép. Máy chủ kiểm tra lại khi lưu; các bàn khác vẫn đặt cùng giờ được. Khách chưa nhận bàn quá 30 phút tính từ giờ đến thì phiếu tự hủy và không còn giữ chỗ (áp dụng cho mọi phiếu, cả phiếu nhân viên tạo hộ); khách đã nhận bàn không bị tự nhả bàn. Khi không đọc được lịch hoặc mất kết nối, frontend không ghi nhận phiếu bằng dữ liệu độc lập; chế độ demo chỉ dùng khi `JAVA_BACKEND_URL=off`.
- **Chi nhánh của bản ghi mới:** bàn mới vào chi nhánh trong `branch` của body (mặc định chi nhánh đầu), sửa bàn không đổi chi nhánh. Đơn tại bàn và phiếu đặt lấy chi nhánh của bàn; đơn mang đi / giao hàng lấy `branch` trong body. Gửi `branch` khác chi nhánh của bàn, hoặc ghép bàn của hai chi nhánh vào một phiếu, đều trả 400 trước khi thu tiền hay lưu.
- Tên bàn chỉ cần không trùng **trong cùng chi nhánh** (cả hai chi nhánh đều có `Bàn 01`).

---

## 2. Danh mục endpoint

| Endpoint | Phương thức | Quyền | Pattern | Trạng thái |
| :--- | :---: | :---: | :--- | :---: |
| `/api/menu` | GET | Công khai | — | 🟢 Đã triển khai |
| `/api/tables` | GET | STAFF+ | — | 🟢 Đã triển khai |
| `/api/tables/{id}` hoặc `/api/tables/{id}/status` | PUT, PATCH | STAFF+ | — | 🟢 Đã triển khai |
| `/api/reservations` | GET | STAFF+ | — | 🟢 Đã triển khai |
| `/api/reservations/mine` | GET | Đăng nhập | Lịch sử đặt bàn của tài khoản hiện tại | 🟢 Đã triển khai |
| `/api/reservations` | POST | Công khai | **Chain of Responsibility** | 🟢 Đã triển khai |
| `/api/checkout` | POST | STAFF+ | **Facade** (+ Decorator, Builder, Strategy, Factory, Observer) | 🟢 Đã triển khai |
| `/api/reservations/{code}/transfer-pos` | POST | STAFF+ | **Adapter** | 🟢 Đã triển khai |
| `/api/menu` | POST | MANAGER+ | — | 🟢 Đã triển khai |
| `/api/menu/{id}` | PUT, PATCH, DELETE | MANAGER+ | — | 🟢 Đã triển khai |
| `/api/menu/{id}/stock` | PATCH, PUT | STAFF+ | — | 🟢 Đã triển khai |
| `/api/reservations/{code}` | PUT, PATCH | STAFF+ | **Chain of Responsibility** | 🟢 Đã triển khai |
| `/api/reservations/{code}/status` | PATCH, PUT | STAFF+ | — | 🟢 Đã triển khai |
| `/api/orders` | GET | STAFF+ | — | 🟢 Đã triển khai |
| `/api/orders/{code}/status` | PATCH, PUT | STAFF+ | **Observer** (đơn hoàn tất) | 🟢 Đã triển khai |
| `/api/orders/{code}/pay` | POST | STAFF+ | **Factory** + **Observer** | 🟢 Đã triển khai |
| `/api/customers` | GET | STAFF+ | — | 🟢 Đã triển khai |
| `/api/analytics/overview` | GET | MANAGER+ | — | 🟢 Đã triển khai |
| `/api/vouchers/validate` | POST | Công khai | **Strategy** | 🟢 Đã triển khai |
| `/api/vouchers` | GET, POST | MANAGER+ | — | 🟢 Đã triển khai |
| `/api/vouchers/{id}` | PUT, DELETE | MANAGER+ | — | 🟢 Đã triển khai |
| `/api/vouchers/{id}/usages` | GET | MANAGER+ | — | 🟢 Đã triển khai |
| `/api/vouchers/active` | GET | Công khai | — | 🟢 Đã triển khai |
| `/api/vouchers/redeem`, `/api/vouchers/release` | POST | Service key | — | 🟢 Đã triển khai |
| `/api/orders/sync` | POST | STAFF+ | — | 🟢 Đã triển khai |
| `/api/config` | GET | STAFF+ | **Singleton** | 🟢 Đã triển khai |
| `/api/config` | PUT, PATCH | ADMIN | **Singleton** | 🟢 Đã triển khai |
| `/api/auth/register`, `/api/auth/login` | POST | Công khai | — | 🟢 Đã triển khai |
| `/api/auth/google` | POST | `X-Service-Key` | — | 🟢 Đã triển khai |
| `/api/auth/me` | GET | Đã đăng nhập | — | 🟢 Đã triển khai |
| `/api/auth/password` | POST | Đã đăng nhập | — | 🟢 Đã triển khai |
| `/api/users` | GET, POST | ADMIN | — | 🟢 Đã triển khai |
| `/api/users/{id}` | PATCH, PUT | ADMIN | — | 🟢 Đã triển khai |

Vòng đời đơn hiện được kiểm bằng một bảng chuyển trạng thái trong `OrderHandler`; tách thành State Pattern vẫn là đề xuất (🔷, xem [DESIGN_PATTERNS_SPEC](DESIGN_PATTERNS_SPEC.md)).

---

## 3. Chi tiết endpoint Java đã triển khai

### 3.1. `GET /api/menu`
Trả về toàn bộ món bán và nguyên liệu.

```json
{
  "ok": true,
  "data": [
    {
      "id": 1, "name": "Cà phê Muối Đặc Biệt", "category": "Cà phê", "kind": "menu",
      "unit": "ly",
      "costPrice": 15000, "sellPrice": 45000, "inStock": true,
      "recipe": "…", "variations": [{ "name": "Nóng", "price": 0 }], "imageUrl": null
    }
  ]
}
```

### 3.2. `GET /api/tables`
Trả về bàn của cả quán, hoặc một chi nhánh với `?branch=` (dữ liệu mẫu: 15 bàn ở `phan-dinh-phung` với khu `Main Floor`, `Patio`, `Coffee Bar`; 8 bàn ở `bui-thi-xuan` với khu `Sân vườn`, `Góc làm việc`, `Tầng 2`). Mỗi bàn: `id`, `name` (`"Bàn 01"`…), `seats`, `zone`, `branch`, `status` (chữ thường), `guestCount`, `occupiedSince`.

### 3.3. `PUT|PATCH /api/tables/{id}` (hoặc `/api/tables/{id}/status`)
```json
{ "status": "occupied", "guestCount": 3 }
```
- `status` nhận một trong `available`, `occupied`, `reserved`, `cleaning`.
- `guestCount` là tuỳ chọn, phải nằm trong `0…seats`. Nếu trạng thái khác `occupied` thì số khách luôn được đưa về 0.
- Phản hồi 200: `{ "ok": true, "message": "Table #3 status changed to 'occupied'" }`. Sai đầu vào trả 400, không có bàn trả 404.

### 3.4. `GET /api/reservations`
Danh sách phiếu (lọc bằng `?branch=`): `id` (mã `RES-xxxx`), `customer`, `contact`, `email`, `dateTime`, `table`, `tableId`, `tableIds`, `branch`, `guests`, `status` (nhãn tiếng Việt), `note`, `preOrders[]`.

### 3.5. `POST /api/reservations`
```json
{
  "customer": "Nguyễn Văn An", "contact": "0912345678", "email": "an@example.com",
  "dateTime": "2026-10-20T05:00:00Z", "endTime": "2026-10-20T06:30:00Z", "tableId": 9, "guests": 3, "note": "Sinh nhật",
  "preOrders": [{ "menuItemId": 2, "qty": 2 }]
}
```
- `endTime` (giờ kết thúc, ISO-8601) không bắt buộc. Thiếu thì mặc định là `dateTime` + 2 giờ, cắt lại ở giờ đóng cửa của cùng ngày. Sai định dạng trả 400. Mọi JSON phiếu đặt bàn đều trả `endTime`; phiếu cũ không lưu giờ kết thúc trả `dateTime` + 2 giờ.
- Mỗi món đặt trước phải có `menuItemId` của một món trong menu. Tên và giá lấy từ menu tại thời điểm đặt; `name` và `price` do client gửi bị bỏ qua (endpoint công khai). Món không tồn tại hoặc thiếu `menuItemId` trả **400** `INVALID_INPUT`. `menuItemId` được giữ trên đơn POS khi `transfer-pos`.
- Chỉ định bàn bằng `tableId`, hoặc bằng tên bàn trong trường `table` (ví dụ `"Bàn 09"`). `dateTime` phải là một thời điểm ISO-8601.
- Phiếu đi qua chuỗi `OperatingHoursValidator` (giờ đến không sớm hơn hiện tại quá 15 phút, trong 07:00–22:00 giờ Việt Nam; giờ kết thúc cùng ngày, sau giờ đến ít nhất 30 phút và không quá giờ đóng cửa) → `CapacityGuestValidator` (1–20 khách, không vượt số ghế) → `TableAvailabilityValidator` (khoảng `[dateTime, endTime)` không giao với phiếu chưa hủy khác trên cùng bàn; hai phiếu nối tiếp nhau như 18:00–19:00 và 19:00–20:30 không bị coi là trùng).
- Hợp lệ trả **201**: `{ "ok": true, "data": { "id": "RES-0010", "status": "Chờ xác nhận" } }`.
- Không qua chuỗi trả **400** `CHAIN_VALIDATION_FAILED`, thông báo lấy từ mắt xích đầu tiên thất bại.

### 3.6. `POST /api/checkout`
```json
{
  "customer": "Phùng Hoài Bo", "customerPhone": "0908123456",
  "tableId": 4, "orderType": "dine-in", "paymentMethod": "card",
  "voucherCode": "WELCOME10", "tenderedAmount": 150000, "note": "Ít đá",
  "lines": [
    { "menuItemId": 2, "qty": 1, "size": "L", "toppings": ["cheese foam", "trân châu"] }
  ]
}
```
- `orderType`: `dine-in`, `pickup` hoặc `delivery`. `paymentMethod`: `cash`, `qr` hoặc `card`.
- Mỗi dòng có thể kèm `size` (`S`, `M`, `L`; chỉ `L` tính phụ thu), `toppings` (chứa "pearl" / "trân châu" hoặc "cheese" / "foam" / "phô mai") hoặc `customizations` (`SIZE_L`, `CHEESE_FOAM`, `WHITE_PEARL`).
- **Giảm giá:**
  - `voucherCode` chỉ nhận `WELCOME10`: giảm 10%, tối đa 50.000đ.
  - Không có voucher nhưng `customerPhone` khớp một khách đã lưu: giảm theo hạng thành viên. Khách đó cũng được cộng điểm qua `LoyaltyPointObserver`, gọi trực tiếp trên đúng đơn của lần checkout này (không gắn lên subject dùng chung, nên đơn của quầy khác thanh toán cùng lúc không cộng nhầm cho khách).
  - **Đổi điểm:** `useLoyaltyPoints` (số nguyên) cần `customerPhone` của một thành viên và không vượt số điểm đang có (nếu vượt: 400 `INSUFFICIENT_POINTS`). `PointRedemptionDiscountStrategy` cộng giá trị điểm (1 điểm = 1.000đ) lên trên voucher hoặc giảm theo hạng, và chỉ dùng số điểm mà phần tiền còn lại hấp thụ được. Số điểm yêu cầu bị giữ (trừ khỏi số dư) **trước** khi thu tiền; nếu không giữ được thì trả 503 `DATABASE_UNAVAILABLE`, không thu tiền, không ghi đơn. Sau khi Facade chạy xong, số điểm strategy không dùng tới được hoàn lại; checkout thất bại thì hoàn đủ.
- **Kiểm tra trước khi thu tiền:** `tableId` phải là một bàn có thật, nếu không trả **404** `NOT_FOUND`. Với `paymentMethod = cash`, nếu có gửi `tenderedAmount` thì số đó phải ≥ tổng tiền sau giảm giá và VAT, nếu không trả **400** `INVALID_INPUT`; `tenderedAmount` âm cũng trả 400. Hai trường hợp này không thu tiền và không lưu đơn. Không gửi `tenderedAmount` thì không kiểm. Trường này tuỳ chọn: POS gửi nó khi thu ngân nhập ô "Tiền khách đưa", và khoá nút thanh toán khi số đó thiếu so với tổng tạm tính; khi Java tắt, bản lưu cục bộ (`cashTenderError` trong `mock-store.ts`) áp cùng quy tắc.
- **Sau khi thu tiền:** đơn được lưu với `paymentStatus = paid`, `status = pending` (chờ quầy pha chế), rồi `OrderEventSubject.notifyOrderPaid` chạy: cộng điểm, bàn ăn tại chỗ chuyển `OCCUPIED`, KDS nhận phiếu. Bàn chỉ chuyển `CLEANING` khi KDS báo đơn `completed` (mục 3.9).
- **Mã đơn** do Java sinh theo dạng `AC-XXXX-XXX`. Phản hồi 200:
```json
{
  "ok": true,
  "data": {
    "orderCode": "AC-ECEC-512", "subtotal": 90000, "discountAmount": 9000,
    "vatAmount": 6480, "finalTotal": 87480, "changeDue": 0, "paymentStatus": "paid",
    "pointsEarned": 0, "pointsRedeemed": 0, "pointsDiscountVnd": 0,
    "transactionId": "CARD-…", "warnings": []
  },
  "message": "Checkout completed"
}
```
- **Lỗi:**
  - 404: món không tồn tại.
  - 409: hết hàng.
  - 400: thanh toán bị từ chối, voucher sai, hoặc đổi điểm không hợp lệ.
  - 503 `DATABASE_UNAVAILABLE`: chế độ JDBC mất kết nối. Không thu tiền, không ghi đơn.

#### `GET /api/reservations/mine`
Tài khoản đăng nhập xem tối đa 50 phiếu đặt bàn của mình, sắp xếp giờ hẹn mới nhất trước, gồm mọi trạng thái và chi nhánh. Dữ liệu phiếu có cùng định dạng với danh sách đặt bàn của nhân viên. Không nhận tài khoản hoặc email từ query string.

Khi đặt bàn với Bearer token hợp lệ, backend tự lưu tài khoản đặt phiếu; `userId` gửi trong body không được sử dụng. Phiếu cũ chưa gắn tài khoản được đối chiếu email liên hệ với email tài khoản. Phiếu đã gắn tài khoản chỉ hiển thị cho chính tài khoản đó, dù email liên hệ trùng tài khoản khác. Phiếu cũ không có email hoặc tài khoản chưa đủ thông tin để tự liên kết.

### 3.7. `POST /api/reservations/{code}/transfer-pos`
Khách đặt trước đến quán: `ReservationToOrderAdapter` chuyển phiếu thành đơn POS. Không cần body.
- **Đơn tạo ra:**
  - Mã đơn chính là mã phiếu (`code`).
  - Loại `dine-in`, trạng thái `pending`, thanh toán `unpaid`.
  - Các món đặt trước (`preOrders`) được sao chép sang đơn, tổng tiền tính lại kèm VAT 8%.
- **Tác dụng phụ:** phiếu chuyển sang `SEATED` ("Khách đã nhận bàn"); bàn chuyển sang `OCCUPIED`, số khách bằng số khách của phiếu (không vượt số ghế).
- Phản hồi 200:
```json
{
  "ok": true,
  "data": {
    "orderCode": "RES-0010", "customer": "Binh", "tableId": 9, "orderType": "dine-in",
    "status": "pending", "paymentStatus": "unpaid",
    "items": [{ "name": "Latte", "qty": 2, "price": 55000 }],
    "subtotal": 110000, "vatAmount": 8800, "total": 118800
  },
  "message": "Reservation RES-0010 transferred to POS"
}
```
- **Lỗi:**
  - 404: không có phiếu.
  - 409 `RESOURCE_CONFLICT`: phiếu đã nhận bàn, đã huỷ, hoặc đã có đơn cùng mã.
  - 405: sai phương thức.
  - 401 / 403: thiếu quyền.

### 3.8. `GET /api/orders`
Danh sách đơn, mới nhất trước. Lọc bằng `?status=pending|brewing|ready|completed|cancelled` (sai giá trị: 400) và `?branch=`. Mỗi đơn gồm `orderCode`, `customer`, `tableId`, `branch`, `orderType`, `status`, `paymentStatus`, `paymentMethod`, `items[]` (`menuItemId`, `name`, `qty`, `price`, `variation`), `subtotal`, `discountAmount`, `vatAmount`, `total`, `note`, `createdAt`, `completedAt`.

### 3.9. `PATCH /api/orders/{code}/status`
```json
{ "status": "brewing" }
```
- Chỉ đi tiến theo `pending → brewing → ready → completed` (được nhảy bước). `cancelled` được phép khi đơn chưa đóng; huỷ một đơn đã thu tiền đặt `paymentStatus = refunded`.
- `completed` cần đơn đã thanh toán. Khi tới `completed`, `notifyOrderCompleted` chạy: bàn chuyển `CLEANING` với 0 khách, KDS gỡ phiếu. Nếu bàn còn đơn khác chưa `completed` hoặc `cancelled`, bàn giữ nguyên `OCCUPIED`, và chỉ sang `CLEANING` khi đơn mở cuối cùng hoàn tất.
- Gửi lại đúng trạng thái hiện tại trả 200 và không đổi gì.
- **Lỗi:** 400 trạng thái lạ; 404 không có đơn; 409 đi lùi, đơn đã đóng, hoặc hoàn tất khi chưa thanh toán.

### 3.10. `POST /api/orders/{code}/pay`
```json
{ "paymentMethod": "cash", "customerPhone": "0901234567" }
```
Thanh toán một đơn chưa thu tiền (ví dụ đơn chuyển từ đặt bàn ở mục 3.7). Bộ xử lý lấy từ `PaymentProcessorFactory`; sau khi thu tiền, `notifyOrderPaid` chạy như ở checkout. `customerPhone` (tuỳ chọn) cộng điểm cho thành viên đó. Phản hồi là đơn (như mục 3.8) kèm `transactionId` và `warnings`.
- **Lỗi:** 400 phương thức sai hoặc bị từ chối; 404 không có đơn hoặc khách; 409 đơn đã thanh toán hoặc đã huỷ; 503 `DATABASE_UNAVAILABLE`.

### 3.11. `POST /api/menu` (MANAGER+)
```json
{
  "name": "Trà Atiso", "category": "Trà", "kind": "menu", "sellPrice": 39000, "costPrice": 12000,
  "unit": "ly", "recipe": "…", "imageUrl": null,
  "variations": [{ "name": "Ít ngọt", "price": 0 }]
}
```
Bắt buộc `name`, `category`, `sellPrice`; số tiền không được âm. `inStock` mặc định là `true`. Hệ thống không theo dõi số lượng tồn kho. Trả **201** với món vừa tạo (định dạng như mục 3.1). Trùng tên (không phân biệt hoa thường) trả 409.

### 3.11b. `PUT /api/menu/{id}` và `DELETE /api/menu/{id}` (MANAGER+)
- **Sửa:** body như mục 3.11 (`name`, `category`, `sellPrice` bắt buộc; `costPrice`, `unit`, `kind`, `recipe`, `imageUrl`, `inStock`, `variations` tuỳ chọn; gửi `variations` là thay cả danh sách). Tên trùng món khác (không phân biệt hoa thường) trả 409; giữ tên của chính món thì không tính là trùng. Giá âm trả 400, không có món trả 404. Trả 200 kèm món sau khi sửa.
- **Xoá:** trả 200, không có món trả 404. Đơn và phiếu đặt đã có giữ nguyên tên và giá lúc bán (dòng đơn lưu JSONB, không có khoá ngoại tới `menu_items`). Muốn tạm ngưng bán thì dùng mục 3.12.
- Frontend (`updateMenuItem`, `deleteMenuItem`) gọi Java trước, rồi mới sửa `admin_menu_items` và cặp liên kết trong `admin_menu_links`. Khi đã cấu hình Java mà Java không phản hồi thì từ chối, để giá ở POS không lệch giữa hai phía.

### 3.12. `PATCH /api/menu/{id}/stock`
```json
{ "inStock": false }
```
Bật / tắt bán một món. Hệ thống không theo dõi số lượng tồn kho, nên `inStock` (boolean) là trường duy nhất và bắt buộc; thiếu hoặc sai kiểu trả 400 (các trường cũ `change`, `stockQty` không còn được nhận). Không có món trả 404. Trả về món sau khi cập nhật. Món đang tắt thì checkout trả 409 `OUT_OF_STOCK`.

### 3.12b. `PUT /api/reservations/{code}` (STAFF+)
```json
{ "customer": "An", "contact": "0911000111", "email": null, "note": "Sinh nhật", "dateTime": "2026-10-20T08:00:00Z", "tableIds": [5, 6], "guests": 8 }
```
Sửa phiếu đang `pending` hoặc `confirmed` (trạng thái khác trả 409, không có phiếu trả 404). Body nhận thêm `endTime`; không gửi thì phiếu giữ nguyên thời lượng cũ, dời theo `dateTime` mới. Bàn chọn như mục 3.5 (`tableIds`, `tableId` hoặc `table`). Mã phiếu, trạng thái và món đặt trước được giữ nguyên. Cả chuỗi Chain of Responsibility chạy lại; phiếu đang sửa không bị tính là trùng lịch với chính nó. Bị từ chối thì trả 400 `CHAIN_VALIDATION_FAILED` và phiếu không đổi. Bàn cũ không còn dùng được trả về `available` nếu không còn phiếu hay đơn nào giữ.

### 3.13. `PATCH /api/reservations/{code}/status`
```json
{ "status": "confirmed" }
```
`pending → confirmed`, và `pending | confirmed → cancelled`. `seated` chỉ đạt được qua `transfer-pos` (400 nếu gửi trực tiếp), để đơn và bàn luôn được tạo cùng lúc. Chuyển không hợp lệ trả 409, không có phiếu trả 404.

### 3.14. `GET /api/customers`
Danh sách thành viên, chi tiêu nhiều nhất trước: `id`, `name`, `phone`, `email`, `totalOrders`, `totalSpent`, `loyaltyPoints`, `rank` (`bronze`, `silver`, `gold`, `vip`), `lastVisit`. `?phone=0901234567` trả mảng 0 hoặc 1 phần tử (POS dùng để tra cứu thành viên).

### 3.15. `GET /api/analytics/overview?days=7` (MANAGER+)
Thêm `&branch=<id>` để chỉ tính đơn và bàn của một chi nhánh (dashboard admin luôn gửi chi nhánh đang chọn).
Tính trực tiếp từ DAO mỗi lần gọi. Doanh thu chỉ tính đơn đã thanh toán và chưa huỷ; "hôm nay" theo giờ `Asia/Ho_Chi_Minh`. `days` (1–90, mặc định 7) là độ dài chuỗi `revenueByDay`; `paymentMix` và `topItems` tính trong cùng khoảng đó. Sai `days` trả 400. Dashboard và trang phân tích của frontend dùng endpoint này khi Java phản hồi.
```json
{
  "totalRevenue": 1250000, "paidOrders": 21, "averageOrderValue": 59523.8,
  "revenueToday": 320000, "paidOrdersToday": 6, "revenueYesterday": 410000,
  "ordersToday": 7, "ordersYesterday": 9,
  "fulfillmentMinutesToday": 6.5, "fulfillmentMinutesYesterday": 7.2, "days": 7,
  "revenueByDay": [{ "date": "2026-10-17", "revenue": 320000, "orders": 6 }],
  "paymentMix": { "cash": 540000, "qr": 410000, "card": 300000 },
  "ordersByStatus": { "pending": 2, "brewing": 1, "ready": 0, "completed": 18, "cancelled": 0 },
  "topItems": [{ "name": "Cà phê Muối Đặc Biệt", "qty": 14, "revenue": 630000 }],
  "tables": { "total": 15, "available": 9, "occupied": 4, "reserved": 1, "cleaning": 1, "occupancyRate": 0.27 }
}
```

### 3.16. `POST /api/vouchers/validate` (công khai)
```json
{ "code": "welcome10", "subtotal": 100000 }
```
Xem trước voucher bằng đúng Strategy mà checkout dùng (`VoucherService`). Trả về `{ code, valid, reason, discountAmount, shortfall, description, firstOnlineOrderOnly }`. `reason` là `OK`, `NOT_FOUND`, `DISABLED`, `NOT_STARTED`, `EXPIRED`, `SOLD_OUT`, `LOGIN_REQUIRED`, `ACCOUNT_LIMIT`, `ONLINE_ONLY` hoặc `BELOW_MIN_ORDER`; với lý do cuối, `shortfall` là số tiền còn thiếu. Mã sai vẫn trả 200 với `"valid": false` và `discountAmount: 0`. Thiếu `subtotal` hoặc âm trả 400. `userId` (không bắt buộc) chỉ được tin khi gọi kèm `X-Service-Key`. Giỏ hàng Storefront (`/api/cart`, action `discount`) hỏi endpoint này để biết mã có hợp lệ không.

### 3.16b. Quản lý voucher `/api/vouchers` (MANAGER+)
Voucher JSON: `{ id, code, type: "PERCENT"|"FIXED", value, maxDiscount, minOrder, maxUses, perAccountLimit, firstOnlineOrderOnly, startDate: "YYYY-MM-DD", endDate, description, active, usedCount, state }`. `maxUses` và `perAccountLimit` để `null` nghĩa là không giới hạn. `state` tính ra từ dữ liệu: `UPCOMING`, `RUNNING`, `EXPIRED`, `SOLD_OUT`, `DISABLED`. Mã hợp lệ từ 00:00 ngày bắt đầu đến 23:59:59 ngày hết hạn, giờ Việt Nam.
- `GET /api/vouchers`: tất cả voucher. `POST /api/vouchers`: tạo mới, trả 201. `PUT /api/vouchers/{id}`: sửa.
- Kiểm tra khi lưu: mã `^[A-Z0-9_-]{3,30}$` (tự viết hoa, trùng trả 409); `PERCENT` 1–100, `FIXED` > 0; đơn tối thiểu ≥ 0; hai giới hạn nếu có thì ≥ 1; ngày hết hạn ≥ ngày bắt đầu; tổng lượt không nhỏ hơn số lượt đã dùng; không đổi mã của voucher đã có lượt dùng (409).
- `DELETE /api/vouchers/{id}`: mã chưa ai dùng thì xoá hẳn (`{ deleted: true }`); đã có lượt dùng thì chỉ tắt (`{ deleted: false, deactivated: true }`).
- `GET /api/vouchers/{id}/usages`: `[{ userId, orderCode, discountAmount, createdAt }]`.
- `GET /api/vouchers/active` (công khai): các mã đang chạy, không kèm số lượt đã dùng: `{ code, type, value, maxDiscount, minOrder, perAccountLimit, firstOnlineOrderOnly, endDate, description }`.
- `POST /api/vouchers/redeem` (chỉ service key): `{ code, subtotal, userId?, orderCode }` → `{ usageId, discountAmount, code }`. Storefront gọi lúc khách đặt đơn COD; lượt bị trừ ngay. Không dùng được thì 400 `INVALID_VOUCHER`.
- `POST /api/vouchers/release` (chỉ service key): `{ orderCode }` → `{ released }`. Nhả lượt khi đơn COD không ghi được; gọi lần hai trả `released: false`.

### 3.17. `POST /api/orders/sync`
Nhận lại các đơn frontend đã ghi khi Java mất kết nối. **Không thu tiền** (tiền đã thu lúc offline).
```json
{
  "orders": [{
    "orderCode": "AC-K2Q7F3-X9A", "customer": "Khách tại bàn", "tableId": 12, "orderType": "dine-in",
    "paymentMethod": "cash", "paid": true, "status": "pending", "createdAt": "2026-10-17T02:00:00Z", "completedAt": null, "total": 97200,
    "lines": [{ "menuItemId": 1, "name": "Cà phê Muối Đặc Biệt", "qty": 2, "price": 45000, "variation": null }]
  }]
}
```
- Tối đa 200 đơn mỗi lần. Mỗi đơn được xử lý riêng: `created`, `exists` (đã có mã này, không làm gì, nên gửi lại cả lô vẫn an toàn) hoặc `failed` kèm `error` (dòng sai, đơn `completed` mà chưa trả tiền…).
- `completedAt` (ISO-8601, tuỳ chọn) chỉ được đọc khi `status` là `completed`: Java giữ đúng thời điểm hoàn tất ghi lúc offline, để thời gian phục vụ trong `/api/analytics` không tính cả lúc mất kết nối. Thiếu trường này thì lấy thời điểm đồng bộ. Sai định dạng thì đơn `failed`. Sớm hơn `createdAt` (đồng hồ lệch) thì đơn vẫn được nhập, `completedAt` lấy bằng `createdAt`, kèm một cảnh báo trong `warnings`.
- Dòng có `menuItemId` Java không biết vẫn được nhập, nhưng không gắn với món (có cảnh báo). Bàn không tồn tại thì đơn được nhập không kèm bàn.
- Đơn đã trả tiền và còn mở phát `notifyOrderPaid` (bàn → `OCCUPIED`, phiếu KDS). Sau đó đơn đi tiếp theo vòng đời ở mục 3.9.
- Phản hồi: `{ "created": 1, "existing": 0, "failed": 0, "results": [{ "orderCode": "…", "result": "created", "warnings": [] }] }`. 503 `DATABASE_UNAVAILABLE` khi chế độ JDBC mất kết nối.

### 3.18. `GET | PUT /api/config`
Thông số trong Singleton `SystemConfigManager`. `GET` (STAFF+) trả `storeName`, `storeAddress`, `storePhone`, `openingTime`, `closingTime` (`HH:mm`), `maxReservationGuests`, `loyaltyRateVndPerPoint`, `pointRedeemValueVnd`, cùng `vatRate` và `autoCancelMinutes` chỉ để tham khảo (đơn dùng VAT cố định trong `Order`, và chưa có tác vụ tự huỷ).

`PUT` hoặc `PATCH` (chỉ ADMIN) nhận bất kỳ tập con nào của 8 trường sửa được:
```json
{ "openingTime": "08:00", "maxReservationGuests": 6, "pointRedeemValueVnd": 1000 }
```
Toàn bộ thay đổi được kiểm trước khi áp dụng: giờ mở phải trước giờ đóng, số khách 1–100, 1 điểm = 1.000–1.000.000đ khi tích, 0–100.000đ khi đổi, chữ 1–120 ký tự. Một trường sai trả 400 và không trường nào bị đổi. Chuỗi kiểm định đặt bàn và việc tích/đổi điểm đọc giá trị mới ngay. Giá trị nằm trong bộ nhớ và trở về mặc định khi khởi động lại server.

### 3.19. `/api/auth` — đăng ký, đăng nhập, Google (khách hàng)
- `POST /api/auth/register` `{ "email", "name", "password" }` → **201** với phiên. Luôn tạo `CUSTOMER`; tài khoản nhân viên do ADMIN cấp ở mục 3.20. Email được chuyển về chữ thường; mật khẩu 8–128 ký tự, có cả chữ và số. Email đã có: 409 `EMAIL_TAKEN`.
- `POST /api/auth/login` `{ "email", "password" }` → 200 với phiên. Sai email hay sai mật khẩu đều trả 401 `INVALID_CREDENTIALS` và tốn thời gian như nhau (email lạ vẫn chạy so khớp với một hash giả). Sai 5 lần trong 15 phút: 429 `TOO_MANY_ATTEMPTS`. Tài khoản bị khoá: 403 `ACCOUNT_DISABLED` (chỉ báo sau khi mật khẩu đúng).
- `POST /api/auth/google` `{ "googleSubject", "email", "name", "emailVerified" }` với header `X-Service-Key: <AUTH_SERVICE_KEY>`. Chỉ frontend gọi, **sau khi** đã tự kiểm `id_token` của Google (chữ ký theo JWKS, issuer, audience, hạn, nonce). **Chỉ dành cho khách hàng:** tìm theo `googleSubject`, rồi theo email đã xác minh (liên kết tài khoản khách hàng đã đăng ký bằng mật khẩu), nếu không có thì tạo `CUSTOMER` (201). Email thuộc tài khoản nhân viên / quản lý / quản trị: 403 `STAFF_PASSWORD_ONLY`. Email chưa xác minh: 400; email đã gắn với tài khoản Google khác: 409; sai hoặc thiếu khoá: 401.
- `GET /api/auth/me` → tài khoản hiện tại. `POST /api/auth/password` `{ "currentPassword", "newPassword" }` đổi mật khẩu (khách chỉ đăng nhập Google, chưa có mật khẩu, thì bỏ trống `currentPassword`).

Phiên trả về:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…", "expiresIn": 28800,
  "user": { "id": 3, "email": "an@example.com", "name": "An", "role": "CUSTOMER", "active": true, "createdAt": "…",
            "lastLoginAt": "…" }
}
```

### 3.20. `/api/users` (ADMIN)
- `GET /api/users` → danh sách tài khoản (như `user` ở trên, không bao giờ có hash mật khẩu).
- `POST /api/users` `{ "email", "name", "password", "role" }` → 201. Dùng để cấp tài khoản `STAFF`, `MANAGER`, `ADMIN`.
- `PATCH /api/users/{id}` với tập con của `{ "role", "active", "name", "password" }`. Quản trị viên không thể tự hạ quyền hay tự khoá mình, và quản trị viên đang hoạt động cuối cùng không thể bị hạ quyền hay khoá (409).

---

## 4. Route Handler Next.js

Hai endpoint này dùng định dạng JSON riêng (không theo khung `{ ok, data }`), lỗi trả về dạng `{ "error": "…" }`.

| Endpoint | Phương thức | Mô tả |
| :--- | :---: | :--- |
| `/api/cart` | GET | Lấy giỏ hàng hiện tại, theo cookie |
| `/api/cart` | POST | Body dạng `{ action, … }` với `action` là `add` (kèm tuỳ chọn Sữa / Độ ngọt / Đá), `quantity`, `discount` (mã `WELCOME`, `WELCOME10`, `DALATCAFE`, `COFFEE`, `DISCOUNT`; mã nào cũng giảm cố định 10%) hoặc `note` |
| `/api/favorites` | GET, POST | Danh sách món yêu thích, lưu trong cookie `dalatcafe-favorites` |

> Giỏ hàng Storefront tính giá bằng USD (dữ liệu demo kiểu Shopify), nên chỉ lấy phán quyết hợp lệ của Java (mục 3.16) rồi giảm cố định 10%. Khi Java không phản hồi, danh sách mã demo (`WELCOME`, `WELCOME10`, `DALATCAFE`, `COFFEE`, `DISCOUNT`) được dùng.

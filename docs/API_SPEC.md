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

Ngoại lệ: một đường dẫn chưa đăng ký nằm ngoài bốn nhóm `/api/menu`, `/api/tables`, `/api/reservations`, `/api/checkout` sẽ nhận trang 404 mặc định của `HttpServer`, không theo khung trên.

### 1.2. Mã lỗi

| HTTP | `code` | Khi nào |
| :---: | :--- | :--- |
| 400 | `INVALID_INPUT` | Thiếu hoặc sai trường, JSON hỏng, `useLoyaltyPoints > 0` (chưa hỗ trợ), thanh toán bị từ chối (`PAYMENT_FAILED`) |
| 400 | `CHAIN_VALIDATION_FAILED` | Phiếu đặt bàn không qua chuỗi kiểm định |
| 400 | `INVALID_VOUCHER` | Mã giảm giá khác `WELCOME10` |
| 401 | `UNAUTHORIZED` | Thiếu hoặc sai header `X-User-Role` ở endpoint cần quyền |
| 403 | `FORBIDDEN` | Vai trò không đủ quyền (ví dụ `CUSTOMER` gọi `/api/checkout`) |
| 404 | `NOT_FOUND` | Không tìm thấy bàn hoặc món, hoặc sai đường dẫn con |
| 405 | `INVALID_INPUT` | Sai phương thức HTTP |
| 409 | `RESOURCE_CONFLICT` | Hết hàng hoặc không giữ được tồn kho, không cập nhật được bàn |
| 413 | `INVALID_INPUT` | Body vượt 1 MB |
| 500 | `INTERNAL_SERVER_ERROR` | Lỗi không mong đợi |
| 503 | `DATABASE_UNAVAILABLE` | Chế độ JDBC mất kết nối khi checkout. Không thu tiền, không ghi đơn. |

### 1.3. Phân quyền & CORS
- **Vai trò** đọc từ header `X-User-Role` (`ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`). Đây chỉ là cổng phân vai cho đồ án: vai trò không được xác thực, và header `Authorization` **không** được dùng. Chi tiết tại [ARCHITECTURE §4](ARCHITECTURE.md#4-phân-quyền-rbac).
- **Công khai:** `GET /api/menu`, `POST /api/reservations`.
- **Cần STAFF, MANAGER hoặc ADMIN:** các endpoint còn lại dưới `/api/tables`, `/api/reservations` (kể cả `transfer-pos`) và `/api/checkout`.
- **CORS:** `Access-Control-Allow-Origin: *`. Cho phép các phương thức GET, POST, PUT, PATCH, DELETE và OPTIONS. Preflight `OPTIONS` trả 204, không cần header vai trò.

---

## 2. Danh mục endpoint

| Endpoint | Phương thức | Quyền | Pattern | Trạng thái |
| :--- | :---: | :---: | :--- | :---: |
| `/api/menu` | GET | Công khai | — | 🟢 Đã triển khai |
| `/api/tables` | GET | STAFF+ | — | 🟢 Đã triển khai |
| `/api/tables/{id}` hoặc `/api/tables/{id}/status` | PUT, PATCH | STAFF+ | — | 🟢 Đã triển khai |
| `/api/reservations` | GET | STAFF+ | — | 🟢 Đã triển khai |
| `/api/reservations` | POST | Công khai | **Chain of Responsibility** | 🟢 Đã triển khai |
| `/api/checkout` | POST | STAFF+ | **Facade** (+ Decorator, Builder, Strategy, Factory, Observer) | 🟢 Đã triển khai |
| `/api/reservations/{code}/transfer-pos` | POST | STAFF+ | **Adapter** | 🟢 Đã triển khai |
| `/api/menu` | POST | — | — | ⚪ Chưa triển khai |
| `/api/menu/{id}/stock` | PATCH | — | — | ⚪ Chưa triển khai |
| `/api/reservations/{id}/status` | PATCH | — | — | ⚪ Chưa triển khai |
| `/api/orders` | GET | — | — | ⚪ Chưa triển khai |
| `/api/orders/{id}/status` | PATCH | — | 🔷 State | ⚪ Chưa triển khai |
| `/api/orders/{id}/pay` | POST | — | — | ⚪ Chưa triển khai |
| `/api/vouchers/validate` | POST | — | Strategy | ⚪ Chưa triển khai |
| `/api/customers` | GET | — | — | ⚪ Chưa triển khai |
| `/api/analytics/overview` | GET | — | 🔷 Template Method | ⚪ Chưa triển khai |

Với các chức năng chưa có endpoint, frontend vẫn tự xử lý bằng Server Actions và kho dữ liệu riêng (xem [DATABASE.md](DATABASE.md)).

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
      "stockQty": 85, "unit": "ly", "lowStockThreshold": 20,
      "costPrice": 15000, "sellPrice": 45000, "inStock": true,
      "recipe": "…", "variations": [{ "name": "Nóng", "price": 0 }], "imageUrl": null
    }
  ]
}
```

### 3.2. `GET /api/tables`
Trả về 15 bàn: `id`, `name` (`"Bàn 01"`…), `seats`, `zone` (`Main Floor`, `Patio`, `Coffee Bar`), `status` (chữ thường), `guestCount`, `occupiedSince`.

### 3.3. `PUT|PATCH /api/tables/{id}` (hoặc `/api/tables/{id}/status`)
```json
{ "status": "occupied", "guestCount": 3 }
```
- `status` nhận một trong `available`, `occupied`, `reserved`, `cleaning`.
- `guestCount` là tuỳ chọn, phải nằm trong `0…seats`. Nếu trạng thái khác `occupied` thì số khách luôn được đưa về 0.
- Phản hồi 200: `{ "ok": true, "message": "Table #3 status changed to 'occupied'" }`. Sai đầu vào trả 400, không có bàn trả 404.

### 3.4. `GET /api/reservations`
Danh sách phiếu: `id` (mã `RES-xxxx`), `customer`, `contact`, `email`, `dateTime`, `table`, `tableId`, `guests`, `status` (nhãn tiếng Việt), `note`, `preOrders[]`.

### 3.5. `POST /api/reservations`
```json
{
  "customer": "Nguyễn Văn An", "contact": "0912345678", "email": "an@example.com",
  "dateTime": "2026-10-20T05:00:00Z", "tableId": 9, "guests": 3, "note": "Sinh nhật",
  "preOrders": [{ "name": "Cà phê Latte Vani Mịn", "qty": 2, "price": 55000 }]
}
```
- Chỉ định bàn bằng `tableId`, hoặc bằng tên bàn trong trường `table` (ví dụ `"Bàn 09"`). `dateTime` phải là một thời điểm ISO-8601.
- Phiếu đi qua chuỗi `OperatingHoursValidator` (07:00–22:00 giờ Việt Nam) → `CapacityGuestValidator` (1–20 khách, không vượt số ghế) → `TableAvailabilityValidator` (không giao nhau trong khung 2 giờ trên cùng bàn).
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
  - Không có voucher nhưng `customerPhone` khớp một khách đã lưu: giảm theo hạng thành viên. Khách đó cũng được cộng điểm qua `LoyaltyPointObserver`.
  - `useLoyaltyPoints > 0` hiện bị từ chối (400).
- **Mã đơn** do Java sinh theo dạng `AC-XXXX-XXX`. Phản hồi 200:
```json
{
  "ok": true,
  "data": {
    "orderCode": "AC-ECEC-512", "subtotal": 90000, "discountAmount": 9000,
    "vatAmount": 6480, "finalTotal": 87480, "changeDue": 0, "paymentStatus": "paid",
    "pointsEarned": 0, "transactionId": "CARD-…", "warnings": []
  },
  "message": "Checkout completed"
}
```
- **Lỗi:**
  - 404: món không tồn tại.
  - 409: hết hàng.
  - 400: thanh toán bị từ chối, hoặc voucher sai.
  - 503 `DATABASE_UNAVAILABLE`: chế độ JDBC mất kết nối. Không thu tiền, không ghi đơn.

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

---

## 4. Route Handler Next.js

Hai endpoint này dùng định dạng JSON riêng (không theo khung `{ ok, data }`), lỗi trả về dạng `{ "error": "…" }`.

| Endpoint | Phương thức | Mô tả |
| :--- | :---: | :--- |
| `/api/cart` | GET | Lấy giỏ hàng hiện tại, theo cookie |
| `/api/cart` | POST | Body dạng `{ action, … }` với `action` là `add` (kèm tuỳ chọn Sữa / Độ ngọt / Đá), `quantity`, `discount` (mã `WELCOME`, `WELCOME10`, `DALATCAFE`, `COFFEE`, `DISCOUNT`; mã nào cũng giảm cố định 10%) hoặc `note` |
| `/api/favorites` | GET, POST | Danh sách món yêu thích, lưu trong cookie `dalatcafe-favorites` |

> Mã giảm giá của giỏ hàng Storefront được xử lý hoàn toàn trong Next.js, khác với quy tắc `WELCOME10` của Java ở mục 3.6.

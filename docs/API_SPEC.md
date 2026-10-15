# ĐẶC TẢ GIAO DIỆN LẬP TRÌNH ỨNG DỤNG (API SPECIFICATION)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

---

**Phiên bản tài liệu:** 1.0.0  
**Ngày cập nhật:** 14/10/2026  
**Định dạng dữ liệu:** JSON (`application/json; charset=UTF-8`)  
**Mục tiêu:** Định nghĩa chuẩn mực giao tiếp dữ liệu giữa Frontend Next.js và Backend Java thuần SE, giúp hai bên phát triển và kiểm thử độc lập mà vẫn đảm bảo tính tương thích 100% khi tích hợp.

---

## 1. Quy chuẩn Chung (General Conventions)

### 1.1. Base URL
- **Môi trường phát triển Next.js nội bộ:** `http://localhost:3000`
- **Môi trường phát triển Backend Java SE:** `http://localhost:8080`

### 1.2. Cấu trúc Response Thống nhất

#### Khi thành công (`HTTP 200 OK` hoặc `HTTP 201 Created`):
```json
{
  "ok": true,
  "data": { ... },
  "message": "Thông báo thành công (tùy chọn)"
}
```

#### Khi có lỗi (`HTTP 400`, `401`, `403`, `404`, `409`, `500`, `503`):
```json
{
  "ok": false,
  "error": "Mô tả chi tiết nguyên nhân lỗi cho người dùng",
  "code": "MÃ_LỖI_CHUẨN_HÓA"
}
```

### 1.3. Bảng Mã Lỗi Chuẩn (Standard Error Codes)
| Mã HTTP | Mã Code Lỗi | Ý nghĩa |
| :---: | :--- | :--- |
| `400` | `INVALID_INPUT` | Tham số gửi lên không đúng định dạng hoặc thiếu trường bắt buộc |
| `400` | `CHAIN_VALIDATION_FAILED` | Đơn đặt bàn vi phạm chuỗi kiểm định (Chain of Responsibility) |
| `400` | `INVALID_VOUCHER` | Mã giảm giá không hợp lệ hoặc không đạt giá trị đơn tối thiểu |
| `401` | `UNAUTHORIZED` | Yêu cầu xác thực tài khoản (Thiếu header `Authorization` hoặc `X-User-Role`) |
| `403` | `FORBIDDEN` | Tài khoản không có đủ quyền thực hiện thao tác này (RBAC: `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`) |
| `404` | `NOT_FOUND` | Không tìm thấy tài nguyên (Bàn, Món, Đơn hàng) |
| `409` | `RESOURCE_CONFLICT` | Xung đột trạng thái (Bàn đã có khách ngồi, mã đơn bị trùng) |
| `500` | `INTERNAL_SERVER_ERROR` | Lỗi phát sinh trong quá trình xử lý tại máy chủ |
| `503` | `DATABASE_UNAVAILABLE` | Cơ sở dữ liệu chính bị gián đoạn kết nối trong giao dịch POS, từ chối chốt đơn an toàn |

### 1.4. Quy chuẩn Xác thực & Phân quyền RBAC (Auth Headers)
Máy chủ Java SE áp dụng bộ lọc `SimpleAuthFilter` kiểm tra vai trò người dùng qua HTTP Headers:
- `X-User-Role: ADMIN | MANAGER | STAFF | CUSTOMER` (hoặc `Authorization: Bearer <token>`)
- Các endpoint phân quyền rõ ràng:
  - **Quản trị (`ADMIN` / `MANAGER`):** Quản lý cấu hình `/api/settings`, xem báo cáo `/api/analytics/*`.
  - **Nhân viên quầy/bếp (`STAFF`):** Chốt đơn `/api/checkout`, chuyển trạng thái bàn `/api/tables/*`, cập nhật bếp KDS `/api/orders/:id/status`.
  - **Công khai (`CUSTOMER` / Khách vãng lai):** Xem thực đơn `/api/menu`, gửi đặt bàn `/api/reservations`.

---

## 2. Bảng Tổng hợp Trạng thái Triển khai API

> [!IMPORTANT]
> **Phân định cơ chế hiện thực giữa Frontend Next.js và Backend Java:**
> - **Trên Frontend Next.js hiện tại:** Các nghiệp vụ quản trị Admin (Menu, Bàn, Đơn hàng POS, Bếp KDS, Khách hàng CRM) được xử lý trực tiếp qua **Next.js Server Actions** (`app/admin/actions.ts`) và **Server Query Functions** (`lib/admin/queries.ts`). Chỉ có phân hệ Giỏ hàng (`/api/cart`) và Yêu thích (`/api/favorites`) được xây dựng dưới dạng **Next.js Route Handlers** thực tế (`app/api/`).
> - **Trên Backend Java SE (Mục tiêu tích hợp):** Toàn bộ danh mục endpoints dưới đây sẽ được triển khai thành các **RESTful HTTP Handler chuẩn JSON** chạy trên máy chủ `com.sun.net.httpserver.HttpServer` (cổng `8080`) để Next.js đóng vai trò API Gateway / Client gọi sang.

| Nhóm API | Endpoint | Phương thức | Mô tả ngắn gọn | Design Pattern liên quan | Trạng thái Triển khai |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **Menu** | `/api/menu` | `GET` | Lấy danh sách thực đơn & nguyên liệu | - | Đã có (Next.js Query) / Cần làm (Java REST) |
| | `/api/menu` | `POST` | Thêm món mới vào thực đơn | - | Đã có (Next.js Action) / Cần làm (Java REST) |
| | `/api/menu/:id/stock` | `PATCH` | Bật/tắt trạng thái bán và cập nhật tồn kho | - | Đã có (Next.js Action) / Cần làm (Java REST) |
| **Bàn** | `/api/tables` | `GET` | Lấy sơ đồ 15 bàn theo 3 khu vực | - | Đã có (Next.js Query) / Cần làm (Java REST) |
| | `/api/tables/:id/status` | `PATCH` | Đổi trạng thái bàn (available, occupied, cleaning) | State Pattern | Đã có (Next.js Action) / Cần làm (Java REST) |
| **Đặt bàn** | `/api/reservations` | `GET` | Lấy danh sách phiếu đặt bàn trước | - | Đã có (Next.js Mock/UI) / Cần làm (Java REST) |
| | `/api/reservations` | `POST` | Gửi yêu cầu đặt bàn (Kiểm định chuỗi) | **Chain of Resp.** | Đã có (Next.js UI) / Cần làm (Java REST) |
| | `/api/reservations/:id/status`| `PATCH` | Cập nhật trạng thái duyệt/hủy đặt bàn | - | Đã có (Next.js UI) / Cần làm (Java REST) |
| | `/api/reservations/:id/transfer-pos`| `POST` | Chuyển phiếu đặt bàn sang quầy POS | **Adapter Pattern** | Đã có (Next.js UI) / Cần làm (Java REST) |
| **POS & Đơn**| `/api/checkout` | `POST` | Chốt đơn và thanh toán POS đa kênh | **Facade, Factory, Decorator, Builder, Observer** | Đã có (Next.js Action) / Cần làm (Java REST) |
| | `/api/orders` | `GET` | Lấy danh sách đơn hàng | - | Đã có (Next.js Query) / Cần làm (Java REST) |
| | `/api/orders/:id/status`| `PATCH` | KDS chuyển trạng thái đơn (Pending -> Completed) | State Pattern | Đã có (Next.js Action) / Cần làm (Java REST) |
| | `/api/orders/:id/pay` | `POST` | Đánh dấu đơn đã thanh toán tại bàn | Observer Pattern | Đã có (Next.js Action) / Cần làm (Java REST) |
| **Giỏ hàng** | `/api/cart` | `GET` | Lấy chi tiết giỏ hàng hiện tại | - | Đã có (Next.js Route Handler) |
| | `/api/cart` | `POST` | Thêm món, đổi số lượng, voucher, ghi chú | Decorator, Strategy | Đã có (Next.js Route Handler) |
| **Yêu thích** | `/api/favorites` | `GET`, `POST` | Quản lý danh sách sản phẩm yêu thích qua cookie | - | Đã có (Next.js Route Handler) |
| **Voucher** | `/api/vouchers/validate` | `POST` | Kiểm tra và tính số tiền giảm giá | **Strategy Pattern** | Đã có (Next.js Store) / Cần làm (Java REST) |
| **Khách hàng**| `/api/customers` | `GET` | Bảng xếp hạng khách hàng thân thiết CRM | - | Đã có (Next.js Query) / Cần làm (Java REST) |
| **Báo cáo** | `/api/analytics/overview`| `GET` | Lấy chỉ số KPI, biểu đồ doanh thu 7 ngày | Template Method | Đã có (Next.js Query) / Cần làm (Java REST) |

---

## 3. Đặc tả Chi tiết Từng Endpoint

### 3.1. Phân hệ Thực đơn & Món ăn (Menu & Inventory)

#### 3.1.1. `GET /api/menu`
- **Mục đích:** Trả về toàn bộ danh sách món ăn, thức uống và nguyên liệu phục vụ bán hàng và quản lý kho.
- **Headers:** `Accept: application/json`
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": 1,
        "name": "Cà phê Muối Đặc Biệt",
        "category": "Cà phê",
        "kind": "menu",
        "stockQty": 85,
        "unit": "ly",
        "lowStockThreshold": 20,
        "costPrice": 15000,
        "sellPrice": 45000,
        "inStock": true,
        "recipe": "Cà phê pha phin truyền thống kết hợp lớp kem mặn béo ngậy.",
        "variations": [
          { "name": "Nóng", "price": 0 },
          { "name": "Đá", "price": 0 }
        ],
        "imageUrl": null
      }
    ]
  }
  ```

#### 3.1.2. `POST /api/menu`
- **Mục đích:** Thêm mới một món đồ uống hoặc nguyên liệu vào hệ thống.
- **Request Body:**
  ```json
  {
    "name": "Trà Đào Cam Sả",
    "category": "Trà trái cây",
    "kind": "menu",
    "stockQty": 50,
    "unit": "ly",
    "lowStockThreshold": 10,
    "costPrice": 18000,
    "sellPrice": 50000,
    "recipe": "Trà đen ủ lạnh, nước cốt đào, cam vàng và sả tươi",
    "variations": [
      { "name": "Tiêu chuẩn", "price": 0 },
      { "name": "Ít ngọt", "price": 0 }
    ]
  }
  ```
- **Response 201 Created:**
  ```json
  {
    "ok": true,
    "data": { "id": 16, "name": "Trà Đào Cam Sả" },
    "message": "Đã thêm món mới vào thực đơn thành công!"
  }
  ```

#### 3.1.3. `PATCH /api/menu/:id/stock`
- **Mục đích:** Quản lý kho hàng nhanh: Bật/tắt bán hoặc nhập thêm tồn kho.
- **Request Body:**
  ```json
  {
    "inStock": false,
    "stockQty": 0
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "message": "Đã cập nhật trạng thái kho cho sản phẩm #1"
  }
  ```

---

### 3.2. Phân hệ Bàn & Sơ đồ tầng (Floor Plan & Tables)

#### 3.2.1. `GET /api/tables`
- **Mục đích:** Lấy danh sách 15 bàn phục vụ chia theo 3 khu vực (`Main Floor`, `Patio`, `Coffee Bar`) kèm trạng thái trực tiếp.
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": 1,
        "name": "Bàn 01",
        "seats": 2,
        "zone": "Main Floor",
        "status": "available",
        "guestCount": 0,
        "occupiedSince": null
      },
      {
        "id": 2,
        "name": "Bàn 02",
        "seats": 4,
        "zone": "Main Floor",
        "status": "occupied",
        "guestCount": 3,
        "occupiedSince": "2026-10-14T14:30:00Z"
      }
    ]
  }
  ```

#### 3.2.2. `PATCH /api/tables/:id/status`
- **Mục đích:** Chuyển đổi trạng thái bàn phục vụ.
- **Request Body:**
  ```json
  {
    "status": "cleaning"
  }
  ```
- **Ràng buộc:** `status` chỉ nhận một trong các giá trị: `available`, `occupied`, `reserved`, `cleaning`.
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "message": "Trạng thái bàn #2 đã chuyển sang 'cleaning'"
  }
  ```

---

### 3.3. Phân hệ Đặt bàn trước (Reservations)

#### 3.3.1. `POST /api/reservations`
- **Mục đích:** Tiếp nhận đơn đặt bàn từ khách hàng. Toàn bộ thông tin sẽ được chuyển qua **Chain of Responsibility** (`OperatingHoursValidator` ➔ `CapacityGuestValidator` ➔ `TableAvailabilityValidator`), theo issue #9; lịch cùng bàn không được giao nhau trong khoảng 2 giờ.
- **Request Body:**
  ```json
  {
    "customer": "Nguyễn Văn An",
    "contact": "0912345678",
    "email": "an.nguyen@example.com",
    "dateTime": "2026-10-15T15:00:00Z",
    "table": "Bàn 04",
    "guests": 4,
    "note": "Kỷ niệm sinh nhật, cần bàn gần cửa sổ",
    "preOrders": [
      { "name": "Cà phê Latte Vani Mịn", "qty": 2, "price": 55000 },
      { "name": "Bánh Croissant bơ Pháp", "qty": 2, "price": 45000 }
    ]
  }
  ```
- **Response 201 Created (Hợp lệ):**
  ```json
  {
    "ok": true,
    "data": { "id": "RES-008", "status": "Chờ xác nhận" },
    "message": "Đã tiếp nhận yêu cầu đặt bàn thành công!"
  }
  ```
- **Response 400 Bad Request (Vi phạm chuỗi kiểm định):**
  ```json
  {
    "ok": false,
    "error": "Quán chỉ nhận đặt bàn trong khung giờ mở cửa (07:00 - 22:00)!",
    "code": "CHAIN_VALIDATION_FAILED"
  }
  ```

#### 3.3.2. `POST /api/reservations/:id/transfer-pos`
- **Mục đích:** Nhân viên thu ngân nhấn nút "Chuyển đơn sang POS". Backend kích hoạt **Adapter Pattern (`ReservationToOrderAdapter`)** chuyển đổi cấu trúc phiếu đặt bàn sang định dạng đơn POS.
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "data": {
      "orderCode": "ORD-FROM-RES-001",
      "customerName": "Nguyễn Hoàng Nam (0912 345 678)",
      "tableId": 4,
      "items": [
        { "name": "Cà phê Latte Vani Mịn", "qty": 2, "price": 55000 },
        { "name": "Bánh Croissant bơ Pháp", "qty": 2, "price": 45000 }
      ],
      "initialSubtotal": 200000
    },
    "message": "Đã chuyển đổi phiếu đặt bàn sang đơn POS thành công!"
  }
  ```

---

### 3.4. Phân hệ Bán hàng POS & Chốt đơn (POS Checkout)

#### 3.4.1. `POST /api/checkout`
- **Mục đích:** Thực hiện chốt đơn và thanh toán tại quầy POS. Điểm tiếp nhận chính của **PosCheckoutFacade**, phối hợp:
  - Tính giá tùy biến món (**Decorator Pattern**).
  - Tính chiết khấu voucher (**Strategy Pattern**).
  - Khởi tạo cổng thanh toán (**Factory Method Pattern**).
  - Đóng gói đơn hàng (**Builder Pattern**).
  - Tích điểm loyalty & Đổi trạng thái bàn (**Observer Pattern**).
- **Request Body:**
  ```json
  {
    "orderCode": "AC-98214",
    "customer": "Phùng Hoài Bo",
    "customerPhone": "0908123456",
    "tableId": 4,
    "orderType": "dine-in",
    "lines": [
      {
        "menuItemId": 1,
        "name": "Cà phê Muối Đặc Biệt",
        "qty": 2,
        "unitPrice": 45000,
        "toppings": ["Trân châu trắng"],
        "size": "L"
      }
    ],
    "voucherCode": "WELCOME10",
    "useLoyaltyPoints": 20,
    "paymentMethod": "cash",
    "paid": true,
    "tenderedAmount": 150000
  }
  ```
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "data": {
      "orderCode": "AC-98214",
      "subtotal": 110000,
      "discountAmount": 11000,
      "pointsRedeemedVnd": 20000,
      "vatAmount": 6320,
      "finalTotal": 85320,
      "changeDue": 64680,
      "paymentStatus": "paid",
      "pointsEarned": 8
    },
    "message": "Thanh toán & in hóa đơn POS thành công!"
  }
  ```
- **Response 503 Service Unavailable (Khi CSDL JDBC gián đoạn - An toàn tài chính, không silent fallback):**
  ```json
  {
    "ok": false,
    "error": "Cơ sở dữ liệu chính đang gián đoạn kết nối, không thể hoàn tất thanh toán. Vui lòng thử lại!",
    "code": "DATABASE_UNAVAILABLE"
  }
  ```

#### 3.4.2. `PATCH /api/orders/:id/status`
- **Mục đích:** Màn hình KDS bếp cập nhật tiến trình đơn.
- **Request Body:**
  ```json
  {
    "status": "brewing"
  }
  ```
- **Giá trị hợp lệ:** `pending` ➔ `brewing` ➔ `ready` ➔ `completed`.
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "message": "Đơn hàng #AC-98214 đã chuyển sang trạng thái 'brewing'"
  }
  ```

---

### 3.5. Phân hệ Giỏ hàng Khách hàng (Customer Storefront Cart)

#### 3.5.1. `GET /api/cart`
- **Mục đích:** Lấy thông tin giỏ hàng hiện tại của khách từ Cookie.
- **Response 200 OK:**
  ```json
  {
    "id": "cart-demo-local",
    "totalQuantity": 3,
    "note": "Ít ngọt, giao trước 10h",
    "discountCodes": [{ "code": "WELCOME10", "applicable": true }],
    "cost": {
      "subtotalAmount": { "amount": "155000.00", "currencyCode": "VND" },
      "totalAmount": { "amount": "139500.00", "currencyCode": "VND" }
    },
    "lines": {
      "nodes": [
        {
          "id": "line-101",
          "quantity": 2,
          "attributes": [
            { "key": "Size", "value": "Ly Lớn (480ml)" },
            { "key": "Sweetness", "value": "Less sweet" }
          ],
          "merchandise": {
            "title": "Ly Lớn (480ml)",
            "price": { "amount": "65000", "currencyCode": "VND" },
            "product": { "title": "Cà phê Latte Vani Mịn" }
          }
        }
      ]
    }
  }
  ```

#### 3.5.2. `POST /api/cart`
- **Mục đích:** Thao tác trên giỏ hàng (Thêm món, đổi số lượng, nhập voucher, lưu ghi chú).
- **Request Body - Thêm món:**
  ```json
  {
    "action": "add",
    "variantId": "gid://shopify/ProductVariant/101",
    "options": {
      "Milk": "Oat",
      "Sweetness": "Less sweet",
      "Ice": "Ice"
    }
  }
  ```
- **Request Body - Đổi số lượng:**
  ```json
  {
    "action": "quantity",
    "lineId": "line-101",
    "quantity": 3
  }
  ```
- **Request Body - Áp mã giảm giá (Strategy Pattern):**
  ```json
  {
    "action": "discount",
    "code": "WELCOME10"
  }
  ```

---

### 3.6. Phân hệ Khách hàng Thân thiết & Báo cáo (CRM & Analytics)

#### 3.6.1. `GET /api/customers`
- **Mục đích:** Lấy danh sách khách hàng thân thiết theo mức chi tiêu tích lũy.
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "data": [
      {
        "id": 1,
        "name": "Phùng Hoài Bo",
        "phone": "0908 123 456",
        "email": "hoaibo@example.com",
        "totalOrders": 24,
        "totalSpent": 1850000,
        "loyaltyPoints": 185,
        "rank": "Vàng",
        "lastVisit": "2026-10-14T11:20:00Z"
      }
    ]
  }
  ```

#### 3.6.2. `GET /api/analytics/overview`
- **Mục đích:** Trả về các chỉ số KPI, biểu đồ doanh thu 7 ngày qua và Top đồ uống bán chạy nhất cho Dashboard.
- **Response 200 OK:**
  ```json
  {
    "ok": true,
    "data": {
      "metrics": {
        "todayRevenue": 4850000,
        "yesterdayRevenue": 4200000,
        "todayOrders": 68,
        "activeTableRatio": "60% (9/15)",
        "avgFulfillmentMinutes": 8.5
      },
      "revenueByDay": [
        { "day": "T2", "revenue": 3800000 },
        { "day": "T3", "revenue": 4200000 },
        { "day": "T4", "revenue": 4850000 }
      ],
      "topDrinks": [
        { "name": "Cà phê Muối Đặc Biệt", "sales": 142 },
        { "name": "Latte Vani Mịn", "sales": 118 },
        { "name": "Cold Brew Cam Vàng", "sales": 95 }
      ]
    }
  }
  ```


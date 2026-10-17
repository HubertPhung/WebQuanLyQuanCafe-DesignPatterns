# Đà Lạt Cafe — Hệ thống Quản lý và Vận hành Quán Cà phê Đa kênh
### Coffee Shop Management & Operations System (GoF Design Patterns Edition)

---

![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016.4-black?style=for-the-badge&logo=next.js)
![React 19](https://img.shields.io/badge/React-19.0-blue?style=for-the-badge&logo=react)
![Tailwind CSS v4](https://img.shields.io/badge/Styling-Tailwind%20v4-38bdf8?style=for-the-badge&logo=tailwindcss)
![Java SE 17+](https://img.shields.io/badge/Backend-Pure%20Java%20OOP-orange?style=for-the-badge&logo=openjdk)
![Design Patterns](https://img.shields.io/badge/Architecture-9%20GoF%20Patterns-success?style=for-the-badge)
[![CI/CD Pipeline](https://github.com/HubertPhung/WebQuanLyQuanCafe-DesignPatterns/actions/workflows/ci.yml/badge.svg)](https://github.com/HubertPhung/WebQuanLyQuanCafe-DesignPatterns/actions/workflows/ci.yml)
![Test Status](https://img.shields.io/badge/Test%20Suite-25%2F25%20PASS-brightgreen?style=for-the-badge)

---

## 1. Giới thiệu Đề tài & Mục tiêu

Dự án **Đà Lạt Cafe** là giải pháp phần mềm chuyển đổi số toàn diện cho quán cà phê hiện đại, phục vụ học phần **Thiết kế Mẫu & Kiến trúc Phần mềm (Design Patterns & Software Architecture)**.

Hệ thống kết hợp giữa:
1. **Frontend Fullstack Hiện đại (Next.js 16 + React 19 + Tailwind v4):** Cung cấp trải nghiệm mượt mà cho khách hàng đặt món online (Storefront) và toàn bộ nghiệp vụ quản trị vận hành quán cà phê (POS bán hàng tại quầy, Bếp pha chế KDS, Sơ đồ bàn Floor Plan, Quản lý đặt bàn, Quản lý kho, CRM tích điểm và Biểu đồ doanh thu).
2. **Backend Hướng đối tượng Thuần túy (Pure Java SE OOP):** Triển khai trọn vẹn **9 mẫu thiết kế Gang of Four (GoF)** kinh điển bằng ngôn ngữ Java SE thuần túy (không sử dụng framework Spring Boot, Spring Security hay Spring Data JPA), đảm bảo tính cô lập, dễ kiểm thử đơn vị và phục vụ mục tiêu học thuật chuyên sâu.

### Các Phân hệ Nghiệp vụ Chính:
- **Cổng Khách hàng (Storefront):** Duyệt thực đơn theo phân loại, lọc theo độ rang/mức giá, đánh dấu yêu thích, modal tùy biến đồ uống (Size, đá, đường, sữa), giỏ hàng trượt và áp dụng voucher giảm giá.
- **Bán hàng tại quầy (POS Terminal):** Chọn món nhanh, bàn phím số tính tiền thừa, tích hợp thuế VAT (8%), trừ điểm tích lũy thành viên, chọn bàn và đẩy đơn sang quầy pha chế.
- **Màn hình Bếp pha chế (Kitchen Display System - KDS):** Theo dõi tiến trình pha chế qua các cột `Pending` ➔ `Brewing` ➔ `Ready` ➔ `Completed`, tự động cảnh báo đổi màu viền khi đơn trễ quá 10 phút.
- **Sơ đồ Bàn thời gian thực (Floor Plan):** Quản lý 15 bàn chia theo 3 khu vực (Main Floor, Patio, Coffee Bar) với 4 màu trạng thái trực quan (`Available`, `Occupied`, `Reserved`, `Cleaning`), hỗ trợ thanh toán tại bàn.
- **Quản lý Đặt bàn trước (Reservations):** Tiếp nhận danh sách khách hẹn trước, số lượng khách, ghi chú, danh sách món gọi trước và nút chuyển đổi phiếu đặt bàn sang đơn POS.
- **Quản lý Kho & Thực đơn (Inventory & Menu):** Kiểm soát số lượng tồn kho nguyên liệu/món, cảnh báo tồn kho thấp (Low stock alert), công tắc bật/tắt bán và modal thêm món mới.
- **Khách hàng thân thiết (CRM & Loyalty):** Bảng xếp hạng khách hàng theo chi tiêu, cơ chế tự động tích lũy điểm thưởng (10.000 VNĐ = 1 điểm; quy đổi 1 điểm = 1.000 VNĐ khi trừ vào bill).
- **Báo cáo Phân tích (Analytics Dashboard):** Biểu đồ doanh thu 7 ngày qua, cơ cấu phương thức thanh toán (Tiền mặt, QR MoMo/VNPay, Thẻ) và tỷ trọng món bán chạy nhất.

---

## 2. Thành viên Nhóm Thực hiện (Team Members)

| MSSV | Họ và tên | GitHub | Phân công nhiệm vụ & Design Patterns phụ trách |
| :---: | :--- | :--- | :--- |
| `2312585` | **Phùng Nguyễn Hoài Bo** | [@HubertPhung](https://github.com/HubertPhung) | • **Kiến trúc hệ thống & Điều phối tổng thể**<br>• **Facade Pattern** (`PosCheckoutFacade`: điều phối quy trình chốt đơn POS đa kênh)<br>• **Singleton Pattern** (`SystemConfigManager`: quản lý tham số & cấu hình toàn cục quán) |
| `2312590` | **Nguyễn Ngọc Trường Dân** | [@0Yaam](https://github.com/0Yaam) | • **Tùy biến món & Xử lý thanh toán đa kênh**<br>• **Decorator Pattern** (`ToppingDecorator`: tính giá topping, kem cheese, nâng size L)<br>• **Factory Method Pattern** (`PaymentProcessorFactory`: bộ xử lý Tiền mặt, QR MoMo, Thẻ) |
| `2312756` | **Nguyễn Hưng Thịnh** | [@elgthinhnguyen](https://github.com/elgthinhnguyen) | • **Đóng gói đơn hàng & Cơ chế lắng nghe sự kiện**<br>• **Builder Pattern** (`OrderBuilder`: khởi tạo thực thể đơn hàng phức tạp với nhiều tùy chọn)<br>• **Observer Pattern** (`OrderEventSubject`: tự động tích điểm loyalty CRM và giải phóng bàn) |
| `2312639` | **Vũ Thế Huỳnh** | [@1convitt](https://github.com/1convitt) | • **Chuỗi kiểm định nghiệp vụ & Chiến lược khuyến mãi**<br>• **Chain of Responsibility** (`ReservationValidator`: chuỗi kiểm định thông tin đặt bàn 3 bước)<br>• **Strategy Pattern** (`DiscountStrategy`: thuật toán tính chiết khấu %, cố định, bậc thang) |
| `2312802` | **Phan Khánh Vương** | [@vuong123s](https://github.com/vuong123s) | • **Chuyển đổi dữ liệu & Bộ kiểm thử đơn vị**<br>• **Adapter Pattern** (`ReservationToOrderAdapter`: ánh xạ cấu trúc phiếu đặt bàn sang đơn POS)<br>• **State / DAO Pattern** & Viết bộ kiểm thử đơn vị **JUnit 5** toàn diện cho 9 Design Patterns |

---

## 3. Công nghệ Sử dụng

### 3.1. Frontend (`frontend-nextjs`)
- **Framework:** Next.js 16.4.0 (App Router, Turbopack, Server Actions, Route Handlers).
- **Core Library:** React 19 / React DOM 19, TypeScript 5.7.3.
- **Giao diện & Styling:** Tailwind CSS v4 (`@tailwindcss/postcss`), Radix UI (`dialog`, `dropdown-menu`), Base UI, Lucide React Icons, `class-variance-authority`, `tw-animate-css`.
- **Hoạt họa, Theme & Thông báo:** Framer Motion 14, `next-themes` (Dark/Light mode), Sonner Toaster (toast notifications), `@vercel/analytics`.
- **State Management & Data Fetching:** Zustand 5.0 (Global Cart Store), SWR 2.5 (Client revalidation).
- **Biểu đồ:** Recharts 3.8 (Doanh thu cột & Donut chart).
- **Lưu trữ & Fallback:** Drizzle ORM 0.45 (`pg` 8.23) + In-memory Mock Store (`mock-store.ts`) tự phục hồi không crash + Shopify Client (`shopify.ts`) kèm dữ liệu mẫu.

### 3.2. Backend (`backend-java`)
- **Nền tảng:** Java SE 17 LTS (Pure Java OOP).
- **Kiến trúc:** Phân tầng thuần OOP (Server Handler, Model POJO, DAO Layer, Patterns Package).
- **Mẫu thiết kế áp dụng:** Đầy đủ 9 mẫu thiết kế GoF:
  - *Creational:* Singleton (`SystemConfigManager`), Factory Method (`PaymentProcessorFactory`), Builder (`OrderBuilder`).
  - *Structural:* Decorator (`ToppingDecorator`), Adapter (`ReservationToOrderAdapter`), Facade (`PosCheckoutFacade`).
  - *Behavioral:* Strategy (`DiscountStrategy`), Chain of Responsibility (`ReservationValidator`), Observer (`OrderEventSubject`).
- **Giao thức:** Java SE `HttpServer` (`com.sun.net.httpserver.HttpServer`) REST JSON trên cổng `8080`.
- **Ràng buộc quan trọng:** Tuyệt đối không dùng Spring Boot, không Spring Security, không Spring Data JPA.

---

## 4. Cấu trúc Dự án

```text
WebQuanLyQuanCafe-DesignPatterns/
├── README.md                       # Tài liệu tổng quan dự án (file này)
├── LICENSE                         # Giấy phép mã nguồn mở MIT
├── docs/                           # Thư mục tài liệu kỹ thuật chi tiết
│   ├── ARCHITECTURE.md             # Kiến trúc phân tầng, luồng dữ liệu & tích hợp
│   ├── API_SPEC.md                 # Đặc tả chi tiết các RESTful API endpoints
│   ├── DATABASE.md                 # Thiết kế cơ sở dữ liệu, ERD & script DDL
│   ├── FEATURES.md                 # Danh mục chức năng chi tiết & phân chia issue
│   ├── ISSUE_GUIDELINES.md         # Quy chuẩn đặt tên, gán label & tạo issue
│   ├── ISSUE_EXECUTION_PLAN.md     # Kế hoạch phân chia 16 Issues & thứ tự không conflict
│   └── DESIGN_PATTERNS_SPEC.md     # Đặc tả chuyên sâu 9 GoF Design Patterns
├── frontend-nextjs/                # Ứng dụng Next.js Fullstack
│   ├── app/                        # App Router: Storefront, Admin POS/KDS/Tables, API
│   │   ├── admin/actions.ts        # Server Actions (createOrder, updateStatus...)
│   │   └── api/                    # Route Handlers (/api/cart, /api/favorites)
│   ├── components/                 # Component UI: admin/, storefront/, ui/
│   ├── lib/                        # Tiện ích, Mock Store, Drizzle Schema, Zustand Store
│   ├── scripts/test-ui-ux.mjs      # Bộ kiểm thử tự động 25 test cases UI/UX
│   ├── package.json
│   └── next.config.mjs
└── backend-java/                   # Thư mục mã nguồn Backend Java thuần OOP (Chuẩn GoF - Cấu trúc sẵn sàng triển khai)
    └── src/com/coffeeshop/         # Gói mã nguồn Java SE (server, model, dao, patterns)
```

---

## 5. Yêu cầu Môi trường

Để cài đặt và chạy toàn bộ dự án, máy tính cần cài sẵn:
- **Node.js:** Phiên bản `>= 18.18.0` (Khuyến nghị **Node.js 20 LTS**).
- **Trình quản lý gói Node:** `pnpm` (dự án định nghĩa `pnpm@12.3.4` qua `packageManager`, tương thích tốt từ pnpm 9+) hoặc `npm` / `yarn`.
- **Java Development Kit (JDK):** **JDK 17 LTS** hoặc JDK 21.
- **Hệ điều hành:** Hỗ trợ tốt trên Windows, macOS và Linux.

---

## 6. Hướng dẫn Cài đặt & Khởi động Dự án

### 6.1. Khởi động Frontend Next.js

1. Mở cửa sổ dòng lệnh (Terminal / PowerShell) và điều hướng vào thư mục Frontend:
   ```bash
   cd frontend-nextjs
   ```

2. Cài đặt các thư viện phụ thuộc:
   ```bash
   pnpm install
   # Hoặc nếu dùng npm:
   # npm install
   ```

3. Khởi động máy chủ phát triển (Development Server):
   ```bash
   pnpm dev
   # Hoặc nếu dùng npm:
   # npm run dev
   ```

4. Truy cập ứng dụng trên trình duyệt:
   - **Giao diện Khách hàng (Storefront):** [http://localhost:3000](http://localhost:3000)
   - **Giao diện Quản trị Vận hành (Admin):** [http://localhost:3000/admin](http://localhost:3000/admin)
   - **Màn hình Bán hàng tại quầy (POS):** [http://localhost:3000/admin/pos](http://localhost:3000/admin/pos)
   - **Màn hình Bếp pha chế (KDS):** [http://localhost:3000/admin/pos?tab=kitchen](http://localhost:3000/admin/pos?tab=kitchen)
   - **Sơ đồ Bàn thời gian thực:** [http://localhost:3000/admin/tables](http://localhost:3000/admin/tables)
   - **Quản lý Đặt bàn trước:** [http://localhost:3000/admin/reservations](http://localhost:3000/admin/reservations)

> [!TIP]
> **Chế độ Zero-Crash Standalone:** Frontend được tích hợp sẵn cơ chế In-Memory Mock Store (`mock-store.ts`) và Catalog mẫu. Ứng dụng chạy mượt mà ngay lập tức mà không yêu cầu phải cài đặt trước database PostgreSQL bên ngoài.

---

### 6.2. Chạy Bộ Kiểm thử Tự động (Automated Test Suite)

Dự án có sẵn bộ test tích hợp 25 kịch bản kiểm thử toàn diện mọi luồng UI/UX và logic nghiệp vụ. 

> [!NOTE]
> Bộ test kịch bản tự động kiểm tra trực tiếp qua HTTP endpoint trên máy chủ cục bộ. Hãy đảm bảo máy chủ Next.js đang chạy trên cổng 3000 (`pnpm dev`) trước khi chạy lệnh test.

```bash
cd frontend-nextjs
pnpm test
# Hoặc:
# node scripts/test-ui-ux.mjs
```
Kết quả kiểm thử mong đợi: **25 / 25 Test Cases Passed (100% Đạt)**.

---

### 6.3. Khởi động Backend Java thuần OOP

Khi triển khai mã nguồn Backend Java trong thư mục `backend-java/`:

1. Điều hướng vào thư mục:
   ```bash
   cd backend-java
   ```

2. Biên dịch toàn bộ mã nguồn Java:
   ```bash
   javac -d bin -sourcepath src src/com/coffeeshop/Main.java
   ```

3. Khởi chạy ứng dụng Java SE:
   ```bash
   java -cp bin com.coffeeshop.Main
   ```
   Máy chủ Java sẽ lắng nghe các request RESTful JSON tại `http://localhost:8080`.

---

### 6.4. Kết nối Frontend với Backend Java (API Proxy)

Server Actions trong `frontend-nextjs/app/admin/actions.ts` chuyển tiếp yêu cầu sang Java qua `lib/api-client.ts`:

| Server Action | Endpoint Java | Ghi chú |
|---|---|---|
| `createOrder` | `POST /api/checkout` | Chỉ đơn **đã thanh toán**; món được ghép theo tên vì hai kho đánh số món độc lập |
| `updateTableStatus` | `PUT /api/tables/{id}` | Java kiểm tra số khách theo sức chứa bàn |
| `createReservation` | `POST /api/reservations` | Java chạy chuỗi kiểm tra Chain of Responsibility |

Địa chỉ backend cấu hình qua biến môi trường (mặc định `http://localhost:8080`, đặt `off` để tắt):

```bash
JAVA_BACKEND_URL=http://localhost:8080
```

- **Java từ chối (4xx):** lỗi nghiệp vụ được trả về cho nhân viên, không ghi dữ liệu.
- **Java không phản hồi (lỗi mạng, quá 2,5 giây, 5xx):** tự động lưu vào Mock Store cục bộ, giao diện không bị crash.
- **Món Java không có hoặc tuỳ chọn có phụ thu:** đơn được lưu cục bộ thay vì gửi sang Java với giá sai.

---

## 7. Tra cứu Tài liệu Kỹ thuật Chi tiết

Toàn bộ tài liệu phân tích kỹ thuật của dự án được lưu trữ trong thư mục `docs/`:

| Tài liệu | Mô tả nội dung chính |
| :--- | :--- |
| **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Kiến trúc phân tầng, cơ chế giao tiếp Next.js – Java Backend, bảo mật & luồng dữ liệu |
| **[docs/API_SPEC.md](docs/API_SPEC.md)** | Danh mục đặc tả toàn bộ RESTful API endpoints, request/response JSON & mã lỗi |
| **[docs/DATABASE.md](docs/DATABASE.md)** | Thiết kế cơ sở dữ liệu, sơ đồ ERD, bảng trường dữ liệu & script DDL SQL |
| **[docs/FEATURES.md](docs/FEATURES.md)** | Ma trận tính năng theo phân hệ, đối chiếu hiện trạng và phân chia backlog issue |
| **[docs/ISSUE_GUIDELINES.md](docs/ISSUE_GUIDELINES.md)** | Quy chuẩn tạo Issue, đặt tiêu đề, phân loại labels, độ ưu tiên & checklist nghiệm thu |
| **[docs/ISSUE_EXECUTION_PLAN.md](docs/ISSUE_EXECUTION_PLAN.md)** | Kế hoạch phân chia 16 Issues chi tiết, thứ tự trước sau & chiến lược chống xung đột Git |
| **[docs/DESIGN_PATTERNS_SPEC.md](docs/DESIGN_PATTERNS_SPEC.md)** | Đặc tả chi tiết 9 mẫu thiết kế GoF chuẩn Java SE OOP kèm sơ đồ Mermaid & code mẫu |

---

## 8. Giấy phép (License)
Dự án được phân phối dưới giấy phép mã nguồn mở [MIT License](LICENSE).


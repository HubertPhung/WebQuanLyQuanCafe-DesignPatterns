# Đà Lạt Cafe — Hệ thống Quản lý và Vận hành Quán Cà phê Đa kênh
### Coffee Shop Management & Operations System (GoF Design Patterns Edition)

![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016.4-black?style=for-the-badge&logo=next.js)
![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![Java SE 17](https://img.shields.io/badge/Backend-Pure%20Java%20SE%2017-orange?style=for-the-badge&logo=openjdk)
![Design Patterns](https://img.shields.io/badge/Architecture-9%20GoF%20Patterns-success?style=for-the-badge)
[![CI/CD Pipeline](https://github.com/HubertPhung/WebQuanLyQuanCafe-DesignPatterns/actions/workflows/ci.yml/badge.svg)](https://github.com/HubertPhung/WebQuanLyQuanCafe-DesignPatterns/actions/workflows/ci.yml)
![Tests](https://img.shields.io/badge/Tests-205%20JUnit%20%2B%2036%20UI-brightgreen?style=for-the-badge)

---

## 1. Giới thiệu

**Đà Lạt Cafe** là đồ án học phần **Thiết kế Mẫu & Kiến trúc Phần mềm**. Hệ thống gồm hai phần:
1. **Frontend Next.js 16** (React 19, Tailwind v4): Storefront cho khách đặt món, và khu quản trị gồm POS, bếp KDS, sơ đồ bàn, đặt bàn, kho, CRM, báo cáo.
2. **Backend Java SE 17 thuần**: cài đặt đủ **9 mẫu thiết kế GoF**, không dùng Spring Boot / Spring Security / Spring Data JPA.

Frontend chạy được một mình, nhờ kho dữ liệu trong bộ nhớ. Khi Backend Java đang chạy, các nghiệp vụ POS được chuyển sang Java xử lý: chốt đơn (kể cả Size L / topping), đổi trạng thái bàn, tạo đặt bàn và chuyển đặt bàn sang POS. Chi tiết tại [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Danh mục tính năng và trạng thái triển khai xem [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md).

---

## 2. Thành viên Nhóm Thực hiện (Team Members)

| MSSV | Họ và tên | GitHub | Phụ trách |
| :---: | :--- | :--- | :--- |
| `2312585` | **Phùng Nguyễn Hoài Bo** (Trưởng nhóm) | [@HubertPhung](https://github.com/HubertPhung) | Kiến trúc và POJO lõi, **Singleton** (`SystemConfigManager`), **Facade** (`PosCheckoutFacade`), HttpServer, tích hợp Next.js ↔ Java |
| `2312590` | **Nguyễn Ngọc Trường Dân** | [@0Yaam](https://github.com/0Yaam) | **Factory Method** (`PaymentProcessorFactory`), **Decorator** (`BeverageDecorator`), tích hợp Next.js ↔ Java |
| `2312756` | **Nguyễn Hưng Thịnh** | [@elgthinhnguyen](https://github.com/elgthinhnguyen) | **Builder** (`OrderBuilder`), **Observer** (`OrderEventSubject`), REST handler, báo cáo E2E |
| `2312639` | **Vũ Thế Huỳnh** | [@1convitt](https://github.com/1convitt) | **Strategy** (`DiscountContext`), **Chain of Responsibility** (`ReservationValidatorHandler`), test JUnit 5 |
| `2312802` | **Phan Khánh Vương** | [@vuong123s](https://github.com/vuong123s) | Tầng DAO (In-Memory / JDBC), **Adapter** (`ReservationToOrderAdapter`), test JUnit 5 |

Cả nhóm cùng tham gia kiểm thử E2E và hoàn thiện báo cáo (#15). Quy trình nhánh và PR xem [docs/PROJECT_MANAGEMENT.md §4](docs/PROJECT_MANAGEMENT.md#4-quy-trình-git--pull-request).

---

## 3. Công nghệ Sử dụng

| Phần | Công nghệ (phiên bản theo `package.json` / `pom.xml`) |
| :--- | :--- |
| Frontend | Next.js **16.4.0** (App Router, Server Actions, Route Handlers), React 19, TypeScript 5.7.3, Tailwind CSS 4, Radix UI / Base UI, Lucide, Framer Motion 14, Sonner, Zustand 5, SWR 2.5, Recharts 3.8 |
| Lưu trữ frontend | Drizzle ORM 0.45 + `pg` 8.23 (khi có `DATABASE_URL`), mock store trong bộ nhớ (`lib/db/mock-store.ts`), dữ liệu Shopify mẫu (`lib/shopify.ts`) |
| Backend | Java SE **17**, `com.sun.net.httpserver.HttpServer` (cổng 8080), Maven, JUnit **5.10.2**, PostgreSQL JDBC **42.7.14** |
| CI | GitHub Actions (`.github/workflows/ci.yml`): Node 22 + `npm ci`, JDK 17 Temurin + `mvn clean test` |

---

## 4. Cấu trúc Dự án

```text
WebQuanLyQuanCafe-DesignPatterns/
├── README.md, LICENSE
├── docs/                    # Tài liệu kỹ thuật (xem mục 7)
│   └── e2e/                 # Ảnh minh chứng kiểm thử E2E
├── frontend-nextjs/         # Next.js: app/, components/, lib/, scripts/test-ui-ux.mjs
├── backend-java/            # Java SE: src/main/java/com/dalatcafe/{server,model,dao,patterns}
└── .github/workflows/ci.yml # CI cho cả hai phần
```

Cây thư mục chi tiết xem [docs/DESIGN_PATTERNS_SPEC.md §1.3](docs/DESIGN_PATTERNS_SPEC.md#13-cấu-trúc-cây-thư-mục-dự-án).

---

## 5. Cài đặt & Khởi chạy

**Yêu cầu:**
- Node.js **≥ 20.9** (theo yêu cầu của Next 16; CI dùng Node 22).
- npm. CI dùng `npm ci` với `package-lock.json`; repo cũng có sẵn `pnpm-lock.yaml`.
- JDK **17+** và Maven **3.9+**.

### 5.1. Frontend Next.js
```bash
cd frontend-nextjs
npm install
npm run dev            # http://localhost:3000
```
Các trang chính:
- Storefront: `/`
- Admin: `/admin`
- POS: `/admin/pos`
- Bếp KDS: `/admin/pos?tab=kitchen`
- Sơ đồ bàn: `/admin/tables`
- Đặt bàn: `/admin/reservations`

Frontend chạy ngay mà không cần database. Nếu đặt `DATABASE_URL` (PostgreSQL), dữ liệu admin sẽ được lưu qua Drizzle.

### 5.2. Backend Java
```bash
cd backend-java
mvn clean test                                            # 205 test JUnit 5
mvn -q compile
java -cp target/classes com.dalatcafe.server.MainServer   # cổng 8080, chế độ In-Memory
```
- Muốn đổi cổng thì truyền số cổng làm đối số đầu tiên, ví dụ `... MainServer 9090`.
- Khi `DATABASE_URL` có giá trị và kết nối được, `DaoFactory` chuyển sang chế độ JDBC. Chế độ này cần thêm driver vào classpath:
  ```bash
  mvn -q dependency:build-classpath -Dmdep.outputFile=cp.txt
  java -cp "target/classes;$(cat cp.txt)" com.dalatcafe.server.MainServer   # Windows (Git Bash); macOS/Linux dùng ':'
  ```

### 5.3. Kết nối Frontend với Backend
Chạy Java trước, rồi chạy frontend với:
```bash
JAVA_BACKEND_URL=http://localhost:8080   # giá trị mặc định; đặt "off" để tắt
```
Danh sách thao tác được chuyển sang Java và quy tắc dự phòng khi Java lỗi: [docs/ARCHITECTURE.md §2](docs/ARCHITECTURE.md#2-tích-hợp-frontend-nextjs--backend-java).

### 5.4. Đăng nhập & phân quyền
Tài khoản nằm ở backend Java, nên **cần chạy Java** để đăng nhập. Khi chạy lần đầu, Java tạo một quản trị viên:
- Đặt trước `ADMIN_EMAIL` và `ADMIN_PASSWORD` (biến môi trường của Java) để tự chọn; hoặc
- Để trống: Java tạo `admin@dalatcafe.local` với mật khẩu ngẫu nhiên và **in một lần vào log** (`Created administrator … with a one-time password: …`).

Đăng nhập tại `http://localhost:3000/login`, vào **Tài khoản & phân quyền** (`/admin/users`) để cấp tài khoản Nhân viên / Quản lý. Khách tự đăng ký ở `/register`.

| Biến | Đặt ở | Ý nghĩa |
| :--- | :--- | :--- |
| `AUTH_JWT_SECRET` | Java **và** Next.js (cùng giá trị, ≥ 32 ký tự) | Khoá ký token. Bỏ trống khi phát triển thì cả hai dùng khoá dev giống nhau; production bắt buộc (Java cần thêm `APP_ENV=production` để chặn khoá dev) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Java | Quản trị viên đầu tiên |
| `AUTH_TOKEN_HOURS` | Java | Thời hạn token, mặc định 8 |
| `AUTH_ALLOW_ROLE_HEADER` | Java | `true` để nhận header `X-User-Role` tự khai (chỉ khi phát triển) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Next.js | OAuth client loại *Web application* trên Google Cloud Console |
| `AUTH_SERVICE_KEY` | Java **và** Next.js (cùng giá trị) | Khoá để Java chỉ nhận đăng nhập Google từ server Next.js |
| `APP_URL` | Next.js (tuỳ chọn) | Gốc URL công khai, dùng để tạo redirect URI |

**Đăng nhập bằng Google (Gmail):** tạo OAuth client trên Google Cloud Console (APIs & Services → Credentials), thêm *Authorized redirect URI* `http://localhost:3000/api/auth/google/callback` (và URL thật khi deploy), rồi đặt ba biến `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SERVICE_KEY`. Chưa đặt thì nút Google hiện hướng dẫn thay vì chuyển trang. Email Gmail trùng với tài khoản nhân viên sẽ được liên kết và giữ nguyên vai trò.

---

## 6. Kiểm thử

```bash
cd frontend-nextjs && npm test     # 36 test UI/UX (tự khởi động next dev nếu chưa có server)
cd backend-java && mvn clean test  # 205 test JUnit 5 (kể cả JDBC trên PostgreSQL nhúng)
```
Danh mục test, báo cáo E2E và các giới hạn đã biết: [docs/TESTING.md](docs/TESTING.md).

---

## 7. Tài liệu Kỹ thuật

| Tài liệu | Nội dung |
| :--- | :--- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc, tích hợp Next.js ↔ Java, quy tắc dự phòng, phân quyền, luồng dữ liệu |
| [docs/API_SPEC.md](docs/API_SPEC.md) | Endpoint REST (đã / chưa triển khai), request/response, mã lỗi |
| [docs/DATABASE.md](docs/DATABASE.md) | Hai schema (Drizzle và JDBC), ERD, giá trị enum, giới hạn |
| [docs/DESIGN_PATTERNS_SPEC.md](docs/DESIGN_PATTERNS_SPEC.md) | Báo cáo 9 mẫu GoF: sơ đồ lớp Mermaid, mã nguồn thật, đề xuất mở rộng |
| [docs/PROJECT_MANAGEMENT.md](docs/PROJECT_MANAGEMENT.md) | Danh mục tính năng và trạng thái, lịch sử 15 issue, quy ước issue, quy trình Git |
| [docs/TESTING.md](docs/TESTING.md) | Bộ test JUnit và UI, báo cáo E2E, giới hạn đã biết |

---

## 8. Giấy phép (License)
Dự án được phân phối theo giấy phép [MIT](LICENSE).

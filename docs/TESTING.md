# KIỂM THỬ & BÁO CÁO E2E (TESTING)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

Tài liệu gom toàn bộ thông tin kiểm thử: cách chạy, danh mục test tự động và báo cáo kiểm thử đầu-cuối (E2E). Lệnh cài đặt môi trường xem tại [README §5](../README.md#5-cài-đặt--khởi-chạy).

---

## 1. Tổng quan & Cách chạy

| Bộ kiểm thử | Lệnh | Số ca | Chạy trên CI |
| :--- | :--- | :---: | :---: |
| JUnit 5 Backend | `cd backend-java && mvn clean test` | 320 | ✅ Job *Backend CI* |
| UI/UX & Admin Actions | `cd frontend-nextjs && npm test` | 41 | ✅ Job *Frontend CI* |
| Kiểu TypeScript | `cd frontend-nextjs && npx tsc --noEmit` | — | ✅ |
| Build production | `cd frontend-nextjs && npm run build` | — | ✅ |
| Đầu-cuối trên PostgreSQL thật | `cd frontend-nextjs && npm run test:e2e` | 59 | ❌ Chạy tay |

- `npm test` chạy `tsx scripts/test-ui-ux.mjs`. Script tự khởi động `next dev` nếu chưa có server ở `TEST_BASE_URL` (mặc định `http://localhost:3000`). Đặt `TEST_BASE_URL` để kiểm thử một server đang chạy sẵn. Các ca *Admin Actions* gọi thẳng `mock-store.ts` trong tiến trình test, nên bộ này không kiểm Java hay cơ sở dữ liệu.
- `npm run test:e2e` chạy `scripts/test-e2e-stack.mjs` trên hệ thống thật: Java (`JAVA_BACKEND_URL`, mặc định cổng 8080) ở chế độ JDBC và Next.js (`TEST_BASE_URL`), cùng trỏ vào `DATABASE_URL`. Mọi bước đi qua HTTP và được đối chiếu với cơ sở dữ liệu: đăng nhập và phân quyền bằng tài khoản thật, menu và bật / tắt bán, bàn, đặt bàn, chuyển sang POS, checkout, bếp, hoàn tiền, đơn offline, cài đặt, thống kê, đặt hàng online ở cửa hàng (giỏ hàng, khách trả VietQR giao tận nơi, COD đồng bộ sang Java chưa thu tiền, đơn hiện ở `/admin/orders`), và 10 trang quản trị mở bằng phiên admin. Cần một tài khoản ADMIN đang hoạt động (Java tạo khi khởi động lần đầu), cùng `AUTH_JWT_SECRET` ở cả ba nơi, cùng `AUTH_SERVICE_KEY` ở Java và Next.js, và một bản build production (`next build`, `next start`) để đọc id của server action đặt hàng. Script gắn mã lần chạy vào mọi dòng nó tạo rồi xoá đúng các dòng đó, trả lại trạng thái bàn, trạng thái bật / tắt bán và giờ mở cửa; dữ liệu có sẵn không bị đụng tới. Nếu Java không ghi vào cùng cơ sở dữ liệu, script dừng ngay. Không chạy trên CI vì cần cơ sở dữ liệu thật.
- Bộ JUnit chạy trong bộ nhớ (`InMemoryDatabase`), trừ `JdbcIntegrationTest`: lớp này tự khởi động một PostgreSQL nhúng (zonky `embedded-postgres`) trong JVM test, không cần Docker và không chạm tới Supabase dùng chung. Lần chạy đầu Maven tải bản PostgreSQL nhúng về.
- Mọi bộ test chạy trên GitHub Actions (`.github/workflows/ci.yml`) mỗi lần push hoặc mở PR; kết quả xem ở tab *Actions*.

---

## 2. Bộ test JUnit 5 (Backend)

| Lớp test | Phạm vi |
| :--- | :--- |
| `patterns/SingletonTest` | Một thể hiện duy nhất, an toàn đa luồng, chặn reflection, serialization, tham số vận hành, `isWithinOperatingHours(null)` theo giờ quán chứ không theo múi giờ máy chủ |
| `patterns/FactoryTest` | Tạo đúng bộ xử lý cho từng `PaymentMethod`, từ chối `null`; cả ba kênh từ chối số tiền ≤ 0, `NaN`, vô cực và mã giao dịch rỗng |
| `patterns/BuilderTest` | Dựng đơn và VAT, giá trị mặc định cho khách vãng lai, đối số sai, tái sử dụng builder, giữ `menuItemId` qua Decorator, sinh lại mã đơn đã bị dùng |
| `patterns/DecoratorTest` | Cộng dồn giá và mô tả, phụ thu từng topping, bọc lặp, thứ tự bọc, `null` |
| `patterns/AdapterTest` | Chuyển phiếu đặt bàn thành đơn POS, sao chép món độc lập, thiếu dữ liệu tuỳ chọn |
| `patterns/FacadeTest` | Toàn quy trình checkout (đơn đã thu tiền ở trạng thái `PENDING`, chỉ phát sự kiện *paid*), số lượng lớn vẫn bán được khi món đang bật, món tắt bán bị từ chối mà không thu tiền, mã đơn trùng được sinh lại trước khi thu tiền, dòng đơn giữ `menuItemId`, báo lỗi khi lưu đơn thất bại, lỗi observer |
| `patterns/StrategyTest` | Phần trăm có trần, số tiền cố định, hạng thành viên, kẹp kết quả |
| `patterns/ChainTest` | Giờ đến đã qua (đồng hồ cố định, chừa 15 phút), giờ mở cửa, sức chứa, trùng lịch bàn, thứ tự mắt xích; khi admin đang đổi giờ mở cửa, lời từ chối luôn trích một cặp giờ thật, không ghép giờ mở mới với giờ đóng cũ |
| `patterns/ObserverTest` | Sự kiện *paid* (cộng điểm, bàn → `OCCUPIED`, phiếu KDS) và *completed* (bàn → `CLEANING`, không cộng điểm lần hai; bàn còn đơn khác đang mở thì giữ `OCCUPIED`), đăng ký trùng, đơn chưa trả tiền, đơn mang đi, khách/bàn không tồn tại, một observer lỗi không chặn các observer sau (lỗi đầu tiên vẫn được ném ra, các lỗi sau gắn vào `getSuppressed`) |
| `dao/DaoLayerTest`, `model/ModelEntitiesTest` | Tầng DAO In-Memory và các thực thể; `Order`, `Reservation`, `Customer` bằng nhau theo mã duy nhất (`orderCode`, `reservationCode`, `phone`) và `hashCode` khớp với `equals`; nhiều luồng cùng cộng và đổi điểm của một khách không làm mất thay đổi nào; hoàn điểm (`restorePoints`) không tính thêm lượt ghé; món mới mặc định đang bán và bật / tắt được |
| `dao/JdbcIntegrationTest` | DAO JDBC trên PostgreSQL thật: nâng cấp schema chạy lại được, cột `branch` của bàn, đơn và phiếu đặt, thêm bàn cho chi nhánh thứ hai khi nâng cấp floor cũ, khoá ngoại chặn bàn không tồn tại, cột JSONB (`items`, `variations`, `pre_orders`), seed và sequence, mã `AC-0001` / `RES-0001`, pool kết nối, checkout qua Facade, bảng `users` (email và Google id duy nhất), cộng và đổi điểm đồng thời trên cùng một dòng `customers` (khoá dòng `SELECT ... FOR UPDATE`), đổi quá số dư không đổi gì, hoàn điểm không tính thêm lượt ghé |
| `security/SecurityTest` | Băm PBKDF2 có salt và xác minh, token HS256 hết hạn và sai khoá, khoá sau nhiều lần sai, tạo admin đầu tiên, cấu hình từ biến môi trường (từ chối khoá dev khi `APP_ENV=production`), DAO tài khoản giữ email và Google id duy nhất |
| `server/AuthTest` | Server chạy như production (không nhận `X-User-Role`): đăng ký thành `CUSTOMER`, token giả / `alg: none` / khoá khác bị từ chối, sai mật khẩu và email lạ trả cùng một lỗi, khoá sau 5 lần sai, ADMIN cấp tài khoản STAFF, đổi vai trò và khoá có hiệu lực với token cũ, quản trị viên cuối cùng được bảo vệ, Google cần service key, liên kết khách hàng theo email đã xác minh và từ chối tài khoản nhân viên, đổi mật khẩu, khoá dịch vụ của cửa hàng (`X-Service-Key`) chỉ đặt và đồng bộ được đơn, mật khẩu có khoảng trắng đầu/cuối được so khớp đúng như đã gõ, đường dẫn giống tên (`/api/usersX`, `/api/configX`) trả 404 thay vì lọt qua kiểm tra vai trò |
| `server/ServerTest` | Định tuyến REST, mã lỗi, RBAC (chạy với `X-User-Role` cho gọn; mặc định từ chối, MANAGER cho tạo món và thống kê), 503 khi mất CSDL, `transfer-pos` qua Adapter, vòng đời đơn trên KDS và đồng bộ bàn, thanh toán đơn chuyển từ đặt bàn, đổi trạng thái phiếu, tạo món và bật / tắt bán (endpoint `/stock` chỉ nhận `inStock`), đổi điểm thành viên (kể cả không giảm quá hoá đơn), thống kê (chuỗi theo ngày, cơ cấu thanh toán, `days` sai), xem trước voucher, nhập đơn offline (idempotent, dòng sai chỉ làm hỏng đơn đó), cài đặt `/api/config` (chỉ ADMIN, chuỗi đặt bàn đọc giá trị mới, cập nhật sai không đổi gì), từ chối đặt bàn cho thời điểm đã qua, giá món đặt trước lấy từ menu theo `menuItemId` (bỏ qua giá client gửi), món đặt trước không tồn tại bị từ chối, checkout tại bàn không tồn tại trả 404 trước khi thu tiền, tiền mặt khách đưa thiếu trả 400 trước khi thu tiền, hoàn tất một đơn khi bàn còn đơn khác đang mở giữ bàn `OCCUPIED`, kể cả hoá đơn mở chưa thanh toán (seed `AC-0052-C3D` ở bàn 7) |
| `server/BranchTest` | Bàn, đơn, đặt bàn và thống kê tách theo chi nhánh: `?branch=` trên `/api/tables`, `/catalog`, `/orders`, `/reservations`, `/analytics/overview` (id lạ trả 400); bàn mới vào chi nhánh được gửi, sửa bàn không đổi chi nhánh, tên bàn trùng được ở hai chi nhánh; đơn tại bàn lấy chi nhánh của bàn, đơn mang đi lấy chi nhánh được gửi, gửi lệch chi nhánh của bàn trả 400 và không thu tiền; phiếu đặt lấy chi nhánh của bàn và chuyển sang POS thành đơn cùng chi nhánh, không ghép bàn hai chi nhánh; đơn offline nhập đúng chi nhánh |
| `server/ConfigHandlerTest` | `GET /api/config` không trả cấu hình đang ghi dở (giờ mở sau giờ đóng) khi admin lưu cài đặt cùng lúc |
| `server/OrderHandlerTest`, `server/ReservationHandlerTest`, `server/CheckoutHandlerTest`, `server/MenuHandlerTest` | Yêu cầu đồng thời trên DAO trả bản sao (như JDBC): huỷ đơn đúng lúc thanh toán không để đơn đã thu tiền ở trạng thái chưa trả; hoàn tất đơn trong lúc sự kiện *paid* đang chạy vẫn để bàn ở `CLEANING`; hai lần checkout không cùng tiêu một số dư điểm; không trừ được điểm thì trả 503, không thu tiền, không ghi đơn; checkout thất bại sau khi đã giữ điểm thì hoàn đủ điểm; một đơn khác được thanh toán trong lúc checkout của hội viên đang chạy không cộng điểm nhầm cho hội viên đó; hai phiếu cùng bàn cùng giờ chỉ một phiếu qua chuỗi; một phiếu chỉ chuyển sang POS một lần; endpoint `/stock` chỉ bật / tắt bán, từ chối `change`, `stockQty` và giá trị không phải boolean |

---

## 3. Bộ test UI/UX & Admin Actions (41 ca)

Các mã dưới đây khớp chính xác với `frontend-nextjs/scripts/test-ui-ux.mjs`.

| Nhóm | Mã | Nội dung kiểm tra |
| :--- | :--- | :--- |
| Storefront | `TC-SF-01` | Thương hiệu & liên kết điều hướng |
| | `TC-SF-02` | Nội dung Hero & nút CTA |
| | `TC-SF-03` | Hiển thị catalog với dữ liệu mẫu dự phòng |
| | `TC-SF-04` | Tab danh mục & thanh công cụ |
| | `TC-SF-05` | Thuộc tính trợ năng (ARIA) |
| | `TC-SF-06` | Journal & chân trang |
| | `TC-SF-07` | Hai chi nhánh (123 Phan Đình Phùng, 456 Bùi Thị Xuân), hotline / email, ảnh không gian quán ở mục Góc cà phê, nút giỏ hàng chỉ còn biểu tượng và số món |
| API giỏ hàng | `TC-API-01` | Thêm/bỏ món yêu thích (`/api/favorites`) |
| | `TC-API-02` | Thêm món có tuỳ chọn vào giỏ (`/api/cart`) |
| | `TC-API-03` | Tăng/giảm số lượng |
| | `TC-API-04` | Ghi chú cho barista |
| | `TC-API-05` | Áp mã giảm giá `WELCOME10` |
| Admin UI | `TC-ADM-01` | `/admin` – Dashboard tổng quan |
| | `TC-ADM-02` | `/admin/pos` – Máy bán hàng POS |
| | `TC-ADM-03` | `/admin/pos?tab=kitchen` – Màn hình bếp KDS |
| | `TC-ADM-04` | `/admin/tables` – Sơ đồ bàn |
| | `TC-ADM-06` | `/admin/customers` – CRM khách hàng |
| | `TC-ADM-07` | `/admin/analytics` – Biểu đồ phân tích |
| | `TC-ADM-08` | `/admin/settings` – Cấu hình chi nhánh |
| | `TC-ADM-11` | Cookie `admin_branch=bui-thi-xuan` (ô chi nhánh trên header) chỉ hiện sơ đồ bàn của 456 Bùi Thị Xuân; mặc định chỉ hiện 123 Phan Đình Phùng |
| | `TC-ADM-10` | Header admin không còn ô tìm kiếm; có chuông thông báo và nút "Đơn đang phục vụ" dẫn thẳng tới tab Bếp |
| Admin Actions (mock store) | `TC-ACT-01` | Tạo đơn POS (bàn 5 có khách), món không có trong thực đơn bị từ chối |
| | `TC-ACT-02` | Đơn đi qua KDS: Brewing → Ready → Completed |
| | `TC-ACT-03` | Đổi trạng thái bàn & số khách |
| | `TC-ACT-04` | Bật/tắt bán món |
| | `TC-ACT-05` | Thêm món mới vào catalog |
| | `TC-ACT-06` | Đơn tại bàn đã thu tiền làm bàn `occupied`; hoàn tất trên KDS chuyển bàn sang `cleaning` |
| | `TC-ACT-07` | Đơn do Java định giá (giảm hạng, đổi điểm) giữ đúng tổng tiền của Java ở kho frontend |
| | `TC-ACT-08` | Tải lại đơn theo mã để đồng bộ offline (mã không có bị bỏ qua) |
| | `TC-ACT-09` | Món mới trả về id để liên kết với món Java |
| | `TC-ACT-10` | Khi Java tắt, fallback đặt bàn cục bộ từ chối phiếu trùng khung 2 giờ, phiếu 23:30 và phiếu đã qua; phiếu đã huỷ không giữ chỗ |
| | `TC-ACT-11` | Khi Java tắt, đơn tiền mặt có nhập tiền khách đưa mà thiếu so với tổng bị từ chối và không ghi đơn; đưa đủ thì nhận; thanh toán thẻ bỏ qua số tiền đưa |
| | `TC-ACT-12` | Đơn tại bàn lấy chi nhánh của bàn, đơn mang đi lấy chi nhánh được chọn; phiếu đặt không ghép được bàn của hai chi nhánh và mang chi nhánh của bàn |
| Đăng nhập & phân quyền | `TC-AUTH-01` | Khách chưa đăng nhập bị chuyển tới `/login?next=…` |
| | `TC-AUTH-02` | Phiên `CUSTOMER` không vào được `/admin` |
| | `TC-AUTH-03` | `STAFF` mở được POS nhưng bị chặn ở cài đặt (chỉ ADMIN) |
| | `TC-AUTH-04` | Token ký bằng khoá khác bị từ chối |
| | `TC-AUTH-05` | Trang đăng nhập có form mật khẩu, nút hiện/ẩn mật khẩu, nút chuyển sang đăng ký và logo |
| | `TC-AUTH-06` | Trang đăng ký tài khoản khách hàng, nút chuyển chế độ đánh dấu trang hiện tại |
| | `TC-AUTH-07` | `ADMIN` mở trang tài khoản & phân quyền, `MANAGER` bị chặn |
| | `TC-AUTH-08` | `?next=` không đưa người dùng ra trang khác: `//evil.com`, `/\evil.com`, `/<tab>/evil.com` đều bị bỏ, đường dẫn nội bộ giữ nguyên |

> Bộ UI ký cookie phiên bằng `AUTH_JWT_SECRET` (CI đặt một khoá chỉ dùng cho test) để mở các trang admin, và chỉ kiểm tra phản hồi HTTP, nội dung trang, cộng với các hàm của mock store. Các luồng có giao tiếp với Java được kiểm ở mục 4.

---

## 4. Báo cáo Kiểm thử Đầu-cuối (E2E)

### 4.1. Môi trường

| Thành phần | Cấu hình |
| :--- | :--- |
| Mã nguồn | `master` sau khi merge #13, #14 và #15 |
| Hệ điều hành | Windows 11 Pro |
| Backend | OpenJDK 17.0.20, Maven 3.9.16, `MainServer` cổng 8080, chế độ `IN_MEMORY` |
| Frontend | Node.js 24, Next.js 16.4.0 bản production (`next build` + `next start`), `JAVA_BACKEND_URL=http://localhost:8080` |
| Trình duyệt | Chrome điều khiển bằng Playwright CLI |

### 4.2. Kết quả tự động

| Hạng mục | Kết quả |
| :--- | :--- |
| JUnit 5 (`mvn clean test`) | **168 / 168 PASS** (bộ test lúc chạy E2E; hiện là 320, xem mục 1) |
| UI/UX (`npm test`, Java đang chạy) | **25 / 25 PASS** (hiện là 41, xem mục 3) |
| TypeScript, build production | Không lỗi |
| Cú pháp sơ đồ Mermaid (`mermaid.parse`, Mermaid 11) | Tất cả sơ đồ trong `docs/` hợp lệ |
| API proxy `lib/api-client.ts` với Java thật (menu, checkout, bàn, đặt bàn, backend tắt, `JAVA_BACKEND_URL=off`) | **9 / 9 PASS** |

### 4.3. Kịch bản 1 — Storefront: Duyệt menu ➔ Giỏ hàng ➔ Voucher ➔ Thanh toán

| Bước | Thao tác | Kết quả mong đợi | Kết quả thực tế |
| :---: | :--- | :--- | :--- |
| 1 | Mở `/`, thêm "Cà phê Latte Vani Mịn" vào giỏ | Giỏ có 1 món, 55.000 đ | Đạt |
| 2 | Nhập `WELCOME10`, bấm "Áp dụng" | Giảm 10% | Đạt: tổng 49.500 đ |
| 3 | "Tiến hành đặt hàng" ➔ `/checkout` | Tạm tính 55.000, giảm 5.500, phí giao 15.000 | Đạt: tổng 64.500 đ |
| 4 | "Xác nhận đặt hàng" | Màn hình xác nhận có mã đơn | Đạt: "Mã đơn hàng: #AC-663478" |

Luồng Storefront xử lý hoàn toàn trong Next.js (`/api/cart`), không gọi sang Java.

![Kịch bản 1](e2e/scenario1-order-confirmed.png)

### 4.4. Kịch bản 2 — POS: Chọn bàn ➔ Lên món ➔ Thanh toán ➔ Sơ đồ bàn ➔ KDS

| Bước | Thao tác | Kết quả mong đợi | Kết quả thực tế |
| :---: | :--- | :--- | :--- |
| 1 | `/admin/pos`: Bàn 3, 3 × "Cà phê Muối Đặc Biệt", Tiền mặt, "Thanh toán & In" | Gửi tới `POST /api/checkout` | Đạt: Java cấp mã `AC-5E15-E64` |
| 2 | Kiểm tra Java sau checkout | Trừ tồn kho, Observer chạy (lần chạy này có trước khi bỏ theo dõi tồn kho) | Đạt: tồn kho món #1 từ 85 còn 82; `TableStatusSyncObserver` chuyển bàn 3 sang `cleaning`; `KitchenNotificationObserver` báo gỡ phiếu |
| 3 | Đối chiếu tổng tiền | Frontend và Java khớp | Đạt: 135.000 + VAT 8% = 145.800 đ |
| 4 | `/admin/tables` | Bàn 3 đổi màu | Đạt: "Trống" ➔ "Có khách" |
| 5 | KDS `/admin/pos?tab=kitchen` | Phiếu mang mã đơn của Java | Đạt: `AC-5E15-E64 · Bàn 3 · 145.800 đ` |
| 6 | Dừng Java, thanh toán đơn cho Bàn 5 | Không crash, lưu kho cục bộ | Đạt: đơn `AC-0056-8CL` xuất hiện trên KDS |
| 7 | Gọi API: Latte + Size L + Cheese Foam + Trân châu, `WELCOME10`, thẻ | Decorator + Strategy + Factory trong Facade | Đạt: subtotal 90.000, giảm 9.000, VAT 6.480, tổng **87.480 đ** |

![POS với lựa chọn Size L / Topping](e2e/scenario2-pos-size-topping.png)

![Kịch bản 2 - KDS với đơn Java và đơn fallback](e2e/scenario2-kds-java-and-fallback.png)

### 4.5. Kịch bản 3 — Đặt bàn ➔ Chain of Responsibility ➔ Adapter

| Bước | Thao tác (`POST /api/reservations`) | Kết quả mong đợi | Kết quả thực tế |
| :---: | :--- | :--- | :--- |
| 1 | Bàn 9, 3 khách, 12:00 hôm sau, 2 món đặt trước | Qua cả 3 mắt xích | Đạt: `201 { id: "RES-0010" }` |
| 2 | Cùng bàn, cùng khung giờ | `TableAvailabilityValidator` từ chối | Đạt: `400 CHAIN_VALIDATION_FAILED` |
| 3 | 03:00 sáng | `OperatingHoursValidator` từ chối | Đạt |
| 4 | 6 khách ở bàn 4 chỗ | `CapacityGuestValidator` từ chối | Đạt |
| 5 | Chuyển phiếu sang đơn POS | `ReservationToOrderAdapter.toPosOrder()` qua `POST /api/reservations/{code}/transfer-pos` | Đạt (xem mục 4.6) |

### 4.6. Kiểm thử lại sau khi sửa lỗi (giao diện thật, Java đang chạy)

| # | Thao tác | Kết quả mong đợi | Kết quả thực tế |
| :---: | :--- | :--- | :--- |
| 1 | POS: "Cà phê Muối Đặc Biệt" + chip **Size L** + **Kem cheese**, Bàn 6, Tiền mặt, "Thanh toán & In" | Giá 45.000 + 10.000 + 15.000; Java tính bằng Decorator | Đạt: hoá đơn 70.000 + VAT 5.600 = **75.600 đ**; Java cấp `AC-6C4C-236`; KDS hiện "Cà phê Muối Đặc Biệt (Size L + Kem cheese) · 75.600 đ". Gọi thẳng Java với `customizations: [SIZE_L, CHEESE_FOAM]` cũng ra 70.000 / 5.600 / 75.600 |
| 2 | Nút đổi điểm trên POS | Không trừ tiền khi chưa được hỗ trợ | Đạt ở thời điểm chạy: nút bị vô hiệu. *Từ bản sau, POS tra cứu thành viên và đổi điểm thật; xem mục 5.* |
| 3 | `/admin/reservations` → "Tạo phiếu đặt bàn" (Bàn 9, 3 khách, 11:30 hôm sau) | Phiếu đi qua chuỗi Java | Đạt: Java lưu `RES-0010` "Chờ xác nhận"; danh sách hiện phiếu kèm nhãn "Java" |
| 4 | "Sang POS" phiếu Java `RES-20261015-001` | Adapter tạo đơn, phiếu → nhận bàn, bàn → có khách | Đạt: KDS hiện `RES-20261015-001 · Bàn 4 · 2× Cà phê Muối Đặc Biệt · 97.200 đ`; Java: "Khách đã nhận bàn", bàn 4 `occupied` (2 khách); nút "Sang POS" bị vô hiệu |
| 5 | "Sang POS" phiếu cục bộ `RES-001` | Bản sao Adapter phía frontend | Đạt: KDS hiện `RES-001 · 2× Latte, 2× Croissant · 216.000 đ` |
| 6 | Tắt Java, mở `/admin/reservations` | Không crash, báo mất kết nối | Đạt: hiện thông báo, chỉ còn 7 phiếu cục bộ |
| 7 | Server giả trả `503 DATABASE_UNAVAILABLE` cho `/api/checkout` | `rejected`, không lưu cục bộ | Đạt; `500` khác và `502` không phải JSON vẫn được xếp loại `unreachable` |

![Đặt bàn sau khi chuyển sang POS](e2e/scenario3-reservations-transfer.png)

---

## 5. Giới hạn đã biết

Báo cáo E2E ở mục 4 ghi lại một lần chạy trước khi bổ sung các endpoint dưới đây; những thay đổi sau đó được kiểm bằng test tự động trên CI (mục 2 và 3) thay vì chạy tay lại.

Đã khắc phục so với lần chạy E2E:
- Đổi điểm thành viên khi thanh toán (`FEAT-POS-04`): POS tra cứu khách qua `GET /api/customers?phone=`, gửi `customerPhone` và `useLoyaltyPoints`; bản sao ở frontend lưu đúng tổng tiền Java trả về, nên không còn lệch khi có giảm theo hạng.
- Đổi trạng thái phiếu đặt bàn được lưu qua `PATCH /api/reservations/{code}/status`.
- Trạng thái bàn thống nhất: thanh toán xong bàn là `occupied`; KDS báo hoàn tất thì bàn chuyển `cleaning`, ở cả Java lẫn frontend.
- Chế độ JDBC lưu đủ `items`, `variations`, `pre_orders`, có khoá ngoại và tự khởi tạo schema.
- Id món được liên kết qua `admin_menu_links` thay cho ghép tên mỗi lần; đơn ghi lúc Java tắt được xếp hàng và gửi lại qua `POST /api/orders/sync`.
- Dashboard, trang phân tích và khách hàng đọc từ Java; trang cài đặt sửa được Singleton `SystemConfigManager`.

Còn lại:
1. **Món chỉ có ở frontend** hoặc biến thể có phụ thu vẫn được lưu cục bộ trước rồi mới đồng bộ (không qua Facade), nên không đổi điểm được (POS báo lỗi thay vì thu đủ tiền). Lần ghép đầu tiên của một món vẫn dựa vào tên.
2. **Đồng bộ offline chỉ đẩy đơn mới.** Trạng thái KDS hay thanh toán đổi lúc Java tắt trên một đơn Java đã có sẽ không được gửi lại; đơn mới tạo lúc offline thì mang theo trạng thái mới nhất khi đồng bộ.
3. **Cài đặt trong `SystemConfigManager` không được lưu bền**: khởi động lại Java là về mặc định.
4. **Luồng đồng bộ phía frontend** (`pushQueuedOrders`) và **đăng nhập Google thật** (đổi code với Google) chưa có test tự động đầu-cuối; phần Java của chúng có test trong `ServerTest` và `AuthTest`.
5. **Khoá ngoại `NOT VALID`** không kiểm dữ liệu ghi trước khi nâng cấp, xem [DATABASE.md §4](DATABASE.md#4-giới-hạn-đã-biết).

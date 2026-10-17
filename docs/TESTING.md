# KIỂM THỬ & BÁO CÁO E2E (TESTING)
## DỰ ÁN: ĐÀ LẠT CAFE OPERATIONS & MANAGEMENT

Tài liệu gom toàn bộ thông tin kiểm thử: cách chạy, danh mục test tự động và báo cáo kiểm thử đầu-cuối (E2E). Lệnh cài đặt môi trường xem tại [README §5](../README.md#5-cài-đặt--khởi-chạy).

---

## 1. Tổng quan & Cách chạy

| Bộ kiểm thử | Lệnh | Số ca | Chạy trên CI |
| :--- | :--- | :---: | :---: |
| JUnit 5 Backend | `cd backend-java && mvn clean test` | 166 | ✅ Job *Backend CI* |
| UI/UX & Admin Actions | `cd frontend-nextjs && npm test` | 25 | ✅ Job *Frontend CI* |
| Kiểu TypeScript | `cd frontend-nextjs && npx tsc --noEmit` | — | ✅ |
| Build production | `cd frontend-nextjs && npm run build` | — | ✅ |

- `npm test` chạy `tsx scripts/test-ui-ux.mjs`. Script tự khởi động `next dev` nếu chưa có server ở `TEST_BASE_URL` (mặc định `http://localhost:3000`). Đặt `TEST_BASE_URL` để kiểm thử một server đang chạy sẵn.
- Bộ JUnit chạy hoàn toàn trong bộ nhớ (`InMemoryDatabase`), không cần mạng hay cơ sở dữ liệu.

---

## 2. Bộ test JUnit 5 (Backend)

| Lớp test | Phạm vi |
| :--- | :--- |
| `patterns/SingletonTest` | Một thể hiện duy nhất, an toàn đa luồng, chặn reflection, serialization, tham số vận hành |
| `patterns/FactoryTest` | Tạo đúng bộ xử lý cho từng `PaymentMethod`, từ chối `null` |
| `patterns/BuilderTest` | Dựng đơn và VAT, giá trị mặc định cho khách vãng lai, đối số sai, tái sử dụng builder |
| `patterns/DecoratorTest` | Cộng dồn giá và mô tả, phụ thu từng topping, bọc lặp, thứ tự bọc, `null` |
| `patterns/AdapterTest` | Chuyển phiếu đặt bàn thành đơn POS, sao chép món độc lập, thiếu dữ liệu tuỳ chọn |
| `patterns/FacadeTest` | Toàn quy trình checkout, thiếu tồn kho, hoàn kho khi lưu lỗi, lỗi observer |
| `patterns/StrategyTest` | Phần trăm có trần, số tiền cố định, hạng thành viên, kẹp kết quả |
| `patterns/ChainTest` | Giờ mở cửa, sức chứa, trùng lịch bàn, thứ tự mắt xích |
| `patterns/ObserverTest` | Ba observer, đăng ký trùng, đơn chưa trả tiền, đơn mang đi, khách/bàn không tồn tại |
| `dao/DaoLayerTest`, `model/ModelEntitiesTest` | Tầng DAO In-Memory và các thực thể |
| `server/ServerTest` | Định tuyến REST, mã lỗi, RBAC theo `X-User-Role` |

---

## 3. Bộ test UI/UX & Admin Actions (25 ca)

Các mã dưới đây khớp chính xác với `frontend-nextjs/scripts/test-ui-ux.mjs`.

| Nhóm | Mã | Nội dung kiểm tra |
| :--- | :--- | :--- |
| Storefront | `TC-SF-01` | Thương hiệu & liên kết điều hướng |
| | `TC-SF-02` | Nội dung Hero & nút CTA |
| | `TC-SF-03` | Hiển thị catalog với dữ liệu mẫu dự phòng |
| | `TC-SF-04` | Tab danh mục & thanh công cụ |
| | `TC-SF-05` | Thuộc tính trợ năng (ARIA) |
| | `TC-SF-06` | Journal & chân trang |
| API giỏ hàng | `TC-API-01` | Thêm/bỏ món yêu thích (`/api/favorites`) |
| | `TC-API-02` | Thêm món có tuỳ chọn vào giỏ (`/api/cart`) |
| | `TC-API-03` | Tăng/giảm số lượng |
| | `TC-API-04` | Ghi chú cho barista |
| | `TC-API-05` | Áp mã giảm giá `WELCOME10` |
| Admin UI | `TC-ADM-01` | `/admin` – Dashboard tổng quan |
| | `TC-ADM-02` | `/admin/pos` – Máy bán hàng POS |
| | `TC-ADM-03` | `/admin/pos?tab=kitchen` – Màn hình bếp KDS |
| | `TC-ADM-04` | `/admin/tables` – Sơ đồ bàn |
| | `TC-ADM-05` | `/admin/inventory` – Kho & thực đơn |
| | `TC-ADM-06` | `/admin/customers` – CRM khách hàng |
| | `TC-ADM-07` | `/admin/analytics` – Biểu đồ phân tích |
| | `TC-ADM-08` | `/admin/settings` – Cấu hình chi nhánh |
| | `TC-ADM-09` | `/admin/staff` – Nhân sự & phân ca |
| Admin Actions (mock store) | `TC-ACT-01` | Tạo đơn POS (bàn 5 có khách, trừ tồn kho) |
| | `TC-ACT-02` | Đơn đi qua KDS: Brewing → Ready → Completed |
| | `TC-ACT-03` | Đổi trạng thái bàn & số khách |
| | `TC-ACT-04` | Bật/tắt bán món |
| | `TC-ACT-05` | Thêm món mới vào catalog |

> Bộ UI chỉ kiểm tra phản hồi HTTP và nội dung trang, cộng với các hàm của mock store. Các luồng có giao tiếp với Java được kiểm ở mục 4.

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
| JUnit 5 (`mvn clean test`) | **166 / 166 PASS** |
| UI/UX (`npm test`, Java đang chạy) | **25 / 25 PASS** |
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
| 2 | Kiểm tra Java sau checkout | Trừ tồn kho, Observer chạy | Đạt: tồn kho món #1 từ 85 còn 82; `TableStatusSyncObserver` chuyển bàn 3 sang `cleaning`; `KitchenNotificationObserver` báo gỡ phiếu |
| 3 | Đối chiếu tổng tiền | Frontend và Java khớp | Đạt: 135.000 + VAT 8% = 145.800 đ |
| 4 | `/admin/tables` | Bàn 3 đổi màu | Đạt: "Trống" ➔ "Có khách" |
| 5 | KDS `/admin/pos?tab=kitchen` | Phiếu mang mã đơn của Java | Đạt: `AC-5E15-E64 · Bàn 3 · 145.800 đ` |
| 6 | Dừng Java, thanh toán đơn cho Bàn 5 | Không crash, lưu kho cục bộ | Đạt: đơn `AC-0056-8CL` xuất hiện trên KDS |
| 7 | Gọi API: Latte + Size L + Cheese Foam + Trân châu, `WELCOME10`, thẻ | Decorator + Strategy + Factory trong Facade | Đạt: subtotal 90.000, giảm 9.000, VAT 6.480, tổng **87.480 đ** |

![Kịch bản 2 - POS](e2e/scenario2-pos-order.png)

![Kịch bản 2 - KDS với đơn Java và đơn fallback](e2e/scenario2-kds-java-and-fallback.png)

### 4.5. Kịch bản 3 — Đặt bàn ➔ Chain of Responsibility ➔ Adapter

| Bước | Thao tác (`POST /api/reservations`) | Kết quả mong đợi | Kết quả thực tế |
| :---: | :--- | :--- | :--- |
| 1 | Bàn 9, 3 khách, 12:00 hôm sau, 2 món đặt trước | Qua cả 3 mắt xích | Đạt: `201 { id: "RES-0010" }` |
| 2 | Cùng bàn, cùng khung giờ | `TableAvailabilityValidator` từ chối | Đạt: `400 CHAIN_VALIDATION_FAILED` |
| 3 | 03:00 sáng | `OperatingHoursValidator` từ chối | Đạt |
| 4 | 6 khách ở bàn 4 chỗ | `CapacityGuestValidator` từ chối | Đạt |
| 5 | Chuyển phiếu sang đơn POS | `ReservationToOrderAdapter.toPosOrder()` | Chỉ đạt ở mức đơn vị (`AdapterTest`), xem mục 5 |

---

## 5. Giới hạn đã biết

1. **POS chưa có chọn Size L / Topping** (`FEAT-POS-07`). Phần này mới kiểm được qua API (mục 4.4, bước 7).
2. **Nút "Chuyển sang POS"** ở `/admin/reservations` chỉ hiện thông báo. Java chưa có endpoint dùng Adapter (`FEAT-RES-03`).
3. **Nút "Dùng 20 điểm" trên POS** trừ tiền trên màn hình nhưng không gửi đi, nên hoá đơn lưu lại vẫn tính đủ tiền (`FEAT-POS-04`).
4. **Chưa có form tạo đặt bàn trên giao diện.** Server Action `createReservation` đã có nhưng chưa được gọi (`FEAT-RES-01`).
5. **Trạng thái bàn sau checkout khác nhau.** Java chuyển bàn sang `cleaning` (coi đơn là đã hoàn tất), frontend để `occupied` (đơn mới gửi bếp). Sơ đồ bàn trên giao diện đọc từ kho của frontend.
6. **Lỗi 503 `DATABASE_UNAVAILABLE`** từ Java đang bị frontend coi là "không phản hồi" và chuyển sang lưu cục bộ.
7. **Hai kho menu đánh số độc lập.** Món được ghép theo tên; món chỉ có ở frontend sẽ được lưu cục bộ.
8. **Chế độ JDBC** chưa lưu các cột JSONB (`items`, `variations`, `pre_orders`), xem [DATABASE.md §4](DATABASE.md#4-giới-hạn-đã-biết).

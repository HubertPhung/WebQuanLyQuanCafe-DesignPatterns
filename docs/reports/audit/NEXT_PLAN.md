# NEXT PLAN: phiên tiếp theo

- Đầu vào: `REVIEW_REPORT.md` (review độc lập ngày 2026-10-18, sau 4 phiên tự động chưa commit).
- Cách làm mỗi mục: viết test tái hiện trước, xem test fail đúng lý do, rồi mới sửa. Sau mỗi bản sửa, chạy kiểm tra đột biến trên bản sao trong scratchpad (khôi phục file đã sửa về `HEAD`, test mới phải fail).
- Trước khi đọc code: chạy `graphify query "<câu hỏi>"`, đúng quy tắc trong `CLAUDE.md`.

## 0. Việc của người dùng, cần làm trước khi code tiếp
- [ ] **Review và commit đống thay đổi hiện tại.** Working tree đang có 47 file sửa và 18 file mới (9 file code hoặc tài liệu, 9 file báo cáo), gồm thay đổi của 5 phiên (review trước và nhóm phiên 1 đến 4), chồng lên `HEAD 67e5253`. Kết quả review: **chấp nhận kèm điều kiện** (xem `REVIEW_REPORT.md` §1). Gợi ý tách commit:
  1. Race và khoá (F1, F2 cũ, BR-02, BR-12): `JdbcCustomerDao`, `InMemoryCustomerDao`, `OrderHandler`, `CheckoutHandler`, `ReservationHandler`, kèm các test `*HandlerTest`, `DaoLayerTest`, `JdbcIntegrationTest`, `Concurrently.java`.
  2. Kho nguyên tử (BR-11): `IMenuDao`, `InMemoryMenuDao`, `JdbcMenuDao`, `MenuHandler`, `PosCheckoutFacade#reserveStock`.
  3. Checkout an toàn (BR-04, BR-06, BR-07, BR-08): `OrderEventSubject`, `CheckoutRequest`, `OrderBuilder`, phần còn lại của `PosCheckoutFacade`.
  4. Đặt bàn (BR-01, quy tắc thời điểm đã qua, fallback F3/F4): `ReservationHandler` (preOrders), `OperatingHoursValidator`, `ReservationValidationChainFactory`, frontend (`reservation-rules.ts`, `actions.ts`, `mock-store.ts`, `reservations/page.tsx`, `reservations-management.tsx`, `test-ui-ux.mjs`).
  5. PT-01, PT-02, PT-03: `SystemConfigManager`, `ConfigHandler`, `PointRedemptionDiscountStrategy`, `PaymentArguments` và 3 processor, `equals/hashCode` ở 3 model.
  6. Tài liệu và CI: `docs/*`, `README.md`, `.agents/rules/*`, `.github/workflows/ci.yml`.
  - Không thêm dòng `Co-Authored-By`.
- [ ] **Quyết định số phận các file báo cáo ở thư mục gốc:** `NIGHTLY_REPORT*.md`, `AUDIT_PLAN.md`, `BUSINESS_AUDIT.md`, `PATTERN_AUDIT.md`, `REVIEW_REPORT.md`, `NEXT_PLAN.md`. Có thể commit vào `docs/reports/`, hoặc để ngoài git. Đừng commit lẫn với code.
- [ ] **Push nhánh để GitHub Actions chạy.** Đến giờ chưa có lần chạy CI nào trên các thay đổi này.

## 1. [P1] Cho quy tắc tiền mặt chạy được từ POS thật (N1)
Hiện quy tắc BR-06 chỉ có ở API: POS không gửi `tenderedAmount`, và state `tendered` ở `pos-terminal.tsx:88,102` không gắn với ô nhập nào.
- Thêm ô "Tiền khách đưa" vào POS khi chọn tiền mặt. Hiển thị tiền thối từ biến `change` sẵn có. Khoá nút "Thanh toán" khi `change < 0`.
- Truyền `tenderedAmount` qua `NewOrderInput`, rồi `CheckoutPayload` (`lib/api-client.ts:94`), rồi `forwardCheckout` (`actions.ts:276`).
- Cần người dùng chọn trước khi làm: ô này bắt buộc hay tuỳ chọn. Nếu bắt buộc, đổi `PosCheckoutFacade.java:78` thành từ chối cả khi `tendered == null` với tiền mặt, và cập nhật `docs/API_SPEC.md:153`.
- **Test:** ca UI trong `test-ui-ux.mjs`: tiền đưa thiếu thì action trả lỗi và không tạo đơn. Ca JUnit cho nhánh `null` nếu chọn bắt buộc.

## 2. [P2] Bàn bị giữ `OCCUPIED` mãi vì đơn treo (N2)
`TableStatusSyncObserver.java:54` coi mọi đơn chưa `COMPLETED` hay `CANCELLED` là đơn mở, kể cả đơn chưa trả tiền bị bỏ quên. Ví dụ: bản in-memory seed sẵn đơn `AC-0052-C3D` (`PENDING`, `UNPAID`) ở bàn 7 (`InMemoryDatabase.java:172-178`). Vì vậy hoàn tất bất kỳ đơn nào khác ở bàn 7 cũng không đưa bàn sang `CLEANING`.
- Bước 1, xác nhận bằng test: `ServerTest` dùng DAO in-memory mặc định, trả tiền rồi hoàn tất một đơn mới ở bàn 7, kiểm tra trạng thái bàn.
- Bước 2, cần người dùng chọn quy tắc: (a) chỉ tính đơn đã trả tiền là đơn mở; (b) chỉ tính đơn tạo trong N giờ gần đây; (c) giữ nguyên quy tắc, và bỏ đơn treo khỏi dữ liệu seed.
- Ghi quy tắc đã chọn vào `docs/DESIGN_PATTERNS_SPEC.md` (mục Observer).

## 3. [P2] Đổi điểm thất bại sau khi đã thu tiền (N3)
`CheckoutHandler.java:95-99`: nếu `redeemPoints` trả `false` sau khi đơn đã thu tiền, khách vẫn được giảm giá theo điểm mà điểm không bị trừ. Hệ thống chỉ thêm một cảnh báo.
- Hướng sửa: trừ điểm **trước** khi thu tiền, trong cùng khoá `facade` (giữ điểm trước, thất bại thì hoàn điểm). Hoặc gộp phần cộng điểm và trừ điểm vào **một** giao dịch `changeLocked` duy nhất (thêm phương thức DAO `settleCheckout(id, amount, earned, redeemed)`).
- **Test:** DAO giả có `redeemPoints` trả `false`. Kỳ vọng: không thu tiền, hoặc tổng điểm vẫn đúng.

## 4. [P3] Hoàn thiện nhỏ
- [ ] **Ngôn ngữ thông báo đặt bàn (F7, N6):** cùng quy tắc "thời điểm đã qua" nhưng `actions.ts:506` báo tiếng Anh, còn `mock-store.ts:832` và Java báo tiếng Việt. Cần người dùng chọn một ngôn ngữ cho thông báo hiển thị.
- [ ] **`min` cho ô ngày ở form đặt bàn (F7):** server tính "hôm nay" theo `Asia/Ho_Chi_Minh` rồi truyền xuống như `maxGuests`, để tránh lệch hydration.
- [ ] **`docs/DEVELOPMENT_PLAN.md` (F8):** vẫn ghi `205/205`, `37/37`, `2,057 nodes`. Số đo hiện tại là 240 JUnit, 38 UI, 3753 node. Nếu giữ file này, cần sửa số và bỏ các câu "100% PASS" không có bằng chứng.
- [ ] **Ghi chú quy ước khoá cấu hình (N5):** thêm vào `.agents/rules/backend-java-constraints.md` một dòng: code nào đọc từ 2 thông số cấu hình trở lên (ví dụ giờ mở và giờ đóng) phải giữ `synchronized (config)`. Test hiện không bắt được lỗi nếu ai đó quên, vì chỉ các khối bên ngoài mới đảm bảo tính nhất quán (`REVIEW_REPORT.md` E6).

## 5. Đang chờ người dùng quyết định (không tự triển khai)
Gom từ các báo cáo phiên 1 đến 4, chưa có quyết định:
1. **PT-02:** cài Factory Method đúng GoF, hay đổi tên thành Simple Factory trong spec. Lựa chọn này ảnh hưởng tới việc đồ án có đủ 9 mẫu GoF hay không.
2. **BR-01 (phần còn lại):** trừ kho món đặt trước lúc `transfer-pos` hay lúc `/pay`.
3. **BR-03:** huỷ đơn đã thu tiền có phải đảo ngược điểm, doanh số, kho và bàn không.
4. **BR-10:** đơn chuyển từ đặt bàn có được giảm giá theo hạng khi `/pay` không.
5. **BR-09 / BR-18:** scheduler tự huỷ phiếu theo `autoCancelMinutes`, và giới hạn đặt bàn công khai.
6. **State Pattern / Template Method, và storefront đọc menu từ Java** (`docs/DEVELOPMENT_PLAN.md` mục 3).
7. **BR-02 dài hạn:** thêm `customerId` vào `orders`. Đây là thay đổi schema.

## 6. Kiểm chứng cuối phiên (bắt buộc)
```bash
cd backend-java && mvn -B clean test        # kỳ vọng: 240 + số test mới, 0 fail, 0 skip
# đếm lại từ target/surefire-reports/TEST-*.xml, không chỉ đọc dòng tóm tắt
cd frontend-nextjs && npx tsc --noEmit -p .  # kỳ vọng: EXIT=0
cd frontend-nextjs && npm test               # kỳ vọng: 38 + số ca mới, 0 FAIL
"C:/Users/phung/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe" -m graphify update .
```
- Cập nhật số test trong `README.md`, `docs/TESTING.md`, `docs/DESIGN_PATTERNS_SPEC.md` và tên bước trong `.github/workflows/ci.yml` theo số đo thực tế.
- Test có luồng chạy song song: chạy lặp ít nhất 3 lần để loại trừ test chập chờn (`REVIEW_REPORT.md` E7).

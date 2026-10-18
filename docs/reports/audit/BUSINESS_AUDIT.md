# BUSINESS RULE AUDIT — Đà Lạt Cafe

**Ngày kiểm toán:** 18/10/2026 · **Vai trò:** kiểm toán độc lập, chỉ đọc source
**Phạm vi:** Backend Java (`backend-java/`) là nơi thực thi nghiệp vụ; frontend Next.js chỉ được xét ở những điểm nó tự áp quy tắc (fallback, voucher giỏ hàng).
**Không tin báo cáo khác:** `REVIEW_REPORT.md`, `NEXT_PLAN.md` không được dùng làm bằng chứng.

---

## 0. Đối tượng kiểm toán & phương pháp

| Mục | Giá trị |
| :--- | :--- |
| Nhánh | `feature/hoai-bo`, HEAD `67e5253` |
| Trạng thái cây làm việc | **Có thay đổi chưa commit**: 12 file sửa (gồm `CheckoutHandler`, `OrderHandler`, `ReservationHandler`, `OperatingHoursValidator`, `ReservationValidationChainFactory`), 3 test mới chưa track (`CheckoutHandlerTest`, `OrderHandlerTest`, `ReservationHandlerTest`). Báo cáo đánh giá **đúng trạng thái đang có trên đĩa**, không phải bản đã merge. CI trên GitHub (`gh run list`) chỉ phủ commit đã push, **không phủ** các thay đổi này. |
| ⚠️ Cây làm việc thay đổi **trong lúc kiểm toán** | Sau khi tôi đọc code (khoảng 04:01), một tiến trình khác (không phải người kiểm toán) đã sửa `JdbcCustomerDao.java` (04:03), `InMemoryCustomerDao.java`, `OrderHandler.java` (04:05), `CheckoutHandler.java` (04:06), `DaoLayerTest`, `JdbcIntegrationTest`, thêm `Concurrently.java`, `frontend-nextjs/lib/reservation-rules.ts` và sửa 4 file frontend. Đối chiếu lại bằng `grep -n` sau khi viết báo cáo: cấu trúc của BR-02, BR-03, BR-04, BR-06 **không đổi**, số dòng ở `CheckoutHandler`/`OrderHandler` có thể lệch khoảng 1 dòng (ví dụ `synchronized (facade)` nay ở `:71`, `attach` ở `:82`, `notifyOrderPaid` của sync ở `:353`). BR-12 có thể đã được xử lý (xem BR-12). Các probe đã chạy trên `target/classes` build lúc 04:01. |
| Nguồn quy tắc nghiệp vụ | `docs/API_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN_PATTERNS_SPEC.md`, `.agents/rules/backend-java-constraints.md` |

**Lệnh đã chạy (tự chạy, tự đọc output):**

1. `cd backend-java && mvn -q -B test` → `EXIT=0`. Tổng hợp từ `target/surefire-reports/*.txt`: **`TOTAL run=213 fail=0 err=0 skip=0`**.
2. Probe tái hiện (chỉ nằm trong scratchpad, biên dịch với `backend-java/target/classes`, DAO in-memory, **không sửa source**):
   - `AuditProbe.java` — 9 kịch bản P1…P9 (output đầy đủ trích dưới từng phát hiện).
   - `ObserverRaceProbe.java` — race của observer tích điểm.
   - `ObserverAbortProbe.java` — một observer lỗi chặn các observer sau.
   Lệnh: `javac -encoding UTF-8 -cp target/classes -d out <Probe>.java && java -cp "target/classes;out" <Probe>`.
3. `gh run list -L 5` → 5 lần chạy gần nhất `completed success` (commit đã push, không gồm thay đổi local).

**Quy ước kết luận:** `ĐẠT` (có test hoặc probe chứng minh), `KHÔNG ĐẠT` (có bằng chứng vi phạm), `CHƯA` (chưa có bằng chứng chạy, chỉ suy luận từ code hoặc không kiểm được).

---

## 1. Tóm tắt

| Mức | Số phát hiện | Mã |
| :--- | :---: | :--- |
| **Cao** | 4 | BR-01, BR-02, BR-03, BR-04 |
| **Trung bình** | 9 | BR-05 … BR-13 |
| **Thấp** | 7 | BR-14 … BR-20 |

Ba vấn đề nặng nhất, đều đã tái hiện bằng probe:
- **BR-01:** khách vô danh tự đặt giá món đặt trước qua endpoint công khai, đơn sau đó được thu **0đ**.
- **BR-02:** điểm và doanh số của một đơn bị cộng nhầm cho **hội viên khác** khi hai quầy thanh toán cùng lúc.
- **BR-03:** huỷ đơn đã thu tiền chỉ đổi nhãn `refunded`. Điểm, doanh số, hạng, tồn kho và trạng thái bàn **giữ nguyên**.

---

## 2. Ma trận quy tắc nghiệp vụ

| # | Quy tắc (nguồn) | Nơi thực thi | Bằng chứng | Kết luận |
| :-: | :--- | :--- | :--- | :---: |
| R1 | Đặt bàn 07:00–22:00 giờ VN (API_SPEC §3.5) | `OperatingHoursValidator.java:34-44`, `SystemConfigManager.java:82-87` | `ChainTest.convertsUtcToVietnamTimeAndReadsLiveConfig`, `ServerTest.reservationOutsideOpeningHoursFailsTheChain` | ĐẠT (xem BR-15) |
| R2 | Không đặt cho thời điểm đã qua quá 15 phút | `OperatingHoursValidator.java:31-33` | `ChainTest.rejectsBookingsThatAlreadyStartedBeyondTheGraceWindow`, `ServerTest.reservationInThePastFailsTheChainAndIsNotStored` | ĐẠT |
| R3 | 1–20 khách, không vượt số ghế | `CapacityGuestValidator.java:21-31` | `ChainTest.capacityUsesBothConfigAndActualSeats` | ĐẠT ở tầng chain, **KHÔNG ĐẠT qua API** với số khách ≤ 0 (BR-14) |
| R4 | Không trùng khung 2 giờ trên cùng bàn; CANCELLED không chiếm lịch | `TableAvailabilityValidator.java:40-58` | `ReservationHandlerTest.twoBookingsForTheSameSlotCannotBothPassTheChain` | ĐẠT (xem BR-09) |
| R5 | Phiếu: `pending→confirmed`, `pending|confirmed→cancelled`, `seated` chỉ qua transfer | `ReservationHandler.java:132-167` | `ServerTest.reservationStatusFollowsTheBookingLifecycle` | ĐẠT |
| R6 | Một phiếu sinh tối đa một đơn POS | `ReservationHandler.java:181-206` | `ReservationHandlerTest.aBookingIsTransferredToPosOnlyOnceUnderConcurrentRequests` | ĐẠT |
| R7 | Giá món đặt trước phải đúng giá bán | — (không có) | Probe P1 | **KHÔNG ĐẠT** (BR-01) |
| R8 | Đơn đi tiến `pending→brewing→ready→completed`, huỷ khi chưa đóng | `OrderHandler.java:142-159` | `ServerTest.ordersCannotMoveBackwardsAndCancellingPaidOrderRefundsIt` | ĐẠT |
| R9 | `completed` cần đơn đã thanh toán | `OrderHandler.java:150-152` | `ServerTest.transferredOrderMustBePaidBeforeCompletion` | ĐẠT |
| R10 | Huỷ đơn đã thu tiền → hoàn tiền (`refunded`) | `OrderHandler.java:155-157` | Probe P2 | **KHÔNG ĐẠT về hệ quả** (BR-03) |
| R11 | `WELCOME10`: −10%, tối đa 50.000đ | `VoucherCatalog.java:18-19` | `ServerTest.voucherValidationIsPublicAndMatchesCheckout` | ĐẠT (frontend lệch, BR-17) |
| R12 | Giảm theo hạng Đồng 0 / Bạc 5 / Vàng 10 / VIP 15% | `CustomerRank.java:7-10`, `LoyaltyTierDiscountStrategy.java:7-12` | `StrategyTest.computesDiscountsAndSwapsAtRuntime`; probe P2 (Bạc: 180.000 → giảm 9.000) | ĐẠT ở `/checkout`, **KHÔNG ĐẠT** ở `/pay` (BR-10) |
| R13 | Đổi điểm: 1 điểm = 1.000đ, không vượt số dư, không vượt hoá đơn | `CheckoutHandler.java:111-128`, `PointRedemptionDiscountStrategy.java:28-37` | `ServerTest.memberRedeemsLoyaltyPointsAtCheckout`, `ServerTest.redemptionNeverDiscountsMoreThanTheBill`, `CheckoutHandlerTest.twoCheckoutsCannotBothSpendTheSamePointsBalance` | ĐẠT |
| R14 | Tích điểm 10.000đ = 1 điểm, cho đúng khách | `LoyaltyPointObserver.java:24-34` | Probe P2 (184.680đ → 18 điểm) | Công thức ĐẠT; **người nhận KHÔNG ĐẠT** khi đồng thời (BR-02) |
| R15 | VAT 8% tính trên phần sau giảm giá | `Order.java:59-63` | Probe P2: (180.000 − 9.000) × 8% = 13.680 | ĐẠT |
| R16 | Đơn đã thu tiền: bàn → OCCUPIED, KDS nhận phiếu, khách được tích điểm | `OrderEventSubject.java:24-29` | `ServerTest.paidOrderSeatsTableAndKdsCompletionSendsItToCleaning` | ĐẠT trong luồng chuẩn; **KHÔNG ĐẠT** khi một observer lỗi (BR-04) |
| R17 | Đơn hoàn tất → bàn CLEANING | `TableStatusSyncObserver.java:33-42` | Probe P5 | **KHÔNG ĐẠT** khi bàn còn đơn khác mở (BR-05) |
| R18 | Không bán vượt tồn kho | `PosCheckoutFacade.java:127-148,185-201` | `FacadeTest.rejectsInsufficientStockWithoutSideEffects` | ĐẠT khi chạy tuần tự; **CHƯA** chứng minh khi đồng thời (BR-11) |
| R19 | DB JDBC mất kết nối → 503, không thu tiền | `CheckoutHandler.java:57-60`, `OrderHandler.java:163-166` | `ServerTest.checkoutReturns503WhenDatabaseIsDown` | ĐẠT |
| R20 | Nhập đơn offline idempotent theo mã, không thu tiền lần hai | `OrderHandler.java:219-270` | `ServerTest.offlineOrdersAreImportedOnceWithoutChargingAgain` | ĐẠT |
| R21 | RBAC: chỉ menu GET, đặt bàn POST, voucher validate, auth là công khai | `SimpleAuthFilter.java:118-142` | `ServerTest.unknownEndpointsAreNotPublicByDefault`, `ServerTest.tablesRequireStaffRole`, `AuthTest` | ĐẠT |
| R22 | Tự huỷ đặt bàn quá 30 phút (DESIGN_PATTERNS_SPEC §3.1) | — | `getAutoCancelMinutes` chỉ được đọc ở `ConfigHandler.java:117` | **CHƯA triển khai** (tài liệu tự thừa nhận) |
| R23 | Tiền khách đưa phải đủ khi trả tiền mặt | — | Probe P3 | **KHÔNG ĐẠT** (BR-06) |

---

## 3. Phát hiện chi tiết

### BR-01 · CAO · Khách vô danh tự đặt giá món đặt trước, đơn được thu 0đ và không trừ kho
- **Quy tắc bị vi phạm:** giá bán do quán quyết định (menu). Món bán ra phải trừ tồn kho.
- **Bằng chứng code:**
  - `SimpleAuthFilter.java:123`: `POST /api/reservations` là **công khai**.
  - `ReservationHandler.java:99-110`: `price` của từng `preOrders` lấy thẳng từ JSON, chỉ kiểm `>= 0`, không tra menu. `OrderItem` được tạo **không có `menuItemId`**.
  - `ReservationToOrderAdapter.java:54-56`: sao chép nguyên giá đó sang đơn POS.
  - `OrderHandler.java:181-185`: tổng tiền = 0 thì tạo `PaymentResult` `NO-CHARGE` mà không gọi bộ xử lý thanh toán.
- **Probe P1 (output thật):**
  ```
  POST /api/reservations -> 201 {"ok":true,"data":{"id":"RES-0010",...}}
  transfer-pos -> 200 {..."items":[{"menuItemId":null,"name":"Cà phê Latte Vani Mịn","qty":10,"price":0,...}],"subtotal":0,...,"total":0,...}
  pay -> 200 {..."paymentStatus":"paid",...,"total":0,...}
  latte stock before=45.0 after=45.0
  ```
- **Tác động:** 10 ly Latte được giao với giá 0đ và không trừ kho. Tương tự, có thể đặt giá tuỳ ý (1đ, hoặc cao bất thường để gây tranh chấp).

### BR-02 · CAO · Điểm và doanh số bị cộng cho sai hội viên khi hai quầy thanh toán đồng thời
- **Bằng chứng code:**
  - `CheckoutHandler.java:70-89`: gắn `LoyaltyPointObserver` của khách hiện tại vào **`OrderEventSubject` dùng chung** (tạo ở `MainServer.java:51` và truyền cho cả Facade lẫn `OrderHandler`), và chỉ khoá bằng `synchronized (facade)`.
  - `OrderHandler.java:173-199` (`/pay`) và `OrderHandler.java:241-252,352` (`/sync`) phát `notifyOrderPaid` trên **cùng subject**, nhưng khoá bằng `synchronized (this)`, tức là **một khoá khác**.
- **Probe `ObserverRaceProbe` (output thật).** Checkout của hội viên #2 bị giữ ở bước lưu đơn. Trong lúc đó một quầy khác thanh toán đơn `RES-OTHER` (1.080.000đ, không phải của hội viên #2):
  ```
  member#2 before: points=250 spent=2500000.0
  pay of unrelated order -> 200
  checkout -> 200
  member#2 after: points=362 spent=3623740.0 orders=3
  ```
  Đơn của chính hội viên chỉ đáng 4 điểm (43.740đ). 108 điểm, 1.080.000đ doanh số và 1 lượt đơn còn lại đến từ đơn của người khác. Hạng của hội viên có thể bị nâng sai theo đó (`Customer.java:43-61`).
- **Ghi chú:** `CheckoutHandlerTest.twoCheckoutsCannotBothSpendTheSamePointsBalance` chỉ kiểm hai **checkout** chạy song song, không kiểm checkout chạy song song với `/pay` hoặc `/sync`.

### BR-03 · CAO · Huỷ đơn đã thu tiền không đảo ngược bất kỳ hệ quả nào
- **Bằng chứng code:** `OrderHandler.java:154-158` chỉ đặt `status = CANCELLED` và `paymentStatus = REFUNDED`, rồi lưu. Không phát sự kiện nào (`OrderHandler.java:129` chỉ phát khi `COMPLETED`). Không hoàn kho, không trừ lại điểm và doanh số, không trả lại điểm đã đổi, không giải phóng bàn. `IPaymentProcessor` (`IPaymentProcessor.java:3-7`) không có thao tác hoàn tiền.
- **Probe P2 (output thật).** Hội viên #1 (Bạc) checkout 4 ly tại bàn 5, sau đó huỷ đơn:
  ```
  member#1 before: points=60 spent=600000.0 orders=1 rank=SILVER
  checkout -> 200 {..."finalTotal":184680,...,"pointsEarned":18,...}
  table5 after pay=OCCUPIED
  cancel -> 200 {..."status":"cancelled","paymentStatus":"refunded",...}
  member#1 after cancel: points=78 spent=784680.0 orders=2
  salt stock before=85.0 after cancel=81.0
  table5 after cancel=OCCUPIED
  ```
- **Tác động:** có thể mua rồi huỷ lặp lại để nuôi điểm và nâng hạng. Tồn kho lệch so với thực tế. Bàn bị "kẹt" ở OCCUPIED.
- **Ghi chú test:** `ServerTest.ordersCannotMoveBackwardsAndCancellingPaidOrderRefundsIt` chỉ khẳng định nhãn `refunded`.

### BR-04 · CAO · Một observer lỗi làm mất phiếu bếp và điểm của đơn đã thu tiền; checkout không kiểm bàn có tồn tại
- **Bằng chứng code:**
  - `OrderEventSubject.java:24-29`: vòng lặp không bắt lỗi cho từng observer, nên exception đầu tiên dừng cả vòng.
  - `MainServer.java:52-53` gắn `TableStatusSyncObserver` **trước** `KitchenNotificationObserver`. Observer tích điểm được gắn sau cùng (`CheckoutHandler.java:81`).
  - `CheckoutHandler.java:174-177` chỉ kiểm `tableId > 0`, không kiểm bàn có tồn tại hay không.
  - `PosCheckoutFacade.java:118-123`: exception bị đổi thành cảnh báo, đơn vẫn tính là thành công.
- **Probe P4 + `ObserverAbortProbe` (output thật):**
  ```
  checkout -> 200 {..."finalTotal":48600,...,"warnings":["Order event observer failed: Table not found: 999"],...}
  success=true paid total=206550.0 warnings=[Order event observer failed: Table not found: 999]
  KDS tickets=[] ; member points before=550 after=550
  ```
- **Tác động:** khách đã trả tiền nhưng bếp không nhận phiếu, và hội viên không được tích điểm.
- **CHƯA kiểm chứng ở chế độ JDBC:** log `mvn test` có dòng `violates foreign key constraint "fk_orders_table"`. Nếu ràng buộc FK này chặn bàn không tồn tại, `orderDao.save` sẽ thất bại **sau khi đã thu tiền**, dẫn tới `PERSISTENCE_FAILED`/503 (`PosCheckoutFacade.java:104-113`). Tôi chưa chạy riêng kịch bản này trên PostgreSQL.

### BR-05 · TRUNG BÌNH · Hoàn tất một đơn đẩy bàn sang CLEANING dù bàn còn đơn khác đang mở
- **Code:** `TableStatusSyncObserver.java:33-42` đặt `CLEANING` với 0 khách mà không xét các đơn khác cùng bàn (`IOrderDao.findByTableId` có sẵn nhưng không được dùng).
- **Probe P5:** `order AC-FCC2-546 status=PENDING, table6=CLEANING guests=0`.

### BR-06 · TRUNG BÌNH · Trả tiền mặt không kiểm số tiền khách đưa
- **Code:** `CheckoutHandler.java:252-254` chỉ tính `changeDue = max(0, tendered − total)`. `CashPaymentProcessor.java:7-13` không nhận `tendered`.
- **Probe P3:** `tenderedAmount:1000` cho đơn 97.200đ → `200 ... "changeDue":0,"paymentStatus":"paid"`.

### BR-07 · TRUNG BÌNH · Đơn tạo qua checkout mất `menuItemId`
- **Code:** `OrderBuilder.java:53` tạo `new OrderItem(description, qty, cost)`. `IBeverage` không mang id món. `AnalyticsHandler.java:142` gom "món bán chạy" theo **tên đã gắn decorator**, nên "Latte (Size L)" và "Latte" bị tính thành hai món khác nhau.
- **Probe P2:** `"items":[{"menuItemId":null,"name":"Cà phê Muối Đặc Biệt",...}]`, trái với API_SPEC §3.8 (liệt kê `menuItemId`).
- **Hệ quả:** không thể hoàn kho hay truy vết theo món (khiến BR-03 khó sửa).

### BR-08 · TRUNG BÌNH · Mã đơn 28 bit ngẫu nhiên, không kiểm trùng, cột UNIQUE → có thể lưu thất bại sau khi đã thu tiền
- **Code:** `OrderBuilder.java:90-93` sinh 7 ký tự hex (16⁷ = 2²⁸). `JdbcDatabase.java:257`: `order_code VARCHAR(50) UNIQUE NOT NULL`. Khi lưu thất bại: `PosCheckoutFacade.java:110-113` trả `PERSISTENCE_FAILED` với nội dung "payment … must be voided".
- **Lập luận (CHƯA chạy):** theo nghịch lý ngày sinh, xác suất trùng đạt khoảng 50% sau khoảng 1,18·√2²⁸ ≈ **19.300 đơn**. Với một quán 50–100 đơn/ngày, mức này đến trong khoảng 6–12 tháng.

### BR-09 · TRUNG BÌNH · Đặt bàn công khai không giới hạn; phiếu chờ giữ chỗ vĩnh viễn
- **Code:** `SimpleAuthFilter.java:123` (công khai, không giới hạn tần suất). `TableAvailabilityValidator.java:40-58` tính PENDING là chiếm lịch. Không có tác vụ tự huỷ (R22).
- **Tác động:** một script có thể chiếm hết 15 bàn × mọi khung giờ. Phiếu không ai xác nhận vẫn chặn khách thật.
- **CHƯA chạy** kịch bản tải. Kết luận dựa trên code.

### BR-10 · TRUNG BÌNH · Hội viên thanh toán đơn chuyển từ đặt bàn không được giảm theo hạng
- **Code:** `OrderHandler.java:161-203` (`/pay`) chỉ tích điểm, không áp `LoyaltyTierDiscountStrategy`. Ngược lại, `CheckoutHandler.java:217-223` có áp.
- **Probe P9:** hội viên `VIP`, `/pay` → `"discountAmount":0,...,"total":118800`.

### BR-11 · TRUNG BÌNH · Giữ kho không nguyên tử; DAO kẹp về 0 thay vì từ chối
- **Code:**
  - `InMemoryMenuDao.java:65-71` và `JdbcMenuDao.java:170-181` (`GREATEST(0.0, …)`) luôn trả `true` khi món tồn tại, kể cả khi trừ quá số tồn. Vì vậy nhánh hoàn tác trong `PosCheckoutFacade.reserveStock` (`:185-197`) không bao giờ chạy vì thiếu hàng.
  - Phép kiểm `PosCheckoutFacade.java:142-147` được bảo vệ bằng khoá `facade`. `MenuHandler.java:107-113` và `OrderHandler.deductStock` (`:328-343`) ghi kho **ngoài khoá đó**.
  - Nếu kho bị kẹp rồi thanh toán lỗi, `releaseStock` (`:199-201`) cộng lại **toàn bộ** nhu cầu, làm kho phình lên.
- **CHƯA tái hiện** race. Kết luận dựa trên code.

### BR-12 · TRUNG BÌNH · JDBC: cập nhật điểm theo kiểu đọc-sửa-ghi, không giao dịch
- **Code tại thời điểm đọc:** `JdbcCustomerDao.java:160-177`: `findById → addOrderRecord/redeemPoints → save`. Hai luồng dùng hai khoá khác nhau (checkout khoá `facade`, `/pay` khoá `OrderHandler`) có thể ghi đè lên nhau.
- **Cập nhật:** bản sửa đồng thời (04:03, chưa commit) thay bằng `changeLocked(...)` với `SELECT … FOR UPDATE` trong giao dịch, và thêm `synchronized (customer)` ở `InMemoryCustomerDao`. Theo code, lỗi mất cập nhật **có thể đã được xử lý**, nhưng **CHƯA** kiểm chứng: tôi chưa chạy test với bản sửa này. Bản sửa **không** giải quyết BR-02 (khách nhận điểm là sai người, không phải mất cập nhật).

### BR-13 · TRUNG BÌNH · Đơn hội viên ghi offline mất giảm giá theo hạng và mất điểm
- **Code:** `frontend-nextjs/app/admin/actions.ts:389-396`: `LocalOrderInput` không có `customerPhone`. `actions.ts:410-433` cho phép lưu cục bộ (chỉ chặn khi có đổi điểm). `OrderHandler.sync` (`:219-270`) không tích điểm.
- **CHƯA chạy** luồng frontend.

### BR-14 · THẤP · Số khách ≤ 0 được ép thành 1 và phiếu được nhận
- **Code:** `Reservation.java:115-117` (`Math.max(1, guests)`), được gọi ở `ReservationHandler.java:96` **trước** khi chạy chain.
- **Probe P7:** `guests=0 -> 201`, `guests=-5 -> 201`. Đây là hành vi DESIGN_PATTERNS_SPEC §3.8 cố ý giữ, nhưng nó che lỗi nhập liệu và làm vô hiệu cận dưới của R3 khi đi qua API.

### BR-15 · THẤP · Nhận phiếu bắt đầu đúng giờ đóng cửa
- **Code:** `SystemConfigManager.java:86` tính cả hai biên. Slot dài 2 giờ.
- **Probe P8:** `22:00 -> 201`, tức bàn được giữ tới 00:00. Spec cố ý không chặn, nhưng đây vẫn là rủi ro vận hành.

### BR-16 · THẤP · `transfer-pos` không kiểm thời điểm và trạng thái bàn
- **Code:** `ReservationHandler.java:185-205`: không so `dateTime` với hiện tại, và đặt bàn sang `OCCUPIED` dù bàn đang có khách khác. **CHƯA chạy.**

### BR-17 · THẤP · Voucher giỏ hàng frontend lệch với Java
- **Code:** `frontend-nextjs/app/api/cart/route.ts:9` (5 mã offline) và `:48` (−10% **không trần**), trong khi `VoucherCatalog.java:18-19` chỉ có `WELCOME10`, trần 50.000đ. API_SPEC §4 có ghi nhận (giá demo tính bằng USD).

### BR-18 · THẤP · `vatRate` và `autoCancelMinutes` trong cấu hình không có tác dụng
- **Code:** `Order.java:16` dùng VAT cố định. `ConfigHandler.java:116-117` ghi chú "reference only". Admin xem được 2 tham số này nhưng chúng không ảnh hưởng hành vi. Tài liệu có ghi nhận.

### BR-19 · THẤP · Trạng thái bàn đổi tuỳ ý
- **Code:** `TableHandler.java:50-66` chấp nhận mọi chuyển trạng thái, ví dụ `AVAILABLE` khi bàn còn đơn chưa thanh toán. Spec chỉ *đề xuất* State Pattern (§4.1). **CHƯA chạy.**

### BR-20 · THẤP · Lưu đơn thất bại sau khi thu tiền: không tự huỷ giao dịch
- **Code:** `PosCheckoutFacade.java:110-113` chỉ trả thông báo "must be voided". Không có cơ chế huỷ giao dịch hay hàng đợi đối soát. Hiện bộ xử lý là mô phỏng, nên rủi ro mới ở mức thiết kế.

---

## 4. Những điểm CHƯA kiểm chứng

- Toàn bộ kịch bản trên **PostgreSQL/JDBC** (BR-04 nhánh FK, BR-08, BR-12). Tôi chỉ chạy `JdbcIntegrationTest` có sẵn (9 test, pass).
- Race kho (BR-11) và tải đặt bàn (BR-09): chưa dựng kịch bản đồng thời.
- Frontend: không chạy `npm test` (37 test UI/UX) và không chạy app. BR-13 và BR-17 chỉ dựa trên đọc code.
- Storefront checkout (`app/checkout/page.tsx`) và Mock Store: chưa đánh giá quy tắc tiền.

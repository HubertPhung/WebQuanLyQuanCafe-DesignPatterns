# REVIEW REPORT: review độc lập 4 phiên tự động (nhánh `feature/hoai-bo`)

- Ngày review: 2026-10-18. HEAD: `67e5253`. Mọi thay đổi được review đều **chưa commit**: 47 file sửa (+1117 / −304 dòng), 18 file mới (9 file code hoặc tài liệu, 9 file báo cáo).
- Phạm vi: các phiên 1 đến 4 (`NIGHTLY_REPORT.md`, `_2`, `_3`, `_4`), chạy sau bản review lúc 03:05. Báo cáo của agent chỉ dùng để biết agent *nói* đã làm gì. Mọi kết luận ở đây dựa trên lệnh tự chạy và dòng code tự đọc.
- Chế độ: chỉ đọc source code. Phiên này chỉ ghi `REVIEW_REPORT.md` và `NEXT_PLAN.md`. Mọi lần chạy kiểm tra đột biến và chạy lặp đều thực hiện trên **bản sao** trong scratchpad. Không commit, không push.
- Vị trí báo cáo: workspace không cấu hình chỗ riêng, nên báo cáo nằm ở thư mục gốc repo, cùng chỗ với các bản trước.

## 1. Kết luận

**Chấp nhận, kèm điều kiện.**
- Các bản sửa race (điểm thành viên, thanh toán và huỷ, kho, cấu hình) đúng hướng.
- Các test mới thật sự bắt được lỗi: trả 7 file về `HEAD` thì đúng 8 test mới fail (E3).
- Toàn bộ 240 test JUnit và 38 test UI đều pass (E1, E4). Chạy lặp 5 lần không thấy test chập chờn (E5).
- Không tìm thấy lỗi biên dịch, deadlock hay hồi quy nào trong code đã đổi.

Điều kiện:
1. **BR-06 mới được sửa ở API, chưa có tác dụng trong quy trình thật.** POS không gửi `tenderedAmount` (N1). Bảng tóm tắt của phiên 2 ghi "✅ Đã sửa". Agent có nói rõ giới hạn này ở §5.2, nhưng nhãn ✅ dễ gây hiểu lầm.
2. Lượng thay đổi chưa commit đã quá lớn (5 phiên chồng lên nhau). Cần người dùng review, tách commit và push để CI chạy, trước khi giao thêm việc (`NEXT_PLAN.md` §0).

## 2. Agent đã làm gì (đối chiếu `git diff`, không theo báo cáo)

| Phiên | Hạng mục | File chính (đã đọc diff) |
| :-: | :--- | :--- |
| 1 | F1: điểm thành viên đọc-sửa-ghi | `JdbcCustomerDao.java:160-208` (`SELECT … FOR UPDATE` trong giao dịch), `InMemoryCustomerDao.java:70,80` (`synchronized (customer)`) |
| 1 | F2: sự kiện *paid* phát ngoài khoá | `OrderHandler.java:175-208`: `notifyOrderPaid` và cộng điểm chuyển vào trong khoá |
| 1 | F3, F4: fallback đặt bàn | `lib/reservation-rules.ts` (mới), `mock-store.ts:827-845`, `reservations/page.tsx` (đọc `maxReservationGuests` từ `/api/config`) |
| 2 | BR-04a: một observer lỗi chặn các observer khác | `OrderEventSubject.java:37-55` |
| 2 | BR-02: điểm cộng nhầm hội viên | `CheckoutHandler.java:74-100` (gọi `LoyaltyPointObserver` trực tiếp, không gắn vào subject dùng chung) |
| 2 | BR-01: client tự đặt giá món đặt trước | `ReservationHandler.java:104-114` (bắt buộc `menuItemId`, giá lấy từ menu) |
| 2 | BR-04b: bàn không tồn tại; BR-06: tiền mặt thiếu | `CheckoutHandler.java:184-186`, `PosCheckoutFacade.java:77-81`, `CheckoutRequest.java` |
| 3 | BR-05, BR-11, BR-07, BR-08 | `TableStatusSyncObserver.java:46-62`, `deductStockIfAvailable` ở 3 DAO, `MenuHandler.java:108-118`, `OrderBuilder.java` |
| 4 | PT-01, PT-02, PT-03, tài liệu | `SystemConfigManager` (khoá và múi giờ), `ConfigHandler.java:48-72`, `PaymentArguments.java` (mới), `equals/hashCode` ở 3 model, `docs/*` |

## 3. Bằng chứng đã tự chạy

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E1 | `cd backend-java && mvn -B clean test` | `MVN_EXIT=0`, `Tests run: 240, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`. Đếm `target/surefire-reports/TEST-*.xml`: **TOTAL 240, fail 0, err 0, skip 0** |
| E2 | `cd frontend-nextjs && npx tsc --noEmit -p .` | `TSC_EXIT=0` |
| E3 | **Kiểm tra đột biến** trên bản sao: trả 7 file về `HEAD` (`InMemoryCustomerDao`, `JdbcCustomerDao`, `OrderEventSubject`, `SystemConfigManager`, `Order`, `Customer`, `OrderHandler`), chạy `DaoLayerTest, JdbcIntegrationTest, ObserverTest, OrderHandlerTest, SingletonTest*, ModelEntitiesTest*, ConfigHandlerTest` | `EXIT=1`, `Tests run: 108, Failures: 8`. Cả 8 đều là test mới, fail đúng lý do: `testConcurrentEarnAndRedeem expected <80000> but was <86742>`; `JdbcIntegrationTest…KeepEveryChange expected <200> but was <188>`; `testCustomerEquality` và `testOrderEquality` (hash khác nhau); `failingObserverDoesNotStopTheOthers… expected <1> but was <0>`; `testCurrentTimeUsesTheCafeTimeZone`; `cancellingWhileACashierPays… expected <409> but was <200>`; `completingWhileThePaidEventRuns… expected <CLEANING> but was <OCCUPIED>` |
| E4 | `cd frontend-nextjs && npm test` (tự khởi động `next dev`, Java không chạy) | `NPM_EXIT=0`, **38/38 PASS**, gồm `TC-ACT-10` (fallback đặt bàn từ chối phiếu trùng slot, phiếu 23:30, phiếu đã qua; phiếu đã huỷ thì nhả slot) |
| E5 | Chạy lặp 5 lần trên bản sao: `ConfigHandlerTest, ChainTest, OrderHandlerTest, ReservationHandlerTest, CheckoutHandlerTest, DaoLayerTest, MenuHandlerTest, FacadeTest, JdbcIntegrationTest` | `RUN1..RUN5 EXIT=0`, không dòng `FAIL` nào trong 5 log. Chưa thấy test chập chờn |
| E6 | Như E3, nhưng chỉ xét `ConfigHandlerTest` khi trả riêng `SystemConfigManager` về `HEAD` | `ConfigHandlerTest` **vẫn pass**. Tính nhất quán của cặp giờ được bảo đảm bởi `synchronized (config)` ở nơi gọi (`ConfigHandler.java:48,110`, `OperatingHoursValidator.java:42`), không phải bởi các getter `synchronized`. Xem N5 |
| E7 | `grep` frontend tìm `preOrders`, `tenderedAmount` trong payload gửi Java | `ReservationPayload` (`lib/api-client.ts:130-138`) không có `preOrders`. `CheckoutPayload` (`lib/api-client.ts:94-104`) không có `tenderedAmount` |
| E8 | `grep` production tìm `Set<Order…>`, `.contains(order)`, `.equals(customer)`, … | Không có kết quả. Đổi ngữ nghĩa `equals` (PT-03) không làm đổi hành vi nào đang chạy |
| E9 | `graphify query "frontend api client sends reservation preOrders and checkout payload…"` | Graph 3753 node, chỉ đúng tới `lib/api-client.ts`, `admin/actions.ts`, `ReservationHandler`, `CheckoutHandler` |

Ghi chú về E5: trong `target/` của bản sao có 4 file XML báo fail (`ModelEntitiesTest$CustomerTest`, `$OrderTest`, `ObserverTest`, `SingletonTest$OperatingParametersTests`). Đó là báo cáo cũ còn lại từ lần chạy đột biến E3, của các lớp không có trong E5, không phải kết quả của E5.

## 4. Đối chiếu Frontend ↔ Backend

| Điểm | Frontend | Backend | Đánh giá |
| :--- | :--- | :--- | :--- |
| `POST /api/reservations` bắt buộc `preOrders[].menuItemId` (BR-01) | Form admin không gửi `preOrders` (`api-client.ts:130-138`). Storefront không có form đặt bàn (grep `app/`, `components/` ngoài admin: chỉ khớp ở trang đăng ký) | `ReservationHandler.java:110-112` trả 400 nếu thiếu | ✅ Không làm vỡ client trong repo. `API_SPEC.md:127-130` đã cập nhật |
| Cửa sổ "thời điểm đã qua" | `reservation-rules.ts`: `RESERVATION_PAST_GRACE_MS = 15 phút` | `OperatingHoursValidator.PAST_GRACE = 15 phút` | ✅ Khớp giá trị. Hằng số vẫn được khai báo hai lần, nhưng đã có chú thích dẫn chéo |
| Giờ mở cửa ở fallback | `isWithinDefaultOperatingHours`: 07:00–22:00, gồm cả hai biên, theo UTC+7 | `isWithinOperatingHours`: `!before(open) && !after(close)`, `Asia/Ho_Chi_Minh` | ✅ Khớp. Fallback dùng giá trị **mặc định**, không phải cấu hình admin đã đổi. Giới hạn này đã ghi ở đầu `reservation-rules.ts` (N8) |
| Trùng slot ở fallback | `reservationSlotsOverlap` 2 giờ, bỏ qua phiếu `Đã hủy` | `TableAvailabilityValidator`: `DEFAULT_DURATION = 2h`, bỏ qua `CANCELLED` | ✅ Khớp |
| Giới hạn số khách | `max={maxGuests}` lấy từ `/api/config`, offline thì dùng 20 (`reservations/page.tsx`) | `CapacityGuestValidator` đọc `getMaxReservationGuests()` | ✅ F4 của bản review trước đã đóng |
| `POST /api/checkout`: bàn không tồn tại → 404 (BR-04b) | Lỗi không phải mất kết nối → `rejected`, hiện lỗi cho thu ngân (`actions.ts:285`) | `CheckoutHandler.java:184-186` | ✅ Đơn không bị lưu cục bộ sau khi Java từ chối. Cả hai phía seed 15 bàn |
| `tenderedAmount` (BR-06) | **Không gửi** (`CheckoutPayload`). State `tendered` ở `pos-terminal.tsx:88` không gắn với ô nhập nào, chỉ được reset ở `:189`. `change` ở `:102` không được dùng | Chỉ kiểm khi có gửi (`PosCheckoutFacade.java:78`) | ❌ Quy tắc không có tác dụng trong quy trình thật (N1) |
| Customization | Gửi `customizations: ["SIZE_L", …]` | Nhận cả `size`/`toppings` và `customizations` (`CheckoutHandler.java:193-214`) | ✅ |
| `/sync` và `/pay` cùng khoá | — | `OrderHandler.java:242` (`/sync`, phát sự kiện bên trong khoá), `:175` (`/pay`) | ✅ Nhất quán với F2 |

## 5. Phát hiện mới (nghiêm trọng nhất trước)

**XÁC NHẬN** = đã chứng minh bằng lệnh hoặc grep. **ĐỌC CODE** = suy ra từ code, chưa có test tái hiện.

### N1. Quy tắc tiền mặt (BR-06) không chạy được từ POS (Trung bình, XÁC NHẬN, E7)
- Backend chỉ kiểm khi `tenderedAmount != null` (`PosCheckoutFacade.java:78`). Frontend không bao giờ gửi trường này (`api-client.ts:94-104`, `pos-terminal.tsx:170-180`).
- Trên POS không có ô "tiền khách đưa": `setTendered` chỉ xuất hiện ở dòng reset `pos-terminal.tsx:189`, còn `change` (`:102`) là code chết.
- `docs/API_SPEC.md:153` ghi trung thực "POS hiện không gửi trường này". Phiên 2 cũng đã nêu ở §5.2. Riêng nhãn "✅ Đã sửa" ở bảng tóm tắt là nói quá: đây mới là phần hạ tầng.

### N2. Đơn treo giữ bàn ở `OCCUPIED` vô thời hạn (Thấp–Trung bình, ĐỌC CODE)
- `TableStatusSyncObserver.hasOtherOpenOrder` (`TableStatusSyncObserver.java:54-62`) coi mọi đơn chưa `COMPLETED` hay `CANCELLED` là đơn mở, kể cả đơn **chưa trả tiền** và không giới hạn thời gian.
- Dữ liệu seed in-memory có sẵn đơn `AC-0052-C3D` (`PENDING`, `UNPAID`) ở bàn 7 (`InMemoryDatabase.java:172-178`). Theo code, hoàn tất bất kỳ đơn nào khác ở bàn 7 cũng không đưa bàn sang `CLEANING` cho tới khi đơn seed được đóng.
- Phiên 3 đã nêu hệ quả này ở §5.2 như một "đổi hành vi". Vẫn cần người dùng chốt quy tắc (`NEXT_PLAN.md` §2).
- Lớp này có hai constructor cho hai hành vi khác nhau: `(tableDao)` giữ hành vi cũ, `(tableDao, orderDao)` dùng hành vi mới. `MainServer` dùng constructor mới. Constructor mặc định của `PosCheckoutFacade` (PT-06) vẫn có thể tạo ra hành vi cũ.

### N3. Đổi điểm thất bại sau khi thu tiền chỉ sinh cảnh báo (Thấp, ĐỌC CODE, có từ trước)
- Ở `CheckoutHandler.java:86-99`, điểm được cộng và trừ trong **hai giao dịch riêng**, đều **sau** khi Facade đã thu tiền. Nếu `redeemPoints` trả `false` (ví dụ lỗi DB), khách vẫn được giảm giá theo điểm mà điểm không bị trừ.
- Lỗi đọc trùng số dư đã được chặn: khoá `facade` và `FOR UPDATE` loại trừ đọc trùng, nên chỉ còn lỗi hạ tầng gây ra nhánh này. Mức thấp, nhưng đây là điểm cuối còn hở trong chuỗi F1, BR-02, BR-12.

### N4. `pay()` giữ khoá trong lúc chạy observer (Thấp, ghi nhận)
- `OrderHandler.java:175-208`: lần ghi bàn, gửi KDS và ghi điểm (JDBC) đều nằm trong `synchronized (this)`. Vì vậy mọi `/pay`, `PATCH /status` và `/sync` đi tuần tự qua một khoá, kể cả khi thuộc các đơn khác nhau. Với quy mô một quán thì chấp nhận được, và đây là cái giá có chủ đích để đóng F2.
- **Phân tích thứ tự khoá (đọc code):** `ReservationHandler` → `config`; `facade` → `config` / `Customer` / `MenuItem`; `OrderHandler` → `Customer`; `ConfigHandler` → `config` (không lấy khoá nào khác). `PointRedemptionDiscountStrategy` giữ `config` và chỉ gọi `customer.getLoyaltyPoints()`, phương thức này không khoá. `Customer.addOrderRecord` không gọi `SystemConfigManager` (grep không có kết quả). **Không thấy chu trình nào, nên không có nguy cơ deadlock.**

### N5. Quy ước khoá cấu hình phụ thuộc vào kỷ luật của nơi gọi (Thấp, XÁC NHẬN, E6)
- Các getter `synchronized` chỉ đảm bảo đọc được giá trị mới nhất của **từng** trường. Đọc cặp giờ mở và giờ đóng nhất quán là nhờ nơi gọi tự giữ `synchronized (config)`.
- E6 cho thấy test không bắt được nếu ai đó thêm một nơi đọc hai trường mà quên khoá. Javadoc của lớp đã ghi quy ước. Nên thêm một dòng vào `.agents/rules/backend-java-constraints.md`.

### N6. Lẫn hai ngôn ngữ trong cùng một quy tắc (Thấp, XÁC NHẬN)
- Cùng quy tắc "thời điểm đã qua": `actions.ts:506` báo "Choose a date and time that has not passed yet.", còn fallback (`mock-store.ts:832`) và Java báo "Không thể đặt bàn cho thời điểm đã qua.". F7 của bản review trước vẫn mở.

### N7. `docs/DEVELOPMENT_PLAN.md` vẫn ghi số liệu cũ (Thấp, XÁC NHẬN)
- Dòng 9, 10, 11 ghi `205/205`, `37/37`, `2,057 nodes`. Số đo hiện tại là 240 (E1), 38 (E4), 3753 node (E9). F8 vẫn mở. File này chưa được theo dõi và đang chờ người dùng duyệt.

### N8. Fallback đặt bàn dùng cấu hình mặc định (Thấp, ghi nhận)
- Khi Java tắt, frontend không đọc được `/api/config`, nên fallback dùng 07:00–22:00 và tối đa 20 khách. Nếu admin đã đổi cấu hình, một phiếu lưu cục bộ có thể không qua được chain của Java. Giới hạn này được ghi trung thực ở đầu `reservation-rules.ts`, và chú thích ở `mock-store.ts:827-829` đã sửa lại cho đúng, không còn "nói quá" như F3 cũ.

## 6. Đối chiếu tuyên bố của agent

| Tuyên bố | Kết quả kiểm |
| :--- | :--- |
| Phiên 4: 240 JUnit, 0 fail | **ĐÚNG** (E1) |
| Phiên 1: 38/38 UI, có `TC-ACT-10` | **ĐÚNG** (E4) |
| Phiên 1: test F1 và F2 fail trên code cũ | **ĐÚNG** (E3) |
| Phiên 2: BR-04a có test fail trên code cũ | **ĐÚNG** (E3) |
| Phiên 4: PT-03 (3 model) và múi giờ PT-01 có test fail trên code cũ | **ĐÚNG** (E3) |
| Phiên 4: test cấu hình bắt được đọc nửa cũ nửa mới | **ĐÚNG có điều kiện:** chỉ bắt được khi gỡ cả khối khoá ở nơi gọi. Trả riêng `SystemConfigManager` về cũ thì test vẫn pass (E6) |
| Phiên 2: BR-06 "✅ Đã sửa" | **ĐÚNG MỘT PHẦN:** đúng ở API, nhưng POS không dùng (N1) |
| Phiên 2: đổi hợp đồng preOrders không ảnh hưởng client trong repo | **ĐÚNG** (E7, §4) |
| Phiên 4: đổi `equals` không làm đổi hành vi đang chạy | **ĐÚNG** (E8) |
| Phiên 3: BR-05, BR-07, BR-08, BR-11 có test fail trên code cũ | Test **pass** trong E1. **Chưa tự kiểm tra đột biến** cho các mục này (cần trả về cũ cả `IMenuDao`, nên phải dựng bộ đột biến riêng) |
| Số test trong `README.md`, `docs/TESTING.md`, `docs/DESIGN_PATTERNS_SPEC.md:1266`, `ci.yml` | **ĐÚNG**: 240 và 38 |
| Không phiên nào commit hay push | **ĐÚNG**: `HEAD` vẫn là `67e5253`, `git status` còn 47 `M` và 18 `??` |

## 7. Logic đã kiểm và thấy đúng
- `JdbcCustomerDao.changeLocked` (`:178-208`): khi `return false` hoặc gặp `SQLException`, code không rollback tường minh, nhưng `JdbcDatabase.release` rollback và đặt lại `autoCommit` mỗi khi trả kết nối về pool. Vì vậy không sót khoá dòng. Chỉ ghi lại các cột bộ đếm, nên giữ nguyên các sửa hồ sơ chạy song song.
- `JdbcMenuDao.deductStockIfAvailable`: một câu `UPDATE … WHERE stock_qty >= ?` có điều kiện, nên nguyên tử. Bản in-memory khoá trên đúng đối tượng mà `updateStock` khoá.
- `MenuHandler.java:108-118`: lần trừ kho tương đối được DAO kiểm lại. Số lượng báo trong lỗi 409 đọc lại từ DAO.
- `PosCheckoutFacade`: kiểm tiền mặt **trước** khi giữ kho và thu tiền. Mã đơn trùng được sinh lại **trước** khi thu tiền (tối đa 10 lần, rồi ném lỗi).
- `ReservationHandler`: kiểm chain và `save`, đổi trạng thái, `transfer-pos` cùng dùng một khoá. `SEATED` vẫn trả 400 trước khi lấy khoá.
- `OrderEventSubject.notifyAll`: mọi observer đều chạy. Lỗi đầu tiên được ném lại, các lỗi sau gắn vào `suppressed`. Nơi gọi biến lỗi thành `warnings`.
- `ConfigHandler.update`: đọc, kiểm `opening < closing` và ghi trong cùng một khoá. Ném `ApiException` bên trong khối `synchronized` vẫn nhả khoá đúng.
- Test có ghi đè trạng thái toàn cục: `ChainTest` và `ConfigHandlerTest` gọi `resetToDefaults()` ở `@AfterEach`. `SingletonTest` khôi phục múi giờ JVM trong `finally` và tự bỏ qua trong khoảng 23:00–01:00 giờ quán.

## 8. Chưa xác minh trong phiên này
- GitHub Actions: chưa push nên CI chưa chạy.
- `npm run build`: không chạy, vì `tsc` sạch (E2). Phiên 1 báo build thành công, nhưng phiên này chưa tự xác minh.
- Kiểm thử trên trình duyệt: không chạy, theo quy ước dựa vào JUnit, bộ test UI và CI.
- Kiểm tra đột biến cho BR-05, BR-07, BR-08, BR-11 và cho `ReservationHandler` (BR-01).
- N2 và N3 chưa có test tái hiện.
- Chạy với Supabase thật: mọi test JDBC chạy trên PostgreSQL nhúng. Việc id bàn ở Supabase khớp với Java chỉ được đối chiếu trên dữ liệu seed (15 bàn mỗi bên).

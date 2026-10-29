# Quản lý voucher — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển voucher từ danh sách viết cứng sang dữ liệu trong database. Admin thêm, sửa, xóa được voucher (kiểu giảm, đơn tối thiểu, giới hạn tổng và giới hạn mỗi tài khoản, chỉ đơn online đầu tiên, ngày bắt đầu và hết hạn). Lượt bị trừ ngay khi đặt đơn (cả COD) và được trả lại khi đơn bị hủy.

**Architecture:** Java giữ mọi quy tắc. Thêm model `Voucher` và `VoucherUsage`, DAO hai chế độ, và `VoucherService` (thay `VoucherCatalog`) dựng Strategy giảm giá có sẵn. Lượt dùng được giữ nguyên tử trong DAO và gắn với mã đơn. Đơn bị hủy sẽ nhả lượt qua một Observer mới. Next.js chỉ gọi API: trang admin mới, storefront lấy danh sách mã từ Java, và đơn COD gọi `redeem`/`release`.

**Tech Stack:** Java 17 (`com.sun.net.httpserver`, JDBC/PostgreSQL, JUnit 5, embedded-postgres), Next.js App Router + TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-29-voucher-va-gio-dat-ban-design.md` (phần A)

## Global Constraints

- Mã voucher: viết hoa, regex `^[A-Z0-9_-]{3,30}$`, duy nhất, so khớp không phân biệt hoa thường sau khi `trim()`.
- Mã hợp lệ từ 00:00 ngày bắt đầu đến 23:59:59 ngày hết hạn, giờ `Asia/Ho_Chi_Minh` (+07:00).
- `PERCENT`: 1–100; mức giảm tối đa không bắt buộc. `FIXED`: > 0. Đơn tối thiểu ≥ 0, tính trên tạm tính trước VAT và trước mọi khoản giảm.
- `maxUses` và `perAccountLimit`: null nghĩa là không giới hạn, nếu có thì ≥ 1. `maxUses` không được nhỏ hơn `usedCount`.
- Không bao giờ vượt `maxUses` hoặc `perAccountLimit`, kể cả khi các request chạy đồng thời.
- Quyền: CRUD voucher cần **MANAGER** trở lên. `GET /api/vouchers/active` và `POST /api/vouchers/validate` công khai. `redeem`/`release` chỉ dành cho service key của storefront.
- Mã đã có lượt dùng thì không xóa hẳn mà chỉ tắt (`active=false`), và không được đổi `code`.
- Voucher thay cho giảm giá theo hạng thành viên; điểm tích lũy vẫn cộng dồn lên trên (`PointRedemptionDiscountStrategy`).
- Storefront từ chối mọi voucher khi Java không truy cập được.
- POS không có ô nhập voucher trong đợt này.
- Comment viết bằng tiếng Việt, theo cách viết của code xung quanh. Test chạy bằng `mvn test` (JUnit) và `npx tsc --noEmit` + `npm run build` + `npm test` bên frontend.
- Commit chỉ `git add` đúng các file của task (working tree đang có thay đổi chưa commit của người dùng), và không thêm dòng `Co-Authored-By`/"Generated with".
- Sau mỗi task có sửa code: chạy `"C:/Users/phung/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe" -m graphify update .` ở thư mục gốc repo.

## Review Focus

1. Mã nhập chữ thường hoặc có khoảng trắng (`" sale1111 "`) phải khớp `SALE1111` → test `checkNormalizesCode` (Task 3).
2. Ranh giới ngày theo giờ VN: mã hết hạn 2026-11-11 vẫn dùng được lúc 2026-11-11T23:59+07:00, không dùng được lúc 2026-11-12T00:00+07:00 (tức 2026-11-11T17:00Z) → test `expiresAtVietnamMidnight` (Task 1).
3. Admin giảm tổng lượt xuống dưới số đã dùng → 400, không lưu → test `rejectsMaxUsesBelowUsedCount` (Task 4).
4. Hủy cùng một đơn hai lần, hoặc hủy đơn không dùng mã → lượt không đổi → test `releaseIsIdempotent` (Task 1) và `cancellingTwiceReleasesOnce` (Task 6).
5. Checkout thất bại sau khi đã giữ lượt (hết hàng, thanh toán bị từ chối) → lượt được trả → test `failedCheckoutReturnsTheUse` (Task 5).

---

### Task 1: Model voucher và DAO in-memory

**Files:**
- Create: `backend-java/src/main/java/com/dalatcafe/model/Voucher.java`, `VoucherType.java`, `VoucherUsage.java`
- Create: `backend-java/src/main/java/com/dalatcafe/dao/IVoucherDao.java`, `InMemoryVoucherDao.java`
- Modify: `backend-java/src/main/java/com/dalatcafe/dao/DaoFactory.java` (thêm `getVoucherDao()` theo mẫu các DAO khác)
- Modify: `backend-java/src/main/java/com/dalatcafe/dao/InMemoryDatabase.java` (seed `WELCOME10`, `reset()` xóa voucher)
- Test: `backend-java/src/test/java/com/dalatcafe/dao/VoucherDaoContract.java` (abstract), `InMemoryVoucherDaoTest.java`

**Interfaces:**
- Produces:
  - `enum VoucherType { PERCENT, FIXED }`
  - `class Voucher`: `Integer id; String code; VoucherType type; double value; Double maxDiscount; double minOrder; Integer maxUses; Integer perAccountLimit; boolean firstOnlineOrderOnly; LocalDate startDate; LocalDate endDate; String description; boolean active; int usedCount; Instant createdAt` (getter/setter đủ), cùng
    - `static final ZoneId CAFE_ZONE = ZoneId.of("Asia/Ho_Chi_Minh")`
    - `boolean isWithinDates(Instant now)`
    - `VoucherState stateAt(Instant now)` với `enum VoucherState { UPCOMING, RUNNING, EXPIRED, SOLD_OUT, DISABLED }`. Thứ tự ưu tiên: DISABLED > EXPIRED > SOLD_OUT > UPCOMING > RUNNING.
    - `Voucher copy()`
  - `record VoucherUsage(int id, int voucherId, Integer userId, String orderCode, double discountAmount, Instant createdAt)`
  - `interface IVoucherDao`:
    - `List<Voucher> findAll()`, `Optional<Voucher> findById(int id)`, `Optional<Voucher> findByCode(String code)` (không phân biệt hoa thường)
    - `boolean save(Voucher v)`: id null thì thêm mới và gán id; ngược lại cập nhật mọi trường trừ `usedCount`. Trả false khi trùng mã.
    - `boolean deleteById(int id)`
    - `RedeemResult redeem(int voucherId, Integer userId, String orderCode, double discountAmount)` với `record RedeemResult(RedeemStatus status, int usageId)` và `enum RedeemStatus { REDEEMED, SOLD_OUT, ACCOUNT_LIMIT, UNKNOWN_VOUCHER }`. Bước kiểm tra `maxUses`, kiểm tra `perAccountLimit` (chỉ khi `userId != null`), tăng `usedCount` và ghi usage là **một thao tác nguyên tử**.
    - `boolean attachOrder(int usageId, String orderCode)`
    - `boolean releaseUsage(int usageId)` và `boolean releaseByOrder(String orderCode)`: xóa usage và giảm `usedCount` đi 1. Trả false nếu không có gì để nhả (idempotent).
    - `Optional<VoucherUsage> findUsageByOrder(String orderCode)`, `List<VoucherUsage> findUsages(int voucherId)`, `int countUsages(int voucherId, int userId)`
  - `DaoFactory.getVoucherDao(): IVoucherDao`
  - Seed `WELCOME10`: PERCENT 10, maxDiscount 50_000, minOrder 0, maxUses null, perAccountLimit 1, firstOnlineOrderOnly true, startDate 2026-01-01, endDate 2099-12-31, active true, description "Giảm 10% cho đơn online đầu tiên (tối đa 50.000 đ)".

- [ ] **Step 1: Viết contract test và lớp con in-memory.** `VoucherDaoContract` có `protected abstract IVoucherDao newDao()` cùng các test:
  - `saveAssignsIdAndRejectsDuplicateCode`: lưu `SALE1111` thì có id; lưu `sale1111` lần hai thì `save` trả false.
  - `findByCodeIgnoresCase`
  - `redeemStopsAtMaxUses`: maxUses 2, ba lần redeem trả `REDEEMED, REDEEMED, SOLD_OUT`, `usedCount == 2`
  - `redeemStopsAtPerAccountLimit`: perAccountLimit 1, user 7 redeem hai lần → `REDEEMED, ACCOUNT_LIMIT`; user 8 vẫn `REDEEMED`; `userId` null không bị giới hạn theo tài khoản
  - `concurrentRedeemNeverExceedsMax`: maxUses 5, 20 luồng dùng `Concurrently` có sẵn → đúng 5 lần `REDEEMED`, `usedCount == 5`
  - `releaseIsIdempotent`: redeem, `attachOrder(id, "ORD-1")`, `releaseByOrder("ORD-1")` → true, `usedCount == 0`; gọi lần hai → false, `usedCount` vẫn 0; `releaseByOrder("KHONG-CO")` → false
  - `releaseUsageBeforeAttach`: redeem rồi `releaseUsage(usageId)` → true, `usedCount == 0`
  - `findUsagesAndCount`: sau hai lượt của user 7, `countUsages(v,7) == 2`, `findUsages(v).size() == 2`, `findUsageByOrder` trả đúng `discountAmount`

  Viết thêm trong `ModelEntitiesTest`:
  - `expiresAtVietnamMidnight`: endDate 2026-11-11 → `isWithinDates(2026-11-11T16:59:59Z)` true, `isWithinDates(2026-11-11T17:00:00Z)` false; startDate 2026-11-01 → `isWithinDates(2026-10-31T16:59:59Z)` false
  - `stateAtPriority`: `active=false` và đã hết hạn → `DISABLED`; hết hạn và hết lượt → `EXPIRED`; hết lượt → `SOLD_OUT`

- [ ] **Step 2: Chạy test, phải fail.** `mvn -q test -Dtest=InMemoryVoucherDaoTest,ModelEntitiesTest` → lỗi biên dịch vì chưa có lớp.
- [ ] **Step 3: Cài đặt model, `IVoucherDao`, `InMemoryVoucherDao`, seed và `DaoFactory.getVoucherDao()`.** DAO in-memory dùng `synchronized` trên mọi phương thức và trả bản sao (`copy()`), giống các DAO in-memory khác. Ở chế độ JDBC, `getVoucherDao()` trả `inMemoryVoucherDao` cho tới Task 2.
- [ ] **Step 4: Chạy test, phải pass.** Lệnh như Step 2 → PASS. Chạy thêm `mvn -q test` → toàn bộ PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(voucher): add voucher model and in-memory DAO"`

### Task 2: DAO JDBC và schema

**Files:**
- Create: `backend-java/src/main/java/com/dalatcafe/dao/JdbcVoucherDao.java`
- Modify: `backend-java/src/main/java/com/dalatcafe/dao/JdbcDatabase.java` (schema), `DaoFactory.java` (dùng `JdbcVoucherDao` ở chế độ JDBC; seed `WELCOME10` khi bảng trống, trong `prepareJdbcStore`)
- Modify: `docs/DATABASE.md` (hai bảng mới, cột mới)
- Test: `backend-java/src/test/java/com/dalatcafe/dao/JdbcVoucherDaoTest.java` (kế thừa `VoucherDaoContract`, khởi động embedded-postgres giống `JdbcIntegrationTest`)

**Interfaces:**
- Consumes: `IVoucherDao`, `Voucher`, `VoucherUsage`, `RedeemResult` (Task 1)
- Produces: schema
  ```sql
  CREATE TABLE IF NOT EXISTS vouchers (
    id SERIAL PRIMARY KEY, code VARCHAR(30) UNIQUE NOT NULL, type VARCHAR(10) NOT NULL,
    value NUMERIC(12,2) NOT NULL, max_discount NUMERIC(12,2), min_order NUMERIC(12,2) NOT NULL DEFAULT 0,
    max_uses INT, per_account_limit INT, first_online_order_only BOOLEAN NOT NULL DEFAULT FALSE,
    start_date DATE NOT NULL, end_date DATE NOT NULL, description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE, used_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS voucher_usages (
    id SERIAL PRIMARY KEY, voucher_id INT NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
    user_id INT, order_code VARCHAR(50) UNIQUE, discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP);
  CREATE INDEX IF NOT EXISTS idx_voucher_usages_voucher_user ON voucher_usages(voucher_id, user_id);
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS voucher_code VARCHAR(30);
  ```
  Thêm `vouchers` và `voucher_usages` vào `syncSequences` nếu hàm này liệt kê bảng.

- [ ] **Step 1: Viết `JdbcVoucherDaoTest extends VoucherDaoContract`.** `newDao()` trả `JdbcVoucherDao` trên database embedded vừa dựng schema. Mỗi test bắt đầu bằng `TRUNCATE vouchers, voucher_usages RESTART IDENTITY CASCADE`.
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=JdbcVoucherDaoTest` → lỗi biên dịch.
- [ ] **Step 3: Cài đặt schema và `JdbcVoucherDao`.** `redeem` chạy trong một transaction:
  1. `SELECT max_uses, per_account_limit, used_count FROM vouchers WHERE id = ? FOR UPDATE`. Không có dòng nào → `UNKNOWN_VOUCHER`. Dòng bị khóa nên các lượt redeem cùng mã phải chạy lần lượt.
  2. `max_uses` không null và `used_count >= max_uses` → rollback, trả `SOLD_OUT`.
  3. `userId != null`, `per_account_limit` không null và `SELECT COUNT(*) FROM voucher_usages WHERE voucher_id=? AND user_id=?` ≥ `per_account_limit` → rollback, trả `ACCOUNT_LIMIT`.
  4. `INSERT INTO voucher_usages ... RETURNING id`, rồi `UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?`, commit → `REDEEMED`.

  `releaseByOrder` và `releaseUsage`: `DELETE ... RETURNING voucher_id`, sau đó `UPDATE vouchers SET used_count = GREATEST(used_count - 1, 0)`, trong cùng transaction.
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test -Dtest=JdbcVoucherDaoTest,JdbcIntegrationTest,JdbcDatabaseTest` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(voucher): persist vouchers and usages in PostgreSQL"`

### Task 3: VoucherService (thay VoucherCatalog)

**Files:**
- Create: `backend-java/src/main/java/com/dalatcafe/server/VoucherService.java`
- Delete: `backend-java/src/main/java/com/dalatcafe/server/VoucherCatalog.java` (sửa mọi chỗ đang gọi nó cho biên dịch được; `CheckoutHandler` và `VoucherHandler` được đấu nối đầy đủ ở Task 4 và 5)
- Test: `backend-java/src/test/java/com/dalatcafe/server/VoucherServiceTest.java`

**Interfaces:**
- Consumes: `IVoucherDao`, `Voucher`, `RedeemResult` (Task 1)
- Produces:
  - `VoucherService(IVoucherDao dao, Clock clock)`
  - `static String normalize(String code)`: trim rồi viết hoa theo `Locale.ROOT`; null hoặc rỗng → null
  - `static IDiscountStrategy strategyFor(Voucher v)`: `PERCENT` → `new PercentageDiscountStrategy(value / 100.0, maxDiscount == null ? Double.MAX_VALUE : maxDiscount)`; `FIXED` → `new FixedAmountDiscountStrategy(value)`
  - `enum Reason { OK, NOT_FOUND, DISABLED, NOT_STARTED, EXPIRED, SOLD_OUT, LOGIN_REQUIRED, ACCOUNT_LIMIT, ONLINE_ONLY, BELOW_MIN_ORDER }`
  - `record Verdict(String code, Reason reason, String message, double discountAmount, double shortfall, Voucher voucher) { boolean valid() { return reason == Reason.OK; } }`
  - `Verdict check(String code, double subtotal, Integer userId, boolean storefront)`: kiểm tra theo đúng thứ tự trong `Reason`, dừng ở điều kiện đầu tiên không qua. `ONLINE_ONLY` khi `firstOnlineOrderOnly && !storefront`. `ACCOUNT_LIMIT` dùng `dao.countUsages`. Mức giảm tính bằng `new DiscountContext(strategyFor(v)).executeDiscount(subtotal, null)`.
  - `record Redemption(int usageId, Voucher voucher, IDiscountStrategy strategy, double discountAmount)`
  - `Redemption redeem(String code, double subtotal, Integer userId, String orderCode, boolean storefront)`: `check` trước, rồi `dao.redeem`. Bất kỳ thất bại nào cũng ném `new ApiException(400, "INVALID_VOUCHER", message)`.
  - `void attachOrder(Redemption r, String orderCode)`, `boolean release(Redemption r)`, `boolean releaseOrder(String orderCode)`, `Optional<VoucherUsage> usageForOrder(String orderCode)`
  - Thông báo cố định:
    - `BELOW_MIN_ORDER`: `"Đơn tối thiểu %,.0f đ, cần mua thêm %,.0f đ."`
    - `LOGIN_REQUIRED`: `"Đăng nhập để dùng mã này."`
    - `SOLD_OUT`: `"Mã đã hết lượt sử dụng."`
    - `ACCOUNT_LIMIT`: `"Tài khoản của bạn đã dùng hết lượt cho mã này."`
    - `EXPIRED`: `"Mã đã hết hạn."`
    - `NOT_STARTED`: `"Mã chưa đến ngày áp dụng."`
    - `NOT_FOUND`: `"Mã không tồn tại."`
    - `DISABLED`: `"Mã đã ngừng áp dụng."`
    - `ONLINE_ONLY`: `"Mã chỉ dùng cho đơn online đầu tiên."`

- [ ] **Step 1: Viết test** (dùng `InMemoryVoucherDao`, `Clock.fixed(Instant.parse("2026-11-05T03:00:00Z"), UTC)`):
  - `checkNormalizesCode`: `check(" sale1111 ", 100_000, null, false).valid()` là true
  - `belowMinOrderReportsShortfall`: minOrder 150_000, subtotal 120_000 → reason `BELOW_MIN_ORDER`, `shortfall == 30_000`
  - `percentRespectsCap`: PERCENT 20, maxDiscount 30_000, subtotal 200_000 → `discountAmount == 30_000`
  - `fixedNeverExceedsSubtotal`: FIXED 50_000, subtotal 40_000 → `discountAmount == 40_000`
  - `perAccountNeedsLogin`: perAccountLimit 1, userId null → `LOGIN_REQUIRED`
  - `onlineOnlyRejectsPos`: firstOnlineOrderOnly, storefront false → `ONLINE_ONLY`
  - `redeemThrowsWithReasonMessage`: hết lượt → `ApiException`, `getStatus()==400`, message `"Mã đã hết lượt sử dụng."`
  - `notStartedAndExpired`: startDate 2026-11-06 → `NOT_STARTED`; endDate 2026-11-04 → `EXPIRED`
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=VoucherServiceTest` → lỗi biên dịch.
- [ ] **Step 3: Cài đặt `VoucherService`** và xóa `VoucherCatalog`.
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test` → PASS. `StrategyTest` và `CheckoutHandlerTest` vẫn phải pass. Nếu chúng đang gọi `VoucherCatalog`, tạm cho `CheckoutHandler` dùng một `VoucherService` trên `DaoFactory.getInstance().getVoucherDao()` cho tới Task 5.
- [ ] **Step 5: Commit.** `git commit -m "feat(voucher): VoucherService replaces the hard-coded catalog"`

### Task 4: API voucher (CRUD, active, validate, redeem, release, usages)

**Files:**
- Modify: `backend-java/src/main/java/com/dalatcafe/server/VoucherHandler.java` (constructor `VoucherHandler(VoucherService service, IVoucherDao dao)`)
- Modify: `backend-java/src/main/java/com/dalatcafe/server/MainServer.java` (tạo một `VoucherService` dùng chung cho `VoucherHandler`, `CheckoutHandler`, `OrderHandler`)
- Modify: `backend-java/src/main/java/com/dalatcafe/server/SimpleAuthFilter.java`
- Modify: `docs/API_SPEC.md`
- Test: `backend-java/src/test/java/com/dalatcafe/server/VoucherHandlerTest.java`, bổ sung `SecurityTest`/`AuthTest` cho các luật quyền

**Interfaces:**
- Consumes: `VoucherService`, `IVoucherDao` (Task 1, 3)
- Produces, với JSON voucher là
  `{id, code, type, value, maxDiscount, minOrder, maxUses, perAccountLimit, firstOnlineOrderOnly, startDate:"YYYY-MM-DD", endDate, description, active, usedCount, state}`:

  | Method & path | Quyền | Body | Trả về |
  |---|---|---|---|
  | `GET /api/vouchers` | MANAGER | — | danh sách JSON voucher |
  | `POST /api/vouchers` | MANAGER | các trường voucher trừ id, usedCount, state | 201 + voucher |
  | `PUT /api/vouchers/{id}` | MANAGER | như POST | 200 + voucher |
  | `DELETE /api/vouchers/{id}` | MANAGER | — | `{deleted:true}` hoặc `{deleted:false, deactivated:true}` |
  | `GET /api/vouchers/{id}/usages` | MANAGER | — | `[{userId, orderCode, discountAmount, createdAt}]` |
  | `GET /api/vouchers/active` | PUBLIC | — | các mã có `state == RUNNING`: `{code, type, value, maxDiscount, minOrder, perAccountLimit, firstOnlineOrderOnly, endDate, description}` |
  | `POST /api/vouchers/validate` | PUBLIC | `{code, subtotal, userId?}` | `{code, valid, reason, discountAmount, shortfall, description, firstOnlineOrderOnly}`. `userId` chỉ được tin khi có service key, ngược lại coi là null. |
  | `POST /api/vouchers/redeem` | service key | `{code, subtotal, userId?, orderCode}` | `{usageId, discountAmount, code}`; thất bại 400 `INVALID_VOUCHER` |
  | `POST /api/vouchers/release` | service key | `{orderCode}` | `{released: boolean}` |

  `SimpleAuthFilter.isServiceRoute` thêm `POST /api/vouchers/redeem` và `/api/vouchers/release`. `required()` trả PUBLIC cho `/api/vouchers/active` (GET) và MANAGER cho mọi đường dẫn `/api/vouchers` còn lại, trừ `validate`, `redeem`, `release`.

- [ ] **Step 1: Viết `VoucherHandlerTest`** (dựng `HttpServer` trên cổng 0 như `CheckoutHandlerTest`, gửi header `X-User-Role`):
  - `managerCreatesListsUpdatesVoucher`: POST `SALE1111` → 201, `code=="SALE1111"`; GET thấy `state=="RUNNING"`; PUT đổi `minOrder` → 200
  - `rejectsInvalidPayloads`: `PERCENT` 120 → 400; endDate < startDate → 400; code `"ab"` → 400; trùng code → 409
  - `rejectsMaxUsesBelowUsedCount`: đã redeem 2 lần, PUT `maxUses:1` → 400, `maxUses` vẫn giữ giá trị cũ
  - `deleteUnusedRemovesUsedDeactivates`: chưa dùng → `deleted:true`; đã dùng → `deactivated:true`, GET vẫn thấy với `active:false`
  - `renamingUsedCodeIsRejected`: đã có lượt, PUT đổi `code` → 409
  - `activeListsOnlyRunning`: mã tắt, mã hết hạn và mã hết lượt không xuất hiện
  - `validateReportsReasonAndShortfall`: dưới đơn tối thiểu → `valid:false, reason:"BELOW_MIN_ORDER", shortfall>0`
  - `redeemAndReleaseNeedServiceKey`: thiếu service key → 401/403; có key → redeem `usageId>0`, release `released:true`, release lần hai `released:false`
  - `staffCannotManageVouchers`: STAFF gọi GET `/api/vouchers` → 403
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=VoucherHandlerTest` → FAIL.
- [ ] **Step 3: Cài đặt handler, đấu nối trong `MainServer`, luật quyền và kiểm tra dữ liệu** (theo Global Constraints). Cập nhật `docs/API_SPEC.md` với các endpoint trên.
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(voucher): voucher management and redemption API"`

### Task 5: Checkout giữ lượt và ghi mã vào đơn

**Files:**
- Modify: `backend-java/src/main/java/com/dalatcafe/patterns/facade/PosCheckoutFacade.java`, `server/CheckoutHandler.java`, `model/Order.java`, `dao/JdbcOrderDao.java` (cột `voucher_code` trong mọi câu SELECT, INSERT, UPDATE), `server/OrderHandler.java` (JSON đơn có `voucherCode`)
- Test: `backend-java/src/test/java/com/dalatcafe/server/CheckoutHandlerTest.java`, `dao/JdbcIntegrationTest.java`

**Interfaces:**
- Consumes: `VoucherService.redeem/attachOrder/release`, `Redemption` (Task 3)
- Produces:
  - `PosCheckoutFacade.subtotalOf(CheckoutRequest request): OptionalDouble`: tạm tính theo cùng giá thực đơn và decorator như `buildOrder`, rỗng nếu thiếu món hoặc món hết hàng; không lưu gì
  - `Order.getVoucherCode()/setVoucherCode(String)`
  - Constructor mới `CheckoutHandler(PosCheckoutFacade, ICustomerDao, ITableDao, IOrderDao, IReservationDao, VoucherService, BooleanSupplier)`. Các constructor cũ dùng `new VoucherService(DaoFactory.getInstance().getVoucherDao(), Clock.systemUTC())`.
  - Body checkout nhận thêm `userId` (số nguyên), chỉ được tin khi request có `STOREFRONT_SERVICE_ATTRIBUTE`.

- [ ] **Step 1: Viết test trong `CheckoutHandlerTest`:**
  - `voucherIsRedeemedAndRecordedOnOrder`: voucher FIXED 10_000, checkout thành công → đơn có `voucherCode=="SALE10K"`, `discountAmount==10_000`, `usedCount==1`, `usageForOrder(orderCode)` có mặt
  - `failedCheckoutReturnsTheUse`: món hết hàng → checkout thất bại, `usedCount==0`
  - `soldOutVoucherRejectsCheckout`: maxUses 1 đã dùng → 400 `INVALID_VOUCHER`, không tạo đơn
  - `belowMinOrderRejectsCheckout`: 400, message chứa `"cần mua thêm"`
  - `onlineOnlyVoucherNeedsStorefront`: thay test cũ của `WELCOME10`, POS gửi `WELCOME10` → 400
  - `concurrentCheckoutsRespectMaxUses`: maxUses 1, hai checkout song song → đúng một thành công
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=CheckoutHandlerTest` → FAIL.
- [ ] **Step 3: Cài đặt.** Trong khối `synchronized (facade)` của `CheckoutHandler.route`:
  1. Dựng request không có voucher và lấy `facade.subtotalOf`. Nếu rỗng thì bỏ qua voucher; facade sẽ tự trả lỗi thiếu món.
  2. `voucherService.redeem(code, subtotal, userId, null, storefront)`.
  3. Dựng request thật với `redemption.strategy()`, thay cho giảm giá theo hạng thành viên. Nếu khách đổi điểm thì strategy này nằm trong `PointRedemptionDiscountStrategy`.
  4. Gọi `facade.checkout`. Thành công thì `attachOrder(redemption, order.getOrderCode())` và `order.setVoucherCode(...)` rồi lưu lại. Thất bại hoặc có ngoại lệ thì `release(redemption)` trong `finally`.

  Bỏ đoạn kiểm tra `VoucherCatalog.WELCOME10` ở đầu `route`, vì quy tắc này giờ là `ONLINE_ONLY` trong service.
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test` → PASS, gồm cả `JdbcIntegrationTest` với một case mới lưu và đọc lại `voucher_code`.
- [ ] **Step 5: Commit.** `git commit -m "feat(voucher): redeem vouchers during checkout"`

### Task 6: Đơn COD đồng bộ sang và trả lượt khi hủy

**Files:**
- Create: `backend-java/src/main/java/com/dalatcafe/patterns/observer/VoucherReleaseObserver.java`
- Modify: `backend-java/src/main/java/com/dalatcafe/server/OrderHandler.java` (`importedOrder`), `MainServer.java` (attach observer, ưu tiên 30)
- Test: `backend-java/src/test/java/com/dalatcafe/server/OrderHandlerTest.java`, `patterns/ObserverTest.java`

**Interfaces:**
- Consumes: `VoucherService.usageForOrder/releaseOrder` (Task 3)
- Produces:
  - `VoucherReleaseObserver(VoucherService service) implements IOrderObserver`: `onOrderCancelled(order)` → `service.releaseOrder(order.getOrderCode())`
  - Constructor `OrderHandler` nhận thêm `VoucherService`. Các constructor cũ dùng service mặc định như Task 5.

- [ ] **Step 1: Viết test:**
  - `ObserverTest.cancelledOrderReleasesVoucher`: redeem với orderCode `"ORD-9"`, `notifyOrderCancelled(order ORD-9)` → `usedCount==0`
  - `OrderHandlerTest.importAppliesRedeemedVoucher`: redeem `SALE10K` cho `"WEB-1"` (discount 10_000), sync đơn `WEB-1` → đơn lưu có `voucherCode=="SALE10K"`, `discountAmount==10_000`, tổng khớp `total` gửi lên (không có warning lệch tổng)
  - `OrderHandlerTest.importingCancelledOrderReleasesVoucher`: redeem cho `WEB-2`, sync với `status:"CANCELLED"` → `usedCount==0`
  - `OrderHandlerTest.cancellingTwiceReleasesOnce`: redeem cùng mã cho hai đơn `WEB-3` và `WEB-4` (`usedCount==2`), cả hai đã sync; PATCH hủy `WEB-3` hai lần (lần hai bị 409) → `usedCount==1`
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=OrderHandlerTest,ObserverTest` → FAIL.
- [ ] **Step 3: Cài đặt.** Trong `importedOrder`, trước `order.recalculateTotals()`: nếu `voucherService.usageForOrder(code)` có mặt thì đặt `voucherCode` (tra mã từ `voucherId`) và `discountAmount`. Sau khi lưu, nếu trạng thái là `CANCELLED` thì gọi `releaseOrder(code)`. Attach `VoucherReleaseObserver` trong `MainServer`.
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(voucher): apply COD redemptions on import and release on cancel"`

### Task 7: Storefront dùng voucher từ Java

**Files:**
- Modify: `frontend-nextjs/lib/api-client.ts`, `lib/storefront/vouchers.ts`, `app/api/cart/route.ts`, `app/admin/actions.ts` (`placeOnlineOrder`, `cashOnDeliveryTotals`, `forwardCheckout`), `components/account/account-dashboard.tsx`, `lib/store/cart-store.ts`, `components/storefront/CartSheet.tsx`, `app/cart/page.tsx`
- Test: `frontend-nextjs/scripts/test-ui-ux.mjs`, mới `frontend-nextjs/scripts/test-voucher-pricing.ts` (script `"test:vouchers": "tsx scripts/test-voucher-pricing.ts"` trong `package.json`, thêm một bước `npm run test:vouchers` vào job frontend trong `.github/workflows`)

**Interfaces:**
- Consumes: các endpoint ở Task 4
- Produces (`lib/api-client.ts`):
  - `type ActiveVoucher = { code: string; type: 'PERCENT' | 'FIXED'; value: number; maxDiscount: number | null; minOrder: number; perAccountLimit: number | null; firstOnlineOrderOnly: boolean; endDate: string; description: string }`
  - `VoucherVerdict` thêm `reason: string; shortfall: number; firstOnlineOrderOnly: boolean`
  - `fetchActiveVouchers(): Promise<JavaResult<ActiveVoucher[]>>`
  - `validateVoucher(code, subtotal, userId?)`: gửi kèm service key khi có `userId`
  - `redeemVoucher(input: { code: string; subtotal: number; userId?: number; orderCode: string }): Promise<JavaResult<{ usageId: number; discountAmount: number; code: string }>>` và `releaseVoucher(orderCode: string): Promise<JavaResult<{ released: boolean }>>` (service key)
  - `CheckoutPayload` thêm `userId?: number`
  - `lib/storefront/vouchers.ts`: bỏ mảng `VOUCHERS`; thêm `voucherDiscount(subtotal: number, voucher: ActiveVoucher | undefined): number`, tính giống `VoucherService` (gồm cả đơn tối thiểu); thêm `loadActiveVouchers(): Promise<ActiveVoucher[]>`, trả `[]` khi Java không truy cập được

- [ ] **Step 1: Viết test.** `test-voucher-pricing.ts` dùng `node:assert/strict`, khớp với `VoucherServiceTest`:
  - PERCENT 20, maxDiscount 30_000, subtotal 200_000 → 30_000
  - FIXED 50_000, subtotal 40_000 → 40_000
  - minOrder 150_000, subtotal 120_000 → 0
  - `voucher` undefined → 0

  Thêm vào `test-ui-ux.mjs`:
  - `TC-VOUCHER-01` "Cart Rejects Vouchers While Java Is Down": khi chạy không có backend Java (chế độ CI hiện tại), POST `/api/cart` áp `WELCOME10` → `applicable === false`
  - `TC-VOUCHER-02` "Account Page Lists No Hard-coded Vouchers": trang tài khoản không còn chứa chuỗi cứng của `WELCOME10` khi Java tắt
- [ ] **Step 2: Chạy, phải fail.** `npm run test:vouchers` → FAIL vì `voucherDiscount` còn chữ ký cũ; `npm test` (theo cách CI chạy) → 2 case mới FAIL.
- [ ] **Step 3: Cài đặt.**
  - Cart route: `isVoucherApplicable` dùng `validateVoucher(code, subtotal, session?.userId)`. Nếu verdict có `firstOnlineOrderOnly` thì kiểm tra thêm `isFirstOnlineOrderAvailable`, thay cho cách so sánh với `'WELCOME10'`. Java không truy cập được → false.
  - `placeOnlineOrder`:
    - Kiểm tra đơn đầu tiên khi verdict của mã có `firstOnlineOrderOnly`.
    - Đơn trả trước: `forwardCheckout` gửi `userId: session.userId`.
    - Đơn COD: tạo `orderCode = newLocalOrderCode()` **trước**, rồi `redeemVoucher({ code, subtotal, userId, orderCode })`. Lỗi thì trả `{ ok:false, error }`. `cashOnDeliveryTotals` dùng `discountAmount` vừa nhận. Nếu `recordOrderLocally` thất bại thì gọi `releaseVoucher(orderCode)` trước khi trả lỗi.
  - Thông báo trong `cart-store.ts`, `CartSheet.tsx`, `cart/page.tsx`: bỏ gợi ý cứng "WELCOME10" và "-10%", hiện `description` hoặc lý do do server trả về.
  - `account-dashboard.tsx` hiện danh sách từ `loadActiveVouchers()`.
- [ ] **Step 4: Chạy, phải pass.** `npx tsc --noEmit` → không lỗi; `npm run test:vouchers` → PASS; `npm run build` → thành công; `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(voucher): storefront reads vouchers from Java and redeems COD orders"`

### Task 8: Trang quản lý voucher cho admin

**Files:**
- Create: `frontend-nextjs/app/admin/vouchers/page.tsx`, `frontend-nextjs/app/admin/voucher-actions.ts`, `frontend-nextjs/components/admin/voucher-management.tsx`
- Modify: `frontend-nextjs/components/admin/admin-sidebar.tsx` (mục `{ href: '/admin/vouchers', labelVi: 'Voucher', subVi: 'Mã giảm giá theo dịp', icon: TicketPercent }`, đặt sau "Thực đơn"), `frontend-nextjs/lib/api-client.ts`
- Test: `frontend-nextjs/scripts/test-ui-ux.mjs`

**Interfaces:**
- Consumes: các endpoint CRUD và usages ở Task 4
- Produces:
  - `api-client.ts`:
    - `type AdminVoucher = ActiveVoucher & { id: number; maxUses: number | null; startDate: string; active: boolean; usedCount: number; state: 'UPCOMING' | 'RUNNING' | 'EXPIRED' | 'SOLD_OUT' | 'DISABLED' }`
    - `type VoucherInput = Omit<AdminVoucher, 'id' | 'usedCount' | 'state'>`
    - `fetchVouchers()`, `createVoucher(input)`, `updateVoucher(id, input)`, `deleteVoucher(id)`, `fetchVoucherUsages(id)`
  - `voucher-actions.ts` (`'use server'`, kiểm tra quyền MANAGER theo cách các action admin khác làm): `saveVoucher(id: number | null, input: VoucherInput): Promise<ActionResult>`, `removeVoucher(id: number): Promise<ActionResult>`, `loadVoucherUsages(id: number)`
  - Giao diện:
    - Bảng gồm Mã, Giảm, Đơn tối thiểu, Đã dùng/Tối đa ("∞" khi không giới hạn), Mỗi tài khoản, Thời gian, Trạng thái (badge tiếng Việt: Sắp diễn ra / Đang chạy / Hết hạn / Hết lượt / Đã tắt).
    - Dialog thêm/sửa theo kiểu `menu-management.tsx`. Ô "Mức giảm tối đa" chỉ hiện với PERCENT. Hai ô giới hạn để trống nghĩa là không giới hạn. Có ô tích "Chỉ cho đơn online đầu tiên". Ô Mã bị khóa khi `usedCount > 0`.
    - Xóa có hộp xác nhận (dialog trong trang, không dùng `confirm()`). Nếu mã đã có lượt dùng thì nói rõ "Mã đã có người dùng nên sẽ được tắt thay vì xóa".
    - Nút "Ai đã dùng" mở danh sách lượt dùng.

- [ ] **Step 1: Viết test:** `TC-VOUCHER-03` "Manager Opens Voucher Page" (cookie MANAGER, GET `/admin/vouchers` → 200, HTML chứa "Voucher"); `TC-VOUCHER-04` "Staff Cannot Open Voucher Page" (cookie STAFF → bị chuyển hướng hoặc 403, theo đúng cách `TC-AUTH-03` đang kiểm tra trang chỉ dành cho admin).
- [ ] **Step 2: Chạy, phải fail.** `npm test` → 2 case mới FAIL.
- [ ] **Step 3: Cài đặt trang, component, actions và mục sidebar.** Trang dùng `requirePageRole('MANAGER', '/admin/vouchers')`.
- [ ] **Step 4: Chạy, phải pass.** `npx tsc --noEmit`, `npm run build`, `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(admin): voucher management page"`

### Task 9: Báo cáo và cập nhật graph

**Files:**
- Create: `docs/reports/nightly/2026-10-29-voucher-management.md` (đã làm gì, test nào chạy và kết quả, quyết định nào còn chờ duyệt)
- Modify: `docs/reports/README.md` (thêm dòng mục lục)

- [ ] **Step 1:** Chạy toàn bộ: `cd backend-java && mvn -q clean test`; `cd frontend-nextjs && npx tsc --noEmit && npm run build`. Ghi kết quả thật vào báo cáo.
- [ ] **Step 2:** Chạy `graphify update .` ở thư mục gốc repo.
- [ ] **Step 3: Commit.** `git commit -m "docs(reports): voucher management session report"`

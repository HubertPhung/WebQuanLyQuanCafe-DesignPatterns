# NIGHTLY REPORT, phiên 4: tự động 2026-10-18 (nhánh `feature/hoai-bo`)

- HEAD: `67e5253`. **Chưa commit, push hay mở PR.** Mọi thay đổi nằm trong working tree, chồng lên thay đổi chưa commit của ba phiên trước (`NIGHTLY_REPORT.md`, `_2`, `_3`). Phiên này không hoàn tác hay ghi đè thay đổi nào của các phiên trước.
- Đầu vào: `PATTERN_AUDIT.md` và `AUDIT_PLAN.md` (Đợt 2 mục 14, 15; Đợt 3 phần PT-03 và tài liệu). Các mục BR đã được ba phiên trước đóng (xem `NIGHTLY_REPORT_3.md` §1). `REVIEW_REPORT.md`, `NEXT_PLAN.md`, `BUSINESS_AUDIT.md`, `PATTERN_AUDIT.md`, `AUDIT_PLAN.md` chỉ được đọc, không sửa.
- Lời nhắn giao việc bị cắt ở câu "Nếu phát hiện sai hoặc đã lỗi thời, đánh dấu KHÔNG…". Phiên này làm theo phần nguyên tắc đọc được, và theo cách các phiên trước đã làm: không commit.

## 1. Tóm tắt

| # | Mã | Phát hiện | Xác minh | Kết quả |
| :-: | :--- | :--- | :--- | :--- |
| 1 | PT-01 | Singleton chỉ an toàn ở bước khởi tạo. Thông số đọc không khoá, nên có thể đọc được cặp giờ nửa cũ nửa mới | **ĐÚNG.** Test tái hiện: `GET /api/config` trả `13:00 - 12:00`; lời từ chối đặt bàn ghi "giờ mở cửa (13:00 - 12:00)" | ✅ Đã sửa |
| 2 | PT-01 | `isWithinOperatingHours(null)` dùng múi giờ máy chủ | **ĐÚNG.** Test với máy chủ ở UTC-5 fail | ✅ Đã sửa |
| 3 | PT-01 | Chặn reflection chỉ có tác dụng sau lần `getInstance()` đầu tiên | **ĐÚNG** (đọc code) | ⏸️ Không sửa (mục 4) |
| 4 | PT-03 | `Order.equals/hashCode` vi phạm hợp đồng | **ĐÚNG**, và `Reservation`, `Customer` mắc cùng lỗi. Test fail: hai đối tượng bằng nhau có `hashCode` khác | ✅ Đã sửa cả ba |
| 5 | PT-02 | Hàm `validate` lặp nguyên văn ở ba Concrete Product | **ĐÚNG** | ✅ Đã gom, hành vi giữ nguyên |
| 6 | PT-02 | Spec ghi "`PosCheckoutFacade` là nơi duy nhất gọi Factory" | **ĐÚNG là sai**: `OrderHandler` (`/pay`) cũng gọi | ✅ Đã sửa spec |
| 7 | PT-02 | Tên "Factory Method (GoF)" trong khi code là Simple Factory | **ĐÚNG** | ⏸️ Cần bạn chọn (mục 5.1) |
| 8 | Tài liệu | Tên lớp sai trong `.agents/rules/backend-java-constraints.md`; cây test thiếu các lớp test handler; ví dụ "Pending → Completed" ở §4.1 mâu thuẫn API_SPEC §3.9 | **ĐÚNG** cả ba | ✅ Đã sửa |

Backend: **234 → 240** test JUnit, 0 fail. Frontend không bị sửa.

## 2. Bằng chứng đã chạy

Mọi lệnh `mvn` chạy trong `backend-java/`. Mỗi lỗi theo TDD: viết test trước, xem test fail đúng lý do, rồi mới sửa.

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E0 | `mvn -q -B clean test` (baseline, trước mọi thay đổi) | `EXIT=0`, đếm `TEST-*.xml`: **TOTAL 234, fail 0, err 0, skip 0** |
| E1 | `mvn -q -B test -Dtest='ConfigHandlerTest,ChainTest#openingHours*'` (**trước khi sửa**) | 2 fail đúng lý do: `GET /api/config showed 13:00 - 12:00`; `Quán chỉ nhận đặt bàn trong giờ mở cửa (13:00 - 12:00).` |
| E2 | `mvn -q -B test -Dtest='SingletonTest*,ModelEntitiesTest*,FactoryTest'` (**trước khi sửa**) | 4 fail đúng lý do: `testOrderEquality: equal orders share a hash ==> expected: <-489874171> but was: <-489874140>`, tương tự cho `Reservation`, `Customer`; `testCurrentTimeUsesTheCafeTimeZone: expected: <true> but was: <false>`. Test Factory mới **pass** (test giữ hành vi, viết trước khi gom `validate`) |
| E3 | `mvn -q -B test -Dtest='ConfigHandlerTest,ChainTest,SingletonTest*,ModelEntitiesTest*,FactoryTest,StrategyTest,ServerTest,FacadeTest'` (sau khi sửa) | 1 fail **do lỗi của test**: trước lần ghi đầu tiên của luồng admin, cấu hình vẫn là mặc định 07:00–22:00, nên 12:30 hợp lệ. Đã đặt cấu hình ban đầu là 07:00–12:00 |
| E4 | `mvn -q -B test -Dtest='ConfigHandlerTest,ChainTest'` × 3 lần (sau khi sửa test) | `EXIT=0` cả 3 lần |
| E5 | **Kiểm tra đột biến**: chép `backend-java` sang scratchpad, khôi phục `SystemConfigManager`, `ConfigHandler`, `Order`, `Customer`, `Reservation`, `PointRedemptionDiscountStrategy` về `HEAD` (cả 6 file không bị phiên trước sửa), bỏ khối `synchronized` mới ở `OperatingHoursValidator`, chạy `ConfigHandlerTest,ChainTest,SingletonTest*,ModelEntitiesTest*,FactoryTest` | `Tests run: 95, Failures: 6`. Đúng 6 test mới fail, đúng lý do như E1, E2. Kết luận: test đã sửa ở E3 vẫn bắt được lỗi |
| E6 | `mvn -B clean test` (sau mọi thay đổi code) | `MVN_EXIT=0`, `Tests run: 240, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`. Đếm `TEST-*.xml`: **TOTAL 240, fail 0, err 0, skip 0** |
| E7 | `graphify update .` | Graph đã cập nhật |

Sau E6 chỉ có tài liệu thay đổi, không sửa code.

**Không chạy:** `npm test`, `tsc`, `npm run build` ở frontend, vì phiên này không sửa file frontend nào. Không có endpoint hay JSON nào đổi hình dạng. GitHub Actions chưa chạy, vì chưa push.

## 3. Chi tiết thay đổi

### 3.1. PT-01: thông số của Singleton an toàn đa luồng
**Nguyên nhân:** `ConfigHandler.update` ghi dưới `synchronized (config)`, còn mọi nơi đọc thì không khoá. Ngay cả khi có `volatile`, giờ mở và giờ đóng vẫn được đọc bằng hai lần gọi riêng, nên có thể rơi vào giữa một lần ghi.

| File | Thay đổi |
| :--- | :--- |
| `patterns/singleton/SystemConfigManager.java` | Mọi getter, setter, `resetToDefaults`, `isWithinOperatingHours`, `calculate*` thành `synchronized` (cùng monitor mà `ConfigHandler` đã dùng). `isWithinOperatingHours(null)` dùng `LocalTime.now(Asia/Ho_Chi_Minh)`. Javadoc lớp ghi rõ quy ước khoá |
| `server/ConfigHandler.java` | `update` đọc giá trị hiện tại, kiểm tra và ghi **trong cùng một khoá**. Trước đây phần đọc và kiểm nằm ngoài khoá, nên hai lệnh `PUT` cùng lúc (một đổi giờ mở, một đổi giờ đóng) có thể cùng qua bước kiểm `opening < closing` với giá trị cũ của nhau, rồi lưu một cặp không hợp lệ. `toJson` đọc dưới khoá |
| `patterns/chain/OperatingHoursValidator.java` | Kiểm giờ và trích giờ mở/đóng vào lời từ chối trong cùng một khoá |
| `patterns/strategy/PointRedemptionDiscountStrategy.java` | Tính số điểm dùng và số tiền giảm bằng cùng một giá trị điểm |
| `test/.../server/ConfigHandlerTest.java` (mới) | +1 test: luồng admin liên tục đổi giữa 07:00–12:00 và 13:00–22:00, `toJson` đọc trong 2 giây và không bao giờ thấy giờ mở ≥ giờ đóng |
| `test/.../patterns/ChainTest.java` | +1 test: cùng kịch bản, đặt bàn 12:30 luôn bị từ chối, và lời từ chối luôn trích đúng một trong hai cặp giờ |
| `test/.../patterns/SingletonTest.java` | +1 test: đặt khung giờ ±30 phút quanh giờ quán hiện tại, đổi múi giờ JVM sang `America/Bogota` (UTC-5), `isWithinOperatingHours(null)` vẫn trả `true`. Test tự bỏ qua (`assumeTrue`) trong khoảng 23:00–01:00 giờ quán, vì khi đó khung giờ vắt qua nửa đêm. Múi giờ JVM được khôi phục trong `finally` |

Phần chạy song song giữa hai lệnh `PUT` một phần ở `ConfigHandler.update` **chưa có test riêng**. Bản sửa dựa trên lập luận: đọc, kiểm và ghi giờ nằm trong cùng một khoá.

### 3.2. PT-03: `equals/hashCode` theo khoá nghiệp vụ
**Nguyên nhân:** quy tắc "bằng nhau nếu cùng `id` **hoặc** cùng mã" không thể đi kèm một `hashCode` đúng, và không có tính bắc cầu. Ngay với dữ liệu trong test cũ: `o1 = o2` (cùng id), `o1 = o3` (cùng mã), nhưng `o2 ≠ o3`. Thêm nữa, hai đơn chưa có `id` luôn bằng nhau.

| File | Thay đổi |
| :--- | :--- |
| `model/Order.java`, `model/Reservation.java`, `model/Customer.java` | Bằng nhau khi và chỉ khi cùng `orderCode` / `reservationCode` / `phone` (các cột `UNIQUE NOT NULL` trong `JdbcDatabase`). `hashCode` chỉ dựa trên đúng trường đó. Đối tượng chưa có mã chỉ bằng chính nó |
| `test/.../model/ModelEntitiesTest.java` | 3 test equality được **viết lại**: cùng mã thì bằng nhau và cùng `hashCode`; cùng `id` khác mã thì khác nhau; hai đối tượng mới tạo (chưa có mã) thì khác nhau. Số test không đổi |

Code production không dùng `equals` của ba lớp này. Đã grep `HashSet`, `contains`, `indexOf`, `remove(o)`, và `TableAvailabilityValidator` cố ý so `id` thay vì `equals`. Vì vậy thay đổi này không làm đổi hành vi nào đang chạy.

### 3.3. PT-02: gom bước kiểm tra thanh toán; sửa spec
| File | Thay đổi |
| :--- | :--- |
| `patterns/factory/PaymentArguments.java` (mới, package-private) | `requireValid(amount, transactionRef)`: đúng nội dung và thông báo lỗi của ba hàm `validate` cũ |
| `CashPaymentProcessor`, `MomoQrPaymentProcessor`, `CardPosPaymentProcessor` | Gọi `PaymentArguments.requireValid`, bỏ hàm `validate` riêng (−30 dòng) |
| `test/.../patterns/FactoryTest.java` | +3 test (tham số hoá theo `PaymentMethod`): cả ba kênh từ chối số tiền 0, âm, `NaN`, vô cực, và mã giao dịch `null` hoặc rỗng. Test pass cả trước lẫn sau khi gom, nên chứng minh hành vi không đổi |

Không dùng lớp cha trừu tượng, vì cách đó thực chất là cài Template Method, mà việc thêm Template Method vẫn đang chờ bạn quyết định (`NEXT_PLAN.md` mục 5.1).

### 3.4. Tài liệu
- `docs/DESIGN_PATTERNS_SPEC.md`: §3.1 Singleton ghi quy ước khoá và múi giờ; §3.2 sửa câu "nơi duy nhất gọi Factory", nêu `PaymentArguments`; cây thư mục thêm `PaymentArguments` và đủ các lớp test (`server/*HandlerTest`, `AuthTest`, `JdbcIntegrationTest`, `SecurityTest`); §4.1 đổi ví dụ "không thể `Pending` → `Completed`" thành các quy tắc API hiện có thật (không đi lùi, không hoàn tất khi chưa thanh toán), kèm dẫn tới API_SPEC §3.9; số test 240.
- `.agents/rules/backend-java-constraints.md`: `ToppingDecorator` → `BeverageDecorator`, `DiscountStrategy` → `IDiscountStrategy`, `ReservationValidator` → `ReservationValidatorHandler` (đúng tên lớp trong code).
- `docs/TESTING.md`, `README.md`: 234 → 240, mô tả các test mới, thêm dòng `server/ConfigHandlerTest`.

## 4. Chưa làm và lý do
| Mục | Lý do |
| :--- | :--- |
| PT-01: reflection gọi trước `getInstance()` tạo được bản thứ hai | Muốn chặn hẳn phải đổi sang enum Singleton hoặc khởi tạo sớm, tức là đổi cách cài đặt mà spec §3.1 đang mô tả (Double-Checked Locking). Không tái hiện được trong một JVM test, vì các test khác đã gọi `getInstance()` trước. Rủi ro thực tế thấp |
| PT-01: hai trường `vatRate`, `autoCancelMinutes` không ai đọc (BR-18) | Trùng với quyết định về scheduler tự huỷ phiếu (`NEXT_PLAN.md` mục 5.3) |
| PT-02: đặt tên Factory Method hay Simple Factory | Cần bạn chọn (mục 5.1) |
| PT-06: Facade bị rò logic điểm ra `CheckoutHandler`; constructor mặc định tự tạo `OrderEventSubject` rỗng | Thay đổi kiến trúc. Constructor mặc định hiện không được `MainServer` dùng, nên rủi ro chưa xảy ra |
| PT-07: `PointRedemptionDiscountStrategy` có trạng thái; `FixedAmountDiscountStrategy` không ai dùng | Thiết kế, không phải lỗi. Đã được Javadoc ghi nhận |
| PT-08: chain phụ thuộc ngầm vào Singleton; `TableAvailabilityValidator` quét `findAll()` | Cải tiến thiết kế và hiệu năng, không có lỗi hành vi |
| PT-11 chiều *paid*: bàn `RESERVED` cho người khác vẫn bị đặt `OCCUPIED` | Quy tắc nghiệp vụ, gắn với đề xuất State Pattern (BR-19) |
| BR-03, BR-10, BR-13 đến BR-20 | Như `NIGHTLY_REPORT_3.md` §4: cần bạn quyết định, là việc ở frontend, hoặc spec cố ý giữ |
| `docs/DEVELOPMENT_PLAN.md` (F8), `min` cho ô ngày và ngôn ngữ thông báo (F7) | Như `NIGHTLY_REPORT.md` §4: file chưa được theo dõi đang chờ bạn duyệt; F7 cần chọn cách làm |

## 5. Cần bạn xem xét
1. **Factory Method (PT-02).** Có hai lựa chọn: (a) cài đúng GoF, tức một Creator trừu tượng có phương thức factory ghi đè được, mỗi kênh thanh toán một Creator con; (b) giữ code, đổi tên thành "Simple Factory" ở bảng tổng hợp spec (§2) và ở `.agents/rules/backend-java-constraints.md`. Đề xuất: (a) nếu đồ án được chấm theo đúng 9 mẫu GoF, vì (b) làm dự án chỉ còn 8 mẫu GoF thật.
2. **Đổi ngữ nghĩa `equals` (PT-03).** Hai `Order` cùng `id` nhưng khác mã giờ **không** còn bằng nhau, và ngược lại. Ba test cũ khẳng định quy tắc "id hoặc mã" đã được viết lại. Với `Customer`, khoá là `phone`: nếu sau này có chức năng đổi số điện thoại, bản cũ và bản mới của cùng một khách sẽ không bằng nhau.
3. **Khoá cấu hình.** Mọi phép đọc cấu hình giờ đi qua một monitor. Với tần suất đọc của quán cà phê thì chi phí không đáng kể. Như các khoá khác, khoá này chỉ có hiệu lực trong một JVM, nhưng cấu hình cũng chỉ nằm trong bộ nhớ của JVM đó.
4. **Commit:** không thêm dòng `Co-Authored-By`. Phiên này chạm vào `OperatingHoursValidator.java` (đã có thay đổi của phiên 1), `ChainTest.java`, `docs/*`, `README.md` (đã có thay đổi của các phiên trước). Các file còn lại chỉ phiên này sửa, nên có thể tách thành commit riêng cho PT-01, PT-02, PT-03.

## 6. Xem diff
```bash
git diff -- backend-java/src/main/java/com/dalatcafe/patterns/singleton/ \
            backend-java/src/main/java/com/dalatcafe/server/ConfigHandler.java \
            backend-java/src/main/java/com/dalatcafe/patterns/chain/OperatingHoursValidator.java \
            backend-java/src/main/java/com/dalatcafe/patterns/strategy/PointRedemptionDiscountStrategy.java \
            backend-java/src/main/java/com/dalatcafe/model/Order.java \
            backend-java/src/main/java/com/dalatcafe/model/Reservation.java \
            backend-java/src/main/java/com/dalatcafe/model/Customer.java \
            backend-java/src/main/java/com/dalatcafe/patterns/factory/
git diff --no-index /dev/null backend-java/src/main/java/com/dalatcafe/patterns/factory/PaymentArguments.java
git diff --no-index /dev/null backend-java/src/test/java/com/dalatcafe/server/ConfigHandlerTest.java
git diff -- backend-java/src/test/ docs/ README.md .agents/
```

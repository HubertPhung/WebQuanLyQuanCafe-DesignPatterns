# DESIGN PATTERN & ARCHITECTURE AUDIT — Đà Lạt Cafe

**Ngày kiểm toán:** 18/10/2026 · **Đối tượng:** `backend-java/src/main/java/com/dalatcafe/` (cây làm việc nhánh `feature/hoai-bo`, HEAD `67e5253` cộng các thay đổi chưa commit, xem BUSINESS_AUDIT §0)
**Chuẩn đối chiếu:** `docs/DESIGN_PATTERNS_SPEC.md` (9 mẫu GoF), `.agents/rules/backend-java-constraints.md`, định nghĩa GoF gốc.

---

## 0. Bằng chứng nền

| Kiểm tra | Lệnh / nguồn | Kết quả |
| :--- | :--- | :--- |
| Bộ test | `mvn -q -B test` + tổng hợp `target/surefire-reports` | `TOTAL run=213 fail=0 err=0 skip=0` |
| Không dùng framework bị cấm | `pom.xml` dependencies; `grep -rlE 'org\.springframework\|javax\.persistence\|jakarta\.persistence\|org\.hibernate' src/main \| wc -l` | Chỉ có `postgresql`, `junit-jupiter-*`, `embedded-postgres`. grep trả về **0** |
| Java SE 17 | `pom.xml:16-17` | `maven.compiler.source/target = 17` ✔ |
| HTTP bằng `com.sun.net.httpserver` | `MainServer.java:56` | `HttpServer.create(...)` ✔ |
| DAO bằng JDBC thuần | `JdbcMenuDao.java:170-181`, … | `java.sql.*` + `PreparedStatement` ✔ |
| Probe hành vi | `ObserverRaceProbe`, `ObserverAbortProbe`, `AuditProbe` (scratchpad) | Output trích ở mục tương ứng |

---

## 1. Bảng kết luận 9 pattern

| # | Pattern (spec) | Lớp chính | Đúng cấu trúc GoF? | Dùng thật trong luồng nghiệp vụ? | Test | Kết luận |
| :-: | :--- | :--- | :--- | :--- | :---: | :---: |
| 1 | Singleton | `SystemConfigManager` | Có (DCL + `volatile` + `readResolve`) | Có (chain, observer, strategy, config) | 9 | **ĐẠT có lỗi** (PT-01) |
| 2 | Factory Method | `PaymentProcessorFactory` | **Không**: đây là Simple/Static Factory | Có (Facade, `/pay`) | 5 | **MỘT PHẦN** (PT-02) |
| 3 | Builder | `OrderBuilder` | Có (fluent builder, Director = Facade) | Có (checkout) | 5 | **ĐẠT có lỗi** (PT-03) |
| 4 | Decorator | `BeverageDecorator` + 3 lớp con | Có | Có (`PosCheckoutFacade.decorate`) | 8 | **ĐẠT** |
| 5 | Adapter | `ReservationToOrderAdapter` | Có (Object Adapter) | Có (`transfer-pos`) | 4 | **ĐẠT**, nhưng chuyển tiếp lỗi dữ liệu (PT-05) |
| 6 | Facade | `PosCheckoutFacade` | Có | Có (`/api/checkout`) | 8 | **ĐẠT có lỗi** (PT-06) |
| 7 | Strategy | `IDiscountStrategy`, `DiscountContext` | Có | Có | 12 | **ĐẠT có lỗi** (PT-07) |
| 8 | Chain of Responsibility | `ReservationValidatorHandler` + 3 handler | Có | Có (`POST /api/reservations`) | 31 | **ĐẠT** (PT-08 nhỏ) |
| 9 | Observer | `OrderEventSubject`, `IOrderObserver` + 3 observer | Có về hình thức | Có | 10 | **KHÔNG ĐẠT về độ an toàn** (PT-09, PT-10) |

Số test là số test trong lớp test cùng tên, đọc từ `target/surefire-reports` (Singleton = 4 + 5 nested).

---

## 2. Phát hiện theo pattern

### PT-01 · Singleton · TRUNG BÌNH · Chỉ bước khởi tạo an toàn luồng; trạng thái thì không
- `SystemConfigManager.java:28` có `instance` `volatile`, và DCL ở `:52-61` đúng. Nhưng các trường cấu hình `:30-39` **không** `volatile`, và setter `:120-194` không đồng bộ.
- Bên ghi (`ConfigHandler.java:58`) dùng `synchronized (config)`. Bên đọc (`OperatingHoursValidator.java:34-43`, `CapacityGuestValidator.java:21`, `LoyaltyPointObserver.java:30`, `PointRedemptionDiscountStrategy.java:31-36`) đọc **không khoá**. Mô hình bộ nhớ Java không bảo đảm bên đọc thấy giá trị mới, và có thể đọc được cặp giờ mở/đóng không nhất quán (giờ mở mới, giờ đóng cũ).
- Chặn reflection chỉ có tác dụng khi `instance` đã được tạo (`:42-44`). Nếu gọi reflection trước lần `getInstance()` đầu tiên thì vẫn tạo được bản thứ hai.
- `isWithinOperatingHours(null)` dùng `LocalTime.now()` theo múi giờ **của máy chủ** (`:83-85`), không phải `Asia/Ho_Chi_Minh`.
- Hai trường `vatRate` và `autoCancelMinutes` không có ai đọc ngoài `ConfigHandler` (grep: chỉ `ConfigHandler.java:116-117`).
- **Kết luận:** đúng mẫu Singleton, nhưng là một *mutable global state* chưa được bảo vệ. CHƯA tái hiện lỗi hiển thị (data race khó tái hiện có chủ đích).

### PT-02 · Factory Method · TRUNG BÌNH · Đặt tên GoF nhưng cài đặt là Simple Factory
- `PaymentProcessorFactory.java:5-19`: lớp `final`, phương thức `static`, chọn bằng `switch`. GoF Factory Method đòi một *Creator* có phương thức factory **có thể ghi đè** để lớp con quyết định sản phẩm. Ở đây không có Creator trừu tượng và không có lớp con.
- Spec tự ghi "dạng Simple/Static Factory" (`DESIGN_PATTERNS_SPEC.md:260`), nhưng bảng tổng hợp và luật dự án vẫn xếp nó là **Factory Method (GoF)** (`DESIGN_PATTERNS_SPEC.md:152`, `backend-java-constraints.md:11`). Khi chấm theo GoF, đây là điểm dễ bị trừ.
- OCP: thêm phương thức thanh toán buộc phải sửa enum **và** `switch`.
- Ba Concrete Product lặp nguyên văn hàm `validate` (`CashPaymentProcessor.java:20-27`, `MomoQrPaymentProcessor.java:20-27`, `CardPosPaymentProcessor.java:20-27`). Đây là vi phạm DRY.
- Spec mâu thuẫn với code: "`PosCheckoutFacade` là nơi duy nhất gọi Factory" (`DESIGN_PATTERNS_SPEC.md:260`), trong khi `OrderHandler.java:185` cũng gọi `PaymentProcessorFactory.createProcessor`.

### PT-03 · Builder · TRUNG BÌNH · Sản phẩm mất liên kết tới món; mã đơn dễ trùng
- `OrderBuilder.java:53`: `addItem(IBeverage, qty)` tạo `OrderItem` **không có `menuItemId`**, vì `IBeverage` không mang định danh. Probe P2 cho thấy `"menuItemId":null` trên đơn checkout. Hệ quả nghiệp vụ: BUSINESS_AUDIT BR-07, BR-03.
- `OrderBuilder.java:90-93`: mã đơn 2²⁸ giá trị, không kiểm trùng, trong khi cột `order_code` là UNIQUE (`JdbcDatabase.java:257`). Xem BR-08.
- Director (`PosCheckoutFacade.java:151-171`) không dùng bước `applyDiscount` của Builder. Nó `build()`, gọi `recalculateTotals()`, rồi set giảm giá trực tiếp vào `Order`. Lý do hợp lý (giảm giá cần subtotal), nhưng khiến bước `applyDiscount` chỉ phục vụ test.
- Sản phẩm `Order` vẫn mở mọi setter tổng tiền (`Order.java:126-161`: `setSubtotal`, `setVatAmount`, `setTotal`), nên Builder không bảo vệ được tính bất biến của tổng.
- `Order.equals` vi phạm hợp đồng `equals/hashCode` (`Order.java:215-226`): hai đơn có `id == null` luôn bằng nhau, nhưng hashCode khác. **Probe P6:** `o1.equals(o2)=true hash equal=false`. Hiện chưa có `HashSet`/`contains` nào dựa vào nó (grep DAO), nên đây là rủi ro tiềm ẩn.

### PT-04 · Decorator · ĐẠT
- Đúng GoF: `BeverageDecorator.java:5-21` giữ `protected final IBeverage` và chuyển tiếp lời gọi. Ba lớp con (`LargeSizeDecorator`, `CheeseFoamDecorator`, `PearlToppingDecorator`) chỉ cộng phụ thu và nối mô tả.
- Ghi chú: spec nói "có thể bọc cùng một topping nhiều lần" (`DESIGN_PATTERNS_SPEC.md:483`). Pattern cho phép, nhưng API thu tuỳ biến vào `Set` (`CheckoutLine.java:22`, `CheckoutHandler.java:184`) nên không thể đặt hai lần trân châu. Không phải lỗi pattern, nhưng tài liệu cần nói rõ.
- Tên lớp trong luật dự án (`ToppingDecorator`, `backend-java-constraints.md:12`) **không tồn tại** trong code.

### PT-05 · Adapter · ĐẠT, nhưng chuyển tiếp dữ liệu không đáng tin
- Đúng Object Adapter (`ReservationToOrderAdapter.java:17-58`): Target là `IPosOrderTarget`, Adaptee là `Reservation`, chỉ đọc Adaptee, sao chép `OrderItem`.
- Adapter sao chép **nguyên giá** món đặt trước mà client gửi lên (`:54-56`). Pattern làm đúng việc của nó, còn lỗ hổng nằm ở chỗ Adaptee được tạo từ input không kiểm (BR-01). Có thể xử lý ở Adapter (tra giá menu khi chuyển đổi) hoặc ở `ReservationHandler`.
- `getAssignedTableId()` trả `-1` làm giá trị "không có bàn" (`:43-46`). Đây là magic number; `OptionalInt` hoặc `Integer` null sẽ rõ nghĩa hơn.

### PT-06 · Facade · TRUNG BÌNH · Facade bị rò logic ra client; giữ kho không nguyên tử
- Facade điều phối đúng thứ tự (`PosCheckoutFacade.java:64-125`): resolve, decorate/build/discount, giữ kho, thanh toán, lưu đơn, phát sự kiện.
- **Rò rỉ trách nhiệm sang client:** `CheckoutHandler.java:70-96` tự làm ba việc nằm *trong* quy trình chốt đơn: gắn/gỡ observer tích điểm, đọc số dư điểm, và trừ điểm sau khi Facade thành công. Spec liệt kê bước 3 (đổi điểm) là việc của Facade (`DESIGN_PATTERNS_SPEC.md:697`). Hệ quả là khoá phải nằm ở client (`synchronized (facade)`) và gây ra race của PT-09.
- **Hai lớp khoá chồng nhau:** `checkout` là `synchronized` (`:64`), và client lại `synchronized (facade)` thêm một lần. Khoá này chỉ bảo vệ những đường đi qua Facade. `MenuHandler` và `OrderHandler.sync` ghi kho ngoài khoá (BR-11).
- **Bù trừ kho dựa trên giả định sai về DAO:** `reserveStock` (`:185-197`) cho rằng `updateStock` trả `false` khi thiếu hàng. Thực tế DAO kẹp về 0 và luôn trả `true` (`InMemoryMenuDao.java:65-71`, `JdbcMenuDao.java:171`). Nhánh hoàn tác thiếu hàng là code chết, và `releaseStock` có thể làm kho phình lên.
- Constructor mặc định (`:46-49`) tự lấy `DaoFactory.getInstance()` và tạo `OrderEventSubject` mới, nên có thể vô tình tạo Facade với subject không có observer nào. Hiện `MainServer` dùng constructor có tham số, tức rủi ro này chưa xảy ra.

### PT-07 · Strategy · THẤP · Một strategy có trạng thái; một strategy không ai dùng
- `PointRedemptionDiscountStrategy.java:14-48` vừa là Strategy vừa bọc một Strategy khác (về bản chất là Decorator trên Strategy). Nó **có trạng thái** (`pointsUsed`, `:17,35`), và `getPointsUsed()` chỉ đúng sau khi `calculateDiscount` đã chạy. Một instance phục vụ một checkout là ràng buộc ngầm, chỉ ghi trong Javadoc.
- Lớp này **không** có trong sơ đồ lớp và cây thư mục của spec (`DESIGN_PATTERNS_SPEC.md:131-132, 856-913`), dù bảng participant ở `:851` có nhắc tới.
- `FixedAmountDiscountStrategy` không được code production nào dùng (grep chỉ thấy chính lớp đó và test). Đây là vi phạm YAGNI nhẹ, nhưng chấp nhận được trong đồ án minh hoạ.
- Việc chọn strategy vẫn dùng `if/else` trong client (`CheckoutHandler.java:217-223`), tuy voucher đã nằm trong registry `VoucherCatalog`. Chấp nhận được.
- `DiscountContext` kẹp kết quả về `[0, subtotal]` (`DiscountContext.java:21-24`), một điểm phòng thủ tốt.

### PT-08 · Chain of Responsibility · ĐẠT (ghi chú nhỏ)
- Đúng GoF: `ReservationValidatorHandler.java:5-23` có `setNext` chống vòng lặp, và mỗi mắt xích dừng ngay ở lỗi đầu tiên. Thứ tự chuỗi được lắp bằng `ReservationValidationChainFactory.java:21-28`. 31 test.
- Mắt xích phụ thuộc ngầm vào Singleton (`SystemConfigManager.getInstance()` trong `OperatingHoursValidator.java:34`, `CapacityGuestValidator.java:21`). Đó là phụ thuộc ẩn, nên test phải `resetToDefaults()`. Có thể tiêm cấu hình qua constructor như đã làm với `Clock`.
- `TableAvailabilityValidator.java:40` quét `findAll()` mỗi lần kiểm. Với vài nghìn phiếu thì vẫn ổn, nhưng nên có `findByTableId`.
- Setter `Reservation.setGuests` ép giá trị về ≥ 1 trước khi chain chạy (BR-14), nên cận dưới của `CapacityGuestValidator` không bao giờ bị kích hoạt qua API.

### PT-09 · Observer · CAO · Observer theo request được gắn lên subject dùng chung
- `OrderEventSubject` được tạo một lần (`MainServer.java:51`) và dùng chung cho Facade (`:54`) và `OrderHandler` (`:62`).
- `CheckoutHandler.java:78-89` gắn rồi gỡ `LoyaltyPointObserver` của **một khách cụ thể** lên subject đó. Mọi `notifyOrderPaid` từ luồng khác (`OrderHandler.java:199`, `:352`) xảy ra trong khoảng thời gian này đều cộng điểm cho khách đó.
- **Probe `ObserverRaceProbe`:** `member#2 before: points=250 spent=2500000.0` → `after: points=362 spent=3623740.0 orders=3`. Hội viên nhận 108 điểm và 1.080.000đ doanh số của đơn người khác.
- Cùng một observer được dùng theo **hai cách khác nhau**: `CheckoutHandler` gắn vào subject, còn `OrderHandler.java:202` gọi `onOrderPaid` trực tiếp (bỏ qua subject). Đây là dấu hiệu dữ liệu "khách của đơn này" đang thiếu ngay trong `Order` (đơn không giữ `customerId`), nên observer phải được khởi tạo theo từng request.

### PT-10 · Observer · CAO · Lỗi của một observer chặn các observer còn lại
- `OrderEventSubject.java:24-36` không cô lập lỗi theo từng observer. Facade (`PosCheckoutFacade.java:118-123`) chỉ bắt exception ở ngoài vòng lặp.
- **Probe `ObserverAbortProbe`:** `success=true … warnings=[Order event observer failed: Table not found: 999]` và `KDS tickets=[] ; member points before=550 after=550`.
- Spec mô tả các observer "phản hồi độc lập" (`DESIGN_PATTERNS_SPEC.md:1085`), nhưng code không bảo đảm điều đó.
- Test `FacadeTest.observerFailureDoesNotUndoCommittedCheckout` chỉ kiểm rằng đơn không bị hoàn tác. Nó không kiểm các observer phía sau có chạy hay không.

### PT-11 · Observer · TRUNG BÌNH · `TableStatusSyncObserver` thiếu ngữ cảnh để quyết định trạng thái bàn
- `TableStatusSyncObserver.java:33-42` đặt CLEANING mà không biết bàn còn đơn mở hay không (BR-05, probe P5). Ở chiều *paid* (`:22-31`), nó đặt OCCUPIED bất kể bàn đang RESERVED cho người khác. Đây là chỗ State Pattern (spec §4.1, mới ở mức đề xuất) sẽ giải quyết.

---

## 3. Nguyên tắc kiến trúc

| Nguyên tắc | Bằng chứng | Kết luận |
| :--- | :--- | :--- |
| Không framework backend | `pom.xml`, grep = 0 | ĐẠT |
| Tách tầng server, patterns, dao, model | Cấu trúc gói; handler gọi pattern; pattern gọi DAO qua interface `I*Dao` | ĐẠT |
| DIP: phụ thuộc interface DAO | `PosCheckoutFacade.java:42-55` nhận `IOrderDao`, `IMenuDao` | ĐẠT. Ngoại lệ: Singleton được gọi trực tiếp trong chain, observer, strategy (PT-01, PT-08) |
| SRP của handler | `CheckoutHandler` vừa ánh xạ HTTP vừa điều phối điểm và observer (PT-06) | MỘT PHẦN |
| Đồng bộ hoá nhất quán | Ba khoá độc lập: `facade`, `OrderHandler.this`, `ReservationHandler.this`; DAO không nguyên tử | **KHÔNG ĐẠT** khi các luồng chạm cùng dữ liệu (BR-02, BR-11, BR-12) |
| Đặc tả khớp code | Lệch: tên lớp trong luật dự án (`ToppingDecorator`, `DiscountStrategy`, `ReservationValidator`), "nơi duy nhất gọi Factory", thiếu `PointRedemptionDiscountStrategy` trong sơ đồ, cây test thiếu 3 test handler mới (`DESIGN_PATTERNS_SPEC.md:137-141`); §4.1 nói "không thể Pending → Completed" trong khi API_SPEC §3.9 cho phép nhảy bước | MỘT PHẦN |
| Mỗi pattern có lớp test JUnit 5 riêng | 9 lớp `*Test` trong `src/test/java/com/dalatcafe/patterns` | ĐẠT |

---

## 4. CHƯA kiểm chứng
- Data race của Singleton (PT-01): chỉ có lập luận theo mô hình bộ nhớ Java, chưa tái hiện được.
- Hành vi các pattern trên chế độ JDBC ngoài phạm vi `JdbcIntegrationTest` có sẵn.
- Phía frontend: mức độ tuân thủ quy ước Next.js (Server Actions, DAL) không nằm trong phạm vi pattern GoF lần này.

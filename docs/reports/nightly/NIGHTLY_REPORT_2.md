# NIGHTLY REPORT, phiên 2: tự động 2026-10-18 (nhánh `feature/hoai-bo`)

- HEAD: `67e5253`. **Chưa commit, push hay mở PR.** Mọi thay đổi nằm trong working tree, chồng lên thay đổi chưa commit của các phiên trước (`NIGHTLY_REPORT.md`, `REVIEW_REPORT.md`). Phiên này không hoàn tác hay ghi đè file nào của các phiên trước.
- Đầu vào: `BUSINESS_AUDIT.md` và `AUDIT_PLAN.md` (Đợt 1, một phần Đợt 2). Các mục phiên trước đã làm (F1 đến F5, BR-12) không làm lại.
- Báo cáo ghi ở file mới, để giữ nguyên `NIGHTLY_REPORT.md` của phiên trước. `AUDIT_PLAN.md`, `BUSINESS_AUDIT.md`, `PATTERN_AUDIT.md` chỉ được đọc, không sửa.

## 1. Tóm tắt

| # | Mã | Lỗi | Kết quả |
| :-: | :--- | :--- | :--- |
| 1 | BR-04a (Cao) | Một observer ném lỗi thì các observer sau không chạy: mất phiếu KDS và mất điểm của đơn đã thu tiền | ✅ Đã sửa. Test fail trước khi sửa, pass sau khi sửa |
| 2 | BR-02 (Cao) | Điểm và doanh số của đơn khác bị cộng cho hội viên đang checkout, khi `/pay` hoặc `/sync` chạy cùng lúc | ✅ Đã sửa. Test tái hiện đúng `ObserverRaceProbe`, fail trước khi sửa (`totalOrders` 2 thay vì 1) |
| 3 | BR-01 (Cao) | Khách vô danh tự đặt giá món đặt trước, đơn được thu 0đ | ✅ Đã sửa phần giá. Phần trừ kho **cần bạn quyết định** (mục 5.1) |
| 4 | BR-04b (Cao) | Checkout tại bàn không tồn tại vẫn thu tiền (JDBC: khoá ngoại làm lưu đơn lỗi *sau* khi thu tiền) | ✅ Đã sửa. Trả 404 trước khi thu tiền |
| 5 | BR-06 (Trung bình) | Tiền mặt khách đưa thiếu vẫn được nhận | ✅ Đã sửa theo quy tắc không làm vỡ POS (mục 5.2) |

Backend: **217 → 223** test JUnit, 0 fail. Frontend không bị sửa.

## 2. Bằng chứng đã chạy

Mọi lệnh chạy trong `backend-java/`. Mỗi lỗi theo TDD: viết test trước, xem test fail đúng lý do, rồi mới sửa code.

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E1 | `mvn -q -B test -Dtest=ObserverTest` (test mới, **trước khi sửa**) | Fail: `failingObserverDoesNotStopTheOthersAndIsStillReported:181 expected: <1> but was: <0>`. Không có lỗi suppressed vì vòng lặp dừng ở observer đầu tiên |
| E2 | `mvn -q -B test -Dtest='ObserverTest,FacadeTest,OrderHandlerTest'` (sau khi sửa) | `EXIT=0` |
| E3 | `mvn -q -B test -Dtest=CheckoutHandlerTest` (**trước khi sửa**) | Lần đầu fail **sai lý do**: bản sao của DAO test không chép `totalOrders`. Đã sửa test để đọc bằng `findById`. Lần hai fail đúng lý do: `anotherOrderPaidDuringCheckoutDoesNotCreditTheMember:115 expected: <1> but was: <2>` |
| E4 | `mvn -q -B test -Dtest='CheckoutHandlerTest,ServerTest,FacadeTest'` (sau khi sửa) | `EXIT=0` |
| E5 | `mvn -q -B test -Dtest='ServerTest#preOrders*'` (**trước khi sửa**) | Lần đầu, test "món không tồn tại" pass **sai lý do** (bàn 12 chỉ có 1 ghế, nên bị chain chặn). Đã đổi sang bàn 5 và thêm ca hợp lệ ở cuối. Lần hai cả hai fail đúng lý do: `menuItemId` null, và `menuItemId: 9999 → 201` |
| E6 | `mvn -q -B test -Dtest='ServerTest,ReservationHandlerTest,AdapterTest,ChainTest'` (sau khi sửa) | `EXIT=0` |
| E7 | `mvn -q -B test -Dtest='ServerTest#checkoutAtAnUnknownTable*'` (**trước khi sửa**) | Fail: `expected: <404> but was: <200>`, phản hồi có `"paymentStatus":"paid"` và `"warnings":["Order event observer failed: Table not found: 999"]`, đúng như probe P4 |
| E8 | `mvn -q -B test -Dtest='ServerTest,CheckoutHandlerTest'` (sau khi sửa) | `EXIT=0` |
| E9 | `mvn -q -B test -Dtest='ServerTest#cashShort*'` (**trước khi sửa**) | Fail: `expected: <400> but was: <200>`, `tenderedAmount: 1000` cho đơn 48.600đ vẫn `"paymentStatus":"paid"`, đúng như probe P3 |
| E10 | `mvn -q -B test -Dtest='ServerTest,CheckoutHandlerTest,FacadeTest'` (sau khi sửa) | `EXIT=0` |
| E11 | `mvn -B clean test` (sau mọi thay đổi code) | `MVN_EXIT=0`, `Tests run: 223, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`. Đếm `TEST-*.xml`: **TOTAL 223, fail 0, err 0, skip 0** |
| E12 | `graphify update .` | Graph đã cập nhật |

Sau E11 chỉ có tài liệu thay đổi, không sửa code.

**Không chạy:** `npm test`, `tsc`, `npm run build` ở frontend, vì phiên này không sửa file frontend nào (xem mục 4). GitHub Actions cũng chưa chạy, vì chưa push.

## 3. Chi tiết thay đổi

### 3.1. BR-04a: cô lập lỗi theo từng observer
| File | Thay đổi |
| :--- | :--- |
| `patterns/observer/OrderEventSubject.java` | `notifyOrderPaid` và `notifyOrderCompleted` dùng chung `notifyAll`: gọi **mọi** observer, giữ lỗi đầu tiên, các lỗi sau đưa vào `addSuppressed`, rồi ném lại lỗi đầu tiên. Nơi gọi vẫn nhận exception như cũ (`try/catch` thành cảnh báo ở Facade, `pay`, `sync` không đổi), và các test "fails loudly" có sẵn vẫn đúng |
| `test/.../patterns/ObserverTest.java` | +1 test: bàn không tồn tại, cộng thêm một observer ném lỗi, nhưng KDS vẫn nhận 1 phiếu và hội viên vẫn được tính 1 đơn. Exception có lỗi bàn và 1 lỗi suppressed |

### 3.2. BR-02: điểm bị cộng nhầm hội viên
**Nguyên nhân:** `CheckoutHandler` gắn `LoyaltyPointObserver` của khách lên `OrderEventSubject` **dùng chung** và chỉ khoá `facade`. Trong khi đó, `/pay` và `/sync` phát *paid* trên cùng subject nhưng dưới khoá `OrderHandler`. Đơn của người khác phát ra trong khoảng thời gian đó sẽ cộng cho khách đang checkout.

**Cách sửa:** làm giống `OrderHandler.pay` đang làm: gọi `LoyaltyPointObserver.onOrderPaid` **trực tiếp trên đúng đơn** vừa checkout thành công, và không gắn gì lên subject dùng chung nữa. Lỗi cộng điểm chỉ thành cảnh báo. Lợi ích phụ: một observer khác lỗi (ví dụ bàn) không còn làm mất điểm ở checkout.

| File | Thay đổi |
| :--- | :--- |
| `server/CheckoutHandler.java` | Bỏ `attach`/`detach`. Cộng điểm trực tiếp, vẫn trong `synchronized (facade)`, nên thứ tự cộng điểm rồi trừ điểm đổi vẫn giữ như cũ |
| `test/.../server/CheckoutHandlerTest.java` | +`PausingOrderDao` (giữ lần `save` kế tiếp) và +1 test: checkout của hội viên bị giữ ở bước lưu đơn, test phát *paid* cho một đơn 20 ly trên subject dùng chung, rồi kiểm hội viên chỉ có 1 đơn và đúng số tiền, đúng số điểm của mình |

**Khác với AUDIT_PLAN:** kế hoạch đề xuất cho `Order` mang `customerId` và dùng **một** observer dùng chung. Cách đó cần thêm cột vào bảng `orders` (đổi schema), nên phiên này chọn cách nhỏ hơn, giống mẫu có sẵn ở `/pay`. Nếu muốn đúng Observer "thuần" hơn, đó là việc tiếp theo (mục 5.4).

### 3.3. BR-01: giá món đặt trước
| File | Thay đổi |
| :--- | :--- |
| `server/ReservationHandler.java` | Constructor nhận thêm `IMenuDao`. Mỗi phần tử `preOrders` **bắt buộc** có `menuItemId`. Tên và giá (`sellPrice`) lấy từ menu, còn `name` và `price` client gửi thì bỏ qua. Món không tồn tại trả 400. `OrderItem` giữ `menuItemId`, Adapter sao chép sang đơn POS, và JSONB `pre_orders` đã lưu `menuItemId` sẵn |
| `server/MainServer.java`, `test/.../ReservationHandlerTest.java` | Truyền `IMenuDao` |
| `test/.../server/ServerTest.java` | +2 test: gửi `price: 0` và tên giả thì đơn POS vẫn là "Cà phê Latte Vani Mịn", 55.000đ × 10, `menuItemId = 2`; `menuItemId` không tồn tại hoặc chỉ có `name` thì trả 400 và không lưu phiếu; ca hợp lệ trả 201. Hai body có sẵn đổi từ `{name, price}` sang `{menuItemId: 2}`, và tổng 110.000đ không đổi |

**Tác động hợp đồng API:** `POST /api/reservations` không còn nhận `preOrders` dạng `{name, qty, price}`. Frontend hiện **không gửi** `preOrders` (đã grep `frontend-nextjs`, chỉ có kiểu dữ liệu để hiển thị), nên giao diện không bị ảnh hưởng. Phản hồi `GET` vẫn có `name`, `qty`, `price`.

### 3.4. BR-04b: bàn không tồn tại
| File | Thay đổi |
| :--- | :--- |
| `server/CheckoutHandler.java` | Constructor nhận thêm `ITableDao`. Nếu có `tableId` mà bàn không tồn tại thì trả **404 `NOT_FOUND`**, trước khi gọi Facade, nên chưa giữ kho và chưa thu tiền |
| `server/MainServer.java`, `test/.../CheckoutHandlerTest.java` | Truyền `ITableDao` |
| `test/.../server/ServerTest.java` | +1 test: `tableId: 999` trả 404, kho vẫn là 10, số đơn không đổi |

Đã kiểm: frontend có đúng 15 bàn (`mock-store.ts`), trùng với seed của Java, nên luồng POS bình thường không bị chặn.

### 3.5. BR-06: tiền mặt khách đưa thiếu
| File | Thay đổi |
| :--- | :--- |
| `patterns/facade/CheckoutRequest.java` | Thêm `tenderedAmount` (tuỳ chọn) qua một constructor 8 tham số. Constructor 7 tham số cũ vẫn giữ và truyền `null`, nên 5 nơi gọi khác không đổi. Giá trị âm ném `IllegalArgumentException` |
| `patterns/facade/PosCheckoutFacade.java` | Ngay sau khi tính tổng và **trước** khi giữ kho, thu tiền: nếu trả tiền mặt, có `tenderedAmount` và số đó nhỏ hơn tổng thì trả `PAYMENT_FAILED` (HTTP 400 `INVALID_INPUT`) |
| `server/CheckoutHandler.java` | `tenderedAmount` âm trả 400 |
| `test/.../server/ServerTest.java` | +1 test: khách đưa 1.000đ trả 400, kho và số đơn không đổi; `-5` trả 400 |

### 3.6. Tài liệu
- `docs/API_SPEC.md`: §3.5 có ví dụ `preOrders` mới và quy tắc giá theo menu. §3.6 có mục "Kiểm tra trước khi thu tiền" (404 bàn, quy tắc `tenderedAmount`) và cách cộng điểm ở checkout.
- `docs/DESIGN_PATTERNS_SPEC.md` (Observer): checkout gọi observer trực tiếp, và subject cô lập lỗi theo từng observer. Đoạn mã `OrderEventSubject` cập nhật theo code thật. Số test 223.
- `docs/TESTING.md`, `README.md`: số test 217 → 223, cùng mô tả các test mới.

## 4. Chưa làm và lý do
| Mục | Lý do |
| :--- | :--- |
| BR-01: trừ kho khi thanh toán đơn chuyển từ đặt bàn | `/pay` thanh toán cả đơn `/sync` chưa trả tiền, mà kho của các đơn đó **đã** bị trừ lúc nhập. Trừ kho thêm ở `/pay` sẽ trừ hai lần. Cần chọn thời điểm trừ (mục 5.1) |
| BR-03: huỷ đơn đã thu tiền không đảo hệ quả | Cần chốt quy tắc nghiệp vụ (điểm đã tiêu hết thì sao, có hoàn kho không). `NIGHTLY_REPORT.md` mục 5.1 đã nêu |
| BR-05, BR-07 đến BR-11, BR-13 trở đi | Ngoài phạm vi phiên này. BR-07 (mang `menuItemId` qua Builder) và BR-11 (DAO từ chối khi thiếu kho) là các ứng viên kế tiếp có thể kiểm bằng test |
| Frontend `npm test` / `tsc` / `build` | Phiên này không sửa file frontend. Lần chạy gần nhất (phiên trước): 38/38 UI, `tsc` và `build` sạch |
| Kiểm thử trình duyệt | Theo quy ước của bạn: dựa vào JUnit và CI |
| BR-04b trên PostgreSQL | Kiểm tra bàn chạy **trước** Facade, nên giống nhau ở cả hai chế độ DAO. Chưa có test riêng ở `JdbcIntegrationTest` |

## 5. Cần bạn xem xét
1. **Trừ kho cho món đặt trước** (BR-01, phần còn lại). Có hai lựa chọn:
   - (a) Trừ lúc `transfer-pos`, giống cách `/sync` trừ lúc nhập.
   - (b) Trừ lúc `/pay`, nhưng chỉ cho đơn đến từ đặt bàn.

   Cả hai cần đi kèm quy tắc hoàn kho khi huỷ (BR-03). Hiện `menuItemId` đã được giữ trên đơn, nên làm cách nào cũng dễ.
2. **Quy tắc tiền mặt** (BR-06). AUDIT_PLAN đề xuất **bắt buộc** gửi `tenderedAmount`. Phiên này chỉ kiểm *khi có gửi*, vì POS (`forwardCheckout` trong `actions.ts`) chưa gửi trường này, nên bắt buộc sẽ làm mọi giao dịch tiền mặt bị từ chối. Muốn bắt buộc thì cần thêm ô "tiền khách đưa" ở POS trước.
3. **Đổi hợp đồng API:** `POST /api/reservations` giờ bắt buộc `preOrders[].menuItemId`. Client bên ngoài nào gửi dạng `{name, price}` sẽ nhận 400.
4. **BR-02, hướng dài hạn:** nếu muốn mọi luồng (`/checkout`, `/pay`, `/sync`) cộng điểm qua **một** `LoyaltyPointObserver` gắn sẵn trên subject, `Order` cần mang `customerId`, nghĩa là thêm cột vào `orders`. Đây là thay đổi schema, nên chưa tự làm.
5. **Đổi chữ ký constructor:** `CheckoutHandler` (+`ITableDao`) và `ReservationHandler` (+`IMenuDao`). Mọi nơi gọi trong repo đã được cập nhật.
6. Commit: không thêm dòng `Co-Authored-By`. Nên tách commit theo từng mã BR-xx nếu muốn lịch sử rõ ràng.

## 6. Xem diff
Diff dưới đây gồm cả thay đổi của các phiên trước trong cùng file (ví dụ `CheckoutHandler`, `ReservationHandler`, `ServerTest`).
```bash
git diff -- backend-java/src/main/java/com/dalatcafe/patterns/observer/OrderEventSubject.java \
            backend-java/src/main/java/com/dalatcafe/patterns/facade/ \
            backend-java/src/main/java/com/dalatcafe/server/MainServer.java \
            backend-java/src/main/java/com/dalatcafe/server/CheckoutHandler.java \
            backend-java/src/main/java/com/dalatcafe/server/ReservationHandler.java
git diff -- backend-java/src/test/java/com/dalatcafe/patterns/ObserverTest.java backend-java/src/test/java/com/dalatcafe/server/ServerTest.java
git diff --no-index /dev/null backend-java/src/test/java/com/dalatcafe/server/CheckoutHandlerTest.java   # file chưa track
git diff -- docs/ README.md
```

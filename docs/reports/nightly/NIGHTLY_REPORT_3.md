# NIGHTLY REPORT, phiên 3: tự động 2026-10-18 (nhánh `feature/hoai-bo`)

- HEAD: `67e5253`. **Chưa commit, push hay mở PR.** Mọi thay đổi nằm trong working tree, chồng lên thay đổi chưa commit của hai phiên trước (`NIGHTLY_REPORT.md`, `NIGHTLY_REPORT_2.md`). Phiên này không hoàn tác hay ghi đè thay đổi nào của các phiên trước.
- Đầu vào: `BUSINESS_AUDIT.md` (các mục Trung bình còn mở) và mục 4 của `NIGHTLY_REPORT_2.md`, nơi BR-07 và BR-11 được đề xuất làm tiếp. `BUSINESS_AUDIT.md`, `AUDIT_PLAN.md`, `PATTERN_AUDIT.md` chỉ được đọc, không sửa.

## 1. Tóm tắt

| # | Mã | Lỗi | Kết quả |
| :-: | :--- | :--- | :--- |
| 1 | BR-05 | Hoàn tất một đơn đẩy bàn sang `CLEANING` dù bàn còn đơn khác đang mở | ✅ Đã sửa. 2 test fail trước khi sửa (`expected: <OCCUPIED> but was: <CLEANING>`), pass sau khi sửa |
| 2 | BR-11 | DAO kẹp kho về 0 thay vì từ chối, nên kho có thể bị bán vượt khi có lượt bán xen vào giữa lúc kiểm và lúc trừ | ✅ Đã sửa ở cả In-Memory, JDBC, Facade và `PATCH /api/menu/{id}/stock`. 5 test fail trước khi sửa |
| 3 | BR-07 | Đơn tạo qua checkout mất `menuItemId` | ✅ Đã sửa. Test fail trước khi sửa (`expected: <900> but was: <null>`) |
| 4 | BR-08 | Mã đơn 28 bit, không kiểm trùng, nên có thể lưu thất bại **sau khi** đã thu tiền | ✅ Đã sửa. Mã trùng được sinh lại **trước** khi thu tiền. Test fail trước khi sửa |
| 5 | BR-10 | `/pay` không giảm giá theo hạng | ⏸️ **Không sửa.** Đây là thay đổi số tiền thu, cần bạn quyết định (mục 5.1) |

Backend: **223 → 234** test JUnit, 0 fail. Frontend không bị sửa.

## 2. Bằng chứng đã chạy

Mọi lệnh `mvn` chạy trong `backend-java/`. Mỗi lỗi theo TDD: viết test trước, xem test fail đúng lý do, rồi mới sửa.

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E0 | `mvn -q -B clean test` (baseline, trước mọi thay đổi) | `EXIT=0`, đếm `TEST-*.xml`: **TOTAL 223, fail 0, err 0, skip 0** |
| E1 | `mvn -q -B test -Dtest='ObserverTest#completedOrder*'` (**trước khi sửa**, mới có constructor rỗng) | Fail: `completedOrderLeavesTableSeatedWhileAnotherOrderThereIsOpen:165 expected: <OCCUPIED> but was: <CLEANING>` |
| E2 | `mvn -q -B test -Dtest='ServerTest#completingOneOrder*'` (**trước khi sửa**) | Fail: `completingOneOrderKeepsTheTableSeatedWhileAnotherOrderIsOpen:381 expected: <OCCUPIED> but was: <CLEANING>`, đúng như probe P5 |
| E3 | `mvn -q -B test -Dtest='ObserverTest,ServerTest,OrderHandlerTest,FacadeTest'` (sau khi sửa BR-05) | `EXIT=0` |
| E4 | `mvn -q -B test -Dtest='DaoLayerTest,FacadeTest,JdbcIntegrationTest'` (**trước khi sửa**; stub `deductStockIfAvailable` gọi `updateStock`, đúng hành vi cũ) | 4 fail đúng lý do: `testDeductStockIfAvailable:171 expected: <false> but was: <true>`; `testConcurrentDeductionsNeverOversell:201 expected: <500> but was: <1600>` (8 luồng "bán" 1.600 ly trên 500 tồn kho); `JdbcIntegrationTest.stockIsNeverDeductedBelowWhatIsLeft:251` (PostgreSQL nhúng); `FacadeTest.stockSoldElsewhereAfterTheCheckIsNotOversold:164`: Facade bán 5 ly khi chỉ còn 1 |
| E5 | Như E4 (sau khi sửa) | `EXIT=0`, không còn lỗi |
| E6 | `mvn -q -B test -Dtest=MenuHandlerTest` (**trước khi sửa** `MenuHandler`) | Fail: `writingOffMoreThanIsLeftAfterAConcurrentSaleIsRefused:55 expected: <409> but was: <200>`, phản hồi có `"stockQty":0` |
| E7 | `mvn -q -B test -Dtest='MenuHandlerTest,ServerTest'` (sau khi sửa) | `EXIT=0` |
| E8 | `mvn -q -B test -Dtest=FacadeTest` (**trước khi sửa** BR-07) | Fail: `checkoutRunsFullWorkflowWithOneCall:82 line keeps its menu item ==> expected: <900> but was: <null>` |
| E9 | `mvn -q -B test -Dtest='FacadeTest,BuilderTest,ServerTest,DecoratorTest'` (sau khi sửa) | `EXIT=0` |
| E10 | `mvn -q -B test -Dtest='FacadeTest#takenOrderCode*'` (**trước khi sửa** BR-08) | Fail: `takenOrderCodeIsReplacedBeforePaymentIsTaken:189 the code is checked and drawn again: []` (Facade không hề tra mã) |
| E11 | `mvn -q -B test -Dtest='FacadeTest,BuilderTest'` (sau khi sửa) | `EXIT=0` |
| E12 | `mvn -B clean test` (sau mọi thay đổi code) | `MVN_EXIT=0`, `Tests run: 234, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`. Đếm `TEST-*.xml`: **TOTAL 234, fail 0, err 0, skip 0** |
| E13 | `graphify update .` | Graph đã cập nhật |

Sau E12 chỉ có tài liệu thay đổi, không sửa code.

**Không chạy:** `npm test`, `tsc`, `npm run build` ở frontend, vì phiên này không sửa file frontend nào. Đã kiểm hợp đồng API bằng grep: `JavaOrder` ở `frontend-nextjs/lib/api-client.ts:198` không đọc dòng món, nên `menuItemId` có giá trị không ảnh hưởng giao diện. GitHub Actions chưa chạy, vì chưa push.

## 3. Chi tiết thay đổi

### 3.1. BR-05: bàn còn đơn mở thì không sang `CLEANING`
| File | Thay đổi |
| :--- | :--- |
| `patterns/observer/TableStatusSyncObserver.java` | Thêm constructor `(ITableDao, IOrderDao)`. Ở sự kiện *completed*, nếu bàn còn đơn khác (khác `orderCode`) chưa `COMPLETED`/`CANCELLED` thì giữ nguyên bàn. Constructor 1 tham số cũ vẫn giữ và chạy như trước (không kiểm), nên `JdbcIntegrationTest` và `OrderHandlerTest` không phải đổi |
| `server/MainServer.java` | Gắn observer với `daos.getOrderDao()` |
| `test/.../ObserverTest.java` | +1 test: 3 đơn cùng bàn (xong, đang pha, đã huỷ). Đơn đầu xong thì bàn vẫn `OCCUPIED` với 2 khách. Đơn đang pha xong thì bàn sang `CLEANING` với 0 khách. Thêm assert `null` cho constructor mới |
| `test/.../ServerTest.java` | +1 test end-to-end qua REST: 3 lần checkout tại bàn 3, huỷ 1 đơn, hoàn tất lần lượt 2 đơn còn lại |

### 3.2. BR-11: trừ kho có điều kiện, nguyên tử ở DAO
**Nguyên nhân:** `updateStock` luôn trả `true` và kẹp về 0, nên nhánh hoàn tác trong `PosCheckoutFacade.reserveStock` không bao giờ chạy vì thiếu hàng. Phép kiểm kho của Facade nằm dưới khoá `facade`, còn `PATCH` kho và `/sync` ghi kho ngoài khoá đó.

**Cách sửa:** thêm `IMenuDao.deductStockIfAvailable(id, qty)`: chỉ trừ khi còn đủ, nếu không thì trả `false` và kho giữ nguyên. Ở In-Memory, thao tác chạy trong `synchronized (item)` (giống `InMemoryCustomerDao`). Ở JDBC, đó là một câu `UPDATE ... SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?`. `updateStock` (kẹp về 0) giữ nguyên cho `/sync`, vì đơn offline đã bán thật (`OrderHandler.deductStock` có comment cố ý).

| File | Thay đổi |
| :--- | :--- |
| `dao/IMenuDao.java`, `dao/InMemoryMenuDao.java`, `dao/JdbcMenuDao.java` | Thêm `deductStockIfAvailable`. `InMemoryMenuDao.updateStock` cũng khoá `item`, để không mất cập nhật khi chạy xen với lần trừ có điều kiện |
| `patterns/facade/PosCheckoutFacade.java` | `reserveStock` dùng `deductStockIfAvailable`. Vì giữ kho giờ chính xác, `releaseStock` cũng hoàn lại đúng phần đã trừ, nên lỗi "kho phình lên" (ý 3 của BR-11) không còn |
| `server/MenuHandler.java` | `change` âm (ghi giảm kho) đi qua `deductStockIfAvailable`, thất bại thì trả 409 với số tồn đọc lại. `stockQty` (đặt số tuyệt đối) và `change` dương vẫn dùng `updateStock` |
| `test/.../DaoLayerTest.java` | +2 test: từ chối trừ quá, số lượng 0, món không tồn tại; 8 luồng × 200 lần trừ trên 500 tồn kho bán đúng 500 |
| `test/.../JdbcIntegrationTest.java` | +1 test cùng nội dung trên PostgreSQL nhúng (4 luồng, bằng `POOL_SIZE / 2`, × 20 lần trừ trên 60 tồn kho) |
| `test/.../FacadeTest.java` | +1 test: một quầy khác bán 9 trên 10 ly ngay sau khi checkout đọc kho. Kết quả `OUT_OF_STOCK`, không thu tiền, còn đúng 1 ly |
| `test/.../server/MenuHandlerTest.java` (mới) | +2 test với DAO trả bản sao (như JDBC): ghi giảm 3 sau lần bán xen vào trả 409 và kho còn 1; đặt `stockQty` tuyệt đối không bị từ chối |

### 3.3. BR-07: giữ `menuItemId` qua checkout
| File | Thay đổi |
| :--- | :--- |
| `patterns/builder/OrderBuilder.java` | Thêm overload `addItem(Integer menuItemId, IBeverage, int)`. `addItem(IBeverage, int)` cũ gọi overload mới với `null`, nên mọi nơi gọi cũ vẫn chạy. Decorator không đổi |
| `patterns/facade/PosCheckoutFacade.java` | `buildOrder` truyền `line.getMenuItemId()` |
| `test/.../FacadeTest.java`, `test/.../BuilderTest.java` | +1 assert ở test toàn quy trình, +1 test Builder (có id qua `LargeSizeDecorator`, overload cũ cho `null`) |

JSONB `items` (`JsonColumns.java:30`) và JSON phản hồi (`OrderHandler.java:430`) đã có `menuItemId`, nên không phải sửa thêm.

### 3.4. BR-08: không để mã đơn trùng làm hỏng đơn đã thu tiền
| File | Thay đổi |
| :--- | :--- |
| `patterns/builder/OrderBuilder.java` | Thêm bước `avoidingCodes(Predicate<String> isTaken)`. `build()` sinh lại mã, tối đa 10 lần, khi mã đã bị dùng. Định dạng `AC-XXXX-XXX` giữ nguyên |
| `patterns/facade/PosCheckoutFacade.java` | Truyền `code -> orderDao.findByOrderCode(code).isPresent()`. `checkout` vốn `synchronized`, nên giữa lúc tra và lúc lưu không có checkout khác chen vào |
| `test/.../FacadeTest.java`, `test/.../BuilderTest.java` | +1 test Facade (mã đầu tiên đã có trong kho, nên đơn nhận mã khác và đó là mã được tra cuối cùng), +1 test Builder (đếm số lần sinh, hết 10 lần thì ném `IllegalStateException`, `null` thì ném `NullPointerException`) |

### 3.5. Tài liệu
- `docs/API_SPEC.md`: §3.9 ghi quy tắc bàn còn đơn mở; §3.12 ghi việc trừ kho có điều kiện cho `change` âm.
- `docs/DESIGN_PATTERNS_SPEC.md`: Builder (overload `addItem`, `avoidingCodes`, sơ đồ lớp và đoạn mã), Facade bước 3, Observer (constructor mới, sơ đồ lớp), danh sách test; số test 234.
- `docs/TESTING.md`, `README.md`: số test 223 → 234, cùng mô tả các test mới.

## 4. Chưa làm và lý do
| Mục | Lý do |
| :--- | :--- |
| BR-10: giảm theo hạng ở `/pay` | Làm thay đổi số tiền khách trả. API_SPEC §3.10 không hứa giảm giá ở đây, và frontend (`payJavaOrder`) không gửi `customerPhone`. Cần bạn chốt quy tắc (mục 5.1) |
| "Món bán chạy" gom theo tên đã gắn Decorator (ý 2 của BR-07) | Giờ đã có `menuItemId` để gom, nhưng cần chọn tên hiển thị (tên menu gốc hay tên kèm size) và việc này đổi số liệu dashboard. Đơn cũ vẫn có `menuItemId = null` |
| BR-03, BR-01 (phần trừ kho) | Vẫn chờ quyết định như `NIGHTLY_REPORT_2.md` mục 5.1. `menuItemId` giờ có trên đơn checkout, nên hoàn kho theo món đã làm được |
| `stockQty` tuyệt đối dựa trên số đọc trước | `PATCH` với `stockQty` được đổi thành một khoản chênh lệch từ lần đọc, nên lượt bán xen vào giữa có thể làm kết quả lệch so với số đã kiểm. Muốn sửa cần thêm thao tác "đặt số tồn" nguyên tử ở DAO. Phiên này không đổi hành vi đó |
| BR-09, BR-13 đến BR-20 | Thiết kế (rate limit, State Pattern, huỷ giao dịch) hoặc quy tắc mà spec cố ý giữ (BR-14, BR-15), hoặc là việc ở frontend |
| Frontend `npm test` / `tsc` / `build` | Không sửa file frontend. Lần chạy gần nhất (phiên 1): 38/38 UI, `tsc` và `build` sạch |

## 5. Cần bạn xem xét
1. **BR-10:** hội viên thanh toán đơn chuyển từ đặt bàn có được giảm theo hạng không? Nếu có thì đề xuất: chỉ áp khi đơn chưa có giảm giá (không cộng dồn, giống `/checkout`), và POS cần gửi `customerPhone` khi gọi `/pay`.
2. **Đổi hành vi bàn (BR-05):** bàn có nhiều đơn giờ chỉ sang `CLEANING` khi đơn mở cuối cùng hoàn tất. Đơn `/sync` chưa trả tiền mà còn mở cũng giữ bàn. Nếu quán hay để đơn treo, nhân viên vẫn có thể đổi trạng thái bàn tay qua `PUT /api/tables/{id}`.
3. **Interface mới:** `IMenuDao.deductStockIfAvailable` là phương thức trừu tượng. Hai implementation trong repo đã có. Nếu có implementation bên ngoài thì cần thêm.
4. **Commit:** không thêm dòng `Co-Authored-By`. Nếu muốn lịch sử rõ ràng, nên tách commit theo mã BR-05, BR-11, BR-07, BR-08. Lưu ý `PosCheckoutFacade.java` và `OrderBuilder.java` chứa cả BR-07, BR-08 và BR-11, và còn có thay đổi của các phiên trước.

## 6. Xem diff
Các file dưới đây có thể gồm cả thay đổi của các phiên trước (ví dụ `PosCheckoutFacade`, `MainServer`, `ServerTest`, `FacadeTest`, `ObserverTest`).
```bash
git diff -- backend-java/src/main/java/com/dalatcafe/dao/IMenuDao.java \
            backend-java/src/main/java/com/dalatcafe/dao/InMemoryMenuDao.java \
            backend-java/src/main/java/com/dalatcafe/dao/JdbcMenuDao.java \
            backend-java/src/main/java/com/dalatcafe/patterns/builder/OrderBuilder.java \
            backend-java/src/main/java/com/dalatcafe/patterns/observer/TableStatusSyncObserver.java \
            backend-java/src/main/java/com/dalatcafe/patterns/facade/PosCheckoutFacade.java \
            backend-java/src/main/java/com/dalatcafe/server/MenuHandler.java \
            backend-java/src/main/java/com/dalatcafe/server/MainServer.java
git diff -- backend-java/src/test/
git diff --no-index /dev/null backend-java/src/test/java/com/dalatcafe/server/MenuHandlerTest.java   # file chưa track
git diff -- docs/ README.md
```

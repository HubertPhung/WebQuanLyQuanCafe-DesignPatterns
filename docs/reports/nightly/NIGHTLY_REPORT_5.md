# NIGHTLY REPORT, phiên 5: tự động 2026-10-18 (nhánh `feature/hoai-bo`)

- HEAD: `67e5253`. **Chưa commit, push hay mở PR.** Mọi thay đổi nằm trong working tree, chồng lên thay đổi chưa commit của các phiên trước. Phiên này không hoàn tác hay ghi đè thay đổi nào của các phiên trước.
- Đầu vào: `NEXT_PLAN.md`. Các mục cần người dùng quyết định (N1, N2 bước 2, §5) không được tự triển khai. `NEXT_PLAN.md`, `REVIEW_REPORT.md` và các báo cáo cũ chỉ được đọc, không sửa.

## 1. Tóm tắt

| # | Mục `NEXT_PLAN.md` | Kết quả |
| :-: | :--- | :--- |
| 1 | §3 N3: đổi điểm thất bại sau khi đã thu tiền | ✅ **Đã sửa.** Tái hiện bằng test: API trả 200, giảm 30.000đ, thu tiền, chỉ kèm cảnh báo `Loyalty points could not be deducted: 30` |
| 2 | §2 N2 bước 1: đơn treo trong seed giữ bàn 7 `OCCUPIED` | ✅ **Đã xác nhận**, chưa sửa (bước 2 cần bạn chọn quy tắc) |
| 3 | §4 N5: ghi chú quy ước khoá cấu hình | ✅ Đã thêm vào `.agents/rules/backend-java-constraints.md` |

Backend: **240 → 244** test JUnit, 0 fail, 0 skip. Frontend không bị sửa.

## 2. Bằng chứng đã chạy
Mọi lệnh `mvn` chạy trong `backend-java/`.

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E0 | `mvn -q -B clean test` (baseline) | `EXIT=0`, đếm `TEST-*.xml`: **TOTAL 240, fail 0, err 0, skip 0** |
| E1 | `mvn -q -B test -Dtest=CheckoutHandlerTest` (test mới, **trước khi sửa**) | 1 fail đúng lý do: `pointsThatCannotBeDeductedAreNeitherDiscountedNorCharged`: `expected: <503> but was: <200>`, body có `"discountAmount":30000` và cảnh báo `Loyalty points could not be deducted: 30`. Test `failedCheckoutGivesTheHeldPointsBack` pass, vì là test giữ hành vi cho đường hoàn điểm mới |
| E2 | `mvn -q -B test -Dtest='CheckoutHandlerTest,ServerTest'` (sau khi sửa) | `EXIT=0` |
| E3 | `mvn -B clean test` | `MVN_EXIT=0`, `Tests run: 244, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`. Đếm `TEST-*.xml`: **TOTAL 244, fail 0, err 0, skip 0** |
| E4 | **Kiểm tra đột biến** trên 3 bản sao trong scratchpad, chạy `CheckoutHandlerTest,ServerTest` | **M1** (logic cũ: trừ điểm sau khi thu tiền): fail `pointsThatCannotBeDeducted…` (200 thay vì 503). **M2** (bỏ snapshot): fail `ServerTest.redemptionNeverDiscountsMoreThanTheBill: expected <55> but was <0>`. **M3** (bỏ bước hoàn điểm): fail `failedCheckoutGivesTheHeldPointsBack: expected <30> but was <0>` và `redemptionNeverDiscountsMoreThanTheBill: expected <445> but was <0>`. Cả ba đột biến đều bị bắt |
| E5 | `mvn -q -B test -Dtest='CheckoutHandlerTest,ServerTest#member*+redemption*'` × 3 lần (test có luồng song song) | `EXIT=0` cả 3 lần |
| E6 | Test N2 **chỉ chạy trên bản sao trong scratchpad**: checkout ở bàn 7, hoàn tất đơn, kỳ vọng `CLEANING` | `expected: <CLEANING> but was: <OCCUPIED>`. Nhận định N2 đúng |
| E7 | `graphify update .` | Graph đã cập nhật |

Sau E3 chỉ có tài liệu và rules thay đổi, không sửa code.

**Không chạy:** `npm test`, `tsc`, `npm run build` ở frontend, vì không sửa file frontend nào. Đã đọc code để kiểm hợp đồng API: `lib/api-client.ts:11` xếp `DATABASE_UNAVAILABLE` vào nhóm fail-closed, nên `createOrder` (`actions.ts:409`) trả lỗi cho thu ngân và **không** tạo đơn local. GitHub Actions chưa chạy, vì chưa push.

## 3. Chi tiết thay đổi: N3

**Nguyên nhân:** `CheckoutHandler` gọi `facade.checkout` (thu tiền, lưu đơn, gửi KDS) **rồi mới** `redeemPoints`. Nếu bước trừ điểm thất bại (JDBC lỗi, khách bị xoá), đơn đã có giảm giá và tiền đã thu, nên hệ thống chỉ còn cách thêm một cảnh báo.

**Cách sửa:** giữ điểm trước, hoàn điểm sau, cùng nằm trong khoá `facade` sẵn có:
1. Kiểm số dư (như cũ), rồi `redeemPoints(id, requestedPoints)` **trước** `facade.checkout`. Nếu không giữ được điểm thì trả 503 `DATABASE_UNAVAILABLE` "payment was not taken", và không thu tiền, không ghi đơn, không trừ kho.
2. Strategy tính giảm giá trên **bản chụp** khách lúc đọc. DAO in-memory trả về đối tượng sống, nên nếu không có bản chụp, strategy sẽ thấy số dư đã bị giữ và chỉ dùng 0 điểm (M2 chứng minh điều này).
3. Khối `finally` hoàn `requestedPoints − pointsUsed` qua `restorePoints`: hoàn phần thừa khi checkout thành công, hoàn đủ khi Facade thất bại hoặc ném lỗi. Nếu hoàn điểm thất bại: ghi log `SEVERE` và thêm cảnh báo vào phản hồi.

| File | Thay đổi |
| :--- | :--- |
| `model/Customer.java` | + `restorePoints(int)`: cộng lại điểm, không tính lượt ghé hay doanh số, từ chối số ≤ 0 |
| `dao/ICustomerDao.java` | + `restorePoints(int id, int points)` |
| `dao/InMemoryCustomerDao.java` | Cài đặt dưới `synchronized (customer)`, như `redeemPoints` |
| `dao/JdbcCustomerDao.java` | Cài đặt qua `changeLocked` (`SELECT … FOR UPDATE`), như `redeemPoints` |
| `server/CheckoutHandler.java` | Giữ điểm trước khi gọi Facade, hoàn điểm trong `finally`, thêm `snapshot(Customer)`, thêm `Logger`. Bỏ cảnh báo cũ `Loyalty points could not be deducted` |
| `test/.../server/CheckoutHandlerTest.java` | +2 test: `pointsThatCannotBeDeductedAreNeitherDiscountedNorCharged` (503; số đơn, tồn kho và điểm không đổi), `failedCheckoutGivesTheHeldPointsBack` (11 ly với tồn 10, trả 409, điểm còn đủ 30). `SnapshotCustomerDao` có thêm cờ `failRedeem` |
| `test/.../dao/DaoLayerTest.java` | +1 test `testRestorePoints` (in-memory) |
| `test/.../dao/JdbcIntegrationTest.java` | +1 test `restoringPointsGivesThemBackWithoutCountingAVisit` (PostgreSQL nhúng) |

## 4. Tài liệu
- `docs/API_SPEC.md`: §3 checkout, đổi "trừ sau khi thanh toán thành công" thành quy tắc giữ điểm trước rồi hoàn lại. Bảng mã lỗi 503 thêm trường hợp "không trừ được điểm".
- `docs/DESIGN_PATTERNS_SPEC.md` (mục Facade, client `CheckoutHandler`): mô tả thứ tự mới. Số test 244.
- `README.md`, `docs/TESTING.md`: 240 → 244, mô tả các test mới.
- `.agents/rules/backend-java-constraints.md` (N5): code nào đọc từ 2 thông số cấu hình trở lên cần chúng khớp nhau thì phải giữ `synchronized (config)`.

## 5. Chưa làm và lý do
| Mục | Lý do |
| :--- | :--- |
| N1: ô "Tiền khách đưa" ở POS | `NEXT_PLAN.md` §1 yêu cầu bạn chọn trước: ô này bắt buộc hay tuỳ chọn |
| N2 bước 2: sửa quy tắc bàn | Đã xác nhận lỗi (E6). Cần bạn chọn (a) chỉ tính đơn đã trả tiền, (b) chỉ tính đơn trong N giờ, (c) bỏ đơn treo khỏi seed. Lưu ý: đơn `PENDING`/`UNPAID` ở bàn có thể là khách đang ngồi chưa trả tiền, nên (a) có thể làm bàn sang `CLEANING` khi khách vẫn còn ngồi |
| F7/N6 (ngôn ngữ thông báo), `min` cho ô ngày | Cần bạn chọn ngôn ngữ; việc ở frontend |
| `docs/DEVELOPMENT_PLAN.md` (F8) | File chưa được theo dõi, đang chờ bạn quyết định giữ hay bỏ |
| `NEXT_PLAN.md` §5 | Đều là quyết định thiết kế hoặc nghiệp vụ |

## 6. Cần bạn xem xét
1. **Phản hồi API thay đổi:** nếu không trừ được điểm, checkout giờ trả **503** thay vì 200 kèm cảnh báo. Frontend đã xử lý 503 theo kiểu fail-closed nên không cần sửa. Cảnh báo cũ `Loyalty points could not be deducted` không còn; thay vào đó có thể xuất hiện `Unused loyalty points could not be given back: N` (rất hiếm, chỉ khi bước hoàn điểm lỗi ngay sau một lần giữ điểm thành công).
2. **Đánh đổi:** nếu bước hoàn điểm lỗi, khách mất phần điểm chưa dùng (đã ghi log `SEVERE` để đối soát). Cách cũ thì quán mất số tiền đã giảm. Hai trường hợp đều cần CSDL lỗi giữa chừng.
3. **Giao diện `ICustomerDao` có thêm phương thức.** Hai lớp cài đặt trong repo đã được cập nhật. Không có lớp cài đặt nào khác ngoài các lớp test kế thừa `InMemoryCustomerDao`.
4. **Commit gợi ý** (không thêm `Co-Authored-By`): một commit riêng cho N3, gồm `Customer`, `ICustomerDao`, `InMemoryCustomerDao`, `JdbcCustomerDao`, `CheckoutHandler` và ba file test. Lưu ý `JdbcCustomerDao`, `InMemoryCustomerDao`, `CheckoutHandler`, `CheckoutHandlerTest`, `DaoLayerTest`, `JdbcIntegrationTest` đã có thay đổi chưa commit của các phiên trước (nhóm 1 trong `NEXT_PLAN.md` §0), nên cần commit nhóm đó trước hoặc dùng `git add -p`.

## 7. Xem diff
```bash
git diff -- backend-java/src/main/java/com/dalatcafe/server/CheckoutHandler.java \
            backend-java/src/main/java/com/dalatcafe/model/Customer.java \
            backend-java/src/main/java/com/dalatcafe/dao/ \
            backend-java/src/test/java/com/dalatcafe/server/CheckoutHandlerTest.java \
            backend-java/src/test/java/com/dalatcafe/dao/ \
            docs/API_SPEC.md docs/DESIGN_PATTERNS_SPEC.md docs/TESTING.md README.md .agents/rules/
```

---

## 8. Vòng 2 (theo yêu cầu "làm lần lượt")
Quyết định của bạn: N2 giữ quy tắc, N1 ô tiền khách đưa **tuỳ chọn**, commit và push. Bước commit/push **đang tạm dừng** (mục 8.4).

### 8.1. N2: giữ quy tắc, khẳng định bằng test
- Seed đặt bàn 7 ở `OCCUPIED` với 4 khách, và `AC-0052-C3D` là hoá đơn mở của chính bàn đó. Vì vậy hành vi hiện tại là đúng; code không đổi.
- + `ServerTest.anUnpaidOpenTabKeepsTheTableSeated`: hoàn tất một đơn khác ở bàn 7 thì bàn vẫn `OCCUPIED`; thu tiền và hoàn tất `AC-0052-C3D` thì bàn sang `CLEANING`. Đột biến "chỉ tính đơn đã trả tiền" làm test fail (`expected <OCCUPIED> but was <CLEANING>`).
- `DESIGN_PATTERNS_SPEC.md` (mục Observer): ghi rõ quy tắc cố ý tính cả hoá đơn mở chưa thanh toán.

### 8.2. N1: ô "Tiền khách đưa" (tuỳ chọn)
| File | Thay đổi |
| :--- | :--- |
| `components/admin/pos-terminal.tsx` | Khi chọn tiền mặt thì hiện ô "Tiền khách đưa" (để trống được), dòng "Tiền thối"/"Còn thiếu"; khoá "Thanh toán & In" khi số tiền đã nhập thiếu so với tổng; gửi `tenderedAmount` |
| `app/admin/actions.ts` | `NewOrderInput.tenderedAmount` (kiểm số hữu hạn, 0 đến 1 tỷ); chỉ giữ khi tiền mặt và trả ngay; chuyển sang Java; bản lưu DB cục bộ trả lỗi khi thiếu tiền (trả về chứ không ném, vì ném sẽ rơi xuống mock store); thông báo có "Change due" |
| `lib/api-client.ts` | `CheckoutPayload.tenderedAmount`, `CheckoutReceipt.changeDue` (Java vốn đã trả trường này) |
| `lib/db/mock-store.ts` | `cashTenderError()` dùng chung; `createMockOrder` kiểm tiền trước rồi mới trừ kho (trước đây trừ kho ngay trong vòng lặp) |
| `scripts/test-ui-ux.mjs` | + `TC-ACT-11`: thiếu tiền thì từ chối, không ghi đơn, không trừ kho; đủ tiền thì nhận; thẻ bỏ qua số tiền đưa |
- Backend và `PosCheckoutFacade` không đổi: Java vốn đã từ chối tiền mặt thiếu khi có `tenderedAmount`.
- Tổng tiền ở POS là số tạm tính. Java vẫn là bên quyết định: nếu Java tính tổng cao hơn, nó trả 400 và không thu tiền.

### 8.3. Bằng chứng
| Lệnh | Kết quả |
| :--- | :--- |
| `npx tsc --noEmit -p .` | `TSC_EXIT=0` |
| `npm test` | `NPM_EXIT=0`, **39/39 PASS** (38 + TC-ACT-11) |
| Đột biến `cashTenderError` luôn trả `null` (sao lưu, chạy `tsx`, khôi phục, `cmp` khớp) | Đơn thiếu tiền được ghi và kho bị trừ, tức là TC-ACT-11 bắt được |
| `mvn -q -B test -Dtest='ServerTest#anUnpaidOpenTab*'` | `EXIT=0` |
| `mvn -B clean test` trong `backend-java/` | **Hỏng do môi trường**: lần 1 `NoClassDefFoundError` (118 test, 63 err), lần 2 `Failed to delete …\target`. Nguyên nhân: một phiên Claude khác ("NIGHTLY FIXER", PID 4320) chạy `mvn -B clean test` cùng lúc trên cùng thư mục |
| `mvn -q -B clean test` trên **bản sao cô lập** trong scratchpad | `MVN_EXIT=0`, **TOTAL 247, fail 0, err 0, skip 0**: 245 của phiên này + 2 test trong `JdbcDatabaseTest.java` của phiên kia |

Tài liệu đã cập nhật: README (245 JUnit, 39 UI), `docs/TESTING.md`, `docs/DESIGN_PATTERNS_SPEC.md`, `docs/API_SPEC.md` (dòng `tenderedAmount` không còn ghi "POS hiện không gửi"), `docs/PROJECT_MANAGEMENT.md` (`FEAT-POS-02` cột tích hợp 🟢), `.github/workflows/ci.yml` (tên bước "39 Tests").

### 8.4. Tạm dừng commit/push: chờ bạn
- Phiên kia đang sửa cùng working tree: `backend-java/src/main/java/com/dalatcafe/dao/JdbcDatabase.java` và file mới `backend-java/src/test/java/com/dalatcafe/dao/JdbcDatabaseTest.java`, không phải của phiên này. Nó có thể còn sửa các tài liệu chung.
- Bạn đã chọn chờ phiên kia xong. Khi đó, bảo tôi "commit": tôi sẽ chạy lại `mvn -B clean test` và `npm test`, chỉnh số test trong tài liệu theo số đo thực tế (README đang ghi 245, chưa tính 2 test của phiên kia), rồi tách commit theo `NEXT_PLAN.md` §0 cộng commit N3, N2, N1, và push `feature/hoai-bo`.

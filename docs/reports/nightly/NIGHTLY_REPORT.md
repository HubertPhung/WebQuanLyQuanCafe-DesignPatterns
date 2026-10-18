# NIGHTLY REPORT: phiên tự động 2026-10-18 (nhánh `feature/hoai-bo`)

- HEAD: `67e5253`. **Chưa commit, push hay mở PR.** Mọi thay đổi nằm trong working tree, chồng lên các thay đổi chưa commit của phiên trước (đã được `REVIEW_REPORT.md` review). Không file nào của phiên trước bị ghi đè hay hoàn tác.
- Đầu vào: `NEXT_PLAN.md`, các mục P1, P2 và một phần P3.
- Vị trí báo cáo: workspace không cấu hình nơi đặt, nên báo cáo được ghi ở thư mục gốc, cạnh `REVIEW_REPORT.md`.
- Trong phiên có ba file chưa được theo dõi xuất hiện mà phiên này không tạo: `AUDIT_PLAN.md`, `BUSINESS_AUDIT.md`, `PATTERN_AUDIT.md`. Phiên này không đọc, không sửa ba file đó.

## 1. Tóm tắt

| # | Việc | Kết quả |
| :--- | :--- | :--- |
| 1 | **[P1] F1: race điểm thành viên** giữa `/api/orders/{code}/pay` và `/api/checkout` | ✅ Đã sửa ở tầng DAO. Có test tái hiện, test fail trên code cũ (3/3 lần chạy), pass sau khi sửa |
| 2 | **[P2] F2: sự kiện *paid* phát ngoài khoá** | ✅ Đã sửa phần có hậu quả thật (xem 3.2). Có test tái hiện, test fail trước khi sửa |
| 3 | **[P2] F3, F4: fallback đặt bàn cục bộ** không theo quy tắc Java, trần 20 khách cố định | ✅ Đã sửa. Có test UI tái hiện, test fail trước khi sửa |
| 4 | [P3] F5: ghi chú khoá chỉ có hiệu lực trong một JVM | ✅ Đã thêm vào `docs/DESIGN_PATTERNS_SPEC.md` (mục Chain) |
| 5 | Cập nhật số test trong tài liệu | ✅ 213 → **217** JUnit, 37 → **38** UI, theo số đo thực tế |

## 2. Bằng chứng đã chạy

| # | Lệnh | Kết quả |
| :--- | :--- | :--- |
| E1 | `mvn -q test -Dtest=DaoLayerTest,JdbcIntegrationTest` (test mới, **trước khi sửa**) | 2 fail: in-memory `expected <80000> but was <86967>`, JDBC `expected <100> but was <101>` |
| E2 | **Kiểm tra đột biến**: chép `backend-java` sang scratchpad, khôi phục `InMemoryCustomerDao` và `JdbcCustomerDao` về `HEAD`, chạy 3 lần | Cả 3 lần, cả 2 test đều fail: in-memory `90126`, `84116`, `89126` (kỳ vọng `80000`); JDBC `143`, `235`, `192` (kỳ vọng `200`) |
| E3 | Cùng lệnh E1, **sau khi sửa** | `EXIT=0` |
| E4 | `mvn -q test -Dtest=OrderHandlerTest` (test mới, **trước khi sửa** `pay`) | `expected: <CLEANING> but was: <OCCUPIED>` |
| E5 | Cùng lệnh E4, **sau khi sửa** | `EXIT=0` |
| E6 | `npx tsx` chạy kịch bản TC-ACT-10 trên `mock-store.ts` **trước khi sửa** | Fallback nhận cả 4 phiếu, kể cả phiếu trùng slot, phiếu 23:30 và phiếu đã qua → `FAIL` |
| E7 | Cùng kịch bản, **sau khi sửa** | `PASS` |
| E8 | `cd backend-java && mvn -B clean test` | `Tests run: 217, Failures: 0, Errors: 0, Skipped: 0`. Đếm `TEST-*.xml`: **TOTAL 217, fail 0, err 0, skip 0** |
| E9 | `cd frontend-nextjs && npx tsc --noEmit -p .` | `EXIT=0` |
| E10 | `cd frontend-nextjs && npm test` (tự khởi động `next dev`, Java không chạy) | **38/38 PASS**, gồm `TC-ACT-10` |
| E11 | `mvn -B clean test` lần cuối, sau mọi thay đổi | `MVN_EXIT=0`, `Tests run: 217, Failures: 0, Errors: 0, Skipped: 0` |
| E12 | `cd frontend-nextjs && npm run build` | `BUILD_EXIT=0` (Next.js build thành công, gồm `/admin/reservations`) |
| E13 | `graphify update .` | Graph đã cập nhật |

## 3. Chi tiết thay đổi

### 3.1. F1: điểm thành viên bị ghi đè (P1)
**Nguyên nhân gốc:** cả hai DAO đều đọc, sửa rồi ghi lại cả dòng khách hàng.
- JDBC: `findById` rồi `save` ghi giá trị tuyệt đối `loyalty_points = EXCLUDED.loyalty_points`.
- In-memory: `+=` và `-=` trên cùng một đối tượng `Customer` mà không có khoá.

Khoá `synchronized (facade)` ở `CheckoutHandler` không che được `/pay`, vì `/pay` cộng điểm ngoài khoá đó. Sửa ở DAO thì bịt được mọi nơi gọi, không cần một khoá chung giữa hai handler.

| File | Thay đổi |
| :--- | :--- |
| `backend-java/.../dao/JdbcCustomerDao.java` | `addOrderRecord` và `redeemPoints` dùng chung `changeLocked`: mở transaction, `SELECT ... FOR UPDATE`, áp logic có sẵn của `Customer` (`addOrderRecord` / `redeemPoints`, giữ nguyên quy tắc xếp hạng), ghi lại **chỉ các cột bộ đếm** rồi commit. Đổi quá số dư thì trả `false`, và pool tự rollback khi nhận lại kết nối (`JdbcDatabase.release`). Sửa hồ sơ (tên, SĐT) chạy cùng lúc không còn bị ghi đè |
| `backend-java/.../dao/InMemoryCustomerDao.java` | `synchronized (customer)` quanh hai thao tác đổi điểm |
| `backend-java/.../server/CheckoutHandler.java` | Sửa chú thích cho khớp với điều code thực sự đảm bảo |
| `backend-java/src/test/.../dao/Concurrently.java` (mới) | Tiện ích test: cho mọi tác vụ bắt đầu cùng lúc |
| `backend-java/src/test/.../dao/DaoLayerTest.java` | +1 test: 4 luồng cộng điểm và 4 luồng đổi điểm, mỗi luồng 20.000 lần, trên một khách. Số dư cuối và số đơn phải đúng |
| `backend-java/src/test/.../dao/JdbcIntegrationTest.java` | +2 test trên PostgreSQL nhúng: cộng và đổi điểm đồng thời trên một dòng; đổi quá số dư, đổi 0 điểm hoặc khách không tồn tại thì không đổi gì, hạng vẫn theo tổng chi tiêu |

### 3.2. F2: thứ tự sự kiện *paid* (P2)
**Đánh giá lại F2.** Kịch bản "huỷ chen giữa lúc lưu đơn và lúc phát *paid*" trong `REVIEW_REPORT.md` không tạo ra trạng thái nào khác với "trả tiền xong rồi mới huỷ". Lý do: huỷ một đơn đã trả tiền hiện chỉ đặt `REFUNDED`, không trả lại điểm, không trả bàn và cũng không phát sự kiện nào (xem mục 5).

Kịch bản có hậu quả thật là **hoàn tất chen vào giữa**. `pay` nhả khoá, KDS chuyển đơn sang `completed` và bàn về `CLEANING`. Sau đó sự kiện *paid* đến muộn lại đặt bàn về `OCCUPIED`, nên bàn kẹt ở trạng thái có khách sau khi đơn đã xong. Test E4 tái hiện được kịch bản này.

| File | Thay đổi |
| :--- | :--- |
| `backend-java/.../server/OrderHandler.java` | `notifyOrderPaid` và phần cộng điểm chạy **bên trong** `synchronized (this)` của `pay()` (phương án A trong NEXT_PLAN). Lỗi observer vẫn chỉ thành cảnh báo |
| `backend-java/src/test/.../server/OrderHandlerTest.java` | +1 test: observer giả giữ sự kiện *paid* cho tới khi sự kiện *completed* đến (tối đa 500 ms). Sau khi cả hai xong, bàn phải ở `CLEANING` |

Đánh đổi: observer chạy trong khoá, nên một lệnh `PATCH /status` phải chờ observer của lệnh `/pay` đang chạy. Các observer hiện có đều ngắn (ghi bàn, in phiếu KDS, cộng điểm).

### 3.3. F3, F4: fallback đặt bàn cục bộ (P2)
| File | Thay đổi |
| :--- | :--- |
| `frontend-nextjs/lib/reservation-rules.ts` (mới) | Hằng số dùng chung, mỗi hằng có chú thích chỉ tới hằng Java tương ứng: 15 phút (`PAST_GRACE`), slot 2 giờ (`DEFAULT_DURATION`), 07:00–22:00 và 20 khách (`SystemConfigManager.DEFAULT_*`). Có thêm các hàm kiểm tra thuần |
| `frontend-nextjs/lib/db/mock-store.ts` | `createMockReservation` kiểm tra thêm: thời điểm đã qua, giờ mở cửa (giờ Đà Lạt, gồm hai biên), trần khách mặc định, trùng khung 2 giờ cùng bàn (bỏ qua phiếu `Đã hủy`). Thông báo lỗi giống hệt bản Java (tiếng Việt) |
| `frontend-nextjs/app/admin/actions.ts` | Bỏ trần `20` cố định trước khi gọi Java, vì Java tự kiểm tra theo `maxReservationGuests` đang cấu hình. Dùng `hasReservationTimePassed` chung. Sửa chú thích từng hứa quá mức (F3) |
| `frontend-nextjs/app/admin/reservations/page.tsx`, `components/admin/reservations-management.tsx` | Ô "Số khách" lấy `max` từ `GET /api/config`. Khi Java tắt thì dùng mặc định 20, khớp với fallback |
| `frontend-nextjs/scripts/test-ui-ux.mjs` | +`TC-ACT-10`: phiếu trùng slot, phiếu 23:30 và phiếu đã qua bị từ chối; huỷ phiếu thì giải phóng slot |

**Giới hạn còn lại:** fallback chỉ chạy khi Java không liên lạc được, nên không đọc được cấu hình mà admin đã đổi trong Java và dùng giá trị mặc định. Nếu admin đổi giờ mở cửa hoặc trần khách trong Java, fallback có thể lệch tới khi Java chạy lại. Điều này đã ghi trong chú thích của `reservation-rules.ts`.

### 3.4. Tài liệu
- `docs/TESTING.md`: số test, mô tả các test đồng thời mới, dòng `TC-ACT-10`.
- `docs/DESIGN_PATTERNS_SPEC.md`: Observer (*paid* phát trong khoá; DAO đổi điểm nguyên tử), Chain (khoá chỉ đúng với một tiến trình backend), số test.
- `README.md`: badge và lệnh test (217 JUnit, 38 UI).
- `.github/workflows/ci.yml`: **chỉ đổi nhãn bước** từ "(37 Tests)" thành "(38 Tests)". Lệnh chạy không đổi.

## 4. Chưa làm và lý do
| Mục | Lý do |
| :--- | :--- |
| F7: `min` cho ô ngày ở form đặt bàn | Nếu tính "hôm nay" ở client component, server và client có thể lệch ngày quanh nửa đêm (lỗi hydration). Cần chọn cách tính (server truyền xuống, hay chỉ đặt trên client sau khi mount). Tách riêng cho gọn |
| F7: thống nhất ngôn ngữ thông báo lỗi | Code hiện dùng tiếng Anh cho lỗi frontend, theo quy ước có sẵn trong `actions.ts`. Đổi toàn bộ là quyết định về quy ước, nên để người dùng chọn. Lỗi mới của fallback dùng đúng câu tiếng Việt của Java |
| F8: số liệu cũ trong `docs/DEVELOPMENT_PLAN.md` | File chưa được theo dõi, do phiên trước tạo, và đang chờ người dùng duyệt. Không sửa |
| NEXT_PLAN mục 5 (State/Template Method, storefront đọc menu Java, scheduler tự huỷ) | Cần người dùng quyết định |
| Kiểm thử thủ công hoặc E2E trên trình duyệt | Theo quy ước của người dùng: dựa vào JUnit, bộ test UI và CI, không chạy kiểm thử trình duyệt tốn token |
| GitHub Actions trên các thay đổi này | Chưa push, nên CI chưa chạy |

## 5. Cần người dùng xem xét
1. **Huỷ một đơn đã trả tiền** (`REFUNDED`) hiện **không** thu hồi điểm đã cộng, không trả bàn và không phát sự kiện nào. Đây là quy tắc nghiệp vụ, không phải race, nên chưa tự sửa. Nếu muốn thu hồi, cần thêm sự kiện `onOrderRefunded` và chốt cách xử lý khi số điểm đã bị tiêu hết.
2. `InMemoryCustomerDao.save` thay hẳn đối tượng trong map. Nếu admin sửa hồ sơ khách đúng lúc khách đang được cộng điểm, phần điểm vừa cộng có thể mất (chỉ ở chế độ in-memory). Phần này nằm ngoài phạm vi F1 và hiện chưa có endpoint nào ghi `save` cho khách có sẵn.
3. Các khoá `synchronized` vẫn chỉ có hiệu lực khi chạy một tiến trình backend. Riêng khoá dòng `FOR UPDATE` của JDBC thì có hiệu lực cả khi chạy nhiều tiến trình.
4. Commit: theo quy tắc của bạn, không thêm dòng `Co-Authored-By`. Khi commit, nên tách các thay đổi của phiên trước và phiên này nếu bạn muốn lịch sử rõ ràng.

## 6. Xem diff
```bash
git status --short
git diff -- backend-java/src/main/java/com/dalatcafe/dao/ backend-java/src/main/java/com/dalatcafe/server/OrderHandler.java
git diff -- frontend-nextjs/
git diff --no-index /dev/null frontend-nextjs/lib/reservation-rules.ts
git diff --no-index /dev/null backend-java/src/test/java/com/dalatcafe/dao/Concurrently.java
```

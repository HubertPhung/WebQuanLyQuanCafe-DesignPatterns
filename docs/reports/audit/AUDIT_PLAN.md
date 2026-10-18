# AUDIT PLAN — Kế hoạch khắc phục & kiểm chứng

**Ngày:** 18/10/2026 · **Đầu vào:** [BUSINESS_AUDIT.md](BUSINESS_AUDIT.md) (BR-xx), [PATTERN_AUDIT.md](PATTERN_AUDIT.md) (PT-xx)
**Nguyên tắc:** người kiểm toán không sửa code. Kế hoạch này nêu *việc cần làm*, *tiêu chí chấp nhận* và *test bắt buộc* để từng phát hiện có thể đóng lại bằng bằng chứng, không đóng bằng lời khẳng định.

---

## 0. Điều kiện trước khi bắt đầu

1. **Chốt baseline.** Cây làm việc đang có khoảng 20 file sửa và nhiều file chưa track, **và vẫn đang bị một tiến trình khác sửa trong lúc kiểm toán** (BUSINESS_AUDIT §0). Dừng mọi chỉnh sửa song song trước khi đánh giá lại. Commit hoặc stash chúng, chạy lại `mvn clean test` (hiện 213/213 pass) và để CI chạy trên đúng baseline đó. Chưa có baseline này thì mọi kết quả "đã sửa" đều không so sánh được.
2. **Biến probe thành test hồi quy.** Mỗi phát hiện đã tái hiện (P1–P9, `ObserverRaceProbe`, `ObserverAbortProbe`) phải trở thành một test JUnit **đỏ trước, xanh sau**. Kịch bản đầy đủ có trong BUSINESS_AUDIT §3.

---

## 1. Đợt 1: Cao (an toàn tiền & dữ liệu khách)

| # | Phát hiện | Việc cần làm | Tiêu chí chấp nhận | Test bắt buộc |
| :-: | :--- | :--- | :--- | :--- |
| 1 | BR-01 / PT-05 | Không tin giá từ client: `preOrders` phải tham chiếu `menuItemId`, giá lấy từ menu khi tạo phiếu hoặc khi Adapter chuyển đổi. Giữ `menuItemId` để trừ kho khi thanh toán | Gửi `price: 0` không làm đổi giá. Đơn chuyển từ phiếu có `menuItemId` khác null. Thanh toán đơn đó trừ tồn kho | `ServerTest`: tạo phiếu với giá giả → transfer → pay → `total` bằng giá menu và tồn kho giảm |
| 2 | BR-02 / PT-09 | Bỏ việc gắn observer theo request lên subject dùng chung. Đơn mang định danh khách (`customerId`), và **một** `LoyaltyPointObserver` dùng chung đọc khách từ đơn. Ngoài ra, mọi đường phát sự kiện dùng chung một chiến lược đồng bộ | Chạy lại `ObserverRaceProbe`: điểm của hội viên chỉ tăng đúng theo đơn của họ (+4 điểm, +43.740đ) | Chuyển `ObserverRaceProbe` thành test trong `CheckoutHandlerTest` (DAO tạm dừng lúc `save`, `/pay` chạy song song) |
| 3 | BR-03 | Định nghĩa sự kiện **huỷ/hoàn tiền** (`onOrderCancelled` hoặc tương đương): đảo điểm tích, trả lại điểm đã đổi, giảm `totalSpent`/`totalOrders` rồi tính lại hạng, hoàn kho, giải phóng bàn. Bổ sung thao tác hoàn tiền vào `IPaymentProcessor` (vẫn có thể mô phỏng) | Sau probe P2: điểm 60, chi tiêu 600.000, đơn 1, kho 85, bàn 5 khác OCCUPIED | Mở rộng `ServerTest.ordersCannotMoveBackwardsAndCancellingPaidOrderRefundsIt` để kiểm cả 5 hệ quả trên |
| 4 | BR-04 / PT-10 | (a) `OrderEventSubject` cô lập lỗi theo từng observer và gom thành danh sách cảnh báo. (b) `CheckoutHandler` kiểm bàn tồn tại **trước** khi thu tiền (404) | `ObserverAbortProbe`: KDS có 1 phiếu, hội viên được +điểm. Checkout `tableId: 999` → 404, không có giao dịch | `ObserverTest`: observer đầu ném lỗi, observer sau vẫn chạy. `ServerTest`: bàn không tồn tại → 404 |

**Cổng ra Đợt 1:** `mvn clean test` xanh, 4 nhóm test mới xanh, các probe trong BUSINESS_AUDIT chạy lại cho kết quả đúng kỳ vọng. Kết quả chạy lại phải được ghi vào báo cáo kèm output.

---

## 2. Đợt 2: Trung bình

| # | Phát hiện | Việc cần làm | Tiêu chí / test |
| :-: | :--- | :--- | :--- |
| 5 | BR-05 / PT-11 | Chỉ chuyển bàn sang CLEANING khi bàn không còn đơn mở (`IOrderDao.findByTableId`) | Probe P5: bàn 6 vẫn OCCUPIED khi đơn thứ hai còn PENDING |
| 6 | BR-06 | Tiền mặt: `tenderedAmount` bắt buộc và phải ≥ `finalTotal` (hoặc quy tắc khác do nghiệp vụ chốt) | Probe P3 → 400 |
| 7 | BR-07 / PT-03 | Mang `menuItemId` qua Builder (ví dụ `IBeverage` hoặc `addItem` nhận thêm id món). Analytics gom theo id | Đơn checkout có `menuItemId`. `topItems` gộp các biến thể size/topping |
| 8 | BR-08 / PT-03 | Tăng entropy mã đơn hoặc kiểm trùng (thử lại khi trùng) trước khi thu tiền | Test: Builder sinh mã trùng (tiêm generator) → checkout vẫn thành công, không có lần thu tiền thừa |
| 9 | BR-09 | Giới hạn tần suất `POST /api/reservations`. Cài tác vụ tự huỷ phiếu PENDING quá `autoCancelMinutes` (khi đó tham số này mới có tác dụng, BR-18) | Test: phiếu PENDING quá hạn không còn chặn slot |
| 10 | BR-10 | Thống nhất chính sách giảm giá giữa `/checkout` và `/pay` (cùng một Strategy) | Probe P9: VIP được giảm 15% ở `/pay`, hoặc tài liệu ghi rõ là không |
| 11 | BR-11 / PT-06 | DAO `updateStock` **từ chối** khi không đủ hàng (JDBC: `UPDATE … WHERE stock_qty >= ?`). Mọi đường ghi kho dùng cùng một cơ chế nguyên tử | Test đồng thời: N checkout song song với kho K < N → đúng K đơn thành công, kho = 0, không âm, không phình |
| 12 | BR-12 | Đã có bản sửa chưa commit (`changeLocked` + `FOR UPDATE`, xuất hiện trong lúc kiểm toán). Việc còn lại: commit và chứng minh bằng test | `JdbcIntegrationTest`: 2 luồng cộng/trừ điểm song song không mất cập nhật, chạy xanh trên CI |
| 13 | BR-13 | Đơn offline mang SĐT hội viên; `/api/orders/sync` tích điểm khi khớp | Test sync có `customerPhone` → khách +điểm đúng một lần (idempotent) |
| 14 | PT-01 | Bảo vệ trạng thái Singleton: đọc và ghi dưới cùng khoá, hoặc thay toàn bộ cấu hình bằng một snapshot bất biến (`volatile`) | Review code. Test đọc cặp giờ mở/đóng luôn nhất quán khi chạy đồng thời với `PUT /api/config` |
| 15 | PT-02 | Chọn một trong hai: (a) cài đúng GoF Factory Method (Creator trừu tượng, mỗi kênh một Creator con), hoặc (b) đổi tên thành Simple Factory trong spec và luật dự án. Gom `validate` trùng lặp vào một chỗ | Spec và code dùng cùng một tên gọi. Không còn hàm `validate` lặp lại |

---

## 3. Đợt 3: Thấp & đồng bộ tài liệu

- **BR-14:** từ chối `guests ≤ 0` ở handler (400) thay vì ép về 1. Cần cập nhật DESIGN_PATTERNS_SPEC §3.8 nếu đổi.
- **BR-15:** chốt nghiệp vụ: phiếu có phải kết thúc trước giờ đóng cửa không. Spec hiện cố ý không chặn.
- **BR-16:** `transfer-pos` kiểm khung giờ (ví dụ ±60 phút) và trạng thái bàn.
- **BR-17:** đồng bộ voucher storefront với `VoucherCatalog` (cùng trần 50.000đ), hoặc ghi rõ là dữ liệu demo.
- **BR-19:** State Pattern cho bàn (spec §4.1) hoặc bảng chuyển trạng thái tối thiểu.
- **BR-20:** ghi nhận giao dịch cần huỷ vào hàng đợi đối soát.
- **PT-03:** sửa `Order.equals/hashCode` cho đúng hợp đồng (khoá theo `orderCode`).
- **PT-07:** ghi chú hoặc tách `PointRedemptionDiscountStrategy` (có trạng thái) và đưa lớp này vào sơ đồ. Xem lại sự cần thiết của `FixedAmountDiscountStrategy`.
- **Tài liệu:** sửa tên lớp trong `.agents/rules/backend-java-constraints.md:12-13`; câu "nơi duy nhất gọi Factory" (`DESIGN_PATTERNS_SPEC.md:260`); cây test (`:137-141`); mâu thuẫn "Pending → Completed" giữa spec §4.1 và API_SPEC §3.9.

---

## 4. Kiểm chứng còn thiếu (CHƯA) cần làm trước khi kết luận cuối

| Hạng mục | Cách kiểm | Ai / khi nào |
| :--- | :--- | :--- |
| BR-04 nhánh FK trên PostgreSQL | Test JDBC: checkout `tableId` không tồn tại ở chế độ JDBC, quan sát `PERSISTENCE_FAILED` sau khi thu tiền | Đợt 1, cùng mục 4 |
| BR-08, BR-12 trên PostgreSQL | Thêm vào `JdbcIntegrationTest` (embedded-postgres đã có sẵn trong `pom.xml`) | Đợt 2 |
| BR-11 race kho | Test đồng thời với `ExecutorService`, giống `ReservationHandlerTest` | Đợt 2 |
| Frontend (BR-13, BR-17, storefront checkout, Mock Store) | Chạy `npm test` trên CI. Đọc thêm `app/checkout/page.tsx`, `lib/db/mock-store.ts` | Kiểm toán vòng 2 |
| Thay đổi chưa commit | CI chạy trên baseline mới (mục 0.1) | Trước Đợt 1 |

## 5. Tiêu chí đóng kiểm toán
- Mọi phát hiện mức Cao và Trung bình đều có test hồi quy, và test đó xanh trên CI.
- Các probe trong BUSINESS_AUDIT chạy lại cho kết quả đúng tiêu chí ở bảng trên, kèm output.
- Spec, luật dự án và code dùng cùng tên gọi pattern và cùng quy tắc nghiệp vụ.
- Các mục ở §4 đã chuyển từ CHƯA sang ĐẠT hoặc KHÔNG ĐẠT, kèm bằng chứng.

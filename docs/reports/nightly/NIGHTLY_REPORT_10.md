# Phiên 10: Quản lý voucher và giờ kết thúc khi đặt bàn

Ngày 2026-10-29 · Nhánh `feature/voucher-reservation-time` (worktree `wt-voucher`, tách từ `251fdcd`) · Chưa push.

- Thiết kế: [specs/2026-10-29-voucher-va-gio-dat-ban-design.md](../../superpowers/specs/2026-10-29-voucher-va-gio-dat-ban-design.md)
- Kế hoạch: [voucher](../../superpowers/plans/2026-10-29-voucher-management.md), [giờ đặt bàn](../../superpowers/plans/2026-10-29-reservation-end-time.md)

## 1. Đã làm

### Voucher

- **Dữ liệu và DAO.** Voucher chuyển từ danh sách viết cứng (`VoucherCatalog`, `lib/storefront/vouchers.ts`) sang các bảng `vouchers` và `voucher_usages`, có DAO in-memory và DAO JDBC. `WELCOME10` được seed với cấu hình: không giới hạn tổng, mỗi tài khoản 1 lần, chỉ cho đơn online đầu tiên.
- **`VoucherService`.** Kiểm tra mã và dựng Strategy giảm giá có sẵn (`PercentageDiscountStrategy`, `FixedAmountDiscountStrategy`). Các điều kiện kiểm tra:
  - mã có tồn tại, đã bật chưa, còn trong ngày áp dụng không (theo giờ Việt Nam);
  - còn lượt tổng, tài khoản này còn lượt không;
  - có phải đơn online đầu tiên không (nếu mã yêu cầu);
  - đơn đã đạt mức tối thiểu chưa, kèm số tiền còn thiếu.
- **Giữ lượt an toàn khi chạy đồng thời.** JDBC dùng `SELECT … FOR UPDATE` trong một transaction; in-memory dùng `synchronized`.
- **API `/api/vouchers`.**
  - CRUD cần MANAGER; `GET …/{id}/usages` cho biết ai đã dùng mã.
  - `GET /active` công khai.
  - `POST /validate` trả `reason` và `shortfall`.
  - `POST /redeem` và `/release` chỉ nhận service key của storefront.
- **Checkout trả trước.** Giữ lượt trước khi thu tiền và ghi `voucher_code` vào đơn. Checkout thất bại thì trả lượt.
- **Đơn COD.** Next.js giữ lượt ngay lúc khách đặt. Khi đơn được đồng bộ, Java áp đúng số tiền giảm đã giữ.
- **Hủy đơn.** Observer mới `VoucherReleaseObserver` trả lượt khi đơn bị hủy. Hủy lần hai không trả thêm lượt.
- **Storefront.** Lấy danh sách mã từ Java. Java không truy cập được thì từ chối mọi mã.
- **Trang admin `/admin/vouchers`.** Bảng danh sách; dialog thêm/sửa; xóa (mã đã có người dùng thì chỉ tắt); xem ai đã dùng mã.

### Giờ đặt bàn

- **Model và lưu trữ.** `Reservation` có thêm `endTime` (cột `end_time`). Phiếu cũ chưa có giá trị này được tính là giờ bắt đầu + 2 giờ.
- **Chuỗi kiểm tra.** Giờ kết thúc phải cùng ngày, sau giờ bắt đầu ít nhất 30 phút và không quá giờ đóng cửa. Chồng lịch được tính theo khoảng nửa mở `[bắt đầu, kết thúc)`, nên hai phiếu nối tiếp nhau đều được nhận.
- **API.** POST và PUT nhận `endTime`:
  - POST thiếu `endTime`: mặc định giờ bắt đầu + 2 giờ, cắt về giờ đóng cửa.
  - PUT thiếu `endTime`: giữ nguyên thời lượng cũ.
  - `/api/tables/catalog` nhận thêm tham số `endTime`.
- **Tự hủy.** Phiếu chưa nhận bàn tự hủy sau 30 phút (trước là 15). Giá trị 15 đã lưu trong cấu hình không còn tác dụng.
- **Giao diện.** Form đặt bàn của khách có ô "Giờ kết thúc". Form admin có giờ kết thúc. Danh sách admin và lịch sử của khách hiện khoảng giờ, ví dụ `18:00 – 19:30`.

## 2. Kiểm thử (chạy lại sau khi sửa theo review)

| Bộ test | Kết quả |
| :--- | :--- |
| `mvn clean test` | 433/433 (trước phiên: 351) |
| `npx tsc --noEmit` | 0 lỗi |
| `test:assets`, `test:vouchers` (giá + giữ lượt COD), `test:reservation-range`, `test:table-delivery`, `test-reservation-availability` (react-server) | Đều pass |
| `next build` | Thành công |
| Bộ UI/API (`npm test`, cách chạy như CI, không có `.env`) | 47/47 |

Bộ UI chạy trên worktree không có `.env.local`, nên không chạm database thật. Một lần chạy 47/47 bị loại vì nó chạy trên server cũ còn sót ở cổng 3100. Kết quả trong bảng là của server dựng từ bản build mới nhất.

## 3. Review độc lập và bản sửa

Reviewer kết luận không có lỗi Critical. Đã sửa, mỗi lỗi có test fail trước khi sửa:

1. **STAFF sửa/xóa được voucher qua `/api/vouchers/+1`.** Bộ lọc quyền chỉ khớp id dạng số, còn handler đọc id bằng `Integer.parseInt`, vốn chấp nhận cả dấu `+`. Giờ mọi đường dẫn voucher trừ `validate`, `active`, `redeem`, `release` đều cần MANAGER, và id chỉ nhận chữ số ASCII. Test: `staffCannotReachVoucherIdsSpelledDifferently`.
2. **Đơn COD ghi lỗi thì lượt voucher bị giữ mãi**, khiến khách mới không dùng được `WELCOME10`. Hàm mới `lib/orders/voucher-hold.ts` trả lượt cả khi ghi đơn ném lỗi, và ghi log nếu trả lượt thất bại. Test: `scripts/test-voucher-hold.ts`.
3. **Phiếu cũ bắt đầu sau 20:00 không sửa được** (nâng từ Minor lên Important vì spec yêu cầu phiếu cũ không bị lỗi). Đã sửa ở Java, kho demo và phần điền sẵn của form admin. Test: `legacyEveningBookingStaysEditable` và case mới trong `test-reservation-range.ts`.

## 4. Quyết định đã tự đưa ra

- Làm trong worktree riêng, vì working tree chính còn thay đổi chưa commit ở `PosCheckoutFacade.java` và `SystemConfigManager.java`.
- `WELCOME10` giờ cần tài khoản đăng nhập, do giới hạn mỗi tài khoản 1 lần. Hai test cũ (`ServerTest`, `AuthTest`) được cập nhật theo.
- Khi Java không truy cập được, storefront từ chối mọi mã. `TC-API-05` đổi từ "áp được WELCOME10" sang "từ chối và nêu lý do".
- Hủy một đơn đã hủy trả 200 và không phát sự kiện (hành vi sẵn có), không phải 409 như kế hoạch dự đoán.
- Quy tắc giờ kết thúc chỉ áp cho phiếu có lưu `endTime`; API luôn lưu giá trị này cho phiếu mới và phiếu được sửa. Giữ constructor `TableAvailabilityValidator(dao, Duration)` làm thời lượng cho phiếu cũ.
- Bàn được báo là đã đặt từ 2 giờ trước giờ đến cho tới giờ kết thúc khách chọn.
- Các test cũ dựa trên thời gian chờ 15 phút được cập nhật lên 30 phút.
- `VoucherReleaseObserver` (package `patterns.observer`) phụ thuộc vào `server.VoucherService`.

## 5. Lỗi phát hiện sau khi mở PR #75 và các lỗi nhỏ đã sửa

**CI GitHub (chạy lúc 22:11 giờ Việt Nam):** tra bàn trống sau giờ đóng cửa mà không gửi `endTime` thì trả 400, vì giờ kết thúc mặc định bị cắt về 22:00, sớm hơn giờ bắt đầu. Máy local không lộ lỗi vì chạy test trong giờ mở cửa. Đã sửa: khi tra cứu, nếu giờ kết thúc mặc định không còn sau giờ bắt đầu thì dùng nguyên 2 giờ. Test: `catalogAfterClosingStillAnswers` với giờ cố định 22:05.

**Sáu lỗi nhỏ từ review**, đã sửa hết, mỗi lỗi có test fail trước khi sửa:

1. **Giảm tổng lượt chạy song song với redeem.** Điều kiện `used_count <= maxUses` giờ nằm trong chính câu `UPDATE`, chung khóa dòng với redeem; vi phạm trả 400 kèm số lượt thật. Test: `saveRefusesMaxUsesBelowUsedCount` (DAO) và `loweringMaxUsesWhileARedeemLandsReportsTheLimit` (handler).
2. **Xóa voucher chạy song song với redeem.** `DELETE` chỉ xóa khi `used_count = 0` và chưa có lượt nào; nếu không xóa được thì handler tắt mã. Khóa ngoại `voucher_usages` bỏ `ON DELETE CASCADE`; database cũ được đổi khi khởi động. Test: `deleteRefusesUsedVoucherAndKeepsUsages`, `deletingWhileARedeemLandsDeactivatesInstead`.
3. **Lỗi lưu trữ lúc redeem.** Trạng thái mới `RedeemStatus.FAILED` (lỗi database hoặc một đơn giữ lượt hai lần), trả 503 `DATABASE_UNAVAILABLE` thay vì "Mã không tồn tại". Kho in-memory cũng chặn giữ lượt hai lần cho cùng một mã đơn, giống cột `order_code` UNIQUE. Test: `duplicateOrderCodeFailsWithoutCounting`, `storageFailureIsServiceUnavailable`.
4. **Lỗi gắn lượt vào đơn bị bỏ qua.** Giờ được ghi log và trả kèm cảnh báo trong kết quả checkout. Test: `unattachedUseIsReportedAsAWarning`. Observer trả lượt khi hủy đơn không cần sửa: `releaseByOrder` trả `false` cũng là trường hợp bình thường (đơn không dùng mã), còn lỗi database thật đã được DAO JDBC ghi log ở mức SEVERE.
5. **API nhận phần trăm dưới 1%.** Giờ API bắt buộc 1–100 như spec.
6. **Thiếu `AUTH_SERVICE_KEY`.** Khi kiểm tra mã cho một tài khoản, `validateVoucher` giờ ghi log lỗi cấu hình và trả lỗi, thay vì âm thầm hỏi Java như khách vãng lai. Test: `scripts/test-voucher-api.ts`.

## 6. Còn ngoài phạm vi

- Ô nhập voucher trên POS tại quầy: thiết kế để sang đợt sau. Backend đã nhận `voucherCode` từ POS.

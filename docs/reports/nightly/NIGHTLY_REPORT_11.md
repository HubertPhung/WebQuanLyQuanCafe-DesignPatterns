# Phiên 11: Ô nhập voucher trên POS tại quầy

Ngày 2026-10-29 · Nhánh `feature/pos-voucher` (tách từ `master` tại `014ab3b`), đẩy lên `feature/hoai-bo` rồi merge vào `master` qua PR.

Phần còn ngoài phạm vi của [phiên 10](NIGHTLY_REPORT_10.md): thu ngân nhập được mã giảm giá khi bán tại quầy.

## 1. Đã làm

- **Ô "Mã giảm giá" trên POS.** Quầy tính trước mức giảm từ danh sách mã đang chạy bên Java bằng `posVoucherVerdict` (`lib/storefront/vouchers.ts`), cùng công thức với `VoucherService`. Mã sai, hết hạn, hoặc chưa đạt đơn tối thiểu thì hiện lý do ngay dưới ô nhập. Java vẫn kiểm tra lại và giữ lượt khi thanh toán.
- **Tổng tiền ở quầy khớp với Java.** Voucher thay cho giảm theo hạng thành viên, còn điểm tích lũy cộng dồn lên trên.
- **Chỉ áp khi thanh toán ngay.** Có mã thì nút "Gửi pha chế" (trả sau) bị khóa, và server action `createOrder` từ chối nếu có ai gọi thẳng. Lý do: đơn trả sau được tính tiền lại lúc `/pay`, mà bước đó không có giảm giá. Java không phản hồi thì đơn có mã bị từ chối, giống khi đổi điểm.
- **Mã giới hạn theo tài khoản dùng ở quầy.** Quầy không biết tài khoản của khách, nên các mã này (kể cả `WELCOME10`) bị từ chối với lý do `ONLINE_ONLY` và thông báo "Mã này chỉ dùng khi đặt online.", thay vì "Đăng nhập để dùng mã này". Khách ẩn danh gọi `POST /api/vouchers/validate` trên web vẫn là kênh online; chỉ nhân viên đăng nhập mới bị coi là đơn tại quầy.
- **Tài liệu.** `docs/API_SPEC.md` cập nhật phần `voucherCode` của checkout và phần giỏ hàng: bỏ các mô tả cũ về mã viết cứng, giảm cố định 10%, và danh sách mã dự phòng.

## 2. Kiểm thử

| Bộ test | Kết quả |
| :--- | :--- |
| `mvn clean test` | 445/445 |
| `npx tsc --noEmit` | 0 lỗi |
| `test:assets`, `test:vouchers` (thêm 8 ca cho `posVoucherVerdict`), `test:reservation-range` | Pass |
| `next build` | Thành công |
| Bộ UI/API (thêm `TC-VOUCHER-05`: POS có ô nhập mã) | 48/48 |

Test mới bên Java: `perAccountVoucherIsOnlineOnlyAtPos`, và một ca nhân viên gọi `validate` trong `validateTrustsUserIdOnlyFromStorefront`.

## 3. Giới hạn đã biết

- Mã chỉ áp khi thanh toán ngay. Muốn áp mã cho đơn trả sau thì bước `/pay` của Java phải tính lại giảm giá; chưa làm.
- Ô nhập mã chưa có test tương tác trên trình duyệt. Phần tính tiền được kiểm tra qua `posVoucherVerdict` (dùng chung với giao diện), và Java kiểm tra lại khi thanh toán.

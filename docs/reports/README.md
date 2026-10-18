# Báo cáo review, kiểm toán và các phiên sửa lỗi

Các báo cáo do agent viết trong ngày 2026-10-18 (nhánh `feature/hoai-bo`). Trước đây chúng nằm ở thư mục gốc repo; tên file được giữ nguyên để các tham chiếu chéo giữa báo cáo vẫn đúng. Báo cáo mới nên đặt vào thư mục con tương ứng ở đây.

## 1. Mục lục

### `audit/`: review và kiểm toán (chỉ đọc code, không sửa)

| File | Nội dung |
| :--- | :--- |
| [REVIEW_REPORT.md](audit/REVIEW_REPORT.md) | Review các bản sửa race condition (đặt bàn, huỷ/thanh toán, checkout); phát hiện F1–F8 |
| [NEXT_PLAN.md](audit/NEXT_PLAN.md) | Kế hoạch tiếp theo từ REVIEW_REPORT, các mục P1–P3 và các quyết định chờ chủ dự án |
| [BUSINESS_AUDIT.md](audit/BUSINESS_AUDIT.md) | Kiểm toán quy tắc nghiệp vụ, phát hiện BR-01 đến BR-20 kèm probe tái hiện |
| [PATTERN_AUDIT.md](audit/PATTERN_AUDIT.md) | Kiểm toán 9 design pattern GoF và kiến trúc, phát hiện PT-01 đến PT-11 |
| [AUDIT_PLAN.md](audit/AUDIT_PLAN.md) | Kế hoạch khắc phục theo đợt cho BR và PT, kèm tiêu chí chấp nhận |
| [FEATURE_STATUS.md](audit/FEATURE_STATUS.md) | Chức năng chưa hoàn thành (U, A, P) và mâu thuẫn giữa các chức năng đã làm (C, T), kèm thứ tự xử lý |

### `nightly/`: các phiên sửa lỗi

| File | Phạm vi | Trạng thái trong code |
| :--- | :--- | :--- |
| [NIGHTLY_REPORT.md](nightly/NIGHTLY_REPORT.md) | Phiên 1: F1 (điểm thành viên bị ghi đè), F2, F3/F4 (fallback đặt bàn), F5 | Đã có trong working tree |
| [NIGHTLY_REPORT_2.md](nightly/NIGHTLY_REPORT_2.md) | Phiên 2: BR-04a, BR-02, BR-01 (giá món đặt trước), BR-04b, BR-06 | Đã có trong working tree |
| [NIGHTLY_REPORT_3.md](nightly/NIGHTLY_REPORT_3.md) | Phiên 3: BR-05, BR-11 (trừ kho nguyên tử), BR-07, BR-08 | Đã có trong working tree |
| [NIGHTLY_REPORT_4.md](nightly/NIGHTLY_REPORT_4.md) | Phiên 4: PT-01 (Singleton an toàn đa luồng), PT-02, PT-03 (`equals/hashCode`), đồng bộ tài liệu | Đã có trong working tree |
| [NIGHTLY_REPORT_5.md](nightly/NIGHTLY_REPORT_5.md) | Phiên 5: N3 (đổi điểm thất bại sau khi thu tiền) | Đã có trong working tree |
| [NIGHTLY_REPORT_6_auth.md](nightly/NIGHTLY_REPORT_6_auth.md) | Phiên 6: S1 leo thang đặc quyền (**nghiêm trọng**), S2, S3 open redirect, D1 | Đã áp thủ công (code, test, tài liệu). Bản vá đã xoá |
| [NIGHTLY_REPORT_7.md](nightly/NIGHTLY_REPORT_7.md) | Phiên 7: chỉ khảo sát, dừng do hết hạn mức | Không sửa code |
| [NIGHTLY_REPORT_8.md](nightly/NIGHTLY_REPORT_8.md) | Phiên 8: D1 (`occupied_since` bị đặt lại), D2 (`completedAt` của đơn offline) | Đã áp. Quy tắc D2 đổi thành: `completedAt` sớm hơn `createdAt` thì lấy `createdAt` và cảnh báo, không từ chối. Bản vá đã xoá |
| [NIGHTLY_REPORT_9.md](nightly/NIGHTLY_REPORT_9.md) | Phiên 9: C1 (bán vượt kho đơn COD), C5 (tổng tiền `/cart`), có phép thử tranh chấp trên Postgres thật | **Không áp**: một phiên song song đã sửa cùng hai mục trên working tree. `NIGHTLY_9_stock_cart.patch` chỉ để tham khảo (có `TC-ACT-12`), xoá sau khi đọc |

## 2. Thay đổi sau phiên 4 chưa có báo cáo riêng

- **Bảo mật và cấu hình:** `JdbcDatabase` không còn in mật khẩu trong lỗi `DATABASE_URL`. Java đọc `backend-java/.env` (git-ignored) qua `util/EnvFile`. Khoá `X-Service-Key` (`AUTH_SERVICE_KEY`) chỉ có quyền STAFF ở `POST /api/checkout` và `POST /api/orders/sync`, dùng cho đơn online của khách. `AUTH_JWT_SECRET` dùng chung giữa Java và Next.js.
- **Đặt hàng online thật:** cửa hàng bán menu thật (`lib/storefront/menu-catalog.ts`), giỏ hàng chỉ nhận món thật, `/checkout` gọi `placeOnlineOrder`. Đơn trả trước đi qua Java, đơn COD được đồng bộ sang Java. Thông tin liên hệ lưu trong `admin_order_contacts`. `/admin/orders` hiện đơn online thật.
- **Trang quản trị nối dữ liệu thật:** `/admin/menu` (thêm món, bật/tắt món), `/admin/inventory` (nguyên liệu, nhập/xuất kho qua `adjustStock`). Bảng điều khiển và sơ đồ bàn lấy khu vực từ dữ liệu. Các phần chưa có API được gắn nhãn "Bản demo".
- **Dữ liệu Supabase:** schema Java, các bảng phụ có RLS, 24 món bán, 18 nguyên liệu, 22 bàn trong 5 khu vực. Đã xoá toàn bộ dữ liệu test.
- **Kiểm thử:** `npm run test:e2e` (`frontend-nextjs/scripts/test-e2e-stack.mjs`) chạy trên hệ thống thật và tự dọn dữ liệu. Xem [TESTING.md](../TESTING.md).

## 3. Việc còn mở (tổng hợp từ mọi báo cáo)

### Cần làm ngay
1. **Đặt lại mật khẩu database Supabase.** Mật khẩu hiện tại đã lộ trong lịch sử chat. Sau khi đặt lại, cập nhật `frontend-nextjs/.env.local` và `backend-java/.env`.

### Cần chủ dự án quyết định
- BR-10: hội viên thanh toán đơn chuyển từ đặt bàn (`/pay`) có được giảm giá theo hạng không ([NIGHTLY_REPORT_3.md](nightly/NIGHTLY_REPORT_3.md) §5).
- BR-01, BR-03: trừ kho cho món đặt trước và hoàn kho, hoàn điểm khi huỷ đơn đã thu tiền ([NIGHTLY_REPORT_2.md](nightly/NIGHTLY_REPORT_2.md) §5).
- PT-02: cài đúng GoF Factory Method hay đổi tên thành Simple Factory ([NIGHTLY_REPORT_4.md](nightly/NIGHTLY_REPORT_4.md) §5).
- N1 (ô tiền mặt bắt buộc hay tuỳ chọn), N2 bước 2 (quy tắc tính đơn còn mở), F7 (ngôn ngữ thông báo lỗi) và [NEXT_PLAN.md](audit/NEXT_PLAN.md) §5 (State Pattern, Template Method, tác vụ tự huỷ phiếu đặt bàn quá hạn).

### Chức năng chưa xong và mâu thuẫn
- Xem [FEATURE_STATUS.md](audit/FEATURE_STATUS.md). Ưu tiên C1 (đơn COD bán vượt kho), C6 (phiếu đặt bàn mất khi Java tắt), C5 (tổng tiền `/cart` sai).

### Chưa có backend, đang gắn nhãn "Bản demo"
- Thêm bàn, thêm khu vực; trang Nhân viên và Lịch ca; các ô cảnh báo và chốt ca trên bảng điều khiển; lưu thông tin ở trang Tài khoản.

### Kỹ thuật
- Giới hạn tần suất đặt đơn online (hiện ai cũng gửi được nhiều đơn COD).
- Pooler Supabase (cổng 6543) chưa nhận mật khẩu mới; `.env.local` đang dùng kết nối trực tiếp, không dùng được khi deploy.
- Toàn bộ thay đổi trên nhánh vẫn chưa commit.

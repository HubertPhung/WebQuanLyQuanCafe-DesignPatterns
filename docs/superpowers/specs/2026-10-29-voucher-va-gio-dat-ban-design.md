# Thiết kế: Quản lý voucher và giờ kết thúc khi đặt bàn

Ngày: 2026-10-29 · Nhánh: `feature/hoai-bo`

Gồm hai phần độc lập, làm lần lượt: **A. Quản lý voucher** trước, **B. Giờ bắt đầu và kết thúc khi đặt bàn** sau.
Những chỗ ghi *(quyết định của Claude)* là lựa chọn mặc định chưa được người dùng duyệt riêng.

---

## A. Quản lý voucher

### Vì sao

Quán muốn tạo mã giảm giá theo từng dịp sale. Hiện tại voucher được viết cứng trong code
(`VoucherCatalog` bên Java và `lib/storefront/vouchers.ts` bên Next.js). Chỉ có mã `WELCOME10`
(giảm 10%, tối đa 50.000 đ, chỉ cho đơn online đầu tiên), và admin không có cách nào để thêm mã.

### Mục tiêu

- Admin có trang **Voucher** trong khu admin để **thêm, sửa, xóa** voucher.
- Mỗi voucher có các trường:
  - **Mã**: viết hoa, duy nhất, chỉ gồm chữ, số và `-` `_`, dài 3–30 ký tự *(độ dài là quyết định của Claude)*.
  - **Kiểu giảm**: `PERCENT` (tỉ lệ 1–100%, kèm *mức giảm tối đa* không bắt buộc) hoặc `FIXED` (giảm thẳng một số tiền).
  - **Đơn tối thiểu**: tạm tính trước VAT phải đạt mức này. Để 0 nghĩa là không yêu cầu.
  - **Giới hạn sử dụng**, gồm hai loại dùng kết hợp được:
    - **Tổng số lượt**: tính trên mọi khách. Để trống nghĩa là không giới hạn.
    - **Số lần mỗi tài khoản**: ví dụ 1. Để trống nghĩa là không giới hạn. Nếu có đặt giới hạn này thì khách phải **đăng nhập**
      mới dùng được mã, khách vãng lai thấy thông báo "Đăng nhập để dùng mã này".
  - **Chỉ cho đơn online đầu tiên của tài khoản**: ô tích. Đây là quy tắc của `WELCOME10`, hiện đang viết cứng trong
    `CheckoutHandler`, được tổng quát hóa để mã nào cũng bật được.
  - **Ngày bắt đầu** và **ngày hết hạn**: mã hợp lệ từ 00:00 ngày bắt đầu đến 23:59:59 ngày hết hạn, theo giờ Việt Nam (+07:00).
  - **Mô tả** ngắn hiển thị cho khách.
  - **Đang bật / tắt**.
- Danh sách trên trang admin hiện **đã dùng / tối đa** (hoặc "không giới hạn") và trạng thái tính ra từ dữ liệu:
  *Sắp diễn ra*, *Đang chạy*, *Hết hạn*, *Hết lượt*, *Đã tắt*.
- Trang chi tiết voucher có danh sách **ai đã dùng mã**: tài khoản (hoặc "khách vãng lai"), mã đơn, thời điểm.
- Khi khách nhập mã ở giỏ hàng hoặc trang thanh toán, hệ thống kiểm tra các điều kiện sau và báo đúng lý do khi mã không dùng được:
  mã có tồn tại không, đã bật chưa, còn trong hạn không, còn lượt tổng không, tài khoản này còn lượt không,
  có phải đơn online đầu tiên không (nếu mã yêu cầu), tạm tính đã đạt đơn tối thiểu chưa.
  Nếu chưa đạt đơn tối thiểu thì báo khách cần mua thêm bao nhiêu.
- **Trừ lượt ngay lúc đặt đơn**, áp dụng cho mọi đơn dùng mã, cả trả trước lẫn **thanh toán khi nhận hàng (COD)**.
  Không bao giờ được vượt quá giới hạn tổng hoặc giới hạn mỗi tài khoản, kể cả khi nhiều đơn đặt cùng lúc.
- Đơn bị **hủy** thì **trả lại lượt** đã trừ, khách dùng lại được mã nếu mã còn hạn.
- `WELCOME10` trở thành một voucher bình thường trong database: không giới hạn tổng, mỗi tài khoản 1 lần,
  bật "chỉ cho đơn online đầu tiên".

### Không làm (non-goals)

- Giới hạn mỗi khách chỉ dùng một mã một lần. Người dùng chỉ yêu cầu thêm đơn tối thiểu.
- Voucher chỉ áp dụng cho một số món, danh mục hoặc chi nhánh.
- Tự động áp mã, hoặc dùng nhiều mã trên một đơn.
- Ô nhập voucher trên màn hình **POS** tại quầy. Đợt này chưa làm; backend vẫn chấp nhận `voucherCode` từ POS như hiện tại
  *(Claude đề xuất, người dùng không phản đối)*.

### Điều tuyệt đối không được xảy ra (anti-goals)

- Kết quả kiểm tra mã (`/api/vouchers/validate`) và số tiền checkout thực sự trừ **lệch nhau**.
- Số lượt đã dùng **vượt quá** số lượt tối đa.
- Xóa một mã đã có người dùng làm hỏng lịch sử đơn hàng.

### Quyết định thiết kế

- **Lưu trữ**: thêm model `Voucher` cùng DAO theo hai chế độ như các DAO khác
  (`IVoucherDao`, `InMemoryVoucherDao`, `JdbcVoucherDao`, đăng ký trong `DaoFactory`),
  và bảng `vouchers` tạo trong `JdbcDatabase` (`CREATE TABLE IF NOT EXISTS`).
  `WELCOME10` được seed ở cả hai chế độ.
- **Strategy**: `VoucherCatalog` bỏ map cứng, đổi sang đọc từ DAO rồi dựng Strategy tương ứng:
  `PercentageDiscountStrategy` cho `PERCENT`, và một Strategy giảm tiền cố định cho `FIXED`
  (tạo mới nếu trong `patterns/strategy` chưa có). Điều kiện đơn tối thiểu cũng được kiểm tra trong cùng đường đi này,
  để validate và checkout dùng chung một chỗ.
- **Ghi nhận lượt dùng**: bảng mới `voucher_usages` (voucher_id, user_id có thể null, order_code, created_at).
  `vouchers.max_uses` và `vouchers.per_account_limit` cho phép null, null nghĩa là không giới hạn.
- **Trừ lượt an toàn khi chạy đồng thời**: với JDBC, trong một transaction:
  `UPDATE vouchers SET used_count = used_count + 1 WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)`,
  sau đó kiểm tra giới hạn mỗi tài khoản bằng cách đếm `voucher_usages` của user đó, rồi ghi một dòng `voucher_usages`.
  Bước nào không qua thì rollback và trả lỗi. Với chế độ in-memory thì làm cả bước trong `synchronized`.
- **Thời điểm trừ lượt**:
  - Đơn trả trước: trong luồng `/api/checkout`, ngay khi tạo đơn.
  - Đơn COD: đơn COD hiện do Next.js tính giá (`cashOnDeliveryTotals` trong `app/admin/actions.ts`), lưu tạm,
    rồi đồng bộ sang Java qua `OrderHandler.importedOrder` mà không gửi mã. Cần một endpoint giữ lượt
    (ví dụ `POST /api/vouchers/redeem`, dùng service key của storefront), gọi lúc khách đặt đơn COD.
    Lần import sau đó mang theo `voucherCode` và số tiền giảm, để không trừ lượt lần hai.
- **Trả lại lượt khi hủy**: đơn chuyển sang trạng thái hủy thì xóa dòng `voucher_usages` của đơn đó và giảm `used_count` đi 1,
  làm trong cùng chỗ xử lý chuyển trạng thái đơn. Hủy lần hai không được trả lượt hai lần.
- **Đơn hàng ghi lại mã**: thêm cột `voucher_code` vào `orders` (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
  để lịch sử đơn biết mã nào đã dùng *(quyết định của Claude)*.
- **Xóa**: mã chưa ai dùng (`used_count = 0`) thì xóa hẳn. Mã đã có người dùng thì chỉ chuyển sang **tắt**,
  và giao diện nói rõ việc này *(quyết định của Claude)*.
- **API** (đặt thêm vào `VoucherHandler`, ghi vào `docs/API_SPEC.md`):
  - `GET /api/vouchers`, `POST /api/vouchers`, `PUT /api/vouchers/{id}`, `DELETE /api/vouchers/{id}`: quyền **MANAGER trở lên**,
    giống quyền sửa thực đơn *(quyết định của Claude)*.
  - `GET /api/vouchers/active`: công khai, trả các mã đang chạy để storefront hiển thị.
    Mục đích là thay danh sách cứng `VOUCHERS` trong `lib/storefront/vouchers.ts`.
  - `POST /api/vouchers/validate`: giữ nguyên dạng cũ, thêm trường `reason` khi mã không hợp lệ.
- **Quy tắc cộng dồn giảm giá giữ nguyên như `CheckoutHandler.discount` hiện tại**: voucher thay cho giảm giá theo hạng thành viên,
  điểm tích lũy vẫn cộng dồn lên trên, và đơn tối thiểu tính trên tạm tính trước mọi khoản giảm *(quyết định của Claude)*.
- **Khi backend Java không truy cập được**: storefront từ chối mọi voucher và báo "tạm thời không áp dụng được mã",
  vì không xác minh được hạn và số lượt *(quyết định của Claude)*.
- **Không cho đổi mã** của voucher đã có người dùng, chỉ được sửa các trường khác *(quyết định của Claude)*.
- **Kiểm tra dữ liệu khi lưu**: ngày hết hạn ≥ ngày bắt đầu; tổng số lượt (nếu có) ≥ 1 và không được nhỏ hơn số lượt đã dùng;
  giới hạn mỗi tài khoản (nếu có) ≥ 1;
  `PERCENT` phải từ 1 đến 100; `FIXED` > 0; đơn tối thiểu ≥ 0.
- **Frontend**:
  - Trang mới `app/admin/vouchers/page.tsx` gồm bảng danh sách và form thêm/sửa dạng dialog,
    theo cùng kiểu với `menu-management.tsx`.
  - Thêm mục "Voucher" vào `admin-sidebar.tsx`.
  - Thêm server actions và kiểu dữ liệu trong `lib/api-client.ts`.
  - Giỏ hàng, trang thanh toán và trang tài khoản lấy voucher từ API thay vì danh sách cứng.

---

## B. Giờ bắt đầu và kết thúc khi đặt bàn

### Vì sao

Hiện tại khách chỉ chọn **giờ đến**. Hệ thống coi mọi phiếu đều chiếm bàn **2 tiếng**
(`TableAvailabilityValidator.DEFAULT_DURATION`), nên bàn bị giữ sai so với thời gian khách thực sự ngồi.

### Mục tiêu

- Form đặt bàn trên storefront (`ReservationDialog.tsx`) cho chọn **ngày**, **giờ bắt đầu** và **giờ kết thúc**.
  - Giờ kết thúc phải sau giờ bắt đầu **ít nhất 30 phút** và **không quá giờ đóng cửa**. Ngoài ra không giới hạn độ dài.
  - Giờ kết thúc dùng cùng các mốc giờ với `RESERVATION_TIME_SLOTS`. Giá trị gợi ý là giờ bắt đầu + 2 tiếng,
    nếu vượt giờ đóng cửa thì lấy giờ đóng cửa *(quyết định của Claude)*.
- Kiểm tra bàn trống theo **khoảng thời gian thật** `[bắt đầu, kết thúc)`.
  Hai phiếu nối tiếp nhau như 18:00–19:00 và 19:00–20:30 **không** bị coi là trùng.
- Danh sách bàn trống mà khách thấy khi đặt cũng lọc theo khoảng giờ đã chọn.
- **Admin**: trang Đặt bàn hiện giờ dạng `18:00 – 19:30`. Khi sửa phiếu, admin đổi được giờ kết thúc với cùng các quy tắc trên.
- **Tài khoản khách**: lịch sử đặt bàn (`reservation-history.tsx`) cũng hiện khoảng giờ.
- **Tự hủy khi khách không đến**: phiếu chưa check-in (đang chờ hoặc đã xác nhận) được giữ **30 phút tính từ giờ bắt đầu**,
  quá thời gian đó thì tự chuyển sang *Đã hủy* và nhả bàn. Quy tắc này áp dụng cho **mọi phiếu**,
  cả phiếu online lẫn phiếu admin tạo hộ khách. Phiếu đã nhận bàn thì không bao giờ bị tự hủy, kể cả khi khách ngồi quá giờ kết thúc.

### Không làm (non-goals)

- Tính giá theo thời lượng ngồi, đặt bàn lặp lại, tự động gia hạn phiếu đang ngồi.
- Thay đổi luồng check-in hoặc chuyển phiếu sang POS.

### Điều tuyệt đối không được xảy ra (anti-goals)

- Phiếu cũ chưa có giờ kết thúc bị lỗi hoặc biến mất.
- Hai phiếu chồng giờ cùng giữ được một bàn.

### Quyết định thiết kế

- `Reservation` thêm trường `endTime` (`Instant`), và bảng `reservations` thêm cột `end_time TIMESTAMPTZ` (cho phép null).
  Getter trả `dateTime + 2 tiếng` khi `endTime` là null, để phiếu cũ vẫn hoạt động.
- `POST /api/reservations` và `PUT` nhận thêm `endTime` (ISO-8601) **không bắt buộc**.
  Nếu thiếu thì mặc định là bắt đầu + 2 tiếng, cắt lại ở giờ đóng cửa *(quyết định của Claude)*,
  để các client và test hiện có không bị hỏng. API trả về `endTime` ở mọi chỗ đang trả `dateTime`.
  Riêng `PUT` không gửi `endTime` thì **giữ nguyên thời lượng cũ**: giờ kết thúc dời theo giờ bắt đầu
  (và vẫn phải qua các bước kiểm tra) *(quyết định của Claude)*.
- Chuỗi kiểm tra (Chain of Responsibility):
  - `OperatingHoursValidator` kiểm tra thêm: kết thúc ≤ giờ đóng cửa và kết thúc − bắt đầu ≥ 30 phút.
  - `TableAvailabilityValidator` đổi `slotsOverlap` sang so khoảng `[start, end)` của từng phiếu thay vì dùng thời lượng cố định.
- Mặc định `SystemConfigManager.DEFAULT_AUTO_CANCEL_MINUTES` đổi từ 15 thành **30**.
  Logic hủy (`Reservation.isNoShowAt`, `expireNoShows`) giữ nguyên.
  Database đã lưu cấu hình 15 thì cũng cần cập nhật lên 30 *(cách làm để người triển khai chọn)*.
- Frontend: `lib/reservation-rules.ts` thêm hàm kiểm tra khoảng giờ, dùng chung cho form khách, form admin
  và server action `reservation-actions.ts`.

---

## Ràng buộc chung

- Backend dùng Java thuần với `com.sun.net.httpserver`, có hai chế độ DAO (in-memory và JDBC/PostgreSQL).
  Frontend dùng Next.js App Router và gọi backend qua `lib/api-client.ts`.
- Comment trong code viết bằng tiếng Việt, theo cách viết của code xung quanh.
- Kiểm thử bằng JUnit và chạy trên CI GitHub Actions. Không dựa vào việc thử tay hoặc thử bằng trình duyệt.
  Mỗi phần cần test cho: validate/checkout (hết hạn, hết lượt tổng, hết lượt mỗi tài khoản, khách vãng lai gặp mã
  giới hạn theo tài khoản, chỉ đơn đầu tiên, chưa đạt đơn tối thiểu, chạy đồng thời), giữ lượt cho đơn COD,
  trả lượt khi hủy (kể cả hủy hai lần),
  các API CRUD kèm phân quyền, chồng giờ và nối tiếp giờ, phiếu cũ không có `endTime`, tự hủy sau 30 phút.
  Các test hiện có (`ChainTest`, `ReservationHandlerTest`, `JdbcIntegrationTest`...) phải vẫn chạy qua.
- Sau khi sửa code chạy `graphify update .`. Báo cáo phiên làm việc ghi vào `docs/reports/nightly/`
  và thêm vào mục lục `docs/reports/README.md`. Cập nhật `docs/API_SPEC.md` và `docs/DATABASE.md`.

## Để người triển khai tự quyết

- Bố cục chi tiết của trang Voucher và của ô chọn giờ, miễn là theo phong cách admin và storefront hiện có.
- Cách cập nhật cấu hình tự hủy đã lưu từ 15 lên 30.
- Đặt tên lớp cho Strategy giảm tiền cố định.

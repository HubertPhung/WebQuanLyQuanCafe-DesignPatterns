# NIGHTLY REPORT, phiên 9 (bán vượt kho C1, tổng tiền `/cart` C5): 2026-10-18, nhánh `feature/hoai-bo`

- HEAD: `67e5253`. **Chưa commit, push hay mở PR. Phiên này không sửa file code nào trên working tree chính.** Chỉ thêm 2 file: báo cáo này và `NIGHTLY_9_stock_cart.patch`, cộng một dòng trong `docs/reports/README.md`.
- **Kết luận chính:** phiên này sửa và kiểm chứng C1 và C5 trong một worktree riêng. Trong lúc đó, một phiên Claude song song cũng sửa đúng hai mục này trên working tree chính (file đổi lúc 13:08–13:12), với cách làm gần như giống hệt. Vì vậy **patch của phiên này không nên áp**. Nó được giữ lại để tham khảo theo quy ước của repo, và có thể xoá.

## 1. Cách làm

1. Khi bắt đầu có 3 tiến trình `claude.exe` đang chạy (PID 4320, 9444, 23284), cùng một worktree Orca `nightly-20261018` đang sửa `MenuHandler.java`. Để không đụng vào thay đổi chưa commit, phiên này làm giống phiên 6 và 8:
   - `git stash create` (không đụng working tree) tạo commit `f2172c5`;
   - `git worktree add --detach` vào scratchpad, chép thêm 17 file chưa được theo dõi, rồi `git add -A` làm mốc so sánh;
   - sửa và test trong worktree, xuất `git diff` ra patch.
2. Chọn việc theo thứ tự đề xuất trong [FEATURE_STATUS.md](../audit/FEATURE_STATUS.md) §3: C1 (bán vượt kho) và C5 (tổng tiền sai), vì đây là lỗi dữ liệu, sửa nhỏ và kiểm chứng được.
3. Worktree, `node_modules` chép tạm (khoảng 1 GB) và cụm Postgres thử nghiệm đã được xoá hết khi kết thúc.

## 2. Xác minh hai phát hiện

| # | Phát hiện | Kết quả xác minh |
| :-: | :--- | :--- |
| C5 | `/cart` giảm `subtotal * 0.1` mà không có trần 50.000 đ | **Đúng.** Gọi API giỏ hàng thật trên server Next của worktree: giỏ 15 × món 65.000 đ cộng mã `WELCOME10` cho tạm tính 975.000 đ. API (cũng là checkout và Java) tính tổng **925.000 đ**, còn trang `/cart` cũ hiện **877.500 đ** (giảm 97.500 đ thay vì 50.000 đ) |
| C1 | Đơn COD và hoá đơn mở chỉ kiểm tra `inStock`, kho bị kẹp `greatest(stock - qty, 0)` | **Đúng phần chính.** Phần "Java từ chối đơn lúc đồng bộ" thì **không đúng**: `OrderHandler.deductStock` (`/api/orders/sync`) nhận đơn, đặt kho về 0 và trả cảnh báo `Stock of … ran out offline; set to 0`. Kết quả là cả hai kho đều bán vượt mà không báo lỗi |

## 3. Bản sửa của phiên này (trong patch, không áp)

| File | Thay đổi |
| :--- | :--- |
| `frontend-nextjs/app/cart/page.tsx` | Dùng `cart.cost.totalAmount` do API giỏ hàng tính (đã có trần), giảm giá hiển thị là `subtotal - total`. Nhãn đổi từ "Ưu đãi thành viên (-10%)" thành "Mã {code}" như trang checkout |
| `frontend-nextjs/lib/orders/stock.ts` (mới) | `stockShortage(quantities, menu)` trả về `unavailable` (món tắt bán, hết hàng hoặc không có trong menu) hoặc `short` (kèm tên món và số còn lại) |
| `frontend-nextjs/app/admin/actions.ts` | `createOrder` và `placeOnlineOrder` kiểm tra số tồn trước khi gửi Java. `recordOrderLocally` nhận thêm tham số `outOfStock`: với đơn mà Java chưa thu tiền, kho bị trừ bằng `UPDATE … WHERE stock_qty >= qty RETURNING id`. Không còn đủ hàng thì ném `OutOfStockError`, giao dịch rollback và hàm trả lỗi thay vì chuyển đơn sang mock store. Đơn Java đã thu tiền vẫn kẹp kho như cũ, vì Java đã tự kiểm tra kho của nó |
| `frontend-nextjs/scripts/test-ui-ux.mjs` | Thêm `TC-ACT-12` |
| `README.md`, `docs/TESTING.md`, `docs/DESIGN_PATTERNS_SPEC.md`, `.github/workflows/ci.yml` | Số test UI từ 40 lên 41, thêm mô tả `TC-ACT-12` |

## 4. Bằng chứng đã chạy (trong worktree)

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E1 | `npx tsc --noEmit -p .` | `TSC_EXIT=0` |
| E2 | Logic `TC-ACT-12` chạy riêng bằng `tsx` | Đặt đúng 14 phần (bằng số tồn) thì nhận, 15 phần trả `short` với `left: 14`, tồn 0 và id lạ trả `unavailable` |
| E3 | Kiểm tra đột biến: đưa `stockShortage` về quy tắc cũ (chỉ xét `inStock`) | `TC-ACT-12 FAIL` (`tooMany: null`, `soldOut: null`). Khôi phục bản sửa thì PASS |
| E4 | Chạy đúng các câu lệnh của giao dịch trên **Postgres thật** (bản nhúng của bộ test Java, cụm tạm ở cổng 55439), món còn 3 phần | Đặt 4 phần: bị từ chối, đơn rollback, kho vẫn 3. **Hai đơn cùng lúc, mỗi đơn 2 phần: một đơn nhận, một đơn bị từ chối**, kho còn 1. Đặt 1 phần: nhận, kho 0. Đặt thêm 1 phần: bị từ chối. Với lệnh `greatest(...)` cũ, cả hai đơn tranh chấp đều được nhận và kho bị kẹp về 0, tức bán vượt 1 phần |
| E5 | `npm test` với `next dev` của worktree (cổng 3191, không có `.env.local` nên dùng mock store, Java tắt) | `EXIT=0`, **Total 41, Passed 41 (100%), Failed 0** |
| E6 | Gọi API giỏ hàng (xem C5 ở mục 2) | Trang mới hiện 925.000 đ, khớp API và checkout |
| E7 | `npm run build` | `BUILD_EXIT=0` |
| E8 | `git apply --check NIGHTLY_9_stock_cart.patch` trên working tree chính | **Thất bại** ở `actions.ts` và `cart/page.tsx`: hai file đã bị phiên song song sửa sau thời điểm chụp (xem mục 5) |

**Không chạy:**
- `mvn test`: phiên này không sửa Java.
- `npm run test:e2e`: script này ghi vào Supabase thật.
- `graphify update .`: code trên working tree chính không đổi.
- GitHub Actions: chưa push.
- Lỗi phụ khi chạy test: `next dev` với `node_modules` dạng junction trỏ sang ổ D: không chạy được, cả webpack lẫn Turbopack đều giải sai đường dẫn (`./D:/…/app-next-dev.js`, phiên 8 cũng gặp). Phiên này phải chép `node_modules` vào worktree. Trong `node_modules\.pnpm` cũ có khoảng 1.178 junction trỏ sang dự án khác (`D:\University\MauThietKe\aroma-craft-coffee-app-development\…`). Build và test không dùng tới chúng, nhưng nên xoá thư mục `.pnpm` thừa đó.

## 5. Tình trạng trên working tree chính (lúc 13:14)

Phiên song song đã thêm vào working tree chính:
- **C5:** `cart/page.tsx` dùng `cart.cost.totalAmount`, giống hệt cách của phiên này.
- **C1:** `shortStockError` và `quantitiesOf` trong `lib/db/mock-store.ts`, `class ShortStock`, và cùng câu `UPDATE … WHERE stock_qty >= qty RETURNING id`, áp khi đơn không có cờ `javaSold`. Phép thử E4 ở trên chạy đúng câu SQL này, nên nó cũng xác nhận bản đó không bán vượt khi hai đơn tranh chấp.
- Ngoài ra phiên song song còn đang sửa các mục khác: bắt đăng nhập trước khi đặt hàng, trang tài khoản và hạng thành viên, voucher, và `customerPhone` cho đơn online.

Điểm nên xem lại trong bản đang có trên working tree chính (chỉ ghi nhận, phiên này không sửa):
1. Lúc 13:14 bộ `test-ui-ux.mjs` trên working tree chính **chưa có test nào cho C1**. Có thể chuyển `TC-ACT-12` từ patch này sang và trỏ nó vào `shortStockError`.
2. `shortStockError` bỏ qua món không có trong `menu`, vì nó lặp theo `menu` chứ không theo `quantities`. Hiện tại không sao, vì `createOrder` đã kiểm tra `unavailable` trước đó.
3. Kiểm tra trước ở `createOrder` giờ chặn cả đơn **đã thanh toán** khi kho cục bộ ít hơn số đặt, kể cả khi kho Java còn đủ. Hai bản sửa đều làm vậy. Nếu hai kho thường lệch nhau thì cần quyết định kho nào là chuẩn.

## 6. Cần bạn xem xét

1. **Không áp `NIGHTLY_9_stock_cart.patch`.** Nên giữ bản của phiên song song, có thể lấy thêm `TC-ACT-12` (mục 5.1). Sau khi đọc xong thì xoá patch và ghi lại trong mục lục.
2. **Chạy nhiều phiên cùng lúc trên một working tree:** lần này hai phiên làm trùng một việc. Nên giao việc theo danh sách mục rõ ràng cho từng phiên, hoặc cho mỗi phiên một nhánh hay worktree Orca riêng.
3. Xoá `frontend-nextjs/node_modules/.pnpm` (junction trỏ sang dự án khác, mục 4).

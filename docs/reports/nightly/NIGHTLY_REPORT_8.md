# NIGHTLY REPORT, phiên 8 (dữ liệu bàn và đồng bộ đơn offline): 2026-10-18, nhánh `feature/hoai-bo`

- HEAD: `67e5253`. **Chưa commit, push hay mở PR. Working tree chính không bị sửa**, chỉ có thêm 2 file chưa theo dõi: báo cáo này và `NIGHTLY_8_data.patch`.
- **Lý do làm trong worktree riêng:** lúc bắt đầu (12:00) vẫn còn 5 tiến trình `claude.exe` khác chạy trên repo này (PID 15876, 4320, 19404, 7952, 9444). Cách làm giống phiên 6:
  1. `git stash create` (không đụng working tree) ra commit `c4ba407`;
  2. `git worktree add --detach` tại `C:\Users\phung\AppData\Local\Temp\claude\D--University-MauThietKe-WebQuanLyQuanCafe-DesignPatterns\653c489a-83d3-4d31-9427-d60955a5afa5\scratchpad\wt`, chép thêm 14 file code/tài liệu chưa theo dõi, rồi `git add -A` làm mốc (không commit);
  3. sửa và test trong worktree, xuất `git diff` ra patch.
- Phiên này chọn mảng **chưa phiên nào động tới**: `JdbcTableDao`, `TableHandler`, `AnalyticsHandler`, `VoucherHandler`, `CustomerHandler`, `UserHandler` và luồng `/api/orders/sync`. Các file trong patch không trùng với file code nào của `NIGHTLY_6_auth.patch`.

## 1. Tóm tắt

| # | Lỗi | Mức độ | Kết quả |
| :-: | :--- | :--- | :--- |
| D1 | Chế độ JDBC: bàn đang có khách nhận thêm một đơn đã trả tiền (hoặc đổi số khách) thì `occupied_since` bị **đặt lại về thời điểm hiện tại**. Bản in-memory và frontend thì giữ nguyên | Trung bình: sai dữ liệu vận hành (đồng hồ "khách ngồi bao lâu", cảnh báo bàn ngồi lâu ở dashboard) | ✅ Đã sửa, có test, test fail trước khi sửa |
| D2 | `/api/orders/sync`: đơn đã `completed` lúc offline bị gán `completedAt` = **thời điểm đồng bộ**. Frontend có `completedAt` thật nhưng không gửi | Trung bình: sai KPI "thời gian phục vụ" (`fulfillmentMinutesToday`) trong `/api/analytics`, bị cộng cả thời gian mất kết nối | ✅ Đã sửa ở cả Java và frontend, có test, đã kiểm tra đột biến |

Backend: **247 → 249** JUnit, 0 fail, 0 skip (chưa gồm 3 test của patch phiên 6). Frontend: `tsc` pass.

## 2. Chi tiết

### D1: `JdbcTableDao.updateStatus` đặt lại thời điểm khách ngồi
- **Nguyên nhân:** câu SQL cũ luôn ghi `occupied_since = now()` khi trạng thái mới là `OCCUPIED`, kể cả khi bàn đã `OCCUPIED` từ trước. Hàm này được gọi lại mỗi lần `TableStatusSyncObserver.onOrderPaid` chạy (khách gọi thêm món), khi chuyển phiếu đặt bàn sang POS, và khi nhân viên đổi số khách qua `PUT /api/tables/{id}`.
- **So sánh:** `Table#setStatus` (in-memory) chỉ đặt `occupiedSince` khi đang `null`. Frontend (`app/admin/actions.ts:363, 621, 717`) dùng `coalesce(occupied_since, now())`. Chỉ đường JDBC, tức production trên Postgres, là sai.
- **Ảnh hưởng:** `dashboard-operational-view.tsx:169` cảnh báo bàn ngồi quá lâu dựa vào `occupiedSince`, nên mỗi đơn gọi thêm làm cảnh báo biến mất và đồng hồ quay về 0.
- **Cách sửa:** `occupied_since = CASE WHEN <đang chuyển sang OCCUPIED> THEN COALESCE(occupied_since, now) END`. Chuyển sang trạng thái khác vẫn xoá về `NULL`, nên lượt khách sau có đồng hồ mới.
- **Test:** `JdbcIntegrationTest#reseatingAnOccupiedTableKeepsWhenTheGuestsSatDown` chạy trên Postgres nhúng: lùi `occupied_since` về 40 phút trước, gọi lại `OCCUPIED`, kiểm tra giữ nguyên thời điểm và số khách mới. Sau đó `CLEANING` xoá thời điểm, và `OCCUPIED` lần nữa bắt đầu đồng hồ mới.

### D2: Đơn offline mất thời điểm hoàn tất khi đồng bộ
- **Nguyên nhân:** `OrderHandler.importedOrder` gọi `order.setStatus(COMPLETED)`, mà hàm này đóng dấu `completedAt = Instant.now()`. Payload không có trường `completedAt` (`SyncOrderPayload` ở `lib/api-client.ts`), dù bảng đơn local có cột `completed_at`.
- **Ảnh hưởng:** `AnalyticsHandler.fulfillmentMinutes` lấy `completedAt - createdAt`. Ví dụ Java mất kết nối 3 giờ: đơn phục vụ trong 12 phút lúc offline sẽ được tính là khoảng 3 giờ sau khi đồng bộ.
- **Cách sửa:**
  - Java: đọc `completedAt` tuỳ chọn, **chỉ khi** `status` là `completed`, rồi đặt trước `setStatus`. Sai định dạng ISO-8601, hoặc sớm hơn `createdAt`, thì đơn đó `failed` (400 cho riêng đơn đó; các đơn khác trong lô vẫn nhập). Gom phần đọc thời điểm thành `instant(input, key)`, dùng chung cho `createdAt` và `completedAt`.
  - Frontend: `pushQueuedOrders` (`app/admin/actions.ts`) gửi `completedAt: order.completedAt?.toISOString() ?? null`. Thêm trường vào kiểu `SyncOrderPayload`.
  - Tương thích ngược: client cũ không gửi `completedAt` thì vẫn như trước (lấy thời điểm đồng bộ).
- **Test:** `OrderHandlerTest#offlineCompletedOrdersKeepTheTimeTheyWereCompleted`, 4 đơn trong 1 lô: giữ đúng `completedAt`; đơn `pending` có kèm `completedAt` thì bỏ qua (`null`); `completedAt` sớm hơn `createdAt` bị từ chối; chuỗi không phải ISO bị từ chối.
- Sửa thêm DAO giả `SnapshotOrderDao` trong `OrderHandlerTest`: hàm `copy` trước đây không chép `completedAt`, trong khi DAO JDBC thật có lưu cột này.

## 3. Bằng chứng đã chạy
Mọi lệnh chạy **trong worktree**, `mvn` chạy trong `backend-java/`.

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E0 | `mvn -q -B clean test` (mốc, chưa sửa) | `EXIT=0`, đếm `TEST-*.xml`: **TOTAL 247, fail 0, err 0, skip 0** |
| E1 | `-Dtest='JdbcIntegrationTest#reseating*'` trước khi sửa D1 | Fail: `expected: <2026-10-18T04:24:05.858216Z> but was: <2026-10-18T05:04:05.861940Z>` (bị đặt lại 40 phút) |
| E2 | `-Dtest='JdbcIntegrationTest,DaoLayerTest'` sau khi sửa D1 | `EXIT=0` |
| E3 | `-Dtest='OrderHandlerTest#offline*'` trước khi sửa D2 | Fail: `"created":4 … expected: <true> but was: <false>` (cả 4 đơn được nhập, kể cả 2 đơn sai) |
| E4 | `-Dtest='OrderHandlerTest,ServerTest'` sau khi sửa D2 | `EXIT=0` (lần đầu fail vì DAO giả không chép `completedAt`; đã sửa DAO giả) |
| E5 | Đột biến D2: khôi phục `OrderHandler.java` về bản gốc, chạy lại test mới | Fail như E3. Đã khôi phục bản sửa |
| E6 | `npx tsc --noEmit -p .` (frontend, `node_modules` qua junction tạm, đã gỡ) | `TSC_EXIT=0` |
| E7 | `mvn -B clean test` (cuối phiên) | `MVN_EXIT=0`, `Tests run: 249, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`. Đếm `TEST-*.xml`: **TOTAL 249, fail 0, err 0, skip 0** |
| E8 | `-Dtest='OrderHandlerTest,JdbcIntegrationTest'` × 2 lần | `EXIT=0` cả 2 lần |
| E9 | `git apply --check NIGHTLY_8_data.patch` trên working tree chính | `0`. Đã so cả 7 file đích trên working tree chính với bản chụp: không file nào bị phiên song song sửa |
| E10 | `git apply --check NIGHTLY_6_auth.patch` trên worktree **đã có** thay đổi của phiên này | `0`: hai patch áp được theo cả hai thứ tự |

**Không chạy:**
- `npm test` (bộ UI 39/40 ca) và `npm run build`: cần một server Next riêng cho worktree, mà Turbopack không chạy được với `node_modules` dạng junction (phiên 6 phải chép khoảng 1 GB). Thay đổi frontend chỉ là 1 trường trong payload gửi Java, không bộ UI nào gọi `/api/orders/sync`. `scripts/test-e2e-stack.mjs` (SYNC-01, SYNC-02) cần cả stack Java + Next, cũng chưa chạy.
- `graphify update .`: code trên working tree chính chưa đổi. Chạy sau khi áp patch.
- GitHub Actions: chưa push.

## 4. File thay đổi (trong patch)

| File | Thay đổi |
| :--- | :--- |
| `backend-java/.../dao/JdbcTableDao.java` | `updateStatus` giữ `occupied_since` khi bàn đã có khách |
| `backend-java/.../server/OrderHandler.java` | `/sync` đọc `completedAt`; thêm `instant(input, key)` |
| `backend-java/.../dao/JdbcIntegrationTest.java` | +1 test (D1) |
| `backend-java/.../server/OrderHandlerTest.java` | +1 test (D2); DAO giả chép thêm `completedAt` |
| `frontend-nextjs/lib/api-client.ts` | `SyncOrderPayload.completedAt: string \| null` |
| `frontend-nextjs/app/admin/actions.ts` | `pushQueuedOrders` gửi `completedAt` |
| `docs/API_SPEC.md` §3.17 | Ví dụ payload và quy tắc của `completedAt` |

Không sửa số test trong `README.md`, `docs/TESTING.md`, `docs/DESIGN_PATTERNS_SPEC.md`, `ci.yml`: patch 6 đang sửa đúng những dòng đó (lên 250). Sau khi áp cả hai patch, tổng kỳ vọng là **252** JUnit.

## 5. Cần bạn xem xét
1. **Áp patch** (từ thư mục gốc repo, sau khi các phiên song song đã dừng):
   ```bash
   git apply --check NIGHTLY_8_data.patch && git apply NIGHTLY_8_data.patch
   cd backend-java && mvn -B clean test       # kỳ vọng 249 (hoặc 252 nếu đã áp patch 6)
   cd ../frontend-nextjs && npx tsc --noEmit -p . && npm test
   "C:/Users/phung/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe" -m graphify update .
   ```
2. **Quyết định cho D2:** `completedAt` sớm hơn `createdAt` thì đơn bị từ chối và nằm lại trong hàng đợi, kèm lý do. Hai giá trị này đều do cùng một server Next ghi, nên thực tế khó xảy ra. Nếu bạn muốn nhập bằng mọi giá, có thể đổi thành "kẹp về `createdAt` và thêm cảnh báo".
3. **Gợi ý commit** (không thêm `Co-Authored-By`): `fix(jdbc): keep a table's seating time when it is re-seated` (JdbcTableDao, JdbcIntegrationTest); `fix(sync): keep when offline orders were completed` (OrderHandler, OrderHandlerTest, api-client.ts, actions.ts, API_SPEC.md).
4. **Dọn dẹp:** worktree tạm (không có `node_modules`, junction đã gỡ) ở `C:\Users\phung\AppData\Local\Temp\claude\D--University-MauThietKe-WebQuanLyQuanCafe-DesignPatterns\653c489a-83d3-4d31-9427-d60955a5afa5\scratchpad\wt`. Gỡ bằng `git worktree remove --force <đường dẫn>`. Worktree ở trạng thái detached HEAD tại commit stash `c4ba407`, không tạo nhánh.

## 6. Đã xem nhưng không sửa
| Mục | Lý do |
| :--- | :--- |
| `PUT /api/tables/{id}` với `status: occupied` mà không gửi `guestCount` | Bàn đang trống thì thành `OCCUPIED` với 0 khách. Nhỏ, và cách xử lý (bắt buộc `guestCount` hay mặc định 1) là quyết định của bạn |
| Tra cứu khách theo số điện thoại so khớp chính xác (`0901 234 567` ≠ `0901234567`) | Chưa thấy luồng nào lưu số có khoảng trắng; chuẩn hoá có thể làm lệch dữ liệu đang có |
| `min` cho ô ngày ở form đặt bàn (`NEXT_PLAN.md` §4) | `reservations-management.tsx` đang có thay đổi lớn chưa commit, có thể của phiên song song; kiểm chứng cần chạy bộ UI |
| `VoucherHandler`, `AnalyticsHandler`, `CustomerHandler`, `UserHandler`, `Json` (số `1e400`) | Không tìm thấy lỗi tái hiện được: số vô hạn đã bị chặn lúc parse, các nhánh 404/405 đúng |
| Các mục đang chờ quyết định trong `NEXT_PLAN.md` (N1, N2 bước 2, §5) và áp `NIGHTLY_6_auth.patch` | Cần bạn quyết định, hoặc phải đợi các phiên song song dừng |

## 7. Xem diff
```bash
git apply --stat NIGHTLY_8_data.patch
# hoặc xem trực tiếp trong worktree:
git -C "C:/Users/phung/AppData/Local/Temp/claude/D--University-MauThietKe-WebQuanLyQuanCafe-DesignPatterns/653c489a-83d3-4d31-9427-d60955a5afa5/scratchpad/wt" diff
```

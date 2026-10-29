# Giờ bắt đầu và kết thúc khi đặt bàn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khách và admin chọn được giờ kết thúc khi đặt bàn (tối thiểu 30 phút, không quá giờ đóng cửa). Bàn bị giữ đúng khoảng `[bắt đầu, kết thúc)` thay vì 2 tiếng cố định. Phiếu chưa check-in tự hủy sau 30 phút.

**Architecture:** `Reservation` có thêm `endTime`; phiếu cũ không có giá trị này thì tính là giờ bắt đầu + 2 tiếng. Hai validator trong Chain of Responsibility kiểm tra độ dài và sự chồng lấn theo khoảng giờ thật. Mọi chỗ đang dùng `DEFAULT_DURATION` chuyển sang hàm so khoảng giờ. Bên frontend, `lib/reservation-rules.ts` là nguồn quy tắc dùng chung cho form khách, form admin và kho demo cục bộ.

**Tech Stack:** Java 17, JDBC/PostgreSQL, JUnit 5; Next.js App Router + TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-29-voucher-va-gio-dat-ban-design.md` (phần B)

## Global Constraints

- Giờ kết thúc − giờ bắt đầu ≥ **30 phút**; giờ kết thúc ≤ giờ đóng cửa (lấy từ `SystemConfigManager`) và cùng ngày theo giờ quán `Asia/Ho_Chi_Minh`; không giới hạn độ dài tối đa.
- Chồng lấn được tính trên khoảng nửa mở `[start, end)`, nên hai phiếu nối tiếp nhau không bị coi là trùng.
- Phiếu không có `endTime` được tính là `dateTime + 2 giờ`. API nhận `endTime` không bắt buộc. Với POST, thiếu `endTime` thì mặc định `min(start + 2h, giờ đóng cửa cùng ngày)`. Với PUT, thiếu `endTime` thì giữ nguyên thời lượng cũ.
- Mốc giờ kết thúc trên giao diện dùng cùng các mốc 30 phút với `RESERVATION_TIME_SLOTS`. Giá trị gợi ý là giờ bắt đầu + 2 tiếng, cắt lại ở giờ đóng cửa.
- Tự hủy phiếu PENDING/CONFIRMED sau **30 phút** tính từ giờ bắt đầu, áp dụng cho mọi phiếu. Phiếu SEATED không bao giờ bị tự hủy. `DEFAULT_AUTO_CANCEL_MINUTES = 30`.
- Comment viết bằng tiếng Việt. Test: `mvn test`; frontend `npx tsc --noEmit`, `npm run build`, `npm test`.
- Commit chỉ `git add` đúng các file của task (working tree đang có thay đổi chưa commit của người dùng), và không thêm dòng `Co-Authored-By`/"Generated with".
- Sau mỗi task có sửa code: chạy `graphify update .` ở thư mục gốc repo, bằng interpreter ghi trong `graphify-out/.graphify_python`.

## Review Focus

1. Giờ kết thúc đúng bằng giờ đóng cửa (22:00) được chấp nhận; 22:30 bị từ chối → `endAtClosingTimeIsAllowed` (Task 2).
2. Đúng 30 phút được chấp nhận; 29 phút hoặc giờ kết thúc trước giờ bắt đầu bị từ chối với thông báo rõ ràng → `minimumLengthIsThirtyMinutes` (Task 2).
3. Hai phiếu nối tiếp nhau trên cùng bàn (18:00–19:00 và 19:00–20:30) đều được nhận → `backToBackBookingsDoNotClash` (Task 2).
4. Phiếu cũ không có `endTime` lúc 18:00 vẫn chặn được phiếu mới 19:59–20:30, nhưng không chặn phiếu 20:00–21:00 → `legacyReservationHoldsTwoHours` (Task 2).
5. POST lúc 21:00 không gửi `endTime` thì giờ kết thúc mặc định bị cắt về 22:00; POST lúc 21:45 bị từ chối vì không còn đủ 30 phút → `defaultEndIsClampedToClosing` (Task 3).

---

### Task 1: Model và lưu trữ `endTime`

**Files:**
- Modify: `backend-java/src/main/java/com/dalatcafe/model/Reservation.java`
- Modify: `backend-java/src/main/java/com/dalatcafe/dao/JdbcDatabase.java` (`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;`), `JdbcReservationDao.java` (cột `end_time` trong mọi SELECT, INSERT và upsert; lưu `getStoredEndTime()`, null thì ghi NULL), `InMemoryReservationDao.java` (bản sao giữ `endTime`, nếu DAO có copy)
- Modify: `docs/DATABASE.md`
- Test: `backend-java/src/test/java/com/dalatcafe/model/ModelEntitiesTest.java`, `dao/JdbcIntegrationTest.java`

**Interfaces:**
- Produces trên `Reservation`:
  - `static final Duration DEFAULT_LENGTH = Duration.ofHours(2)`
  - `void setEndTime(Instant endTime)`, `Instant getStoredEndTime()` (giá trị thô, có thể null)
  - `Instant getEndTime()`: trả `endTime` nếu có, ngược lại `dateTime.plus(DEFAULT_LENGTH)`; null khi `dateTime` null
  - `boolean overlaps(Instant start, Instant end)`: `dateTime < end && start < getEndTime()`

- [ ] **Step 1: Viết test:**
  - `ModelEntitiesTest.endTimeDefaultsToTwoHours`: không set `endTime` → `getEndTime() == dateTime + 2h`, `getStoredEndTime() == null`
  - `ModelEntitiesTest.overlapsIsHalfOpen`: phiếu 18:00–19:00 → `overlaps(19:00, 20:30)` false, `overlaps(18:30, 19:30)` true
  - `JdbcIntegrationTest.reservationEndTimeRoundTrips`: lưu phiếu có `endTime` → đọc lại bằng nhau; lưu phiếu không có `endTime` → đọc lại `getStoredEndTime()` null
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=ModelEntitiesTest,JdbcIntegrationTest` → FAIL.
- [ ] **Step 3: Cài đặt model, migration và DAO.**
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(reservation): store an optional end time"`

### Task 2: Chuỗi kiểm tra theo khoảng giờ

**Files:**
- Modify: `backend-java/src/main/java/com/dalatcafe/patterns/chain/OperatingHoursValidator.java`, `TableAvailabilityValidator.java`, `ReservationValidationChainFactory.java`
- Modify: `backend-java/src/main/java/com/dalatcafe/server/TableHandler.java`, `TableUsage.java` (đổi sang chữ ký `slotsOverlap` mới)
- Test: `backend-java/src/test/java/com/dalatcafe/patterns/ChainTest.java`, `server/TableUsageTest.java`

**Interfaces:**
- Consumes: `Reservation.getEndTime()`, `DEFAULT_LENGTH` (Task 1)
- Produces:
  - `OperatingHoursValidator.MIN_LENGTH = Duration.ofMinutes(30)`. Thông báo cố định:
    - `"Giờ kết thúc phải sau giờ bắt đầu ít nhất 30 phút."`
    - `"Giờ kết thúc không được quá giờ đóng cửa (" + closing + ")."`
  - `TableAvailabilityValidator.slotsOverlap(Instant aStart, Instant aEnd, Instant bStart, Instant bEnd): boolean` (nửa mở). Thay chữ ký ba tham số cũ; xóa constructor nhận `Duration`, `DEFAULT_DURATION` và overload `ReservationValidationChainFactory.create(..., Duration)`.

- [ ] **Step 1: Viết test trong `ChainTest`** (dùng `Clock` cố định như các test chain hiện có; giờ mở cửa 07:00–22:00):
  - `endAtClosingTimeIsAllowed`: 21:00–22:00 hợp lệ; 21:00–22:30 bị từ chối với thông báo giờ đóng cửa
  - `minimumLengthIsThirtyMinutes`: 18:00–18:30 hợp lệ; 18:00–18:29 bị từ chối; giờ kết thúc 17:00 cho giờ bắt đầu 18:00 bị từ chối
  - `endOnNextDayIsRejected`: 21:00 đến 07:30 hôm sau → bị từ chối
  - `backToBackBookingsDoNotClash`: bàn 5 có 18:00–19:00 → phiếu mới 19:00–20:30 hợp lệ; 18:45–19:15 bị từ chối
  - `legacyReservationHoldsTwoHours`: phiếu cũ 18:00 không có `endTime` → 19:59–20:30 bị từ chối, 20:00–21:00 hợp lệ
  - `TableUsageTest.usageFollowsEndTime`: phiếu 10:00–10:45 không còn giữ bàn lúc 10:50
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=ChainTest,TableUsageTest` → FAIL.
- [ ] **Step 3: Cài đặt.** `OperatingHoursValidator` kiểm tra giờ bắt đầu như cũ, rồi kiểm tra `getEndTime()`: cùng ngày giờ quán với giờ bắt đầu, `!endLocal.isAfter(closing)`, và `start + MIN_LENGTH <= end`. `TableAvailabilityValidator` so `[getDateTime(), getEndTime())` của hai phiếu. `TableHandler.bookedTablesAt` và `TableUsage` dùng `getEndTime()` của từng phiếu.
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test` → PASS. Các test cũ dùng hằng `DEFAULT_DURATION` phải được sửa sang API mới, nhưng giữ nguyên ý đồ của chúng.
- [ ] **Step 5: Commit.** `git commit -m "feat(reservation): validate bookings by their real time range"`

### Task 3: API đặt bàn, danh sách bàn trống và tự hủy 30 phút

**Files:**
- Modify: `backend-java/src/main/java/com/dalatcafe/server/ReservationHandler.java` (`create`, `update`, JSON phiếu), `TableHandler.java` (query `endTime` cho `/api/tables/catalog`), `patterns/singleton/SystemConfigManager.java`
- Modify: `docs/API_SPEC.md`
- Test: `backend-java/src/test/java/com/dalatcafe/server/ReservationHandlerTest.java`, `server/ConfigHandlerTest.java` hoặc `patterns/SingletonTest.java`

**Interfaces:**
- Consumes: Task 1, 2
- Produces:
  - `ReservationHandler.defaultEndTime(Instant start): Instant`, package-private static: `min(start + 2h, giờ đóng cửa cùng ngày giờ quán)`
  - Body POST và PUT nhận `endTime` (ISO-8601, không bắt buộc). PUT không gửi `endTime` thì `end = newStart + (current.getEndTime() − current.getDateTime())`. Định dạng sai → 400 `"endTime must be an ISO-8601 instant"`.
  - JSON phiếu thêm `"endTime"` (luôn có, lấy từ `getEndTime()`)
  - `GET /api/tables/catalog?dateTime=…&endTime=…`: `endTime` không bắt buộc, mặc định `defaultEndTime(dateTime)`
  - `SystemConfigManager.DEFAULT_AUTO_CANCEL_MINUTES = 30`. Bỏ việc nạp `autoCancelMinutes` từ store đã lưu (dòng `applyParsed(saved, "autoCancelMinutes", ...)`), để giá trị 15 đã lưu từ trước không còn tác dụng. Giá trị này vốn không sửa được qua API (`StoreConfigChange` loại nó ra).

- [ ] **Step 1: Viết test:**
  - `ReservationHandlerTest.createAcceptsEndTime`: POST 18:00–19:30 → 201; GET trả `endTime` 19:30
  - `ReservationHandlerTest.defaultEndIsClampedToClosing`: POST 21:00 không gửi `endTime` → `endTime` 22:00; POST 21:45 → 400 với thông báo 30 phút
  - `ReservationHandlerTest.updateWithoutEndTimeKeepsLength`: phiếu 18:00–19:30, PUT dời sang 19:00 không gửi `endTime` → `endTime` 20:30
  - `ReservationHandlerTest.catalogUsesEndTime`: bàn 5 có 18:00–19:00 → `catalog?dateTime=19:00&endTime=20:00` báo bàn 5 `available:true`; `dateTime=18:30` báo `false`
  - `ReservationHandlerTest.noShowAfterThirtyMinutes`: phiếu CONFIRMED lúc T; tại T+29 phút chưa bị hủy; tại T+30 phút → `CANCELLED`. Phiếu SEATED tại T+3 giờ vẫn SEATED.
  - `SingletonTest.autoCancelDefaultIsThirtyAndIgnoresStoredValue`: store có `autoCancelMinutes=15` → sau khi nạp, `getAutoCancelMinutes() == 30`
- [ ] **Step 2: Chạy, phải fail.** `mvn -q test -Dtest=ReservationHandlerTest,SingletonTest` → FAIL.
- [ ] **Step 3: Cài đặt.** Cập nhật `docs/API_SPEC.md` (trường `endTime`, tham số `endTime` của catalog).
- [ ] **Step 4: Chạy, phải pass.** `mvn -q test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(reservation): end time in the API and a 30-minute no-show hold"`

### Task 4: Quy tắc dùng chung bên frontend và form đặt bàn của khách

**Files:**
- Modify: `frontend-nextjs/lib/reservation-rules.ts`, `lib/api-client.ts` (`ReservationPayload.endTime?: string`, kiểu phiếu trả về có `endTime: string`, `fetchReservationTables(dateTime?, branch?, endTime?)`), `lib/reservations/availability.ts`, `lib/db/mock-store.ts` (phiếu demo có `endTime: Date`, `createMockReservation` kiểm tra theo khoảng), `app/actions/reservation-actions.ts`, `components/storefront/ReservationDialog.tsx`
- Create: `frontend-nextjs/scripts/test-reservation-range.ts` (script `"test:reservation-range": "tsx scripts/test-reservation-range.ts"`, thêm bước chạy vào job frontend trong `.github/workflows`)

**Interfaces:**
- Produces (`lib/reservation-rules.ts`):
  - `RESERVATION_MIN_LENGTH_MS = 30 * 60 * 1000`
  - `RESERVATION_DEFAULT_LENGTH_MS = 2 * 60 * 60 * 1000` (đổi tên từ `RESERVATION_SLOT_MS`, sửa mọi chỗ dùng)
  - `endSlotsAfter(start: string, closing = DEFAULT_CLOSING_TIME): string[]`: các mốc trong `RESERVATION_TIME_SLOTS` có giá trị ≥ start + 30 phút và ≤ closing
  - `defaultEndSlot(start: string, closing = DEFAULT_CLOSING_TIME): string | null`: start + 2h, cắt về closing; null nếu `endSlotsAfter` rỗng
  - `reservationRangeError(start: Date, end: Date): string | null`: trả đúng hai thông báo cố định của Task 2, hoặc `'Giờ kết thúc không hợp lệ.'` khi khác ngày
  - `reservationRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean` (thay `reservationSlotsOverlap`)
  - `reservationEnd(r: { dateTime: Date; endTime?: Date | null }): Date`: phiếu cũ không có `endTime` thì cộng `RESERVATION_DEFAULT_LENGTH_MS`
- `getReservationTableOptions(dateTime?, branch?, endTime?)` và `getCustomerReservationTables(dateTime?, branch?, endTime?)`
- Input của server action đặt bàn thêm `endTime: string`

- [ ] **Step 1: Viết `test-reservation-range.ts`** (`node:assert/strict`):
  - `endSlotsAfter('21:00')` → `['21:30','22:00']`; `endSlotsAfter('21:45')` → `[]`
  - `defaultEndSlot('18:00')` → `'20:00'`; `defaultEndSlot('21:00')` → `'22:00'`
  - `reservationRangeError` cho 18:00–18:29 trả thông báo 30 phút; 21:00–22:30 trả thông báo giờ đóng cửa; 18:00–18:30 trả null
  - `reservationRangesOverlap` cho 18–19 và 19–20:30 → false
- [ ] **Step 2: Chạy, phải fail.** `npx tsx scripts/test-reservation-range.ts` → FAIL vì chưa có các export này.
- [ ] **Step 3: Cài đặt.** Trong `ReservationDialog`, thêm `select` "Giờ kết thúc" cạnh "Khung giờ đón khách", lấy options từ `endSlotsAfter(selectedTimeSlot)`. Khi đổi giờ bắt đầu, nếu giờ kết thúc không còn hợp lệ thì đặt lại về `defaultEndSlot`. Gửi `endTime` (`${date}T${end}:00+07:00`) lên availability và submit. Nếu không còn mốc kết thúc hợp lệ thì khóa nút đặt và hiện thông báo 30 phút. Server action kiểm tra bằng `reservationRangeError` trước khi gọi Java.
- [ ] **Step 4: Chạy, phải pass.** `npm run test:reservation-range` → PASS; `npx tsc --noEmit` → không lỗi; `npm run build` → thành công; `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(reservation): customers choose an end time"`

### Task 5: Admin và lịch sử của khách hiển thị khoảng giờ

**Files:**
- Modify: `frontend-nextjs/app/admin/actions.ts` (`createReservation`, `updateReservation`: nhận `endTime` và kiểm tra bằng `reservationRangeError`), `components/admin/reservations-management.tsx` (cột giờ hiện `18:00 – 19:30`; form tạo và sửa có ô giờ kết thúc dùng `endSlotsAfter`/`defaultEndSlot`), `components/account/reservation-history.tsx` (hiện khoảng giờ)
- Test: `frontend-nextjs/scripts/test-ui-ux.mjs`

**Interfaces:**
- Consumes: Task 4 (`endSlotsAfter`, `defaultEndSlot`, `reservationRangeError`, `reservationEnd`), Task 3 (JSON có `endTime`)
- Produces: `NewReservationInput.endTime: string`; input của `updateReservation` có `endTime?: string`. Không gửi thì backend giữ nguyên thời lượng cũ.

- [ ] **Step 1: Viết test** `TC-RES-END-01` "Admin Reservations Page Shows Time Ranges": cookie ADMIN, GET `/admin/reservations` ở chế độ demo → HTML chứa một khoảng giờ khớp `/\d{2}:\d{2} – \d{2}:\d{2}/`. Seed demo trong `mock-store` phải có ít nhất một phiếu có `endTime`.
- [ ] **Step 2: Chạy, phải fail.** `npm test` → case mới FAIL.
- [ ] **Step 3: Cài đặt.**
- [ ] **Step 4: Chạy, phải pass.** `npx tsc --noEmit`, `npm run build`, `npm test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(reservation): admin and account views show the booked range"`

### Task 6: Báo cáo và cập nhật graph

**Files:**
- Create: `docs/reports/nightly/2026-10-29-reservation-end-time.md`
- Modify: `docs/reports/README.md`

- [ ] **Step 1:** Chạy `cd backend-java && mvn -q clean test` và `cd frontend-nextjs && npx tsc --noEmit && npm run test:reservation-range && npm run build`. Ghi kết quả thật vào báo cáo.
- [ ] **Step 2:** Chạy `graphify update .` ở thư mục gốc repo.
- [ ] **Step 3: Commit.** `git commit -m "docs(reports): reservation end time session report"`

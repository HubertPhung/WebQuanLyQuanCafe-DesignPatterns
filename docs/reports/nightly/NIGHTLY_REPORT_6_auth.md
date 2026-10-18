# NIGHTLY REPORT, phiên 6 (bảo mật đăng nhập và phân quyền): tự động 2026-10-18, nhánh `feature/hoai-bo`

- HEAD: `67e5253`. **Chưa commit, push hay mở PR. Working tree chính không bị sửa**, chỉ có thêm 2 file chưa theo dõi: báo cáo này và `NIGHTLY_6_auth.patch`.
- **Lý do làm trong worktree riêng:** lúc bắt đầu có 4 phiên Claude khác cùng chạy trên working tree này (3 phiên "NIGHTLY AUTONOMOUS CODING", 1 phiên "NIGHTLY FIXER", 1 phiên "NIGHTLY REVIEW"; xem `Get-CimInstance Win32_Process`). Phiên 5 đã từng hỏng `mvn clean test` vì hai phiên dùng chung `target/`. Vì vậy phiên này:
  1. chụp trạng thái working tree bằng `git stash create` (không đụng tới working tree), ra commit `3987e60`;
  2. tạo worktree tách rời tại `C:\Users\phung\AppData\Local\Temp\claude\D--University-MauThietKe-WebQuanLyQuanCafe-DesignPatterns\3f776807-c877-4433-86fd-a05caf5e74f6\scratchpad\wt`, rồi chép thêm 21 file chưa theo dõi;
  3. sửa và test hoàn toàn trong worktree, rồi xuất patch.
- Phiên này cố ý chọn mảng **chưa phiên nào động tới**: xác thực, phân quyền và chuyển hướng sau khi đăng nhập. Các mục còn lại trong `NEXT_PLAN.md` có thể đang được các phiên song song làm.

## 1. Tóm tắt

| # | Lỗi | Mức độ | Kết quả |
| :-: | :--- | :--- | :--- |
| S1 | Đường dẫn giống tên (`/api/usersX`, `/api/configX`, `/api/menuX`) lọt qua kiểm tra vai trò. Tài khoản **STAFF tạo được tài khoản ADMIN** | **Nghiêm trọng**: leo thang đặc quyền | ✅ Đã sửa, có test, đã kiểm tra đột biến |
| S2 | Mật khẩu có khoảng trắng đầu/cuối: đăng ký được nhưng **không bao giờ đăng nhập lại được** | Trung bình: mất quyền vào tài khoản | ✅ Đã sửa, có test, đã kiểm tra đột biến |
| S3 | Open redirect qua `?next=/%09/evil.com` sau khi đăng nhập | Trung bình: lừa đảo (phishing) | ✅ Đã sửa, có test, đã kiểm tra đột biến |
| D1 | `test-ui-ux.mjs` luôn khởi động `next dev -p 3000`, bỏ qua cổng trong `TEST_BASE_URL` | Nhỏ: DX | ✅ Đã sửa |

Backend: **247 → 250** JUnit, 0 fail, 0 skip. Frontend: **39 → 40** ca UI, 40/40 PASS.

## 2. Chi tiết

### S1: Leo thang đặc quyền qua đường dẫn giống tên
- **Nguyên nhân:** `HttpServer` của JDK chọn context theo **tiền tố chuỗi**, nên `/api/usersX` được chuyển tới handler của `/api/users`. Các handler chỉ kiểm phần sau (`parts.get(2)`), không kiểm `parts.get(1)`. Trong khi đó, `SimpleAuthFilter.required` so khớp **chính xác** (`p.equals("/api/users")`), nên `/api/usersX` rơi vào nhánh mặc định `STAFF`.
- **Tái hiện** (test viết trước khi sửa, token STAFF thật, server chạy như production):

  | Request (token STAFF) | Trước khi sửa | Kỳ vọng |
  | :--- | :-: | :-: |
  | `GET /api/usersX`: liệt kê mọi tài khoản | **200** | 404 |
  | `POST /api/usersX` với `"role":"admin"` | **201**, và đăng nhập được bằng tài khoản ADMIN mới (**200**) | 404 |
  | `PUT /api/configX`: đổi cấu hình cửa hàng | **200** | 404 |
  | `POST /api/menuX` (cần MANAGER) | **400** (đã qua lớp phân quyền, chỉ fail ở bước kiểm dữ liệu) | 404 |
- **Cách sửa** (`SimpleAuthFilter.java`): trước mọi kiểm tra khác, request chỉ đi tiếp khi đường dẫn **là chính context path, hoặc là đường dẫn con** (`context + "/"`). Ngược lại trả 404 `NOT_FOUND`. Cách này áp dụng chung cho mọi context, nên endpoint mới không mắc lại lỗi này. `required()` giữ nguyên.
- Đã kiểm hợp đồng với frontend: mọi đường dẫn mà `frontend-nextjs` gọi đều là context path hoặc đường dẫn con (grep `'/api/...'` trong `lib/`, `app/`, `scripts/`), nên không có lời gọi nào bị ảnh hưởng.

### S2: Mật khẩu bị cắt khoảng trắng khi đăng nhập
- **Nguyên nhân:** `register`, `/api/users` và `newPassword` băm mật khẩu **nguyên văn** (`AuthHandler.password`). Còn `login` đọc qua `requireStr`, và `currentPassword` đọc qua `str`; cả hai đều `trim()`. Frontend (`app/auth/actions.ts`) gửi nguyên văn. Hệ quả: đăng ký với `" Coffee2026 "` thì vào được ngay (nhờ phiên tạo lúc đăng ký), nhưng mọi lần đăng nhập sau đều trả 401 và bị tính vào giới hạn khoá 5 lần.
- **Cách sửa** (`AuthHandler.java`): thêm `presentedPassword(body, key)`, đọc chuỗi nguyên văn (sai kiểu vẫn trả 400). `login` vẫn trả 400 khi thiếu mật khẩu hoặc mật khẩu rỗng. `AdminBootstrap` vốn đã băm `ADMIN_PASSWORD` nguyên văn, nên vẫn khớp.
- Không làm hỏng tài khoản cũ: mật khẩu luôn được lưu nguyên văn, nên ai đăng nhập được trước đây (mật khẩu không có khoảng trắng đầu/cuối) vẫn đăng nhập như cũ.

### S3: Open redirect sau đăng nhập (`lib/auth/roles.ts#safeNext`)
- **Nguyên nhân:** `safeNext` chỉ chặn `//` và `/\`. Trình duyệt (chuẩn WHATWG URL) **bỏ ký tự tab và xuống dòng**, nên `next` = `"/\t/evil.com"` (từ `?next=%2F%09%2Fevil.com`) qua được kiểm tra, rồi trở thành `//evil.com`.
- **Tái hiện:** chạy hàm cũ và hàm mới bằng `tsx` trên cùng các đầu vào. Hàm cũ cho `"/\t/evil.com"` và `"/\n/evil.com"` resolve ra `https://evil.com/`. Form đăng nhập render `<input name="next" value="/	/evil.com">`.
- **Cách sửa:** resolve `next` bằng `new URL(next, base)` như trình duyệt sẽ làm, chỉ giữ khi origin không đổi, và trả về dạng đã chuẩn hoá `pathname + search + hash`. Hàm này dùng chung cho form đăng nhập, form đăng ký, server action và cả hai route Google (`start`, `callback`).

## 3. Bằng chứng đã chạy
Mọi lệnh chạy **trong worktree**. `mvn` chạy trong `backend-java/`.

| # | Lệnh | Kết quả |
| :-: | :--- | :--- |
| E0 | `mvn -q -B clean test` (baseline) | `EXIT=0`, đếm `TEST-*.xml`: **TOTAL 247, fail 0, err 0, skip 0** |
| E1 | `mvn -q -B test -Dtest='AuthTest#lookalike*'` trước khi sửa | Fail: `expected: <403> but was: <200>`. Bản thăm dò in ra lần lượt `200, 201, 200 (đăng nhập ADMIN giả), 200, 400, 401` |
| E2 | `mvn -q -B test -Dtest='AuthTest,SecurityTest,ServerTest'` sau khi sửa S1 | `EXIT=0` |
| E3 | Đột biến S1: đổi `withinContext` thành `path.startsWith(context)` | Fail: `AuthTest.lookalikePathsDoNotSkipTheRoleCheck:184 expected: <404> but was: <200>`. Đã khôi phục |
| E4 | `-Dtest='AuthTest#passwordsWith*'` trước khi sửa S2 | Fail: `INVALID_CREDENTIALS … expected: <200> but was: <401>` |
| E5 | Đột biến S2: login dùng lại `requireStr` / `currentPassword` dùng lại `str` | Fail ở `:181` (401) và `:185` (401). Đã khôi phục |
| E6 | `npx tsc --noEmit -p .` (frontend) | `TSC_EXIT=0` |
| E7 | `TEST_BASE_URL=http://localhost:3107 npm test` (server `next dev` riêng của worktree, cổng 3107) | `NPM_EXIT=0`, **40/40 PASS** |
| E8 | Đột biến S3: khôi phục `roles.ts` từ HEAD, chạy lại `npm test` | `NPM_EXIT=1`, chỉ fail `TC-AUTH-08`: `leaked=["/\t/evil.com","/\n/evil.com"]`, `field=value="/	/evil.com"`. Đã khôi phục |
| E9 | `mvn -B clean test` (cuối phiên) | `MVN_EXIT=0`, `Tests run: 250, Failures: 0, Errors: 0, Skipped: 0`, `BUILD SUCCESS`. Đếm `TEST-*.xml`: **TOTAL 250, fail 0, err 0, skip 0** |
| E10 | `mvn -q -B test -Dtest=AuthTest` × 2 lần | `EXIT=0` cả 2 lần |
| E11 | `git apply --check NIGHTLY_6_auth.patch` trên working tree chính | `APPLY_CHECK=0`. 11 file trong patch giống hệt bản chụp (chỉ khác CRLF/LF), nghĩa là chưa phiên song song nào sửa các file này |

**Không chạy:** `npm run build` (không có thay đổi cấu hình build, `tsc` đã pass); `graphify update .` (graph nằm ở working tree chính, mà code ở đó chưa đổi; chạy sau khi áp patch). GitHub Actions chưa chạy vì chưa push.

**Vướng môi trường (đã xử lý):** Turbopack và webpack đều không chạy được khi `node_modules` là junction trỏ sang ổ khác (C: → D:): `Symlink node_modules could not be resolved` / `Can't resolve './D:/…'`. Phiên đã thay junction bằng bản sao thật bằng robocopy (đủ 80.015 file, khoảng 1 GB). Bản sao chỉ nằm trong worktree, không đụng `node_modules` của repo.

## 4. File thay đổi (trong patch)

| File | Thay đổi |
| :--- | :--- |
| `backend-java/.../server/SimpleAuthFilter.java` | Trả 404 cho đường dẫn không thuộc context. Thêm `withinContext(path, context)` |
| `backend-java/.../server/AuthHandler.java` | Thêm `presentedPassword()`; `login` và `changePassword` so mật khẩu nguyên văn |
| `backend-java/.../server/AuthTest.java` | +2 test: `lookalikePathsDoNotSkipTheRoleCheck`, `passwordsWithSurroundingSpacesWorkExactlyAsTyped` |
| `backend-java/.../server/ServerTest.java` | +1 test: `onlyTheContextPathAndItsSubPathsBelongToAContext` |
| `frontend-nextjs/lib/auth/roles.ts` | `safeNext` resolve như trình duyệt, kiểm origin |
| `frontend-nextjs/scripts/test-ui-ux.mjs` | + `TC-AUTH-08`; server tự khởi động dùng cổng lấy từ `TEST_BASE_URL` |
| `docs/API_SPEC.md` §1.3 | Ghi quy tắc 404 cho đường dẫn giống tên, và quy tắc so mật khẩu nguyên văn |
| `README.md`, `docs/TESTING.md`, `docs/DESIGN_PATTERNS_SPEC.md`, `.github/workflows/ci.yml` | Số test 245 → **250** JUnit (con số đo được, gồm cả 2 test `JdbcDatabaseTest` của phiên kia mà README chưa tính) và 39 → **40** UI. Mô tả test mới |

## 5. Cần bạn xem xét
1. **Áp patch** (từ thư mục gốc repo, sau khi các phiên song song đã dừng):
   ```bash
   git apply --check NIGHTLY_6_auth.patch && git apply NIGHTLY_6_auth.patch
   cd backend-java && mvn -B clean test        # kỳ vọng 250 + số test các phiên khác thêm vào
   cd ../frontend-nextjs && npx tsc --noEmit -p . && npm test   # kỳ vọng 40/40
   "C:/Users/phung/AppData/Roaming/uv/tools/graphifyy/Scripts/python.exe" -m graphify update .
   ```
   Nếu phiên khác đã sửa README hoặc TESTING.md (số test), phần tài liệu của patch có thể conflict. Phần code (5 file Java/TS + 2 file test) độc lập với tài liệu.
2. **S1 nên là một commit riêng, ưu tiên cao**, và nên merge trước các commit khác: đây là lỗ hổng leo thang đặc quyền có thể khai thác bằng một token STAFF bình thường. Nếu bản cũ đã từng deploy ở đâu đó, nên kiểm tra danh sách tài khoản ADMIN.
3. **Thay đổi hành vi API:** `/api/<tên>X` trước đây có thể trả 200/400/403, giờ luôn trả 404. Frontend không gọi đường dẫn nào như vậy.
4. **Gợi ý commit** (không thêm `Co-Authored-By`): `fix(auth): reject lookalike paths before the role check` (SimpleAuthFilter, AuthTest#lookalike, ServerTest); `fix(auth): compare passwords exactly as typed` (AuthHandler, AuthTest#passwords); `fix(frontend): resolve ?next= like a browser before redirecting` (roles.ts, TC-AUTH-08); `docs: test counts and auth rules`.
5. **Dọn dẹp:** worktree tạm (gồm khoảng 1 GB `node_modules`) ở `C:\Users\phung\AppData\Local\Temp\claude\D--University-MauThietKe-WebQuanLyQuanCafe-DesignPatterns\3f776807-c877-4433-86fd-a05caf5e74f6\scratchpad\wt`. Gỡ bằng `git worktree remove --force <đường dẫn>`. Worktree ở trạng thái detached HEAD tại commit stash `3987e60`, không tạo nhánh mới.

## 6. Chưa làm và lý do
| Mục | Lý do |
| :--- | :--- |
| Đổi mật khẩu không thu hồi token cũ (JWT không trạng thái, TTL 8 giờ) | Là quyết định thiết kế (cần `tokenVersion` trong tài khoản, tức thay đổi schema) |
| `Json.parse` chấp nhận số kiểu `+1`, `01`, `.5`; khoá trùng thì khoá sau thắng | Lỏng nhưng không gây sai dữ liệu hiện tại; siết lại có thể làm hỏng client cũ |
| Các mục còn mở trong `NEXT_PLAN.md` (§4, §5) | Cần bạn quyết định, hoặc có thể trùng với phiên song song |

## 7. Xem diff
```bash
git apply --stat NIGHTLY_6_auth.patch
# hoặc xem trực tiếp trong worktree:
git -C "C:/Users/phung/AppData/Local/Temp/claude/D--University-MauThietKe-WebQuanLyQuanCafe-DesignPatterns/3f776807-c877-4433-86fd-a05caf5e74f6/scratchpad/wt" diff
```

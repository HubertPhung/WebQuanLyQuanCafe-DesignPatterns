# Asset nội bộ

Ảnh và font của ứng dụng được phục vụ từ project, không cần CDN hoặc Google Fonts khi build/chạy.

- `frontend-nextjs/public/images/catalog/`: 26 ảnh JPEG tải từ các URL Unsplash trước đây, giữ kích thước 800 px và chất lượng 80.
- `frontend-nextjs/public/fonts/`: Be Vietnam Pro (300–700), Playfair Display variable (normal/italic), gồm bộ ký tự tiếng Việt và giấy phép OFL.
- `frontend-nextjs/public/vendor/vis-network/`: thư viện 9.1.6 và giấy phép, dùng cho HTML Graphify.
- `sources.json`: nguồn tải, kích thước và SHA-256 để kiểm tra tính toàn vẹn; các URL này chỉ là thông tin xuất xứ.

Ảnh `photo-1445116572660-238429888876` trả về HTTP 404, được thay bằng ảnh quầy bar `/images/space/counter.jpg` có sẵn.

`lib/assets.ts` chuyển URL Unsplash cũ trong dữ liệu/giỏ hàng sang bản local. Ảnh ngoài danh mục dùng placeholder nội bộ. Form quản trị nhận ảnh tải lên hoặc đường dẫn trong trang; ảnh món tải lên dạng data URL vẫn hoạt động.

Cập nhật Graphify và giữ HTML dùng thư viện local, chạy từ `frontend-nextjs`:

```powershell
npm run graphify:update
```

Nếu đã tái tạo HTML bằng lệnh Graphify trực tiếp, đổi đường dẫn CDN về local bằng:

```powershell
npm run graphify:local-assets
```

Kiểm tra các file tải về và ánh xạ ảnh bằng `npm run test:assets`.

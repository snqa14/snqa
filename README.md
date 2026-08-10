# Tiết kiệm 240k

Web nhỏ để theo dõi mục tiêu tiết kiệm 240,000đ, lưu tiến độ và ảnh kỷ niệm.


## Chạy trên VPS bằng 1 file server Python

Không cần PHP hay file route riêng. Chỉ cần chạy `server.py`; file này tự phục vụ giao diện web, route API lưu `data.json`, và route upload ảnh vào thư mục `uploads/`.

## Chạy trên VPS không cần treo Python server


Nếu VPS có Apache/Nginx kèm PHP, upload các file `index.html`, `style.css`, `script.js`, `api.php`, `data.json` và thư mục `uploads/` lên cùng một thư mục public. Ứng dụng sẽ gọi `api.php` để đọc/ghi `data.json`, nên không cần giữ tiến trình `python3 server.py` chạy nền.

> Lưu ý: thư mục chứa `data.json` và thư mục `uploads/` cần quyền ghi cho user chạy web server (ví dụ `www-data`).

Nếu VPS có Apache/Nginx kèm PHP, upload các file `index.html`, `style.css`, `script.js`, `api.php` và `data.json` lên cùng một thư mục public. Ứng dụng sẽ gọi `api.php` để đọc/ghi `data.json`, nên không cần giữ tiến trình `python3 server.py` chạy nền.

> Lưu ý: thư mục chứa `data.json` cần quyền ghi cho user chạy web server (ví dụ `www-data`).


API PHP cung cấp:

- `GET /api.php` để đọc dữ liệu tiết kiệm.
- `POST /api.php` để lưu dữ liệu tiết kiệm vào `data.json`.

- `POST /api.php?action=upload-image` để lưu ảnh vào thư mục `uploads/` trên VPS và trả về URL ảnh.


## Chạy bằng Python server (dự phòng khi dev local)


1. Khởi động server:

   ```bash
   python3 server.py
   ```

2. Mở trình duyệt tại:

   ```text
   http://localhost:5000
   ```


3. Khi deploy lên VPS, trỏ reverse proxy/domain về port `5000` và đảm bảo thư mục repo có quyền ghi để tạo/cập nhật `data.json` và `uploads/`.



Python server cung cấp:

- `GET /` để mở web.
- `GET /api/data` để đọc dữ liệu tiết kiệm.
- `POST /api/data` để lưu dữ liệu tiết kiệm vào `data.json`.
- `POST /api/upload-image` để lưu ảnh vào thư mục `uploads/` trên VPS và trả về URL ảnh.
- `GET /api/health` để kiểm tra server đang chạy.

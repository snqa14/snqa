# Tiết kiệm 240k

Web nhỏ để theo dõi mục tiêu tiết kiệm 240,000đ, lưu tiến độ và ảnh kỷ niệm.

## Chạy trên VPS không cần treo Python server

Nếu VPS có Apache/Nginx kèm PHP, upload các file `index.html`, `style.css`, `script.js`, `api.php` và `data.json` lên cùng một thư mục public. Ứng dụng sẽ gọi `api.php` để đọc/ghi `data.json`, nên không cần giữ tiến trình `python3 server.py` chạy nền.

> Lưu ý: thư mục chứa `data.json` cần quyền ghi cho user chạy web server (ví dụ `www-data`).

API PHP cung cấp:

- `GET /api.php` để đọc dữ liệu tiết kiệm.
- `POST /api.php` để lưu dữ liệu tiết kiệm vào `data.json`.

## Chạy bằng Python server (dự phòng khi dev local)

1. Khởi động server:

   ```bash
   python3 server.py
   ```

2. Mở trình duyệt tại:

   ```text
   http://localhost:5000
   ```

Python server cung cấp:

- `GET /` để mở web.
- `GET /api/data` để đọc dữ liệu tiết kiệm.
- `POST /api/data` để lưu dữ liệu tiết kiệm vào `data.json`.
- `GET /api/health` để kiểm tra server đang chạy.

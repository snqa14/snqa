# Tiết kiệm 240k

Web nhỏ để theo dõi mục tiêu tiết kiệm 240,000đ, lưu tiến độ và ảnh kỷ niệm.

## Chạy bằng Python server

1. Khởi động server:

   ```bash
   python3 server.py
   ```

2. Mở trình duyệt tại:

   ```text
   http://localhost:5000
   ```

Server cung cấp:

- `GET /` để mở web.
- `GET /api/data` để đọc dữ liệu tiết kiệm.
- `POST /api/data` để lưu dữ liệu tiết kiệm vào `data.json`.
- `GET /api/health` để kiểm tra server đang chạy.

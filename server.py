"""One-file Python server for the savings tracker web app."""

from __future__ import annotations

import base64
import binascii
import json
import mimetypes
import re
import secrets
from datetime import datetime
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any
from urllib.parse import quote, urlparse

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"
UPLOAD_DIR = BASE_DIR / "uploads"
TARGET = 240_000
MAX_IMAGE_BYTES = 5 * 1024 * 1024

DEFAULT_DATA: dict[str, Any] = {
    "money": 0,
    "images": [],
    "daily": {},
}

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ("jpg", (b"\xff\xd8\xff",)),
    "image/png": ("png", (b"\x89PNG\r\n\x1a\n",)),
    "image/webp": ("webp", (b"RIFF",)),
    "image/gif": ("gif", (b"GIF87a", b"GIF89a")),
}

DATA_URL_PATTERN = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", re.DOTALL)


mimetypes.add_type("image/webp", ".webp")


def load_data() -> dict[str, Any]:
    """Load saved progress from disk, creating defaults when needed."""
    if not DATA_FILE.exists():
        return DEFAULT_DATA.copy()

    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError):
        return DEFAULT_DATA.copy()

    return clean_data(data)


def clean_data(data: dict[str, Any]) -> dict[str, Any]:
    """Normalize client-provided data before storing it."""
    return {
        "money": max(int(data.get("money") or 0), 0),
        "images": data.get("images") if isinstance(data.get("images"), list) else [],
        "daily": data.get("daily") if isinstance(data.get("daily"), dict) else {},
    }


def save_data(data: dict[str, Any]) -> None:
    """Persist progress atomically to avoid partial writes."""
    with NamedTemporaryFile("w", encoding="utf-8", dir=BASE_DIR, delete=False) as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temp_path = Path(file.name)

    temp_path.replace(DATA_FILE)


def detect_image_type(content: bytes, requested_type: str) -> tuple[str, str] | None:
    """Return the safe mime type and extension when the upload looks like an image."""
    if requested_type == "image/webp":
        is_webp = len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP"
        return ("image/webp", "webp") if is_webp else None

    for mime_type, (extension, signatures) in ALLOWED_IMAGE_TYPES.items():
        if requested_type and requested_type != mime_type:
            continue
        if any(content.startswith(signature) for signature in signatures):
            return mime_type, extension

    if not requested_type:
        for mime_type, (extension, signatures) in ALLOWED_IMAGE_TYPES.items():
            if mime_type == "image/webp":
                continue
            if any(content.startswith(signature) for signature in signatures):
                return mime_type, extension

    return None


def public_base_url(handler: SimpleHTTPRequestHandler) -> str:
    """Build the absolute public base URL for generated upload links."""
    scheme = "https" if handler.headers.get("X-Forwarded-Proto") == "https" else "http"
    host = handler.headers.get("Host", "localhost:5000")
    return f"{scheme}://{host}"


def save_uploaded_image(payload: dict[str, Any], handler: SimpleHTTPRequestHandler) -> dict[str, str]:
    """Decode a base64 image payload and save it into uploads on the VPS."""
    raw_image = str(payload.get("image") or "")
    requested_type = str(payload.get("type") or "")
    if not raw_image:
        raise ValueError("Thiếu dữ liệu ảnh.")

    match = DATA_URL_PATTERN.match(raw_image)
    if match:
        requested_type = match.group(1)
        raw_image = match.group(2)

    if requested_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError("Chỉ hỗ trợ ảnh JPG, PNG, WEBP hoặc GIF.")

    try:
        image_bytes = base64.b64decode(raw_image, validate=True)
    except binascii.Error as error:
        raise ValueError("Dữ liệu ảnh base64 không hợp lệ.") from error

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("Ảnh vượt quá giới hạn 5MB.")

    detected = detect_image_type(image_bytes, requested_type)
    if detected is None:
        raise ValueError("File tải lên không phải ảnh hợp lệ.")

    _, extension = detected
    UPLOAD_DIR.mkdir(mode=0o755, exist_ok=True)
    filename = f"{datetime.utcnow():%Y%m%d-%H%M%S}-{secrets.token_hex(6)}.{extension}"
    image_path = UPLOAD_DIR / filename
    image_path.write_bytes(image_bytes)

    return {
        "url": f"{public_base_url(handler)}/uploads/{quote(filename)}",
        "path": f"uploads/{filename}",
    }


class SavingsRequestHandler(SimpleHTTPRequestHandler):
    """Serve static files and JSON endpoints for the web app."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self.write_json({"status": "ok", "target": TARGET})
            return

        if path == "/api/data":
            self.write_json(load_data())
            return

        if path == "/":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        payload = self.read_json_payload()
        if payload is None:
            return

        if path == "/api/data":
            cleaned = clean_data(payload)
            save_data(cleaned)
            self.write_json({"ok": True, "data": cleaned})
            return

        if path == "/api/upload-image":
            try:
                image = save_uploaded_image(payload, self)
            except ValueError as error:
                self.write_json({"ok": False, "error": str(error)}, HTTPStatus.BAD_REQUEST)
                return
            except OSError:
                self.write_json({"ok": False, "error": "Không lưu được ảnh lên VPS."}, HTTPStatus.INTERNAL_SERVER_ERROR)
                return

            self.write_json({"ok": True, "image": image})
            return

        self.send_error(HTTPStatus.NOT_FOUND, "API endpoint not found")

    def read_json_payload(self) -> dict[str, Any] | None:
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON payload")
            return None

        if not isinstance(payload, dict):
            self.send_error(HTTPStatus.BAD_REQUEST, "JSON payload must be an object")
            return None

        return payload

    def write_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        response = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


def main() -> None:
    server = ThreadingHTTPServer(("0.0.0.0", 5000), SavingsRequestHandler)
    print("Server đang chạy tại http://localhost:5000")
    server.serve_forever()


if __name__ == "__main__":
    main()

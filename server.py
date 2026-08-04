"""Small standard-library Python API server for the savings tracker web app."""

from __future__ import annotations

import json
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data.json"
TARGET = 240_000

DEFAULT_DATA: dict[str, Any] = {
    "money": 0,
    "images": [],
    "daily": {},
}


def load_data() -> dict[str, Any]:
    """Load saved progress from disk, creating defaults when needed."""
    if not DATA_FILE.exists():
        return DEFAULT_DATA.copy()

    try:
        with DATA_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (json.JSONDecodeError, OSError):
        return DEFAULT_DATA.copy()

    return {
        "money": int(data.get("money") or 0),
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
        if self.path == "/api/health":
            self.write_json({"status": "ok", "target": TARGET})
            return

        if self.path == "/api/data":
            self.write_json(load_data())
            return

        if self.path == "/":
            self.path = "/index.html"

        super().do_GET()

    def do_POST(self) -> None:
        if self.path != "/api/data":
            self.send_error(HTTPStatus.NOT_FOUND, "API endpoint not found")
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_error(HTTPStatus.BAD_REQUEST, "Invalid JSON payload")
            return

        cleaned = {
            "money": max(int(payload.get("money") or 0), 0),
            "images": payload.get("images") if isinstance(payload.get("images"), list) else [],
            "daily": payload.get("daily") if isinstance(payload.get("daily"), dict) else {},
        }
        save_data(cleaned)
        self.write_json({"ok": True, "data": cleaned})

    def write_json(self, payload: dict[str, Any]) -> None:
        response = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(HTTPStatus.OK)
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

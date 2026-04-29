"""Tiny MJPEG server that exposes the FocusTracker camera feed (with mesh
+ iris overlay) to the React frontend over `<img src="…/video_feed">`.

When no session is active the camera is closed and the stream serves a
neutral placeholder so the frontend `<img>` doesn't break.

Stdlib only — uses `http.server.ThreadingHTTPServer`. No new deps.
"""

import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np

from backend.overlay import make_overlay_renderer

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
TARGET_FPS = 30
JPEG_QUALITY = 80
PLACEHOLDER_W = 640
PLACEHOLDER_H = 480


def _build_placeholder() -> bytes:
    """Solid dark frame with a hint label, used when no session is active."""
    frame = np.full((PLACEHOLDER_H, PLACEHOLDER_W, 3), 18, dtype=np.uint8)
    cv2.putText(frame, "Sin sesion", (PLACEHOLDER_W // 2 - 90, PLACEHOLDER_H // 2),
                cv2.FONT_HERSHEY_DUPLEX, 0.9, (110, 110, 110), 2, cv2.LINE_AA)
    ok, jpg = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
    return jpg.tobytes() if ok else b""


_PLACEHOLDER_JPG = _build_placeholder()


def _make_handler(tracker):
    """Bind a fresh handler class to a specific FocusTracker instance."""

    class VideoHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            return  # quiet

        def do_GET(self):
            if self.path == "/video_feed":
                self._stream_mjpeg()
            elif self.path == "/health":
                self.send_response(200)
                self.send_header("Content-Type", "text/plain")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(b"ok")
            else:
                self.send_response(404)
                self.end_headers()

        def _stream_mjpeg(self):
            self.send_response(200)
            self.send_header("Age", "0")
            self.send_header("Cache-Control", "no-cache, private")
            self.send_header("Pragma", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()

            render = make_overlay_renderer()
            frame_interval = 1.0 / TARGET_FPS
            last = 0.0
            try:
                while True:
                    now = time.time()
                    if now - last < frame_interval:
                        time.sleep(max(0.0, frame_interval - (now - last)))
                    last = time.time()

                    frame, state = tracker.get_frame_and_state()
                    if frame is None:
                        payload = _PLACEHOLDER_JPG
                    else:
                        rendered = render(frame, state)
                        ok, jpg = cv2.imencode(".jpg", rendered, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY])
                        if not ok:
                            continue
                        payload = jpg.tobytes()

                    try:
                        self.wfile.write(b"--frame\r\n")
                        self.wfile.write(b"Content-Type: image/jpeg\r\n")
                        self.wfile.write(f"Content-Length: {len(payload)}\r\n\r\n".encode("ascii"))
                        self.wfile.write(payload)
                        self.wfile.write(b"\r\n")
                    except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                        return
            except Exception as e:
                print(f"[video_server] stream error: {e}")

    return VideoHandler


def start_video_server(tracker, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> threading.Thread:
    """Start the MJPEG server in a daemon thread. Returns the thread."""
    handler = _make_handler(tracker)
    ThreadingHTTPServer.daemon_threads = True
    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer((host, port), handler)

    def _serve():
        print(f"[video_server] escuchando en http://{host}:{port}/video_feed")
        try:
            server.serve_forever()
        except Exception as e:
            print(f"[video_server] error: {e}")

    t = threading.Thread(target=_serve, daemon=True, name="video_server")
    t.start()
    return t


def get_video_url(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> str:
    return f"http://{host}:{port}/video_feed"

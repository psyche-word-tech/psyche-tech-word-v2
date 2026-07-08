#!/usr/bin/env python3
"""
支持反向代理的静态文件服务器
- 提供 client/web-static 目录的静态文件
- 将 /api/* 请求代理到 localhost:9091
"""
import http.server
import socketserver
import urllib.request
import urllib.error
import os
import sys

PORT = 5000
API_TARGET = "http://localhost:9091"
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "client", "web-static")


class ProxyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=STATIC_DIR, **kwargs)

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._proxy_request('GET')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            self._proxy_request('POST')
        else:
            self.send_error(405, "Method Not Allowed")

    def do_PUT(self):
        if self.path.startswith('/api/'):
            self._proxy_request('PUT')
        else:
            self.send_error(405, "Method Not Allowed")

    def do_PATCH(self):
        if self.path.startswith('/api/'):
            self._proxy_request('PATCH')
        else:
            self.send_error(405, "Method Not Allowed")

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self._proxy_request('DELETE')
        else:
            self.send_error(405, "Method Not Allowed")

    def do_OPTIONS(self):
        if self.path.startswith('/api/'):
            self._proxy_request('OPTIONS')
        else:
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
            self.end_headers()

    def _proxy_request(self, method):
        target_url = API_TARGET + self.path
        content_length = self.headers.get('Content-Length')
        body = None
        if content_length:
            body = self.rfile.read(int(content_length))

        headers = {}
        for key, value in self.headers.items():
            if key.lower() not in ('host', 'content-length'):
                headers[key] = value

        req = urllib.request.Request(target_url, data=body, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                body = response.read()
                self.send_response(response.status)
                for key, value in response.headers.items():
                    if key.lower() not in ('transfer-encoding', 'content-encoding', 'content-length'):
                        self.send_header(key, value)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for key, value in e.headers.items():
                self.send_header(key, value)
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            print(f"[Proxy Error] {method} {target_url}: {e}", file=sys.stderr)
            self.send_error(502, f"Proxy Error: {e}")

    def log_message(self, format, *args):
        print(f"[ProxyServer] {self.address_string()} - {format % args}")


if __name__ == '__main__':
    os.chdir(STATIC_DIR)
    with socketserver.TCPServer(("0.0.0.0", PORT), ProxyHandler) as httpd:
        print(f"[ProxyServer] Serving static files from {STATIC_DIR}")
        print(f"[ProxyServer] Proxying /api/* to {API_TARGET}")
        print(f"[ProxyServer] Listening on http://0.0.0.0:{PORT}")
        httpd.serve_forever()

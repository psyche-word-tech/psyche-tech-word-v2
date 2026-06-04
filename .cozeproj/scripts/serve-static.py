#!/usr/bin/env python3
import http.server, socketserver, os, sys, urllib.request, urllib.error, json, socket

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
ROOT = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else ".")

API_TARGET = "http://localhost:9091"

class ReusableTCPServer(socketserver.TCPServer):
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        super().server_bind()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # 修复工作目录被删除的问题
        try:
            os.getcwd()
        except FileNotFoundError:
            os.chdir('/')
        super().__init__(*args, directory=ROOT, **kwargs)

    def _send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        if self.path.startswith('/api/'):
            self.send_response(204)
            self._send_cors_headers()
            self.end_headers()
            return
        self.send_response(405)
        self.end_headers()

    def _proxy_api(self):
        """Proxy /api/* requests to the backend server."""
        target_url = API_TARGET + self.path
        body = None
        content_length = self.headers.get('Content-Length')
        if content_length:
            body = self.rfile.read(int(content_length))

        try:
            req = urllib.request.Request(
                target_url,
                method=self.command,
                data=body,
                headers={
                    k: v for k, v in self.headers.items()
                    if k.lower() not in ('host', 'content-length', 'transfer-encoding')
                },
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                self.send_response(resp.status)
                for k, v in resp.headers.items():
                    if k.lower() not in ('transfer-encoding', 'content-encoding'):
                        self.send_header(k, v)
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(resp.read())
        except urllib.error.HTTPError as e:
            self.send_response(e.code)
            for k, v in e.headers.items():
                self.send_header(k, v)
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(e.read())
        except Exception as e:
            self.send_response(502)
            self.send_header('Content-Type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({"error": f"Backend unavailable: {str(e)}"}).encode())

    def do_GET(self):
        if self.path.startswith('/api/'):
            self._proxy_api()
            return
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not self.path.startswith('/_expo/static/'):
            self.path = '/index.html'
        super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/'):
            self._proxy_api()
            return
        self.send_response(405)
        self.end_headers()

    def do_PUT(self):
        if self.path.startswith('/api/'):
            self._proxy_api()
            return
        self.send_response(405)
        self.end_headers()

    def do_PATCH(self):
        if self.path.startswith('/api/'):
            self._proxy_api()
            return
        self.send_response(405)
        self.end_headers()

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            self._proxy_api()
            return
        self.send_response(405)
        self.end_headers()

    def log_message(self, format, *args):
        pass

with ReusableTCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()

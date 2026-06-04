#!/usr/bin/env python3
import http.server
import socketserver
import os

PORT = 5000
ROOT = "client/web-static"
os.chdir(ROOT)

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) and not self.path.startswith('/_expo/static/'):
            self.path = '/index.html'
        super().do_GET()

    def log_message(self, format, *args):
        pass

# 使用 SO_REUSEADDR 选项
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()

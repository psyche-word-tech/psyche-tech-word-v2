#!/usr/bin/env python3
"""支持 SPA 路由的静态文件服务器"""

import http.server
import socketserver
import os
import urllib.parse
import posixpath

PORT = 5000
DIRECTORY = "client/web-static"

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # 清理路径
        path = urllib.parse.unquote(self.path)
        path = posixpath.normpath(path)
        
        # 构建完整文件路径
        if path == '/':
            filepath = os.path.join(DIRECTORY, 'index.html')
        elif path.startswith('/'):
            filepath = os.path.join(DIRECTORY, path[1:])
        else:
            filepath = os.path.join(DIRECTORY, path)
        
        # 如果文件存在，直接返回
        if os.path.exists(filepath) and not os.path.isdir(filepath):
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        
        # 其他路由都返回 index.html (SPA fallback)
        index_path = os.path.join(DIRECTORY, 'index.html')
        if os.path.exists(index_path):
            self.path = '/index.html'
            return http.server.SimpleHTTPRequestHandler.do_GET(self)
        
        # 返回 404
        self.send_error(404, 'File not found')
    
    def log_message(self, format, *args):
        # 记录请求
        print(f"{self.address_string()} - {format % args}")

class ReuseAddrTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

with ReuseAddrTCPServer(("", PORT), SPAHandler) as httpd:
    print(f"Serving SPA on port {PORT}")
    httpd.serve_forever()

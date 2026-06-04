#!/usr/bin/env python3
import http.server, socketserver, os, sys, urllib.request, urllib.error, json

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
ROOT = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else os.getcwd()

API_TARGET = "http://localhost:9091"

class Handler(http.server.SimpleHTTPRequestHandler):
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
            # Try offline data when backend is unavailable
            offline_data = self._get_offline_data(self.path)
            if offline_data is not None:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps(offline_data).encode())
            else:
                self.send_response(502)
                self.send_header('Content-Type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({"error": f"Backend unavailable: {str(e)}"}).encode())

    def _get_offline_data(self, path):
        """Return offline data for API paths when backend is unavailable."""
        root = os.path.abspath(os.path.dirname(os.path.abspath(__file__)) + "/../../client")
        wordbooks = [{"id": "words_a", "name": "Word Roots", "description": "词根词缀记忆法", "purchased": True}, {"id": "words_b", "name": "Head & Neck", "description": "头颈部位", "purchased": True}, {"id": "words_c", "name": "Body Parts", "description": "身体部位", "purchased": True}, {"id": "words_d", "name": "Emotions", "description": "情绪情感", "purchased": True}]
        if path in ('/api/v1/wordbooks', '/api/v1/wordbooks/'):
            return wordbooks
        if path == '/api/v1/wordbooks/stats':
            return {"total": 375, "categories": {"x": 0, "y": 0, "z": 0}}
        import re
        m = re.match(r'^/api/v1/wordbooks/([^/]+)$', path)
        if m:
            table = m.group(1)
            fname = None
            if table in ('words_a', 'words_b', 'words_c', 'words_d'):
                fname = 'wordbook_2.json'
            elif table in ('words_x', 'words_y', 'words_z'):
                fname = f'wordbook_{table[-1]}.json'
            elif table in ('x1', 'y1', 'z1'):
                fname = f'wordbook_{table}.json'
            elif table.isdigit():
                fname = f'wordbook_{table}.json'
            if fname:
                fpath = os.path.join(root, 'assets', 'data', fname)
                if os.path.exists(fpath):
                    with open(fpath) as f:
                        return json.load(f)
        m = re.match(r'^/api/v1/wordbooks/([^/]+)/words_x$', path)
        if m:
            fpath = os.path.join(root, 'assets', 'data', 'wordbook_x.json')
            if os.path.exists(fpath):
                with open(fpath) as f:
                    return json.load(f)
        m = re.match(r'^/api/v1/wordbooks/([^/]+)/words_y$', path)
        if m:
            fpath = os.path.join(root, 'assets', 'data', 'wordbook_y.json')
            if os.path.exists(fpath):
                with open(fpath) as f:
                    return json.load(f)
        m = re.match(r'^/api/v1/wordbooks/([^/]+)/words_z$', path)
        if m:
            fpath = os.path.join(root, 'assets', 'data', 'wordbook_z.json')
            if os.path.exists(fpath):
                with open(fpath) as f:
                    return json.load(f)
        m = re.match(r'^/api/v1/user-words/category/([^/]+)$', path)
        if m:
            return []
        return None

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

os.chdir(ROOT)
Handler.directory = ROOT

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    httpd.serve_forever()

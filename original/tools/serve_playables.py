"""Serve the exact Playables candidate with Google's documented CSP for local QA."""
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse

parser=argparse.ArgumentParser()
parser.add_argument('--port',type=int,default=8771)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]/'dist/playables'
if not (root/'index.html').is_file():raise SystemExit('Run package_playables.py first.')
CSP="default-src 'none'; script-src 'report-sample' 'self' 'unsafe-eval' 'unsafe-inline' blob: https://www.youtube.com/game_api/v0 https://www.youtube.com/game_api/v0/ https://www.youtube.com/game_api/v1 https://www.youtube.com/game_api/v1/; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data: https://fonts.googleapis.com https://fonts.gstatic.com; connect-src 'self' blob: data:; sandbox allow-pointer-lock allow-same-origin allow-scripts; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:"
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        self.send_header('Content-Security-Policy',CSP)
        super().end_headers()
    def log_message(self,*args):pass
server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(root)))
print(f'Cloudpost Playables candidate: http://127.0.0.1:{args.port}',flush=True)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()

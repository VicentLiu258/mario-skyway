"""Local-only static server; no uploads, no external dependencies."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import argparse, webbrowser

base=Path(__file__).resolve().parents[1]/'cocos/build/web-desktop'
parser=argparse.ArgumentParser();parser.add_argument('--no-browser',action='store_true');parser.add_argument('--port',type=int,default=8770)
args=parser.parse_args()
if not (base/'index.html').exists():raise SystemExit('请先使用 Cocos Creator 构建 web-desktop。')
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-cache');super().end_headers()
    def log_message(self,format,*args):pass
server=None
for port in range(args.port,args.port+20):
    try:server=ThreadingHTTPServer(('127.0.0.1',port),partial(Handler,directory=str(base)));break
    except PermissionError:raise SystemExit('无法创建本地监听端口：当前运行环境未授予网络监听权限。')
    except OSError:continue
if server is None:raise SystemExit('本地端口被占用，请使用 --port 其他端口。')
url=f'http://127.0.0.1:{server.server_port}'
print('Cloudpost Dash 试玩：'+url,flush=True)
print('关闭此窗口或按 Ctrl+C 停止服务。',flush=True)
if not args.no_browser:webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()

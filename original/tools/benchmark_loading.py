#!/usr/bin/env python3
"""Local cold-load comparison, with no browser automation or production hooks.

Open /before/ and /after/ in the same browser. Responses use no-store, 100 ms
latency and a shared 1 MiB/s download budget. The old external SDK is replaced
by a local no-op, so the comparison excludes YouTube connectivity delays.
The on-page result is captured at the first rendered, enabled start button.
"""
import argparse
import gzip
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import mimetypes
from pathlib import Path
import threading
import time
from urllib.parse import unquote, urlsplit

INSTRUMENT = '''<script>
(function () {
  var observer = new MutationObserver(function () {
    var ui = document.getElementById('cloudpost-ui');
    var start = document.getElementById('start');
    if (!ui || ui.dataset.state !== 'ready' || !start || start.disabled) return;
    observer.disconnect();
    requestAnimationFrame(function () {
      var resources = performance.getEntriesByType('resource');
      var result = {readyMs: Math.round(performance.now()), requests: resources.length,
        decodedBytes: resources.reduce(function (n,r) {return n+r.decodedBodySize;},0),
        transferBytes: resources.reduce(function (n,r) {return n+r.transferSize;},0)};
      var output = document.createElement('output'); output.id = 'load-benchmark';
      output.textContent = JSON.stringify(result);
      output.style.cssText='position:fixed;bottom:4px;left:8px;z-index:10000;background:#fff;padding:4px;font:12px monospace;color:#222';
      document.body.appendChild(output);
    });
  });
  observer.observe(document.documentElement, {childList:true,subtree:true,attributes:true});
})();
</script>'''

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--before', type=Path, required=True)
    parser.add_argument('--after', type=Path, required=True)
    parser.add_argument('--port', type=int, default=8772)
    args = parser.parse_args()
    roots = {'before': args.before.resolve(), 'after': args.after.resolve()}
    lock = threading.Lock()
    next_chunk = [0.0]
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            path = unquote(urlsplit(self.path).path)
            if path == '/sdk-noop.js':
                data, kind = b'/* Standalone SDK no-op for controlled comparison only. */', 'text/javascript'
            else:
                parts = path.strip('/').split('/', 1)
                if parts[0] not in roots:
                    self.send_error(404); return
                root = roots[parts[0]]
                file = (root / (parts[1] if len(parts)>1 else '')).resolve()
                if file.is_dir(): file = file / 'index.html'
                if not file.is_relative_to(root) or not file.is_file():
                    self.send_error(404); return
                data = file.read_bytes()
                kind = mimetypes.guess_type(file)[0] or 'application/octet-stream'
                if file.suffix == '.html':
                    text = data.decode().replace('https://www.youtube.com/game_api/v1','/sdk-noop.js')
                    data = text.replace('</head>',INSTRUMENT+'</head>').encode()
            if kind.startswith('text/') or kind in ('application/javascript','application/json'):
                data = gzip.compress(data)
                compressed = True
            else: compressed = False
            time.sleep(.1)
            self.send_response(200)
            self.send_header('Content-Type',kind)
            self.send_header('Cache-Control','no-store')
            self.send_header('Content-Length',str(len(data)))
            if compressed:self.send_header('Content-Encoding','gzip')
            self.end_headers()
            try:
                for start in range(0,len(data),32768):
                    chunk=data[start:start+32768]
                    with lock:
                        due=max(time.monotonic(),next_chunk[0])+len(chunk)/(1024*1024)
                        next_chunk[0]=due
                    time.sleep(max(0,due-time.monotonic()))
                    self.wfile.write(chunk)
            except (BrokenPipeError,ConnectionResetError):pass
        def log_message(self,*args):pass
    print(f'Cold-load comparison at http://127.0.0.1:{args.port}/before/ and /after/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()

if __name__=='__main__':main()

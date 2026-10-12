#!/usr/bin/env python3
"""Second Brain transfer tool (runs on your PC, Python standard library only).

Sends a vault folder to the iPad as a zip and receives backup files from the iPad over your home Wi-Fi.
Open the printed address in Safari on the iPad (not inside the app), enter the PIN, then use Files to import into the app.

  python transfer_tool.py --vault "C:\\Users\\you\\Documents\\Brain\\Privat"

Safety: only devices on your private network may connect, a random PIN is required, uploads never overwrite files,
nothing is deleted, the vault folder is only read. Traffic on home Wi-Fi is not encrypted: use it only on a network you trust.
"""
import argparse, io, ipaddress, os, secrets, socket, time, zipfile
from email import message_from_bytes
from email.policy import HTTP
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

EXCLUDE = {'_tools', '.git', 'raw', '.obsidian', 'node_modules', '__MACOSX'}
MAX_UPLOAD = 200 * 1024 * 1024
STATE = {'pin': '', 'tokens': set(), 'fails': 0, 'locked_until': 0.0, 'vault': '', 'inbox': ''}

PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Second Brain transfer</title><style>
body{font:17px -apple-system,Segoe UI,sans-serif;margin:0;background:#f8f9fa;color:#202122}main{max-width:640px;margin:0 auto;padding:24px}
h1{font-family:Georgia,serif;font-weight:400}.box{background:#fff;border:1px solid #a2a9b1;margin:16px 0}.box h2{margin:0;padding:10px 14px;background:#cee0f2;font-size:17px}.box div{padding:14px}
button,input[type=file],input[type=password],input[type=text]{min-height:48px;font-size:17px}button,.btn{background:#3366cc;color:#fff;border:0;border-radius:8px;padding:0 20px;display:inline-flex;align-items:center;text-decoration:none;min-height:48px}
.err{background:#fee7e6;color:#8f1d1d;padding:10px}.ok{background:#ddf3e4;color:#1b6b3a;padding:10px}.m{color:#54595d;font-size:14px}</style></head><body><main><h1>Second Brain transfer</h1>%s</main></body></html>"""


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1)); return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


def zip_vault(root):
    buf = io.BytesIO(); n = 0
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        base = os.path.basename(os.path.abspath(root))
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x not in EXCLUDE and not x.startswith('.')]
            for f in files:
                if f.lower().endswith('.md'):
                    p = os.path.join(d, f); z.write(p, os.path.join(base, os.path.relpath(p, root)).replace('\\', '/')); n += 1
    return buf.getvalue(), n


def unique_path(folder, name):
    name = os.path.basename(name.replace('\\', '/')) or 'upload.bin'
    stem, ext = os.path.splitext(name); p = os.path.join(folder, name); i = 1
    while os.path.exists(p):
        p = os.path.join(folder, f'{stem}-{i}{ext}'); i += 1
    return p


class H(BaseHTTPRequestHandler):
    server_version = 'SBTransfer'

    def log_message(self, *a):
        pass

    def allowed(self):
        try:
            ip = ipaddress.ip_address(self.client_address[0]); return ip.is_private or ip.is_loopback
        except ValueError:
            return False

    def send(self, code, body, ctype='text/html; charset=utf-8', extra=None):
        b = body.encode() if isinstance(body, str) else body
        self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(b))); self.send_header('Cache-Control', 'no-store')
        for k, v in (extra or {}).items(): self.send_header(k, v)
        self.end_headers(); self.wfile.write(b)

    def authed(self):
        c = self.headers.get('Cookie', '')
        return any(p.strip().startswith('t=') and p.strip()[2:] in STATE['tokens'] for p in c.split(';'))

    def login_page(self, msg=''):
        self.send(200, PAGE % (f'{msg}<form method="post" action="/login" class="box"><h2>Enter the PIN shown on your PC</h2><div><input type="password" name="pin" inputmode="numeric" autocomplete="off" autofocus> <button>Continue</button></div></form>'))

    def home(self, msg=''):
        self.send(200, PAGE % (f'{msg}<div class="box"><h2>Send to iPad</h2><div><p>Downloads your vault as a zip. Then open the Second Brain app and use Import file.</p><a class="btn" href="/download">Download vault zip</a><p class="m">Vault folder: {os.path.basename(STATE["vault"])} (read only, Markdown files)</p></div></div>'
                               '<div class="box"><h2>Receive from iPad</h2><div><p>Choose a backup file (.sbbak) or zip from the Files app. Existing files are never overwritten.</p><form method="post" action="/upload" enctype="multipart/form-data"><input type="file" name="f" required> <button>Upload</button></form></div></div>'))

    def do_GET(self):
        if not self.allowed(): return self.send(403, 'Only devices on your private network may connect.', 'text/plain')
        if self.path == '/download':
            if not self.authed(): return self.login_page()
            data, n = zip_vault(STATE['vault']); name = os.path.basename(os.path.abspath(STATE['vault'])) + '.zip'
            return self.send(200, data, 'application/zip', {'Content-Disposition': f'attachment; filename="{name}"', 'X-Notes': str(n)})
        if self.authed(): return self.home()
        self.login_page()

    def do_POST(self):
        if not self.allowed(): return self.send(403, 'Only devices on your private network may connect.', 'text/plain')
        length = int(self.headers.get('Content-Length') or 0)
        if self.path == '/login':
            now = time.time()
            if now < STATE['locked_until']: return self.login_page('<div class="err">Too many wrong PINs. Wait a minute.</div>')
            pin = parse_qs(self.rfile.read(min(length, 1000)).decode('utf-8', 'ignore')).get('pin', [''])[0].strip()
            if secrets.compare_digest(pin, STATE['pin']):
                STATE['fails'] = 0; t = secrets.token_urlsafe(24); STATE['tokens'].add(t)
                self.send_response(303); self.send_header('Set-Cookie', f't={t}; HttpOnly; SameSite=Strict; Path=/'); self.send_header('Location', '/'); self.send_header('Content-Length', '0'); self.end_headers(); return
            STATE['fails'] += 1
            if STATE['fails'] >= 5: STATE['locked_until'] = now + 60; STATE['fails'] = 0
            return self.login_page('<div class="err">Wrong PIN.</div>')
        if self.path == '/upload':
            if not self.authed(): return self.login_page()
            if length > MAX_UPLOAD: return self.home('<div class="err">File too large (limit 200 MB).</div>')
            raw = self.rfile.read(length); msg = message_from_bytes(b'Content-Type: ' + self.headers['Content-Type'].encode() + b'\r\n\r\n' + raw, policy=HTTP)
            saved = []
            for part in msg.iter_parts():
                fn = part.get_filename()
                if fn:
                    os.makedirs(STATE['inbox'], exist_ok=True); p = unique_path(STATE['inbox'], fn)
                    with open(p, 'wb') as f: f.write(part.get_payload(decode=True))
                    saved.append(os.path.basename(p))
            return self.home(f'<div class="ok">Saved to the received folder: {", ".join(saved)}</div>' if saved else '<div class="err">No file received.</div>')
        self.send(404, 'Not found', 'text/plain')


def main():
    ap = argparse.ArgumentParser(description='Second Brain transfer tool')
    ap.add_argument('--vault', required=True, help='Vault folder to send to the iPad (only read)')
    ap.add_argument('--inbox', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'received'), help='Where files from the iPad are saved')
    ap.add_argument('--port', type=int, default=8765)
    ap.add_argument('--pin', default='', help='Fixed PIN (default: random 6 digits)')
    a = ap.parse_args()
    if not os.path.isdir(a.vault): raise SystemExit(f'Vault folder not found: {a.vault}')
    STATE.update(pin=a.pin or f'{secrets.randbelow(10**6):06d}', vault=a.vault, inbox=a.inbox)
    srv = ThreadingHTTPServer(('0.0.0.0', a.port), H)
    print(f'\nSecond Brain transfer is running.\n  On the iPad open Safari and go to:  http://{lan_ip()}:{a.port}\n  PIN: {STATE["pin"]}\n  Files from the iPad are saved in: {a.inbox}\n  Press Ctrl+C to stop. Close this window when you are done.\n')
    try: srv.serve_forever()
    except KeyboardInterrupt: print('Stopped.')


if __name__ == '__main__':
    main()

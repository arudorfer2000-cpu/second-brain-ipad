import io, os, subprocess, sys, tempfile, time, urllib.request, urllib.parse, zipfile, http.cookiejar, unittest, socket
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOL = os.path.join(ROOT, 'pc-tool', 'transfer_tool.py')
def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p
class T(unittest.TestCase):
    @classmethod
    def setUpClass(c):
        c.tmp = tempfile.mkdtemp(); v = os.path.join(c.tmp, 'Privat'); os.makedirs(os.path.join(v, 'A')); os.makedirs(os.path.join(v, '_tools')); os.makedirs(os.path.join(v, '.git'))
        for p, t in [('A/one.md', 'one'), ('two.md', 'two'), ('_tools/skip.md', 'x'), ('.git/y.md', 'y'), ('pic.png', 'n')]: open(os.path.join(v, p), 'w').write(t)
        c.port = free_port(); c.inbox = os.path.join(c.tmp, 'in')
        c.p = subprocess.Popen([sys.executable, TOOL, '--vault', v, '--inbox', c.inbox, '--port', str(c.port), '--pin', '123456'], stdout=subprocess.DEVNULL)
        for _ in range(50):
            try: socket.create_connection(('127.0.0.1', c.port), 0.2).close(); break
            except OSError: time.sleep(0.1)
        c.jar = http.cookiejar.CookieJar(); c.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(c.jar))
        c.base = f'http://127.0.0.1:{c.port}'
    @classmethod
    def tearDownClass(c): c.p.terminate()
    def post(self, path, data, headers=None):
        return self.op.open(urllib.request.Request(self.base + path, data=data, headers=headers or {}))
    def test_1_requires_pin(self):
        body = urllib.request.urlopen(self.base + '/download').read().decode(); self.assertIn('Enter the PIN', body)
        body = self.post('/login', b'pin=000000').read().decode(); self.assertIn('Wrong PIN', body)
    def test_2_download_and_upload(self):
        self.assertIn('Send to iPad', self.post('/login', b'pin=123456').read().decode())
        z = zipfile.ZipFile(io.BytesIO(self.op.open(self.base + '/download').read())); self.assertEqual(sorted(z.namelist()), ['Privat/A/one.md', 'Privat/two.md'])
        b = '----x'; body = (f'--{b}\r\nContent-Disposition: form-data; name="f"; filename="backup.sbbak"\r\nContent-Type: application/octet-stream\r\n\r\nDATA1\r\n--{b}--\r\n').encode()
        h = {'Content-Type': f'multipart/form-data; boundary={b}'}
        self.assertIn('backup.sbbak', self.post('/upload', body, h).read().decode()); self.assertIn('backup-1.sbbak', self.post('/upload', body, h).read().decode())
        self.assertEqual(sorted(os.listdir(self.inbox)), ['backup-1.sbbak', 'backup.sbbak']); self.assertEqual(open(os.path.join(self.inbox, 'backup.sbbak')).read(), 'DATA1')
    def test_3_path_traversal_name_is_flattened(self):
        b = '----y'; body = (f'--{b}\r\nContent-Disposition: form-data; name="f"; filename="..\\\\..\\\\evil.txt"\r\n\r\nX\r\n--{b}--\r\n').encode()
        self.post('/upload', body, {'Content-Type': f'multipart/form-data; boundary={b}'}); self.assertIn('evil.txt', os.listdir(self.inbox)); self.assertFalse(os.path.exists(os.path.join(self.tmp, 'evil.txt')))
    def test_4_lockout_after_five_wrong_pins(self):
        op = urllib.request.build_opener()
        for _ in range(5): op.open(urllib.request.Request(self.base + '/login', data=b'pin=999999')).read()
        self.assertIn('Too many', op.open(urllib.request.Request(self.base + '/login', data=b'pin=123456')).read().decode())
if __name__ == '__main__': unittest.main(verbosity=2)

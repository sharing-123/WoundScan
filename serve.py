"""Server lokal WoundScan. Jalankan:  python serve.py [port]
Buka http://localhost:8765 di komputer. Untuk ponsel di Wi-Fi yang sama, buka http://<IP-komputer>:8765
(kamera ponsel di HTTP non-localhost mungkin terbatas; tombol "Foto luka" memakai kamera bawaan lewat input file, jadi tetap berfungsi)."""
import http.server, os, socket, sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app'))


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


H.extensions_map.update({'.mjs': 'text/javascript', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream'})
ip = socket.gethostbyname(socket.gethostname())
print(f'WoundScan: http://localhost:{PORT}   |   jaringan: http://{ip}:{PORT}')
http.server.ThreadingHTTPServer(('0.0.0.0', PORT), H).serve_forever()

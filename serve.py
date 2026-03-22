import http.server
import os
import socket
import threading

port = int(os.environ.get('PORT', 8765))
directory = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()
    def log_message(self, format, *args):
        pass  # suppress request logs

class IPv6Server(http.server.HTTPServer):
    address_family = socket.AF_INET6

# IPv4 server on all interfaces
ipv4 = http.server.HTTPServer(('0.0.0.0', port), Handler)

# IPv6 server on ::1 so Chrome can reach localhost via either address family
try:
    ipv6 = IPv6Server(('::1', port), Handler)
    threading.Thread(target=ipv6.serve_forever, daemon=True).start()
except OSError:
    pass  # IPv6 unavailable on this system — IPv4 only

print(f'Guitar Theory Dashboard running at http://localhost:{port}', flush=True)
ipv4.serve_forever()

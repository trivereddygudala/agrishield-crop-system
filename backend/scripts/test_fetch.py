import urllib.request
import re

urls = [
    'https://www.bighaat.com/products/ridomil-gold-fungicide',
    'https://www.bighaat.com/products/blitox-fungicide',
    'https://www.bighaat.com/products/bavistin-fungicide',
    'https://www.bighaat.com/products/multiplex-neem-oil'
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9'
}

for u in urls:
    try:
        req = urllib.request.Request(u, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            final_url = resp.geturl()
            html = resp.read().decode('utf-8', errors='ignore')
            m = re.search(r'property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
            if not m:
                m = re.search(r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', html)
            if m:
                print('OK:', u.split('/')[-1], '->', m.group(1))
            else:
                print('No meta for:', u.split('/')[-1], 'redirected to:', final_url)
    except Exception as e:
        print('ERR for:', u.split('/')[-1], ':', e)

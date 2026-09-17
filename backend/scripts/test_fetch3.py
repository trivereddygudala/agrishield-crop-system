import urllib.request
import re

url = 'https://www.bighaat.com/products/ridomil-gold-fungicide'
headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=8) as resp:
    html = resp.read().decode('utf-8', errors='ignore')
    import json
    scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
    print('Total scripts:', len(scripts))
    for i, s in enumerate(scripts):
        if 'cdn.shopify.com' in s or 'media.bighaat' in s or 'image' in s:
            print(f'Script #{i}:', s[:200])

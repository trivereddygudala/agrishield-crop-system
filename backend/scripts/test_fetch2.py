import urllib.request
import re

url = 'https://www.bighaat.com/products/ridomil-gold-fungicide'
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
}
req = urllib.request.Request(url, headers=headers)
with urllib.request.urlopen(req, timeout=8) as resp:
    html = resp.read().decode('utf-8', errors='ignore')
    print('HTML length:', len(html))
    imgs = set(re.findall(r'//cdn\.shopify\.com/s/files/[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)', html))
    print('Found Shopify image links:', len(imgs))
    for img in list(imgs)[:10]:
        print(' - https:' + img)

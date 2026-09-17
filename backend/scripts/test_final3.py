import urllib.request
import re

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}

urls = {
    "chelated-zinc-aries": "https://www.kisanshop.in/product/aries-chelamin-plus-fertilizer",
    "iffco-nano-dap": "https://agribegri.com/products/iffco-nano-dap-fertilizer.php"
}

for pid, u in urls.items():
    try:
        req = urllib.request.Request(u, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            m = re.search(r'property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
            if not m:
                m = re.search(r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', html)
            if m:
                print(f"OK {pid}: {m.group(1)}", flush=True)
            else:
                imgs = re.findall(r'https?://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)', html)
                print(f"NO OG, found {len(imgs)} imgs for {pid}", flush=True)
                for img in imgs[:5]:
                    print(f" - {img}", flush=True)
    except Exception as e:
        print(f"ERR {pid}: {e}", flush=True)

import urllib.request
import re
import json

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
}

product_slugs = [
    ("amistar-top-syngenta", "https://www.bighaat.com/products/amistar-top-fungicide"),
    ("kavach-syngenta", "https://www.bighaat.com/products/kavach-fungicide"),
    ("nativo-bayer", "https://www.bighaat.com/products/nativo-fungicide"),
    ("ridomil-gold-syngenta", "https://www.bighaat.com/products/ridomil-gold-fungicide"),
    ("blitox-tata-rallis", "https://www.bighaat.com/products/blitox-fungicide"),
    ("tilt-syngenta", "https://www.bighaat.com/products/tilt-syngenta"),
    ("antracol-bayer", "https://www.bighaat.com/products/antracol-fungicide"),
    ("custodia-adama", "https://www.bighaat.com/products/custodia-fungicide"),
    ("bavistin-crystal", "https://www.bighaat.com/products/bavistin-fungicide"),
    ("confidor-bayer", "https://www.bighaat.com/products/confidor-insecticide"),
    ("actara-syngenta", "https://www.bighaat.com/products/actara-insecticide"),
    ("tracer-corteva", "https://www.bighaat.com/products/tracer-insecticide"),
    ("neem-oil-organic", "https://www.bighaat.com/products/multiplex-neem-oil-10000-ppm"),
    ("regent-basf", "https://www.bighaat.com/products/regent-sc-insecticide"),
    ("alika-syngenta", "https://www.bighaat.com/products/alika-insecticide"),
    ("iffco-nano-urea", "https://www.bighaat.com/products/iffco-nano-urea-liquid-fertilizer"),
    ("iffco-nano-dap", "https://www.bighaat.com/products/iffco-nano-dap"),
    ("iffco-19-19-19-npk", "https://www.bighaat.com/products/npk-19-19-19-fertilizer"),
    ("chelated-zinc-aries", "https://www.bighaat.com/products/aries-chelamin-plus-zinc-fertilizer"),
    ("boron-solubor-borax", "https://www.bighaat.com/products/solubor-boron-fertilizer"),
    ("humic-acid-multiplex", "https://www.bighaat.com/products/samras-humic-acid-multiplex")
]

for pid, url in product_slugs:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            # Look for og:image
            m = re.search(r'property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
            if not m:
                m = re.search(r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', html)
            if m:
                print(f'"{pid}": "{m.group(1)}",')
            else:
                # search for cdn.shopify.com/s/files
                m_cdn = re.search(r'https://cdn\.shopify\.com/s/files/[^\s"\'<>]+\.(?:jpg|jpeg|png|webp)', html)
                if m_cdn:
                    print(f'"{pid}": "{m_cdn.group(0)}",')
                else:
                    print(f'"{pid}": None,')
    except Exception as e:
        print(f'"{pid}": ERROR ({e}),')

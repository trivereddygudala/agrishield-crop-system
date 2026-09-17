import urllib.request
import re
import json

candidates = [
    ('ridomil-gold-syngenta', ['https://www.bighaat.com/products/ridomil-gold-fungicide-syngenta', 'https://www.bighaat.com/products/ridomil-gold-fungicide']),
    ('blitox-tata-rallis', ['https://www.bighaat.com/products/blitox-fungicide-tata-rallis', 'https://www.bighaat.com/products/blitox-50-fungicide']),
    ('tilt-syngenta', ['https://www.bighaat.com/products/tilt-fungicide', 'https://www.bighaat.com/products/syngenta-tilt-fungicide', 'https://www.bighaat.com/products/tilt-fungicide-crystal']),
    ('bavistin-crystal', ['https://www.bighaat.com/products/bavistin-fungicide-crystal', 'https://www.bighaat.com/products/bavistin-50-wp-fungicide']),
    ('neem-oil-organic', ['https://www.bighaat.com/products/multiplex-neem-oil-10000-ppm-organic-bio-pesticide', 'https://www.bighaat.com/products/multiplex-neem-oil-10000-ppm-bio-pesticide', 'https://www.bighaat.com/products/multiplex-neem-oil-10000-ppm']),
    ('iffco-nano-dap', ['https://www.bighaat.com/products/iffco-nano-dap-liquid-fertilizer', 'https://www.bighaat.com/products/nano-dap-liquid']),
    ('iffco-19-19-19-npk', ['https://www.bighaat.com/products/npk-19-19-19-water-soluble-fertilizer', 'https://www.bighaat.com/products/19-19-19-npk-fertilizer']),
    ('tata-paras-10-26-26', ['https://www.bighaat.com/products/paras-10-26-26-complex-fertilizer', 'https://www.bighaat.com/products/tata-paras-10-26-26']),
    ('chelated-zinc-aries', ['https://www.bighaat.com/products/aries-chelamin-plus-chelated-zinc-fertilizer', 'https://www.bighaat.com/products/chelamin-plus-chelated-zinc-12']),
    ('boron-solubor-borax', ['https://www.bighaat.com/products/solubor-boron-20-fertilizer', 'https://www.bighaat.com/products/borax-morarji-solubor-boron']),
    ('humic-acid-multiplex', ['https://www.bighaat.com/products/multiplex-samras-humic-acid-98', 'https://www.bighaat.com/products/samras-humic-acid'])
]

headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

found = {}
for name, urls in candidates:
    for u in urls:
        try:
            req = urllib.request.Request(u, headers=headers)
            with urllib.request.urlopen(req, timeout=4) as resp:
                html = resp.read().decode('utf-8', errors='ignore')
                m = re.search(r'property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html)
                if not m:
                    m = re.search(r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', html)
                if m:
                    img_u = m.group(1)
                    if img_u.startswith('//'):
                        img_u = 'https:' + img_u
                    found[name] = img_u
                    print(f'"{name}": "{img_u}",', flush=True)
                    break
        except Exception:
            pass

print("\n--- Summary ---")
print(json.dumps(found, indent=2))

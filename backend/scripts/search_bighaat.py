import urllib.request
import urllib.parse
import re
import json

queries = [
    ("indofil-m45", "indofil m 45"),
    ("benevia-fmc", "benevia"),
    ("admire-bayer", "admire"),
    ("mkp-00-52-34", "00 52 34"),
    ("potassium-nitrate-13-0-45", "13 00 45"),
    ("iffco-mop-potash", "muriate of potash"),
    ("ssp-fertilizer", "single super phosphate"),
    ("ferrous-sulphate-aries", "ferrous sulphate aries"),
    ("magnesium-sulphate-aries", "magnesium sulphate")
]

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
}

found = {}
for p_id, q in queries:
    search_url = f"https://www.bighaat.com/search?q={urllib.parse.quote(q)}"
    try:
        req = urllib.request.Request(search_url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            html = resp.read().decode('utf-8', errors='ignore')
            # Extract product hrefs
            hrefs = re.findall(r'href=["\'](/products/[^"\'?]+)["\']', html)
            unique_hrefs = list(dict.fromkeys(hrefs))[:3]
            print(f"Query '{q}' found {len(unique_hrefs)} links", flush=True)
            for h in unique_hrefs:
                prod_url = "https://www.bighaat.com" + h
                try:
                    req_p = urllib.request.Request(prod_url, headers=headers)
                    with urllib.request.urlopen(req_p, timeout=6) as resp_p:
                        html_p = resp_p.read().decode('utf-8', errors='ignore')
                        m = re.search(r'property=["\']og:image["\']\s+content=["\']([^"\']+)["\']', html_p)
                        if not m:
                            m = re.search(r'content=["\']([^"\']+)["\']\s+property=["\']og:image["\']', html_p)
                        if m:
                            img = m.group(1)
                            if img.startswith('//'):
                                img = 'https:' + img
                            found[p_id] = img
                            print(f'"{p_id}": "{img}",', flush=True)
                            break
                except Exception as e:
                    print(f"Error loading {prod_url}: {e}", flush=True)
            if p_id in found:
                continue
    except Exception as e:
        print(f"Error searching {q}: {e}", flush=True)

print("FOUND:", json.dumps(found, indent=2))

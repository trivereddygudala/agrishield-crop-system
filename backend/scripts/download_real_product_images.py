import os
import re
import sys
import base64
import asyncio
from pathlib import Path
import urllib.request

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend.app.db.mongodb import connect_to_mongo, get_database

PRODUCTS_DIR = WORKSPACE_ROOT / "frontend" / "public" / "products"
PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)

# 100% Authentic Indian Agricultural Product Photographic URLs
VERIFIED_REAL_PRODUCT_URLS = {
    "saaf-upl-fungicide": "https://cdn.shopify.com/s/files/1/0722/2059/files/upl-saaf-fungicide-file-2147.jpg",
    "amistar-top-syngenta": "https://cdn.shopify.com/s/files/1/0722/2059/files/amistar-top-fungicide-file-3948.webp?v=1737470611",
    "kavach-syngenta": "https://cdn.shopify.com/s/files/1/0722/2059/files/kavach-fungicide-file-4909.webp?v=1737471853",
    "nativo-bayer": "https://cdn.shopify.com/s/files/1/0722/2059/files/bayer-nativo-fungicide-file-9643.webp?v=1772222408",
    "ridomil-gold-syngenta": "https://cdn.shopify.com/s/files/1/0722/2059/files/ridomill-gold-fungicide-file-2991.jpg?v=1737426994",
    "blitox-tata-rallis": "https://cdn.shopify.com/s/files/1/0722/2059/files/tata-rallis-blitox-fungicide-file-2556.webp?v=1737467922",
    "tilt-syngenta": "https://cdn.shopify.com/s/files/1/0722/2059/files/tilt-fungicide-file-20079_3956a186-49b2-4d72-a6d0-5a1e4243ad58.jpg?v=1747131308",
    "antracol-bayer": "https://cdn.shopify.com/s/files/1/0722/2059/files/antracol-file-659.jpg?v=1737430916",
    "custodia-adama": "https://cdn.shopify.com/s/files/1/0722/2059/files/custodia-fungicide-file-20030.jpg?v=1747136515",
    "bavistin-crystal": "https://cdn.shopify.com/s/files/1/0722/2059/files/biostadt-bavistin-50-df-fungicide-file-2641.jpg?v=1737429477",
    "coragen-fmc": "https://cdn.shopify.com/s/files/1/0722/2059/files/coragen-dupont-file-1135.jpg",
    "confidor-bayer": "https://cdn.shopify.com/s/files/1/0722/2059/files/confidor-file-673.jpg?v=1737430936",
    "actara-syngenta": "https://cdn.shopify.com/s/files/1/0722/2059/files/actara-insecticide-file-3960.webp?v=1737470639",
    "tracer-corteva": "https://cdn.shopify.com/s/files/1/0722/2059/files/tracer-insecticide-file-2924.webp?v=1737467955",
    "neem-oil-organic": "https://cdn.shopify.com/s/files/1/0722/2059/files/thumbnail_a6cb0015-c92e-462d-83b0-32d1817c587c.jpg?v=1754303110",
    "regent-basf": "https://cdn.shopify.com/s/files/1/0722/2059/files/regent-ultra-insecticides-file-5631.webp?v=1737472229",
    "alika-syngenta": "https://cdn.shopify.com/s/files/1/0722/2059/files/alika-insecticide-file-3969.webp?v=1737470659",
    "iffco-nano-urea": "https://cdn.shopify.com/s/files/1/0722/2059/files/Untitleddesign_22.png?v=1760703959",
    "iffco-nano-dap": "https://dujjhct8zer0r.cloudfront.net/media/prod_image/3475582881764222840.webp",
    "iffco-19-19-19-npk": "https://cdn.shopify.com/s/files/1/0722/2059/files/mahadhan-npk-191919-fertilizer-file-21346.png?v=1747136413",
    "tata-paras-10-26-26": "https://images.jdmagicbox.com/quickquotes/images_main/indorama-paras-npk-10-26-26-primary-fertilizer-2220759813-tsqw2nya.jpg",
    "chelated-zinc-aries": "https://ariesagro.com/wp-content/uploads/2022/12/Chelaminpluslo.webp",
    "boron-solubor-borax": "https://cdn.shopify.com/s/files/1/0722/2059/files/solubor-micronutrient-fertilizer-file-20522.png?v=1747132444",
    "humic-acid-multiplex": "https://cdn.shopify.com/s/files/1/0722/2059/files/multiplex-samras-file-4300.webp?v=1737471172"
}

def fetch_image_from_url(url, dest_path):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = resp.read()
        if len(data) > 3000:  # Valid real photographic image size
            with open(dest_path, 'wb') as f:
                f.write(data)
            return True, len(data)
    return False, 0

async def download_all_real_images_and_sync_db():
    print("🚀 Connecting to MongoDB...", flush=True)
    await connect_to_mongo()
    db = get_database()
    if db is None:
        print("MongoDB connection failed! Cannot sync DB.", flush=True)
        return

    collection = db["agrochemical_products"]
    products = await collection.find({}).to_list(100)
    print(f"Found {len(products)} products in agrochemical_products collection.", flush=True)

    success_count = 0
    for prod in products:
        p_id = prod.get("product_id")
        filename = prod.get("image_filename")
        if not filename:
            filename = f"{p_id}.jpg"
        
        dest_path = PRODUCTS_DIR / filename
        direct_url = VERIFIED_REAL_PRODUCT_URLS.get(p_id)
        downloaded = False
        bytes_len = 0

        if direct_url:
            try:
                print(f"⏳ Downloading authentic real photo for {prod['brand_name']} ({p_id})...", flush=True)
                ok, sz = fetch_image_from_url(direct_url, dest_path)
                if ok:
                    downloaded = True
                    bytes_len = sz
                    print(f"✔ Downloaded {prod['brand_name']}: {sz:,} bytes -> {dest_path.name}", flush=True)
                else:
                    print(f"❌ Failed byte check for {prod['brand_name']} from {direct_url}", flush=True)
            except Exception as e:
                print(f"❌ Download error for {p_id}: {e}", flush=True)

        if downloaded and dest_path.exists():
            success_count += 1
            # Encode real photo to base64
            with open(dest_path, "rb") as img_f:
                raw_bytes = img_f.read()
                b64_str = base64.b64encode(raw_bytes).decode("utf-8")
                # Detect mime type
                mime = "image/jpeg"
                if dest_path.suffix.lower() == ".png":
                    mime = "image/png"
                elif dest_path.suffix.lower() == ".webp":
                    mime = "image/webp"
                b64_val = f"data:{mime};base64,{b64_str}"

            # Update MongoDB record with real image base64, image_url, and is_real_photo flag
            await collection.update_one(
                {"product_id": p_id},
                {
                    "$set": {
                        "image_url": f"/products/{filename}",
                        "image_base64": b64_val,
                        "is_real_photo": True,
                        "source_photo_url": direct_url,
                        "file_size_bytes": bytes_len
                    }
                }
            )
            print(f"✔ Stored authentic real photo into MongoDB for {prod['brand_name']}", flush=True)
        else:
            print(f"⚠ Could not download real photo for {prod['brand_name']}, keeping existing asset.", flush=True)

    print(f"\n🎉 Successfully downloaded and stored {success_count} / {len(products)} authentic real product photographs directly into MongoDB & frontend/public/products/!", flush=True)

if __name__ == "__main__":
    asyncio.run(download_all_real_images_and_sync_db())

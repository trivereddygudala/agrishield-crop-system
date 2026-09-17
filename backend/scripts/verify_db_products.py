import asyncio
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend.app.db.mongodb import connect_to_mongo, get_database

async def verify():
    await connect_to_mongo()
    db = get_database()
    prods = await db["agrochemical_products"].find({}, {"_id": 0}).to_list(100)
    print(f"Total products in MongoDB: {len(prods)}")
    
    categories = {"fungicide": 0, "pesticide": 0, "fertilizer": 0}
    for p in prods:
        cat = p.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1
        b64_len = len(p.get("image_base64", ""))
        print(f"[{p.get('category').upper():10}] {p.get('brand_name'):25} | Chemical: {p.get('active_ingredients'):45} | Real Photo: {p.get('is_real_photo')} ({b64_len:,} b64 chars)")

    print("\nSummary by Category:")
    for c, cnt in categories.items():
        print(f" - {c.capitalize()}: {cnt}")

if __name__ == "__main__":
    asyncio.run(verify())

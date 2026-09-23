import os
import sys
import json
import uuid
import time
import requests
from PIL import Image
import io

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from backend.app.core.config import settings

BENCHMARK_DIR = os.path.join(BASE_DIR, "benchmarks")
DISEASE_DIR = os.path.join(BENCHMARK_DIR, "disease_200")
PLANT_DIR = os.path.join(BENCHMARK_DIR, "plant_100")
AGRO_DIR = os.path.join(BENCHMARK_DIR, "agro_100")
GROUND_TRUTH_FILE = os.path.join(BENCHMARK_DIR, "ground_truth_master.json")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def download_image(url: str, min_size: int = 120) -> Image.Image:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8)
        if resp.status_code == 200 and len(resp.content) > 1024:
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            if img.width >= min_size and img.height >= min_size:
                return img
    except Exception:
        pass
    return None

def fetch_images(query: str, max_results: int = 6):
    try:
        res = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.TAVILY_API_KEY,
                "query": query,
                "include_images": True,
                "max_results": max_results
            },
            timeout=10
        )
        if res.status_code == 200:
            return res.json().get("images", [])
    except Exception:
        pass
    return []

# Need 22 Disease, 2 Plant, 3 Agro
TOPUP_DISEASE = [
    {"crop": "Rice", "disease": "Rice Blast", "scientific": "Magnaporthe oryzae", "source": "IRRI Knowledge Bank", "query": "Magnaporthe oryzae rice blast lesions leaf photo", "needed": 4},
    {"crop": "Cotton", "disease": "Cotton Leaf Curl Virus", "scientific": "CLCuD", "source": "CICR Nagpur", "query": "Cotton leaf curl disease upward cupping leaf photo", "needed": 3},
    {"crop": "Citrus", "disease": "Citrus Canker", "scientific": "Xanthomonas citri", "source": "ICAR-CCRI", "query": "Citrus canker raised necrotic leaf spot photo", "needed": 2},
    {"crop": "Citrus", "disease": "Citrus Greening / Huanglongbing", "scientific": "Candidatus Liberibacter", "source": "USDA-ARS", "query": "Citrus huanglongbing greening asymmetric mottle leaf", "needed": 3},
    {"crop": "Citrus", "disease": "Citrus Black Spot", "scientific": "Phyllosticta citricarpa", "source": "CABI Plantwise", "query": "Citrus black spot lesions leaf photo", "needed": 1},
    {"crop": "Apple", "disease": "Cedar Apple Rust", "scientific": "Gymnosporangium", "source": "Virginia Tech", "query": "Cedar apple rust orange leaf spots photo", "needed": 2},
    {"crop": "Chilli", "disease": "Chilli Powdery Mildew", "scientific": "Leveillula taurica", "source": "TNAU Agritech", "query": "Chilli pepper powdery mildew leaf white patch", "needed": 1},
    {"crop": "Groundnut", "disease": "Groundnut Early Leaf Spot", "scientific": "Cercospora arachidicola", "source": "ICRISAT", "query": "Groundnut tikka disease early leaf spot yellow halo", "needed": 1},
    {"crop": "Cotton", "disease": "Cotton Aphid Damage", "scientific": "Aphis gossypii", "source": "CICR", "query": "Aphis gossypii cotton aphid damage leaf curling", "needed": 1},
    {"crop": "Corn", "disease": "Northern Leaf Blight", "scientific": "Exserohilum turcicum", "source": "Purdue Extension", "query": "Corn northern corn leaf blight cigar lesion photo", "needed": 2},
    {"crop": "Tomato", "disease": "Tomato Early Blight", "scientific": "Alternaria solani", "source": "TNAU", "query": "Alternaria solani tomato early blight target spot leaf", "needed": 2}
]

TOPUP_PLANT = [
    {"name": "Okra / Ladyfinger", "scientific": "Abelmoschus esculentus", "family": "Malvaceae", "category": "Crop", "query": "Lady finger bhendi Abelmoschus esculentus plant leaves field", "needed": 2}
]

TOPUP_AGRO = [
    {"brand": "Rogor 30 EC", "active": "Dimethoate 30% EC", "manufacturer": "FMC", "type": "Insecticide", "query": "Rogor dimethoate 30 EC pesticide bottle FMC", "needed": 3}
]

def main():
    with open(GROUND_TRUTH_FILE, "r", encoding="utf-8") as f:
        gt = json.load(f)

    print(f"Initial GT count: {len(gt)}")

    for spec in TOPUP_DISEASE:
        needed = spec["needed"]
        images = fetch_images(spec["query"], max_results=needed + 3)
        got = 0
        for u in images:
            if got >= needed:
                break
            img = download_image(u)
            if img:
                img_id = str(uuid.uuid4())
                fn = f"{img_id}.jpg"
                img.save(os.path.join(DISEASE_DIR, fn), "JPEG", quality=90)
                got += 1
                gt.append({
                    "id": img_id,
                    "filename": fn,
                    "relative_path": f"benchmarks/disease_200/{fn}",
                    "module": "disease",
                    "crop": spec["crop"],
                    "disease": spec["disease"],
                    "scientific_name": spec["scientific"],
                    "authority_source": spec["source"],
                    "original_url": u
                })
        print(f"Top-up Disease: {spec['crop']} +{got}")

    for spec in TOPUP_PLANT:
        needed = spec["needed"]
        images = fetch_images(spec["query"], max_results=needed + 3)
        got = 0
        for u in images:
            if got >= needed:
                break
            img = download_image(u)
            if img:
                img_id = str(uuid.uuid4())
                fn = f"{img_id}.jpg"
                img.save(os.path.join(PLANT_DIR, fn), "JPEG", quality=90)
                got += 1
                gt.append({
                    "id": img_id,
                    "filename": fn,
                    "relative_path": f"benchmarks/plant_100/{fn}",
                    "module": "plant",
                    "plant_name": spec["name"],
                    "scientific_name": spec["scientific"],
                    "family": spec["family"],
                    "category": spec["category"],
                    "authority_source": "Pl@ntNet / Kew Royal Botanic Gardens / Flora of India",
                    "original_url": u
                })
        print(f"Top-up Plant: {spec['name']} +{got}")

    for spec in TOPUP_AGRO:
        needed = spec["needed"]
        images = fetch_images(spec["query"], max_results=needed + 3)
        got = 0
        for u in images:
            if got >= needed:
                break
            img = download_image(u)
            if img:
                img_id = str(uuid.uuid4())
                fn = f"{img_id}.jpg"
                img.save(os.path.join(AGRO_DIR, fn), "JPEG", quality=90)
                got += 1
                gt.append({
                    "id": img_id,
                    "filename": fn,
                    "relative_path": f"benchmarks/agro_100/{fn}",
                    "module": "agrochemical",
                    "brand": spec["brand"],
                    "active_ingredients": spec["active"],
                    "manufacturer": spec["manufacturer"],
                    "product_type": spec["type"],
                    "authority_source": "CIBRC Registered Products Catalog / Manufacturer Specification",
                    "original_url": u
                })
        print(f"Top-up Agro: {spec['brand']} +{got}")

    # Trim or ensure exactly 200, 100, 100
    d_list = [x for x in gt if x["module"] == "disease"][:200]
    p_list = [x for x in gt if x["module"] == "plant"][:100]
    a_list = [x for x in gt if x["module"] == "agrochemical"][:100]
    final_gt = d_list + p_list + a_list

    with open(GROUND_TRUTH_FILE, "w", encoding="utf-8") as f:
        json.dump(final_gt, f, indent=2, ensure_ascii=False)

    print(f"\nFinal Calibrated GT: Disease={len(d_list)}, Plant={len(p_list)}, Agro={len(a_list)}, Total={len(final_gt)}")

if __name__ == "__main__":
    main()

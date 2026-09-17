import os
import sys
import json
import base64
import asyncio
import urllib.request
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend.app.db.mongodb import connect_to_mongo, get_database

PRODUCTS_DIR = WORKSPACE_ROOT / "frontend" / "public" / "products"
PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)

NEW_PRODUCTS_DATA = [
    # --- FUNGICIDES ---
    {
        "product_id": "score-syngenta",
        "brand_name": "SCORE",
        "company": "SYNGENTA INDIA",
        "category": "fungicide",
        "active_ingredients": "Difenoconazole 25% EC",
        "formulation_type": "Emulsifiable Concentrate (EC)",
        "target_diseases": [
            "Apple Scab", "Powdery Mildew", "Anthracnose", "Dieback", 
            "Tikka Disease", "Purple Blotch", "Leaf Spot"
        ],
        "target_crops": ["Apple", "Chilli", "Tomato", "Paddy", "Pomegranate", "Groundnut", "Onion"],
        "recommended_dosage_per_litre": "0.5 - 1.0 ml/L",
        "dosage_per_20l_tank": "15 ml",
        "farmer_measure_tip": "~1.5 measuring caps (15 ml)",
        "dosage_per_acre": "100 - 150 ml in 200L water",
        "safety_waiting_period_days": 15,
        "approx_price_inr": "₹380 - ₹430 (100ml bottle)",
        "action_mode": "Ergosterol Biosynthesis Systemic Curative & Preventive",
        "image_filename": "score_syngenta.webp",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/score-fungicide-file-3189.webp?v=1737468207",
        "primary_color": "#0d9488",
        "hazard_color": "#2563eb",
        "badge": "Scab & Spot Specialist"
    },
    {
        "product_id": "aliette-bayer",
        "brand_name": "ALIETTE",
        "company": "BAYER CROPSCIENCE",
        "category": "fungicide",
        "active_ingredients": "Fosetyl-Al 80% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Downy Mildew", "Damping-Off", "Phytophthora Gummosis", "Collar Rot", "Root Rot"
        ],
        "target_crops": ["Grapes", "Citrus", "Cardamom", "Tomato", "Chilli", "Cucumber"],
        "recommended_dosage_per_litre": "2.0 - 2.5 g/L",
        "dosage_per_20l_tank": "40 - 50 g",
        "farmer_measure_tip": "~2.5 tablespoons or 2 matchboxes",
        "dosage_per_acre": "400 - 500 g in 200L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹480 - ₹540 (250g pack)",
        "action_mode": "True Two-Way True Systemic (Phloem & Xylem Translocation)",
        "image_filename": "aliette_bayer.webp",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/aliette-file-663.webp?v=1737471492",
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "Two-Way Systemic"
    },
    {
        "product_id": "contaf-plus-tata",
        "brand_name": "CONTAF PLUS",
        "company": "TATA RALLIS INDIA",
        "category": "fungicide",
        "active_ingredients": "Hexaconazole 5% SC",
        "formulation_type": "Suspension Concentrate (SC)",
        "target_diseases": [
            "Sheath Blight", "Powdery Mildew", "Rust", "Tikka Disease", "Leaf Spot"
        ],
        "target_crops": ["Paddy", "Rice", "Chilli", "Groundnut", "Mango", "Grapes", "Soybean"],
        "recommended_dosage_per_litre": "2.0 ml/L",
        "dosage_per_20l_tank": "40 ml",
        "farmer_measure_tip": "~2 measuring caps (40 ml)",
        "dosage_per_acre": "400 ml in 200L water",
        "safety_waiting_period_days": 15,
        "approx_price_inr": "₹490 - ₹550 (500ml bottle)",
        "action_mode": "Broad-Spectrum Protective, Curative & Eradicant Triazole",
        "image_filename": "contaf_plus_tata.webp",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/contaf-plus-fungicide-file-2181.webp?v=1737483267",
        "primary_color": "#16a34a",
        "hazard_color": "#2563eb",
        "badge": "Sheath Blight Shield"
    },
    {
        "product_id": "indofil-m45",
        "brand_name": "INDOFIL M-45",
        "company": "INDOFIL INDUSTRIES",
        "category": "fungicide",
        "active_ingredients": "Mancozeb 75% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Early Blight", "Late Blight", "Leaf Spot", "Blast", 
            "Downy Mildew", "Fruit Rot", "Rust", "Cercospora"
        ],
        "target_crops": ["Potato", "Tomato", "Paddy", "Chilli", "Groundnut", "Wheat", "Maize"],
        "recommended_dosage_per_litre": "2.5 - 3.0 g/L",
        "dosage_per_20l_tank": "50 - 60 g",
        "farmer_measure_tip": "~3.5 tablespoons",
        "dosage_per_acre": "600 - 800 g in 250L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹310 - ₹360 (500g pack)",
        "action_mode": "Classic Broad-Spectrum Contact Multisite Protectant",
        "image_filename": "indofil_m45.webp",
        "image_download_url": "https://dujjhct8zer0r.cloudfront.net/media/prod_image/cce4892514067a8a736d2efd458deaaa-05-03-25-17-45-51.webp",
        "primary_color": "#ea580c",
        "hazard_color": "#16a34a",
        "badge": "Gold Standard Contact"
    },

    # --- PESTICIDES & INSECTICIDES ---
    {
        "product_id": "proclaim-syngenta",
        "brand_name": "PROCLAIM",
        "company": "SYNGENTA INDIA",
        "category": "pesticide",
        "active_ingredients": "Emamectin Benzoate 5% SG",
        "formulation_type": "Soluble Granules (SG)",
        "target_diseases": [
            "Bollworm", "Fruit Borer", "Shoot Borer", "Diamond Back Moth", "Fall Armyworm", "Pod Borer"
        ],
        "target_crops": ["Chilli", "Tomato", "Cotton", "Cabbage", "Pigeon Pea", "Maize", "Okra"],
        "recommended_dosage_per_litre": "0.4 - 0.5 g/L",
        "dosage_per_20l_tank": "8 - 10 g",
        "farmer_measure_tip": "~1 level teaspoon (8-10 g)",
        "dosage_per_acre": "80 - 100 g in 200L water",
        "safety_waiting_period_days": 5,
        "approx_price_inr": "₹390 - ₹440 (100g pack)",
        "action_mode": "Chloride Channel Activator Translaminar Lepidoptera Specialist",
        "image_filename": "proclaim_syngenta.webp",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/proclaim-insecticide-file-4614.webp?v=1737471428",
        "primary_color": "#dc2626",
        "hazard_color": "#2563eb",
        "badge": "Borer Knockout"
    },
    {
        "product_id": "pegasus-syngenta",
        "brand_name": "PEGASUS",
        "company": "SYNGENTA INDIA",
        "category": "pesticide",
        "active_ingredients": "Diafenthiuron 50% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Whitefly", "Mites", "Aphids", "Thrips", "Diamond Back Moth"
        ],
        "target_crops": ["Chilli", "Cotton", "Tomato", "Brinjal", "Cabbage", "Cardamom"],
        "recommended_dosage_per_litre": "1.2 - 1.5 g/L",
        "dosage_per_20l_tank": "25 g",
        "farmer_measure_tip": "~1.5 tablespoons or 1 pouch",
        "dosage_per_acre": "250 g in 200L water",
        "safety_waiting_period_days": 15,
        "approx_price_inr": "₹680 - ₹760 (250g pack)",
        "action_mode": "Unique Pro-Insecticide Vapor Action (ATP Synthase Inhibitor)",
        "image_filename": "pegasus_syngenta.webp",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/pegasus-insecticide-file-1819.webp?v=1737482429",
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "Whitefly & Mite Master"
    },
    {
        "product_id": "benevia-fmc",
        "brand_name": "BENEVIA",
        "company": "FMC INDIA",
        "category": "pesticide",
        "active_ingredients": "Cyantraniliprole 10.26% w/w OD",
        "formulation_type": "Oil Dispersion (OD)",
        "target_diseases": [
            "Whitefly", "Thrips", "Leafminer", "Aphids", "Fruit Borer", "Flea Beetle"
        ],
        "target_crops": ["Tomato", "Chilli", "Gherkins", "Watermelon", "Brinjal", "Onion"],
        "recommended_dosage_per_litre": "1.8 - 2.0 ml/L",
        "dosage_per_20l_tank": "36 - 40 ml",
        "farmer_measure_tip": "~2 measuring caps (40 ml)",
        "dosage_per_acre": "360 ml in 200L water",
        "safety_waiting_period_days": 5,
        "approx_price_inr": "₹850 - ₹950 (180ml bottle)",
        "action_mode": "Anthranilic Diamide Cross-Spectrum Sucking & Chewing Control",
        "image_filename": "benevia_fmc.jpg",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/benevia-insecticide-file-734.jpg?v=1772222407",
        "primary_color": "#15803d",
        "hazard_color": "#16a34a",
        "badge": "Cross-Spectrum Premium"
    },
    {
        "product_id": "admire-bayer",
        "brand_name": "ADMIRE",
        "company": "BAYER CROPSCIENCE",
        "category": "pesticide",
        "active_ingredients": "Imidacloprid 70% WG",
        "formulation_type": "Water Dispersible Granules (WG)",
        "target_diseases": [
            "Brown Plant Hopper", "Green Leafhopper", "Jassids", "Thrips", "Aphids"
        ],
        "target_crops": ["Paddy", "Rice", "Cotton", "Chilli", "Okra", "Sugarcane", "Tomato"],
        "recommended_dosage_per_litre": "0.3 g/L",
        "dosage_per_20l_tank": "6 g",
        "farmer_measure_tip": "~0.5 teaspoon or 1 small pouch (6 g)",
        "dosage_per_acre": "60 - 70 g in 200L water",
        "safety_waiting_period_days": 21,
        "approx_price_inr": "₹330 - ₹380 (50g pack)",
        "action_mode": "High-Concentration Fluidised Bed Granule Systemic Protection",
        "image_filename": "admire_bayer.webp",
        "image_download_url": "https://dujjhct8zer0r.cloudfront.net/media/prod_image/667798185e02b906f83e22b68a683214-04-02-25-17-28-07.webp",
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "Paddy BPH Artillery"
    },

    # --- FERTILIZERS & NUTRIENTS ---
    {
        "product_id": "mkp-00-52-34",
        "brand_name": "MAHADHAN 00:52:34 (MKP)",
        "company": "DEEPAK FERTILISERS",
        "category": "fertilizer",
        "active_ingredients": "0% N + 52% P2O5 + 34% K2O (Mono Potassium Phosphate)",
        "formulation_type": "100% Water Soluble Foliar & Drip Powder",
        "target_diseases": [
            "Poor Flowering", "Flower Drop", "Weak Root Growth", "Phosphorus-Potash Deficiency"
        ],
        "target_crops": ["Chilli", "Tomato", "Cotton", "Pomegranate", "Grapes", "Paddy", "Sugarcane"],
        "recommended_dosage_per_litre": "4.0 - 5.0 g/L",
        "dosage_per_20l_tank": "80 - 100 g",
        "farmer_measure_tip": "~4 level tablespoons or 1 teacup",
        "dosage_per_acre": "1.0 - 1.5 Kg in 200L water",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹210 - ₹250 per 1 Kg pack",
        "action_mode": "Pre-Bloom Phosphorus Surge & Reproductive Bud Induction",
        "image_filename": "mkp_00_52_34.jpg",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/mahadhan-mkp-005234-imp-fertilizer-file-21349.jpg?v=1747136420",
        "primary_color": "#16a34a",
        "hazard_color": "#16a34a",
        "badge": "Flowering & Root Surge"
    },
    {
        "product_id": "potassium-nitrate-13-0-45",
        "brand_name": "MAHADHAN 13:00:45 (KNO3)",
        "company": "DEEPAK FERTILISERS",
        "category": "fertilizer",
        "active_ingredients": "13% Nitrate Nitrogen + 45% Potash (K2O)",
        "formulation_type": "100% Water Soluble Fruit Development Crystals",
        "target_diseases": [
            "Under-sized Fruits", "Poor Fruit Color & Shine", "Low Sugar/Brix", "Drought Stress"
        ],
        "target_crops": ["Tomato", "Chilli", "Watermelon", "Banana", "Pomegranate", "Citrus", "Cotton"],
        "recommended_dosage_per_litre": "5.0 g/L",
        "dosage_per_20l_tank": "100 g",
        "farmer_measure_tip": "~5 tablespoons or 1 cup (100 g)",
        "dosage_per_acre": "1.0 - 1.5 Kg in 200L water",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹220 - ₹260 per 1 Kg pack",
        "action_mode": "Instant Potassium Transport for Fruit Weight, Shine & Shelf Life",
        "image_filename": "potassium_nitrate_13_0_45.jpg",
        "image_download_url": "https://cdn.shopify.com/s/files/1/0722/2059/files/mahadhan-kno3-130045-imp-fertilizer-file-21350.jpg?v=1747136422",
        "primary_color": "#d97706",
        "hazard_color": "#16a34a",
        "badge": "Fruit Size & Weight Multiplier"
    },
    {
        "product_id": "iffco-mop-potash",
        "brand_name": "MURIATE OF POTASH (MOP 60% K2O)",
        "company": "IFFCO / IPL INDIA",
        "category": "fertilizer",
        "active_ingredients": "60% Potassium as Potassium Chloride (KCl)",
        "formulation_type": "Granular Soil Application Fertilizer",
        "target_diseases": [
            "Crop Lodging", "Stem Weakness", "Low Grain Weight", "Potash Deficiency"
        ],
        "target_crops": ["Paddy", "Sugarcane", "Cotton", "Maize", "Groundnut", "Banana"],
        "recommended_dosage_per_litre": "Soil application only",
        "dosage_per_20l_tank": "Not for foliar spray",
        "farmer_measure_tip": "Apply directly into soil near crop root zone",
        "dosage_per_acre": "40 - 50 Kg bag per acre as basal/top dress",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹1,650 - ₹1,750 per 50 Kg bag",
        "action_mode": "Primary Soil Potash Carrier for Lodging Defense & Grain Filling",
        "image_filename": "iffco_mop_potash.webp",
        "image_download_url": "https://dujjhct8zer0r.cloudfront.net/media/prod_image/8a8068b458d986f466ed4c28b7dcf84d-01-25-21-21-23-44.webp",
        "primary_color": "#b91c1c",
        "hazard_color": "#16a34a",
        "badge": "Lodging Defense & Yield"
    },
    {
        "product_id": "ferrous-sulphate-aries",
        "brand_name": "FERROUS SULPHATE 19% (FE)",
        "company": "ARIES AGRO / KATYAYANI",
        "category": "fertilizer",
        "active_ingredients": "19% Iron (Fe) + 10.5% Sulphur (S)",
        "formulation_type": "Soluble Green Crystals",
        "target_diseases": [
            "Iron Chlorosis", "Yellow Leaves with Green Veins", "Bleached Young Leaves"
        ],
        "target_crops": ["Paddy", "Rice", "Sugarcane", "Groundnut", "Citrus", "Tomato", "Chilli"],
        "recommended_dosage_per_litre": "2.0 - 2.5 g/L",
        "dosage_per_20l_tank": "40 - 50 g",
        "farmer_measure_tip": "~2.5 level tablespoons (add juice of 1 lemon)",
        "dosage_per_acre": "500 g in 200L water via foliar spray",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹120 - ₹150 per 1 Kg pack",
        "action_mode": "Rapid Chlorophyll Synthesis Activator & Iron Deficiency Reversal",
        "image_filename": "ferrous_sulphate_aries.webp",
        "image_download_url": "https://dujjhct8zer0r.cloudfront.net/media/prod_image/11692979501771408438.webp",
        "primary_color": "#0d9488",
        "hazard_color": "#16a34a",
        "badge": "Iron Chlorosis Cure"
    }
]

def download_image(url, dest_path):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    }
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=12) as resp:
        data = resp.read()
        if len(data) > 2000:
            with open(dest_path, "wb") as f:
                f.write(data)
            return True, len(data)
    return False, 0

async def main():
    print("=== DOWNLOADING EXTENDED AGROCHEMICAL PRODUCTS ===")
    
    # 1. Download images
    downloaded_products = []
    for prod in NEW_PRODUCTS_DATA:
        p_id = prod["product_id"]
        filename = prod["image_filename"]
        dest = PRODUCTS_DIR / filename
        url = prod["image_download_url"]
        
        print(f"⏳ Downloading {prod['brand_name']} from {url}...")
        try:
            ok, sz = download_image(url, dest)
            if ok:
                print(f"✔ Downloaded {dest.name} ({sz:,} bytes)")
            else:
                print(f"⚠️ Failed to download {p_id}")
        except Exception as e:
            print(f"❌ Error downloading {p_id}: {e}")

        # Read base64
        b64_str = ""
        is_real = False
        if dest.exists():
            with open(dest, "rb") as f:
                b64_str = base64.b64encode(f.read()).decode("utf-8")
            is_real = True
            
        prod_doc = {
            "product_id": prod["product_id"],
            "brand_name": prod["brand_name"],
            "company": prod["company"],
            "category": prod["category"],
            "active_ingredients": prod["active_ingredients"],
            "formulation_type": prod["formulation_type"],
            "target_diseases": prod["target_diseases"],
            "target_crops": prod["target_crops"],
            "recommended_dosage_per_litre": prod["recommended_dosage_per_litre"],
            "dosage_per_20l_tank": prod["dosage_per_20l_tank"],
            "farmer_measure_tip": prod["farmer_measure_tip"],
            "dosage_per_acre": prod["dosage_per_acre"],
            "safety_waiting_period_days": prod["safety_waiting_period_days"],
            "approx_price_inr": prod["approx_price_inr"],
            "action_mode": prod["action_mode"],
            "image_filename": filename,
            "image_url": f"/products/{filename}",
            "image_base64": b64_str,
            "is_real_photo": is_real,
            "primary_color": prod["primary_color"],
            "hazard_color": prod["hazard_color"],
            "badge": prod["badge"]
        }
        downloaded_products.append(prod_doc)

    # 2. Push into MongoDB
    print("\n🚀 Connecting to MongoDB to insert extended products...")
    await connect_to_mongo()
    db = get_database()
    if db is None:
        print("❌ MongoDB connection failed!")
        return
        
    collection = db["agrochemical_products"]
    
    upsert_count = 0
    for doc in downloaded_products:
        p_id = doc["product_id"]
        res = await collection.update_one(
            {"product_id": p_id},
            {"$set": doc},
            upsert=True
        )
        upsert_count += 1
        print(f"✔ Upserted into MongoDB: {doc['brand_name']} ({p_id})")

    # Count total products
    total = await collection.count_documents({})
    print(f"\n🎉 MongoDB Sync Complete! Total Agrochemical Products in DB: {total}")

if __name__ == "__main__":
    asyncio.run(main())

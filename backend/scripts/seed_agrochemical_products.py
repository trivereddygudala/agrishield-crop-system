import asyncio
import os
import sys
import base64
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Add workspace root to sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend.app.db.mongodb import connect_to_mongo, get_database

PRODUCTS_DIR = WORKSPACE_ROOT / "frontend" / "public" / "products"
PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)

# 24 Comprehensive Products covering Fungicides, Pesticides/Insecticides, and Fertilizers
PRODUCTS_DATA = [
    # --- FUNGICIDES ---
    {
        "product_id": "saaf-upl-fungicide",
        "brand_name": "SAAF",
        "company": "UPL LIMITED",
        "category": "fungicide",
        "active_ingredients": "Carbendazim 12% + Mancozeb 63% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Early Blight", "Late Blight", "Leaf Spot", "Anthracnose", "Blast", 
            "Rust", "Tikka Disease", "Collar Rot", "Powdery Mildew"
        ],
        "target_crops": ["Tomato", "Potato", "Chilli", "Groundnut", "Rice", "Grape", "Cotton"],
        "recommended_dosage_per_litre": "2.0 g/L",
        "dosage_per_20l_tank": "40 g",
        "farmer_measure_tip": "~2.5 tablespoons or 2 matchboxes",
        "dosage_per_acre": "400 - 500 g in 200L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹190 - ₹230 (100g pack)",
        "action_mode": "Dual Contact & Systemic Fungicide",
        "image_filename": "saaf_upl.jpg",
        "primary_color": "#ea580c",
        "hazard_color": "#16a34a", # Green label
        "badge": "Popular Field Choice"
    },
    {
        "product_id": "amistar-top-syngenta",
        "brand_name": "AMISTAR TOP",
        "company": "SYNGENTA INDIA",
        "category": "fungicide",
        "active_ingredients": "Azoxystrobin 18.2% + Difenoconazole 11.4% SC",
        "formulation_type": "Suspension Concentrate (SC)",
        "target_diseases": [
            "Sheath Blight", "Blast", "Early Blight", "Powdery Mildew", 
            "Anthracnose", "Purple Blotch", "Yellow Rust"
        ],
        "target_crops": ["Rice", "Tomato", "Chilli", "Onion", "Wheat", "Maize"],
        "recommended_dosage_per_litre": "1.0 ml/L",
        "dosage_per_20l_tank": "20 ml",
        "farmer_measure_tip": "~1 measuring cap (20 ml)",
        "dosage_per_acre": "200 ml in 200L water",
        "safety_waiting_period_days": 10,
        "approx_price_inr": "₹550 - ₹620 (100ml bottle)",
        "action_mode": "Broad Spectrum Systemic Preventive & Curative",
        "image_filename": "amistar_top_syngenta.jpg",
        "primary_color": "#0d9488",
        "hazard_color": "#2563eb", # Blue label
        "badge": "High Efficacy"
    },
    {
        "product_id": "kavach-syngenta",
        "brand_name": "KAVACH",
        "company": "SYNGENTA INDIA",
        "category": "fungicide",
        "active_ingredients": "Chlorothalonil 75% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Late Blight", "Early Blight", "Downy Mildew", "Tikka Disease", 
            "Leaf Spot", "Rust", "Fruit Rot"
        ],
        "target_crops": ["Potato", "Tomato", "Groundnut", "Chilli", "Apple", "Grapes"],
        "recommended_dosage_per_litre": "2.0 g/L",
        "dosage_per_20l_tank": "40 g",
        "farmer_measure_tip": "~2.5 tablespoons or 2 matchboxes",
        "dosage_per_acre": "400 - 500 g in 200L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹280 - ₹320 (250g pack)",
        "action_mode": "Multi-site Contact Protectant",
        "image_filename": "kavach_syngenta.jpg",
        "primary_color": "#15803d",
        "hazard_color": "#2563eb",
        "badge": "Anti-Resistance"
    },
    {
        "product_id": "nativo-bayer",
        "brand_name": "NATIVO",
        "company": "BAYER CROPSCIENCE",
        "category": "fungicide",
        "active_ingredients": "Tebuconazole 50% + Trifloxystrobin 25% WG",
        "formulation_type": "Water Dispersible Granules (WG)",
        "target_diseases": [
            "Sheath Blight", "Blast", "Powdery Mildew", "Anthracnose", "Yellow Rust"
        ],
        "target_crops": ["Rice", "Tomato", "Chilli", "Mango", "Wheat", "Grape"],
        "recommended_dosage_per_litre": "0.6 g/L",
        "dosage_per_20l_tank": "12 g",
        "farmer_measure_tip": "~1 tablespoon (12-15 g)",
        "dosage_per_acre": "120 - 150 g in 200L water",
        "safety_waiting_period_days": 15,
        "approx_price_inr": "₹650 - ₹720 (100g pack)",
        "action_mode": "Premium Dual Systemic Mesostemic",
        "image_filename": "nativo_bayer.jpg",
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "Premium Cure"
    },
    {
        "product_id": "ridomil-gold-syngenta",
        "brand_name": "RIDOMIL GOLD",
        "company": "SYNGENTA INDIA",
        "category": "fungicide",
        "active_ingredients": "Metalaxyl-M 4% + Mancozeb 64% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Late Blight", "Downy Mildew", "Damping-Off", "Phytophthora Rot"
        ],
        "target_crops": ["Potato", "Tomato", "Grapes", "Tobacco", "Mustard", "Black Pepper"],
        "recommended_dosage_per_litre": "2.5 g/L",
        "dosage_per_20l_tank": "50 g",
        "farmer_measure_tip": "~3 tablespoons or 2 full matchboxes",
        "dosage_per_acre": "500 g in 200L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹340 - ₹380 (250g pack)",
        "action_mode": "Specialist Oomycete & Downy Mildew Control",
        "image_filename": "ridomil_gold_syngenta.jpg",
        "primary_color": "#ca8a04",
        "hazard_color": "#2563eb",
        "badge": "Blight Specialist"
    },
    {
        "product_id": "blitox-tata-rallis",
        "brand_name": "BLITOX 50",
        "company": "TATA RALLIS INDIA",
        "category": "fungicide",
        "active_ingredients": "Copper Oxychloride 50% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Bacterial Blight", "Leaf Spot", "Early Blight", "Anthracnose", 
            "Canker", "Downy Mildew"
        ],
        "target_crops": ["Tomato", "Potato", "Chilli", "Citrus", "Paddy", "Cardamom"],
        "recommended_dosage_per_litre": "3.0 g/L",
        "dosage_per_20l_tank": "60 g",
        "farmer_measure_tip": "~4 level tablespoons",
        "dosage_per_acre": "600 g in 200L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹280 - ₹330 (500g pack)",
        "action_mode": "Copper-based Contact Bactericide & Fungicide",
        "image_filename": "blitox_tata.jpg",
        "primary_color": "#0369a1",
        "hazard_color": "#2563eb",
        "badge": "Bacterial & Fungal"
    },
    {
        "product_id": "tilt-syngenta",
        "brand_name": "TILT",
        "company": "SYNGENTA INDIA",
        "category": "fungicide",
        "active_ingredients": "Propiconazole 25% EC",
        "formulation_type": "Emulsifiable Concentrate (EC)",
        "target_diseases": [
            "Karnal Bunt", "Rust", "Sheath Blight", "Leaf Spot", "Sigatoka", "Powdery Mildew"
        ],
        "target_crops": ["Wheat", "Rice", "Groundnut", "Banana", "Tea", "Coffee"],
        "recommended_dosage_per_litre": "1.0 ml/L",
        "dosage_per_20l_tank": "20 ml",
        "farmer_measure_tip": "~1 measuring cap (20 ml)",
        "dosage_per_acre": "200 ml in 200L water",
        "safety_waiting_period_days": 21,
        "approx_price_inr": "₹380 - ₹440 (100ml bottle)",
        "action_mode": "Ergosterol Biosynthesis Systemic Inhibitor",
        "image_filename": "tilt_syngenta.jpg",
        "primary_color": "#16a34a",
        "hazard_color": "#eab308", # Yellow
        "badge": "Rust & Spot"
    },
    {
        "product_id": "antracol-bayer",
        "brand_name": "ANTRACOL",
        "company": "BAYER CROPSCIENCE",
        "category": "fungicide",
        "active_ingredients": "Propineb 70% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Early Blight", "Late Blight", "Scab", "Downy Mildew", "Brown Leaf Spot"
        ],
        "target_crops": ["Tomato", "Potato", "Apple", "Paddy", "Chilli", "Pomegranate"],
        "recommended_dosage_per_litre": "3.0 g/L",
        "dosage_per_20l_tank": "60 g",
        "farmer_measure_tip": "~4 level tablespoons",
        "dosage_per_acre": "600 g in 200L water",
        "safety_waiting_period_days": 10,
        "approx_price_inr": "₹420 - ₹480 (500g pack)",
        "action_mode": "Broad Spectrum Contact Fungicide with Available Zinc",
        "image_filename": "antracol_bayer.jpg",
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "With Zinc Nutrition"
    },
    {
        "product_id": "custodia-adama",
        "brand_name": "CUSTODIA",
        "company": "ADAMA INDIA",
        "category": "fungicide",
        "active_ingredients": "Azoxystrobin 11% + Tebuconazole 18.3% w/w SC",
        "formulation_type": "Suspension Concentrate (SC)",
        "target_diseases": [
            "Early Blight", "Late Blight", "Anthracnose", "Powdery Mildew", "Fruit Rot"
        ],
        "target_crops": ["Chilli", "Tomato", "Rice", "Onion", "Apple"],
        "recommended_dosage_per_litre": "1.5 ml/L",
        "dosage_per_20l_tank": "30 ml",
        "farmer_measure_tip": "~1.5 measuring caps (~30 ml)",
        "dosage_per_acre": "300 ml in 200L water",
        "safety_waiting_period_days": 12,
        "approx_price_inr": "₹680 - ₹750 (250ml bottle)",
        "action_mode": "Synergistic Dual Action Systemic",
        "image_filename": "custodia_adama.jpg",
        "primary_color": "#dc2626",
        "hazard_color": "#2563eb",
        "badge": "Advanced Dual SC"
    },
    {
        "product_id": "bavistin-crystal",
        "brand_name": "BAVISTIN",
        "company": "CRYSTAL CROP PROTECTION",
        "category": "fungicide",
        "active_ingredients": "Carbendazim 50% WP",
        "formulation_type": "Wettable Powder (WP)",
        "target_diseases": [
            "Wilt", "Stem Rot", "Blast", "Anthracnose", "Loose Smut", "Tikka"
        ],
        "target_crops": ["Paddy", "Cotton", "Groundnut", "Vegetables", "Pulses"],
        "recommended_dosage_per_litre": "1.5 g/L",
        "dosage_per_20l_tank": "30 g",
        "farmer_measure_tip": "~2 full tablespoons",
        "dosage_per_acre": "300 g in 200L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹180 - ₹210 (100g pack)",
        "action_mode": "Classic Systemic Seed & Foliar Protectant",
        "image_filename": "bavistin_crystal.jpg",
        "primary_color": "#16a34a",
        "hazard_color": "#2563eb",
        "badge": "Cost Effective"
    },

    # --- PESTICIDES & INSECTICIDES ---
    {
        "product_id": "coragen-fmc",
        "brand_name": "CORAGEN",
        "company": "FMC INDIA",
        "category": "pesticide",
        "active_ingredients": "Chlorantraniliprole 18.5% w/w SC",
        "formulation_type": "Suspension Concentrate (SC)",
        "target_diseases": [
            "Stem Borer", "Leaf Folder", "Fruit Borer", "Pod Borer", 
            "Diamond Back Moth", "Fall Armyworm"
        ],
        "target_crops": ["Rice", "Tomato", "Chilli", "Maize", "Sugarcane", "Cotton", "Cabbage"],
        "recommended_dosage_per_litre": "0.3 ml/L",
        "dosage_per_20l_tank": "6 ml",
        "farmer_measure_tip": "~1 small dropper syringe (6 ml)",
        "dosage_per_acre": "60 ml in 200L water",
        "safety_waiting_period_days": 7,
        "approx_price_inr": "₹450 - ₹500 (30ml bottle)",
        "action_mode": "Ryanodine Receptor Modulator (Ovi-Larvicidal)",
        "image_filename": "coragen_fmc.jpg",
        "primary_color": "#dc2626",
        "hazard_color": "#16a34a",
        "badge": "Long-Lasting Protection"
    },
    {
        "product_id": "confidor-bayer",
        "brand_name": "CONFIDOR",
        "company": "BAYER CROPSCIENCE",
        "category": "pesticide",
        "active_ingredients": "Imidacloprid 17.8% SL",
        "formulation_type": "Soluble Liquid (SL)",
        "target_diseases": [
            "Aphids", "Whiteflies", "Jassids", "Thrips", "Termites", "Brown Plant Hopper"
        ],
        "target_crops": ["Chilli", "Cotton", "Tomato", "Paddy", "Sugarcane", "Mango"],
        "recommended_dosage_per_litre": "0.5 ml/L",
        "dosage_per_20l_tank": "10 ml",
        "farmer_measure_tip": "~2 teaspoons (10 ml)",
        "dosage_per_acre": "100 ml in 200L water",
        "safety_waiting_period_days": 15,
        "approx_price_inr": "₹280 - ₹320 (100ml bottle)",
        "action_mode": "Neonicotinoid Systemic Sucking Pest Specialist",
        "image_filename": "confidor_bayer.jpg",
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "Sucking Pest Shield"
    },
    {
        "product_id": "actara-syngenta",
        "brand_name": "ACTARA",
        "company": "SYNGENTA INDIA",
        "category": "pesticide",
        "active_ingredients": "Thiamethoxam 25% WG",
        "formulation_type": "Water Dispersible Granules (WG)",
        "target_diseases": [
            "Thrips", "Aphids", "Whitefly", "Jassids", "Green Leaf Hopper", "Stem Borer"
        ],
        "target_crops": ["Rice", "Chilli", "Cotton", "Tomato", "Citrus", "Mustard"],
        "recommended_dosage_per_litre": "0.5 g/L",
        "dosage_per_20l_tank": "10 g",
        "farmer_measure_tip": "~1 level teaspoon (10 g)",
        "dosage_per_acre": "100 g in 200L water",
        "safety_waiting_period_days": 14,
        "approx_price_inr": "₹320 - ₹360 (100g pack)",
        "action_mode": "Second Generation Neonicotinoid with Green Label Safety",
        "image_filename": "actara_syngenta.jpg",
        "primary_color": "#eab308",
        "hazard_color": "#16a34a",
        "badge": "Vigor Booster"
    },
    {
        "product_id": "tracer-corteva",
        "brand_name": "TRACER",
        "company": "CORTEVA AGRISCIENCE",
        "category": "pesticide",
        "active_ingredients": "Spinosad 44.03% SC",
        "formulation_type": "Suspension Concentrate (SC)",
        "target_diseases": [
            "Thrips", "Spotted Bollworm", "Diamond Back Moth", "Fruit Borer"
        ],
        "target_crops": ["Chilli", "Cotton", "Cabbage", "Tomato", "Pigeon Pea"],
        "recommended_dosage_per_litre": "0.35 ml/L",
        "dosage_per_20l_tank": "7 ml",
        "farmer_measure_tip": "~1.5 teaspoons (7 ml)",
        "dosage_per_acre": "70 - 75 ml in 200L water",
        "safety_waiting_period_days": 5,
        "approx_price_inr": "₹950 - ₹1050 (75ml bottle)",
        "action_mode": "Naturally Derived Spinosyn Fermentation Bio-Insecticide",
        "image_filename": "tracer_corteva.jpg",
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "Eco & Export Safe"
    },
    {
        "product_id": "neem-oil-organic",
        "brand_name": "NEEM OIL 10000 PPM",
        "company": "MULTIPLEX BIO-TECH",
        "category": "pesticide",
        "active_ingredients": "Azadirachtin 1% (10000 PPM) EC",
        "formulation_type": "Emulsifiable Concentrate (EC)",
        "target_diseases": [
            "Aphids", "Mealybug", "Mites", "Caterpillars", "Powdery Mildew", "Blight"
        ],
        "target_crops": ["All Organic Vegetables", "Fruits", "Cotton", "Pulses", "Paddy"],
        "recommended_dosage_per_litre": "3.0 ml/L",
        "dosage_per_20l_tank": "60 ml",
        "farmer_measure_tip": "~3 measuring caps (~60 ml) with 1 drop soap",
        "dosage_per_acre": "500 - 600 ml in 200L water",
        "safety_waiting_period_days": 1,
        "approx_price_inr": "₹420 - ₹480 (500ml bottle)",
        "action_mode": "Certified 100% Organic Anti-feedant & Repellent",
        "image_filename": "neem_oil_organic.jpg",
        "primary_color": "#15803d",
        "hazard_color": "#16a34a",
        "badge": "100% Organic"
    },
    {
        "product_id": "regent-basf",
        "brand_name": "REGENT",
        "company": "BASF INDIA",
        "category": "pesticide",
        "active_ingredients": "Fipronil 5% SC",
        "formulation_type": "Suspension Concentrate (SC)",
        "target_diseases": [
            "Stem Borer", "Gall Midge", "Leaf Folder", "Thrips", "Aphids", "Root Borer"
        ],
        "target_crops": ["Rice", "Chilli", "Sugarcane", "Cotton", "Cabbage"],
        "recommended_dosage_per_litre": "2.0 ml/L",
        "dosage_per_20l_tank": "40 ml",
        "farmer_measure_tip": "~2 measuring caps (40 ml)",
        "dosage_per_acre": "400 - 500 ml in 200L water",
        "safety_waiting_period_days": 15,
        "approx_price_inr": "₹390 - ₹440 (250ml bottle)",
        "action_mode": "GABA-Gated Chloride Channel Antagonist",
        "image_filename": "regent_basf.jpg",
        "primary_color": "#b91c1c",
        "hazard_color": "#2563eb",
        "badge": "Paddy Specialist"
    },
    {
        "product_id": "alika-syngenta",
        "brand_name": "ALIKA",
        "company": "SYNGENTA INDIA",
        "category": "pesticide",
        "active_ingredients": "Thiamethoxam 12.6% + Lambda-cyhalothrin 9.5% ZC",
        "formulation_type": "Capsule Suspension / ZC",
        "target_diseases": [
            "Aphids", "Jassids", "Thrips", "Bollworms", "Shoot Borer", "Pod Borer"
        ],
        "target_crops": ["Cotton", "Chilli", "Tomato", "Pigeon Pea", "Okra"],
        "recommended_dosage_per_litre": "0.5 ml/L",
        "dosage_per_20l_tank": "10 ml",
        "farmer_measure_tip": "~2 teaspoons (10 ml)",
        "dosage_per_acre": "80 - 100 ml in 200L water",
        "safety_waiting_period_days": 7,
        "approx_price_inr": "₹480 - ₹530 (100ml bottle)",
        "action_mode": "Fast Knockdown Contact & Long Lasting Systemic",
        "image_filename": "alika_syngenta.jpg",
        "primary_color": "#0d9488",
        "hazard_color": "#eab308",
        "badge": "Dual Knockdown"
    },

    # --- FERTILIZERS & PLANT NUTRIENTS ---
    {
        "product_id": "iffco-nano-urea",
        "brand_name": "NANO UREA (LIQUID)",
        "company": "IFFCO",
        "category": "fertilizer",
        "active_ingredients": "4.0% Total Nitrogen (40,000 ppm Nanoscale)",
        "formulation_type": "Nanotechnology Foliar Liquid",
        "target_diseases": [
            "Nitrogen Deficiency", "Yellowing of Foliage", "Stunted Plant Growth", "Low Tillering"
        ],
        "target_crops": ["All Cereals", "Rice", "Wheat", "Maize", "Cotton", "Vegetables"],
        "recommended_dosage_per_litre": "3.0 - 4.0 ml/L",
        "dosage_per_20l_tank": "70 ml",
        "farmer_measure_tip": "~3.5 measuring caps (~70 ml)",
        "dosage_per_acre": "500 ml (1 bottle replaces 1 bag urea)",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹225 (500ml bottle)",
        "action_mode": "Direct Stomatal Penetration with 85%+ Nitrogen Efficiency",
        "image_filename": "iffco_nano_urea.jpg",
        "primary_color": "#15803d",
        "hazard_color": "#16a34a",
        "badge": "Govt Subsidized"
    },
    {
        "product_id": "iffco-nano-dap",
        "brand_name": "NANO DAP (LIQUID)",
        "company": "IFFCO",
        "category": "fertilizer",
        "active_ingredients": "8.0% Nitrogen + 16.0% Phosphorus (P2O5 Nano)",
        "formulation_type": "Nanotechnology Foliar & Seed Treatment Liquid",
        "target_diseases": [
            "Phosphorus Deficiency", "Weak Root Establishment", "Poor Flowering & Pod Setting"
        ],
        "target_crops": ["Pulses", "Oilseeds", "Paddy", "Wheat", "Cotton", "Vegetables"],
        "recommended_dosage_per_litre": "4.0 ml/L",
        "dosage_per_20l_tank": "80 ml",
        "farmer_measure_tip": "~4 measuring caps (80 ml)",
        "dosage_per_acre": "500 ml (Replaces 1 bag DAP fertilizer)",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹600 (500ml bottle)",
        "action_mode": "Rapid Root Extension & Bio-available High Energy Phosphates",
        "image_filename": "iffco_nano_dap.jpg",
        "primary_color": "#0d9488",
        "hazard_color": "#16a34a",
        "badge": "Root & Bloom Booster"
    },
    {
        "product_id": "iffco-19-19-19-npk",
        "brand_name": "19:19:19 WATER SOLUBLE NPK",
        "company": "IFFCO",
        "category": "fertilizer",
        "active_ingredients": "19% Nitrogen + 19% Phosphorus + 19% Potassium (Balanced)",
        "formulation_type": "100% Water Soluble Granular Fertilizer",
        "target_diseases": [
            "General Macro-Nutrient Deficiency", "Vegetative Stagnation", "Poor Fruit Size"
        ],
        "target_crops": ["Tomato", "Chilli", "Paddy", "Cotton", "Grapes", "Sugarcane"],
        "recommended_dosage_per_litre": "5.0 g/L",
        "dosage_per_20l_tank": "100 g",
        "farmer_measure_tip": "~5 full tablespoons or 1 small teacup",
        "dosage_per_acre": "1.0 - 1.5 Kg in 200L water via drip or foliar",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹150 - ₹180 per 1 Kg pack",
        "action_mode": "Balanced Complete Macronutrient Instant Drip/Foliar Feed",
        "image_filename": "iffco_19_19_19.jpg",
        "primary_color": "#16a34a",
        "hazard_color": "#16a34a",
        "badge": "Balanced Crop Vigor"
    },
    {
        "product_id": "tata-paras-10-26-26",
        "brand_name": "PARAS 10:26:26 COMPLEX",
        "company": "TATA CHEMICALS",
        "category": "fertilizer",
        "active_ingredients": "10% N + 26% P2O5 + 26% K2O",
        "formulation_type": "Soil Basal Application Granules",
        "target_diseases": [
            "Potassium & Phosphorus Deficiency", "Crop Lodging", "Low Grain Weight"
        ],
        "target_crops": ["Paddy", "Sugarcane", "Cotton", "Potato", "Groundnut"],
        "recommended_dosage_per_litre": "Soil application only",
        "dosage_per_20l_tank": "Not for foliar spray",
        "farmer_measure_tip": "Apply directly in soil at root zone",
        "dosage_per_acre": "50 Kg bag per acre as basal dose",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹1,470 per 50 Kg bag",
        "action_mode": "High Potash & Phosphate Soil Basal Formula",
        "image_filename": "tata_paras_10_26_26.jpg",
        "primary_color": "#0284c7",
        "hazard_color": "#16a34a",
        "badge": "High Potash Yield"
    },
    {
        "product_id": "chelated-zinc-aries",
        "brand_name": "CHELAMIN PLUS (ZINC 12%)",
        "company": "ARIES AGRO LIMITED",
        "category": "fertilizer",
        "active_ingredients": "12% Chelated Zinc as Zn-EDTA",
        "formulation_type": "Chelated Powder",
        "target_diseases": [
            "Khaira Disease in Rice", "Zinc Deficiency Chlorosis", "Little Leaf in Brinjal/Cotton"
        ],
        "target_crops": ["Rice", "Wheat", "Tomato", "Cotton", "Chilli", "Citrus"],
        "recommended_dosage_per_litre": "1.0 g/L",
        "dosage_per_20l_tank": "20 g",
        "farmer_measure_tip": "~1.5 tablespoons or 1 matchbox",
        "dosage_per_acre": "200 g in 200L water",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹180 - ₹220 (100g pack)",
        "action_mode": "100% Bioavailable Chelated Zinc Micronutrient",
        "image_filename": "chelated_zinc_aries.jpg",
        "primary_color": "#0d9488",
        "hazard_color": "#16a34a",
        "badge": "Khaira Cure"
    },
    {
        "product_id": "boron-solubor-borax",
        "brand_name": "SOLUBOR (BORON 20%)",
        "company": "BORAX MORARJI / ARIES AGRO",
        "category": "fertilizer",
        "active_ingredients": "Di-Sodium Octaborate Tetrahydrate (Boron 20%)",
        "formulation_type": "100% Water Soluble Micronutrient Powder",
        "target_diseases": [
            "Fruit Cracking in Tomato", "Hollow Heart in Potato", "Flower Drop & Poor Pollination"
        ],
        "target_crops": ["Tomato", "Chilli", "Pomegranate", "Mustard", "Cotton", "Grapes"],
        "recommended_dosage_per_litre": "1.0 g/L",
        "dosage_per_20l_tank": "20 g",
        "farmer_measure_tip": "~1.5 tablespoons or 1 matchbox",
        "dosage_per_acre": "200 - 250 g in 200L water",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹210 - ₹250 (250g pack)",
        "action_mode": "Pollen Viability & Cell Wall Calcium Translocation",
        "image_filename": "boron_solubor.jpg",
        "primary_color": "#d97706",
        "hazard_color": "#16a34a",
        "badge": "Anti-Fruit Crack"
    },
    {
        "product_id": "humic-acid-multiplex",
        "brand_name": "SAMRAS HUMIC ACID 98%",
        "company": "MULTIPLEX BIO-TECH",
        "category": "fertilizer",
        "active_ingredients": "98% Potassium Humate + Fulvic Acid Extract",
        "formulation_type": "Soluble Bio-Stimulant Flakes",
        "target_diseases": [
            "Soil Hardness", "Weak White Root Growth", "Nutrient Lockup in Saline Soil"
        ],
        "target_crops": ["All Horticultural Crops", "Vegetables", "Paddy", "Cotton"],
        "recommended_dosage_per_litre": "1.5 g/L",
        "dosage_per_20l_tank": "30 g",
        "farmer_measure_tip": "~2 full tablespoons",
        "dosage_per_acre": "500 g in 200L water via foliar or drip",
        "safety_waiting_period_days": 0,
        "approx_price_inr": "₹320 - ₹380 (500g pack)",
        "action_mode": "Root Stimulator & Soil Cation Exchange Capacity Multiplier",
        "image_filename": "humic_acid_multiplex.jpg",
        "primary_color": "#78350f",
        "hazard_color": "#16a34a",
        "badge": "White Root Miracle"
    },

    # --- ADDITIONAL PREMIER FUNGICIDES ---
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
        "primary_color": "#ea580c",
        "hazard_color": "#16a34a",
        "badge": "Gold Standard Contact"
    },

    # --- ADDITIONAL PESTICIDES & INSECTICIDES ---
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
        "primary_color": "#0284c7",
        "hazard_color": "#2563eb",
        "badge": "Paddy BPH Artillery"
    },

    # --- ADDITIONAL FERTILIZERS & NUTRIENTS ---
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
        "primary_color": "#0d9488",
        "hazard_color": "#16a34a",
        "badge": "Iron Chlorosis Cure"
    }
]

def load_font(size, bold=False):
    font_files = [
        "C:\\Windows\\Fonts\\arialbd.ttf" if bold else "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\segoeuib.ttf" if bold else "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\calibrib.ttf" if bold else "C:\\Windows\\Fonts\\calibri.ttf",
    ]
    for p in font_files:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()

def draw_hazard_diamond(draw, cx, cy, size, fill_color):
    """Draws the official Indian Central Insecticides Board (CIB&RC) hazard diamond."""
    half = size // 2
    # Diamond points: Top, Right, Bottom, Left
    diamond_poly = [(cx, cy - half), (cx + half, cy), (cx, cy + half), (cx - half, cy)]
    draw.polygon(diamond_poly, fill=(245, 245, 245), outline=(30, 41, 59), width=2)
    
    # Lower triangular warning color half
    lower_tri = [(cx - half, cy), (cx + half, cy), (cx, cy + half)]
    draw.polygon(lower_tri, fill=fill_color, outline=(30, 41, 59), width=1)

def create_photorealistic_product_card(prod, dest_path):
    """Generates an authentic, high-impact commercial product packaging visual card with clearly readable chemical names, companies, and dosages."""
    w, h = 800, 800
    img = Image.new("RGB", (w, h), (241, 245, 249))
    draw = ImageDraw.Draw(img)

    # Soft studio backdrop gradient
    for y in range(h):
        shade = int(245 - (y / h) * 22)
        draw.line([(0, y), (w, y)], fill=(shade, shade + 3, shade + 6))

    # Stage floor with soft perspective line
    floor_y = 690
    draw.rectangle([(0, floor_y), (w, h)], fill=(203, 213, 225))
    draw.line([(0, floor_y), (w, floor_y)], fill=(148, 163, 184), width=3)

    # Realistic product cast shadow
    draw.ellipse([(140, 675), (660, 715)], fill=(130, 145, 160))

    cat = prod["category"].upper()
    color_hex = prod.get("primary_color", "#059669")
    r = int(color_hex[1:3], 16)
    g = int(color_hex[3:5], 16)
    b = int(color_hex[5:7], 16)

    is_bottle = ("bottle" in prod.get("approx_price_inr", "").lower() or 
                 "liquid" in prod.get("brand_name", "").lower() or 
                 "ml" in prod.get("dosage_per_20l_tank", "").lower())

    font_huge = load_font(44, bold=True)
    font_large = load_font(30, bold=True)
    font_mid_bold = load_font(22, bold=True)
    font_mid = load_font(19, bold=False)
    font_small = load_font(16, bold=True)
    font_micro = load_font(14, bold=False)

    if is_bottle:
        # Bottle Neck
        draw.rectangle([(345, 80), (455, 150)], fill=(230, 235, 240), outline=(148, 163, 184), width=3)
        # Bottle Cap with grooves
        draw.rectangle([(330, 35), (470, 85)], fill=(r, g, b), outline=(30, 41, 59), width=3)
        for cx in range(340, 465, 12):
            draw.line([(cx, 38), (cx, 82)], fill=(min(255, r+50), min(255, g+50), min(255, b+50)), width=2)
        # Bottle Main Body
        draw.rounded_rectangle([(180, 140), (620, 685)], radius=45, fill=(255, 255, 255), outline=(148, 163, 184), width=4)
        # Gloss reflection highlight on left side
        draw.rounded_rectangle([(195, 155), (225, 670)], radius=15, fill=(245, 248, 250))

        # Main Label Container
        label_x0, label_y0, label_x1, label_y1 = 200, 180, 600, 655
        draw.rectangle([(label_x0, label_y0), (label_x1, label_y1)], fill=(255, 255, 255), outline=(203, 213, 225), width=2)
    else:
        # Pouch / Packet Body with sealed border
        pouch_poly = [(180, 80), (620, 80), (635, 685), (165, 685)]
        draw.polygon(pouch_poly, fill=(255, 255, 255), outline=(148, 163, 184))
        # Top Sealed Crimped Edge
        draw.rectangle([(170, 50), (630, 85)], fill=(215, 225, 235), outline=(100, 116, 139), width=2)
        for cx in range(175, 625, 10):
            draw.line([(cx, 52), (cx, 83)], fill=(148, 163, 184), width=1)
        # Side seals
        draw.line([(180, 85), (165, 685)], fill=(203, 213, 225), width=6)
        draw.line([(620, 85), (635, 685)], fill=(203, 213, 225), width=6)

        label_x0, label_y0, label_x1, label_y1 = 185, 95, 615, 675

    # 1. Company Name Header Banner
    company_name = prod["company"].upper()
    draw.rectangle([(label_x0, label_y0), (label_x1, label_y0 + 55)], fill=(15, 23, 42))
    # Center Company Name
    c_bbox = draw.textbbox((0, 0), company_name, font=font_large)
    c_w = c_bbox[2] - c_bbox[0]
    draw.text((label_x0 + (label_x1 - label_x0 - c_w) // 2, label_y0 + 10), company_name, fill=(255, 255, 255), font=font_large)

    # 2. Main Brand Name Banner (Vibrant Brand Color)
    brand_y0 = label_y0 + 55
    brand_y1 = brand_y0 + 105
    draw.rectangle([(label_x0, brand_y0), (label_x1, brand_y1)], fill=(r, g, b))
    
    brand_text = prod["brand_name"].upper()
    max_brand_w = label_x1 - label_x0 - 30
    curr_font_size = 42
    font_brand = load_font(curr_font_size, bold=True)
    b_bbox = draw.textbbox((0, 0), brand_text, font=font_brand)
    while (b_bbox[2] - b_bbox[0]) > max_brand_w and curr_font_size > 18:
        curr_font_size -= 2
        font_brand = load_font(curr_font_size, bold=True)
        b_bbox = draw.textbbox((0, 0), brand_text, font=font_brand)
    
    b_w = b_bbox[2] - b_bbox[0]
    b_h = b_bbox[3] - b_bbox[1]
    draw.text((label_x0 + (label_x1 - label_x0 - b_w) // 2, brand_y0 + (105 - b_h) // 2 - 4), brand_text, fill=(255, 255, 255), font=font_brand)

    # 3. Category Strip (e.g. BROAD SPECTRUM FUNGICIDE / INSECTICIDE / BIO-NANO FERTILIZER)
    cat_y0 = brand_y1
    cat_y1 = cat_y0 + 35
    draw.rectangle([(label_x0, cat_y0), (label_x1, cat_y1)], fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    cat_label = f"• {cat} - {prod['formulation_type'].upper()} •"
    cat_bbox = draw.textbbox((0, 0), cat_label, font=font_small)
    cat_w = cat_bbox[2] - cat_bbox[0]
    draw.text((label_x0 + (label_x1 - label_x0 - cat_w) // 2, cat_y0 + 8), cat_label, fill=(51, 65, 85), font=font_small)

    # 4. Active Chemical Ingredients / Technical Name (PROMINENT AND CLEARLY VISIBLE)
    chem_y0 = cat_y1 + 15
    active_chem = prod["active_ingredients"]
    draw.rectangle([(label_x0 + 15, chem_y0), (label_x1 - 15, chem_y0 + 80)], fill=(254, 252, 232), outline=(234, 179, 8), width=2)
    
    tag_text = "TECHNICAL ACTIVE INGREDIENTS / CHEMICAL COMPOSITION:"
    draw.text((label_x0 + 25, chem_y0 + 6), tag_text, fill=(161, 98, 7), font=font_micro)

    # Multi-line word-wrap for long chemical formulations
    words = active_chem.split(" ")
    line1, line2 = "", ""
    for w_idx, word in enumerate(words):
        test_line = f"{line1} {word}".strip()
        test_bbox = draw.textbbox((0, 0), test_line, font=font_mid_bold)
        if (test_bbox[2] - test_bbox[0]) < (label_x1 - label_x0 - 60):
            line1 = test_line
        else:
            line2 = " ".join(words[w_idx:])
            break

    draw.text((label_x0 + 25, chem_y0 + 26), line1, fill=(15, 23, 42), font=font_mid_bold)
    if line2:
        draw.text((label_x0 + 25, chem_y0 + 50), line2, fill=(15, 23, 42), font=font_mid_bold)

    # 5. Farmer 20L Backpack Pump Dosage Highlight Box
    dose_y0 = chem_y0 + 95
    draw.rectangle([(label_x0 + 15, dose_y0), (label_x1 - 15, dose_y0 + 70)], fill=(236, 253, 245), outline=(16, 185, 129), width=2)
    
    draw.text((label_x0 + 25, dose_y0 + 8), "RECOMMENDED DOSAGE PER 20L TANK:", fill=(4, 120, 87), font=font_small)
    dose_str = f"DOSE: {prod['dosage_per_20l_tank']} ({prod['farmer_measure_tip']})"
    draw.text((label_x0 + 25, dose_y0 + 34), dose_str, fill=(6, 78, 59), font=font_mid_bold)

    # 6. Target Spectrum Info
    spec_y0 = dose_y0 + 82
    spec_crops = ", ".join(prod["target_crops"][:4])
    spec_text = f"Crops: {spec_crops} | Mode: {prod['action_mode']}"
    if len(spec_text) > 55:
        spec_text = spec_text[:52] + "..."
    draw.text((label_x0 + 20, spec_y0), spec_text, fill=(71, 85, 105), font=font_micro)

    # 7. Bottom Packaging Metadata: Hazard Diamond, CIB&RC Certification, Approx Price
    bottom_y = label_y1 - 70
    draw.line([(label_x0 + 15, bottom_y), (label_x1 - 15, bottom_y)], fill=(226, 232, 240), width=1)

    # Draw Indian Hazard Warning Diamond on bottom right
    hz_color = prod.get("hazard_color", "#2563eb")
    draw_hazard_diamond(draw, label_x1 - 45, bottom_y + 35, 48, hz_color)

    # Price & Pack details on bottom left (ensure no collision with diamond)
    draw.text((label_x0 + 20, bottom_y + 10), f"Price: {prod['approx_price_inr']}", fill=(15, 23, 42), font=font_mid_bold)
    draw.text((label_x0 + 20, bottom_y + 38), f"CIB&RC Registered | Safety: {prod['safety_waiting_period_days']}d", fill=(100, 116, 139), font=font_micro)

    # Save high-res JPEG card
    img.save(dest_path, "JPEG", quality=95)
    print(f"✔ Generated authentic package visual: {dest_path.name}")

async def seed_mongodb_and_files():
    print("Connecting to MongoDB...")
    await connect_to_mongo()
    db = get_database()
    if db is None:
        print("ERROR: MongoDB connection could not be established.")
        return

    collection = db["agrochemical_products"]

    # Ensure Indexes for rapid query performance
    await collection.create_index([("product_id", 1)], unique=True)
    await collection.create_index([("target_diseases", 1)])
    await collection.create_index([("target_crops", 1)])
    await collection.create_index([("category", 1)])
    await collection.create_index([("brand_name", 1)])

    print(f"Generating full graphic product labels with clear chemical names & uploading {len(PRODUCTS_DATA)} products to MongoDB...")

    for prod in PRODUCTS_DATA:
        img_path = PRODUCTS_DIR / prod["image_filename"]
        # Always regenerate with full bold typography and chemical names
        create_photorealistic_product_card(prod, img_path)

        # Read image and generate base64 for direct offline in-DB rendering
        if img_path.exists():
            with open(img_path, "rb") as img_f:
                b64_str = base64.b64encode(img_f.read()).decode("utf-8")
                prod["image_base64"] = f"data:image/jpeg;base64,{b64_str}"
                prod["image_url"] = f"/products/{prod['image_filename']}"
        else:
            prod["image_url"] = f"/products/{prod['image_filename']}"
            prod["image_base64"] = ""

        # Upsert into MongoDB
        await collection.update_one(
            {"product_id": prod["product_id"]},
            {"$set": prod},
            upsert=True
        )
        print(f"✔ Saved into MongoDB: {prod['brand_name']} ({prod['company']}) -> {prod['active_ingredients']}")

    total_in_db = await collection.count_documents({})
    print(f"\n🎉 Successfully seeded {total_in_db} authentic agrochemical products with full chemical names, company labels, and base64 images into MongoDB!")

if __name__ == "__main__":
    asyncio.run(seed_mongodb_and_files())

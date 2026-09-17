import os
import sys
import json
import zipfile
import shutil
import base64
from PIL import Image
from pymongo import MongoClient

# Target crops and their key disease/condition classes in combined_dataset.zip
CROP_SPECS = [
    # 1. Tomato (10 classes x 3 = 30 images)
    {
        "crop": "Tomato",
        "crop_te": "టమోటా",
        "crop_hi": "टमाटर",
        "icon": "🍅",
        "classes": [
            ("Tomato_Early_blight", "Early Blight", "ముందస్తు తెగులు (ఎర్లీ బ్లైట్)", "High"),
            ("Tomato_Late_blight", "Late Blight", "ఆలస్యపు తెగులు (లేట్ బ్లైట్)", "Critical"),
            ("Tomato_Bacterial_spot", "Bacterial Spot", "బాక్టీరియా మచ్చ తెగులు", "Medium"),
            ("Tomato_Leaf_Mold", "Leaf Mold", "ఆకు బూజు తెగులు", "Medium"),
            ("Tomato_Septoria_leaf_spot", "Septoria Leaf Spot", "సెప్టోరియా ఆకుమచ్చ తెగులు", "Medium"),
            ("Tomato_Spider_mites_Two_spotted_spider_mite", "Spider Mites Infestation", "ఎర్ర నల్లి / స్పైడర్ మైట్", "High"),
            ("Tomato__Target_Spot", "Target Spot", "టార్గెట్ స్పాట్ తెగులు", "Medium"),
            ("Tomato__Tomato_YellowLeaf__Curl_Virus", "Yellow Leaf Curl Virus", "ఆకు ముడత వైరస్ (జెమినివైరస్)", "Critical"),
            ("Tomato__Tomato_mosaic_virus", "Mosaic Virus", "మొజాయిక్ వైరస్", "High"),
            ("Tomato_healthy", "Healthy Leaf", "ఆరోగ్యకరమైన ఆకు", "None")
        ]
    },
    # 2. Potato (3 classes x 3 = 9 images)
    {
        "crop": "Potato",
        "crop_te": "బంగాళాదుంప",
        "crop_hi": "आलू",
        "icon": "🥔",
        "classes": [
            ("Potato___Early_blight", "Early Blight", "ముందస్తు ఆకు మాడ తెగులు", "High"),
            ("Potato___Late_blight", "Late Blight", "ఆలస్యపు మాడ తెగులు", "Critical"),
            ("Potato___healthy", "Healthy Leaf", "ఆరోగ్యకరమైన ఆకు", "None")
        ]
    },
    # 3. Chilli & Pepper (7 classes x 3 = 21 images)
    {
        "crop": "Chilli",
        "crop_te": "మిరప",
        "crop_hi": "मिर्च",
        "icon": "🌶️",
        "classes": [
            ("Chilli___Anthracnose", "Anthracnose / Dieback", "కొమ్మ ఎండు తెగులు / ఆంత్రాక్నోస్", "Critical"),
            ("Chilli___Leaf_Spot", "Cercospora Leaf Spot", "సెర్కోస్పోరా ఆకుమచ్చ తెగులు", "Medium"),
            ("Chilli___Leaf_Curl_Virus", "Leaf Curl Virus", "జెమినివైరస్ ఆకుముడత", "Critical"),
            ("Chilli___Veinal_Mottle_Virus", "Veinal Mottle Virus", "ఈనెల మొజాయిక్ వైరస్", "High"),
            ("Chilli___Whitefly", "Whitefly Damage", "తెల్లదోమ ఆశించిన ఆకు", "High"),
            ("Chilli___healthy", "Healthy Foliage", "ఆరోగ్యకరమైన మిరప ఆకు", "None"),
            ("Bell_pepper_leaf_spot", "Bacterial Leaf Spot", "బాక్టీరియల్ ఆకుమచ్చ తెగులు", "Medium")
        ]
    },
    # 4. Rice / Paddy (6 classes x 3 = 18 images)
    {
        "crop": "Rice",
        "crop_te": "వరి",
        "crop_hi": "धान / चावल",
        "icon": "🌾",
        "classes": [
            ("Rice_Bacterial_Leaf_Blight", "Bacterial Leaf Blight", "బాక్టీరియా ఆకు ఎండు తెగులు", "Critical"),
            ("Rice_Brown_Spot", "Brown Spot", "గోధుమ రంగు మచ్చ తెగులు", "High"),
            ("Rice_Leaf_Smut", "Leaf Smut", "ఆకు కాటుక తెగులు", "Medium"),
            ("Rice_Leaf_Roller", "Leaf Folder / Roller", "ఆకుచుట్టు పురుగు", "High"),
            ("Rice_Leafhopper", "Green Leafhopper", "పచ్చ దీపపు పురుగు", "Medium"),
            ("Rice_Leaf_Mite", "Rice Leaf Mite", "వరి ఆకు నల్లి", "Medium")
        ]
    },
    # 5. Corn / Maize (4 classes x 3 = 12 images)
    {
        "crop": "Corn",
        "crop_te": "మొక్కజొన్న",
        "crop_hi": "मक्का",
        "icon": "🌽",
        "classes": [
            ("Corn_(maize)___Common_rust_", "Common Rust", "కుంకుమ తెగులు (రస్ట్)", "High"),
            ("Corn_(maize)___Northern_Leaf_Blight", "Northern Leaf Blight", "టర్సికం ఆకు మాడ తెగులు", "High"),
            ("Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot", "Gray Leaf Spot", "బూడిద రంగు ఆకుమచ్చ తెగులు", "Medium"),
            ("Corn_(maize)___healthy", "Healthy Corn Leaf", "ఆరోగ్యకరమైన మొక్కజొన్న ఆకు", "None")
        ]
    },
    # 6. Cotton (4 classes x 3 = 12 images)
    {
        "crop": "Cotton",
        "crop_te": "పత్తి",
        "crop_hi": "कपास",
        "icon": "🌱",
        "classes": [
            ("Cotton___Bacterial_blight", "Bacterial Blight / Angular Leaf Spot", "బాక్టీరియా కోణీయ ఆకుమచ్చ తెగులు", "High"),
            ("Cotton___Curl_virus", "Leaf Curl Virus", "పత్తి ఆకుముడత వైరస్", "Critical"),
            ("Cotton___Fusarium_wilt", "Fusarium Wilt", "ఫ్యుసేరియం ఎండు తెగులు", "Critical"),
            ("Cotton___healthy", "Healthy Cotton Leaf", "ఆరోగ్యకరమైన పత్తి ఆకు", "None")
        ]
    },
    # 7. Groundnut / Peanut (4 classes x 3 = 12 images)
    {
        "crop": "Groundnut",
        "crop_te": "వేరుశనగ",
        "crop_hi": "मूंगफली",
        "icon": "🥜",
        "classes": [
            ("Groundnut___LEAF SPOT (EARLY AND LATE)", "Tikka Leaf Spot", "తిక్కా ఆకుమచ్చ తెగులు", "High"),
            ("Groundnut___RUST", "Groundnut Rust", "కుంకుమ తెగులు (రస్ట్)", "High"),
            ("Groundnut___ROSETTE", "Groundnut Rosette Virus", "గుబురు తెగులు / రోసెట్ వైరస్", "Critical"),
            ("Groundnut___HEALTHY", "Healthy Groundnut Leaf", "ఆరోగ్యకరమైన వేరుశనగ ఆకు", "None")
        ]
    },
    # 8. Sugarcane (4 classes x 3 = 12 images)
    {
        "crop": "Sugarcane",
        "crop_te": "చెరకు",
        "crop_hi": "गन्ना",
        "icon": "🎋",
        "classes": [
            ("Sugarcane___RedRot", "Red Rot Disease", "ఎర్ర కుళ్లు తెగులు (రెడ్ రాట్)", "Critical"),
            ("Sugarcane___Rust", "Sugarcane Rust", "చెరకు కుంకుమ తెగులు", "Medium"),
            ("Sugarcane___Mosaic", "Mosaic Virus", "మొజాయిక్ వైరస్", "High"),
            ("Sugarcane___Healthy", "Healthy Sugarcane Foliage", "ఆరోగ్యకరమైన చెరకు ఆకు", "None")
        ]
    },
    # 9. Banana (4 classes x 3 = 12 images)
    {
        "crop": "Banana",
        "crop_te": "అరటి",
        "crop_hi": "केला",
        "icon": "🍌",
        "classes": [
            ("Banana Black Sigatoka Disease", "Black Sigatoka Leaf Streak", "నల్ల సిగటోక ఆకు తెగులు", "Critical"),
            ("Banana Yellow Sigatoka Disease", "Yellow Sigatoka Leaf Spot", "పసుపు సిగటోక తెగులు", "High"),
            ("Banana Panama Disease", "Panama Wilt (Fusarium)", "పనామా విల్ట్ ఎండు తెగులు", "Critical"),
            ("Banana Healthy Leaf", "Healthy Banana Leaf", "ఆరోగ్యకరమైన అరటి ఆకు", "None")
        ]
    },
    # 10. Apple (4 classes x 3 = 12 images)
    {
        "crop": "Apple",
        "crop_te": "యాపిల్",
        "crop_hi": "सेब",
        "icon": "🍎",
        "classes": [
            ("Apple___Apple_scab", "Apple Scab", "యాపిల్ గజ్జి తెగులు (స్కాబ్)", "High"),
            ("Apple___Black_rot", "Black Rot", "నల్ల కుళ్లు తెగులు", "High"),
            ("Apple___Cedar_apple_rust", "Cedar Apple Rust", "సీడర్ యాపిల్ రస్ట్ తెగులు", "Medium"),
            ("Apple___healthy", "Healthy Apple Leaf", "ఆరోగ్యకరమైన యాపిల్ ఆకు", "None")
        ]
    },
    # 11. Grape (4 classes x 3 = 12 images)
    {
        "crop": "Grape",
        "crop_te": "ద్రాక్ష",
        "crop_hi": "अंगूर",
        "icon": "🍇",
        "classes": [
            ("Grape___Black_rot", "Black Rot", "ద్రాక్ష నల్ల కుళ్లు తెగులు", "High"),
            ("Grape___Esca_(Black_Measles)", "Esca (Black Measles)", "ఎస్కా / నల్ల మచ్చ తెగులు", "Critical"),
            ("Grape___Leaf_blight_(Isariopsis_Leaf_Spot)", "Leaf Blight (Isariopsis)", "ఆకు మాడ తెగులు", "Medium"),
            ("Grape___healthy", "Healthy Grape Leaf", "ఆరోగ్యకరమైన ద్రాక్ష ఆకు", "None")
        ]
    },
    # 12. Citrus / Orange (2 classes x 3 = 6 images)
    {
        "crop": "Citrus",
        "crop_te": "నిమ్మ / బత్తాయి",
        "crop_hi": "नींबू / संतरा",
        "icon": "🍊",
        "classes": [
            ("Orange___Haunglongbing_(Citrus_greening)", "Citrus Greening (HLB)", "సిట్రస్ గ్రీనింగ్ తెగులు", "Critical"),
            ("Citrus_Leafminer", "Citrus Leafminer Infestation", "ఆకు తొలిచే పురుగు", "High")
        ]
    },
    # 13. Wheat (3 classes x 3 = 9 images)
    {
        "crop": "Wheat",
        "crop_te": "గోధుమ",
        "crop_hi": "गेहूं",
        "icon": "🌾",
        "classes": [
            ("Wheat_Aphid", "Wheat Aphid Infestation", "గోధుమ పేనుబంక పురుగు", "High"),
            ("Wheat_Armyworm", "Armyworm Leaf Damage", "లద్దెపురుగు ఆకు నష్టం", "Critical"),
            ("Wheat_Midge", "Wheat Blossom Midge", "గోధుమ పూత మిడ్జ్ పురుగు", "Medium")
        ]
    },
    # 14. Mango (2 classes x 3 = 6 images)
    {
        "crop": "Mango",
        "crop_te": "మామిడి",
        "crop_hi": "आम",
        "icon": "🥭",
        "classes": [
            ("Fruit_Anthracnose_Mango", "Mango Anthracnose", "మామిడి ఆంత్రాక్నోస్ మచ్చ తెగులు", "High"),
            ("Fruit_Alternaria_Mango", "Alternaria Rot", "ఆల్టర్నేరియా కుళ్లు తెగులు", "Medium")
        ]
    },
    # 15. Soybean (2 classes x 3 = 6 images)
    {
        "crop": "Soybean",
        "crop_te": "సోయాబీన్",
        "crop_hi": "सोयाबीन",
        "icon": "🌱",
        "classes": [
            ("Soybean_Aphid", "Soybean Aphids", "సోయాబీన్ పేనుబంక", "High"),
            ("Soybean_Looper", "Soybean Looper Caterpillar", "ఆకు తినే గొంగళి పురుగు", "High")
        ]
    }
]

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    zip_path = os.path.join(root_dir, "datasets", "combined_dataset.zip")
    
    if not os.path.exists(zip_path):
        print(f"Error: {zip_path} not found.")
        sys.exit(1)
        
    out_datasets_dir = os.path.join(root_dir, "datasets", "crop_disease_samples")
    out_public_dir = os.path.join(root_dir, "frontend", "public", "samples", "dataset")
    
    os.makedirs(out_datasets_dir, exist_ok=True)
    os.makedirs(out_public_dir, exist_ok=True)
    
    print(f"Opening archive: {zip_path} ...")
    z = zipfile.ZipFile(zip_path)
    
    # Map all archive items
    all_names = z.namelist()
    class_map = {}
    for name in all_names:
        if name.endswith('/') or not (name.lower().endswith('.jpg') or name.lower().endswith('.png') or name.lower().endswith('.jpeg')):
            continue
        parts = name.strip('/').split('/')
        if len(parts) >= 3:
            cls = parts[1]
            class_map.setdefault(cls, []).append(name)
            
    print(f"Loaded {len(class_map)} class categories from zip.")
    
    catalog = []
    total_extracted = 0
    
    # Extract 3 high-quality images per class
    IMAGES_PER_CLASS = 3
    
    for spec in CROP_SPECS:
        crop = spec["crop"]
        crop_te = spec["crop_te"]
        crop_hi = spec["crop_hi"]
        crop_icon = spec["icon"]
        
        crop_dataset_dir = os.path.join(out_datasets_dir, crop)
        crop_public_dir = os.path.join(out_public_dir, crop.lower())
        os.makedirs(crop_dataset_dir, exist_ok=True)
        os.makedirs(crop_public_dir, exist_ok=True)
        
        for cls_name, disease_name, disease_te, severity in spec["classes"]:
            available = class_map.get(cls_name, [])
            if not available:
                # Try finding a case-insensitive or partial match
                for k, v in class_map.items():
                    if cls_name.lower() in k.lower():
                        available = v
                        break
            
            if not available:
                print(f"  [WARN] Class {cls_name} not found in zip. Skipping.")
                continue
                
            # Pick evenly spaced images to ensure variety
            step = max(1, len(available) // IMAGES_PER_CLASS)
            selected = [available[i * step] for i in range(min(IMAGES_PER_CLASS, len(available)))]
            
            for idx, zip_entry in enumerate(selected, 1):
                clean_disease = disease_name.lower().replace(" ", "_").replace("/", "_").replace("(", "").replace(")", "").replace("-", "_")
                filename = f"{crop.lower()}_{clean_disease}_{idx:02d}.jpg"
                
                dataset_dest = os.path.join(crop_dataset_dir, filename)
                public_dest = os.path.join(crop_public_dir, filename)
                
                # Extract image bytes
                img_bytes = z.read(zip_entry)
                
                # Write to datasets folder
                with open(dataset_dest, "wb") as f:
                    f.write(img_bytes)
                    
                # Resize/optimize for web and write to public folder
                try:
                    from io import BytesIO
                    pil_img = Image.open(BytesIO(img_bytes)).convert('RGB')
                    # Standardize dimension max 800x800 for instant snappy web loading
                    pil_img.thumbnail((800, 800), Image.Resampling.LANCZOS)
                    pil_img.save(public_dest, 'JPEG', quality=88, optimize=True)
                except Exception as e:
                    with open(public_dest, "wb") as f:
                        f.write(img_bytes)
                
                # Generate base64 thumbnail for fast UI pre-rendering
                with open(public_dest, "rb") as f:
                    b64_thumb = f"data:image/jpeg;base64,{base64.b64encode(f.read()).decode('utf-8')}"
                
                rel_url = f"/samples/dataset/{crop.lower()}/{filename}"
                
                item = {
                    "id": f"{crop.lower()}_{clean_disease}_{idx:02d}",
                    "crop": crop,
                    "crop_te": crop_te,
                    "crop_hi": crop_hi,
                    "crop_icon": crop_icon,
                    "disease": disease_name,
                    "disease_te": disease_te,
                    "severity": severity,
                    "file_name": filename,
                    "image_url": rel_url,
                    "local_dataset_path": dataset_dest,
                    "original_archive_path": zip_entry,
                    "base64_preview": b64_thumb
                }
                catalog.append(item)
                total_extracted += 1
                
    print(f"\n=======================================================")
    print(f"SUCCESS: Extracted and optimized {total_extracted} real crop disease images!")
    print(f"=======================================================")
    
    # Save JSON catalogs
    catalog_public_path = os.path.join(root_dir, "frontend", "public", "samples", "dataset_catalog.json")
    catalog_dataset_path = os.path.join(out_datasets_dir, "dataset_catalog.json")
    
    # For public catalog, save lightweight version (without base64) to keep network payload super light (~50KB)
    public_catalog = [{k: v for k, v in it.items() if k != "base64_preview"} for it in catalog]
    
    with open(catalog_public_path, "w", encoding="utf-8") as f:
        json.dump(public_catalog, f, indent=2, ensure_ascii=False)
        
    with open(catalog_dataset_path, "w", encoding="utf-8") as f:
        json.dump(public_catalog, f, indent=2, ensure_ascii=False)
        
    print(f"Saved public catalog ({len(public_catalog)} items) to: {catalog_public_path}")
    
    # Seed into MongoDB
    try:
        mongo_uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2500)
        db = client["crop_disease_system"]
        coll = db["crop_disease_dataset_samples"]
        
        coll.delete_many({}) # Clear existing
        coll.insert_many(catalog)
        print(f"Successfully seeded {len(catalog)} samples with base64 into MongoDB: db.crop_disease_dataset_samples")
    except Exception as e:
        print(f"MongoDB seeding notice: {e}")

if __name__ == "__main__":
    main()

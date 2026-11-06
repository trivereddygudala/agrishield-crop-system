import os
import sys
import shutil
import json
import re

# Ensure stdout uses UTF-8
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

BASE_DIR = r"c:\AI Crop Disease Detection System"
MODELS_DIR = os.path.join(BASE_DIR, "models", "per_crop")
SAMPLES_DIR = os.path.join(BASE_DIR, "datasets", "crop_disease_samples")
COMBINED_DIR = os.path.join(BASE_DIR, "datasets", "combined_dataset", "combined_dataset")
CATALOG_PATH = os.path.join(SAMPLES_DIR, "dataset_catalog.json")

# Load catalog if exists
catalog_items = []
if os.path.exists(CATALOG_PATH):
    with open(CATALOG_PATH, "r", encoding="utf-8") as f:
        catalog_items = json.load(f)
print(f"Loaded {len(catalog_items)} items from dataset_catalog.json")

crops = sorted(os.listdir(MODELS_DIR))
print(f"Processing {len(crops)} crop micro-models...")

summary_stats = {"total_crops": len(crops), "total_classes": 0, "images_attached": 0}

for crop_slug in crops:
    crop_dir = os.path.join(MODELS_DIR, crop_slug)
    classes_file = os.path.join(crop_dir, "classes.json")
    if not os.path.isfile(classes_file):
        continue

    with open(classes_file, "r", encoding="utf-8") as f:
        classes_data = json.load(f)

    crop_name = classes_data.get("crop_name", crop_slug)
    classes = classes_data.get("classes", [])
    samples_dir = os.path.join(crop_dir, "samples")
    os.makedirs(samples_dir, exist_ok=True)

    enriched_classes = []
    
    for cls in classes:
        summary_stats["total_classes"] += 1
        cls_clean = cls.lower().replace("_", " ").strip()
        matched_image_src = None

        # 1. Look in dataset_catalog.json
        for item in catalog_items:
            item_crop = item.get("crop", "").lower()
            item_disease = item.get("disease", "").lower()
            if (crop_slug in item_crop or item_crop in crop_slug) and (cls_clean in item_disease or item_disease in cls_clean):
                if os.path.exists(item.get("local_dataset_path", "")):
                    matched_image_src = item["local_dataset_path"]
                    break

        # 2. Look in crop_disease_samples/<Crop>/
        if not matched_image_src and os.path.exists(SAMPLES_DIR):
            for crop_folder in os.listdir(SAMPLES_DIR):
                if crop_folder.lower() in crop_slug or crop_slug in crop_folder.lower():
                    sub = os.path.join(SAMPLES_DIR, crop_folder)
                    if os.path.isdir(sub):
                        for img_name in os.listdir(sub):
                            if any(part in img_name.lower() for part in cls.lower().split("_") if len(part) > 3):
                                matched_image_src = os.path.join(sub, img_name)
                                break
                if matched_image_src:
                    break

        # 3. Look in combined_dataset/combined_dataset/
        if not matched_image_src and os.path.exists(COMBINED_DIR):
            for folder in os.listdir(COMBINED_DIR):
                folder_lower = folder.lower()
                if any(part in folder_lower for part in crop_slug.split("_") if len(part) > 3):
                    if any(part in folder_lower for part in cls.lower().split("_") if len(part) > 3):
                        folder_path = os.path.join(COMBINED_DIR, folder)
                        if os.path.isdir(folder_path):
                            for fname in os.listdir(folder_path)[:1]:
                                if fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                                    matched_image_src = os.path.join(folder_path, fname)
                                    break
                if matched_image_src:
                    break

        # 4. If healthy class, look for any healthy leaf of that crop
        if not matched_image_src and "healthy" in cls.lower():
            if os.path.exists(SAMPLES_DIR):
                for crop_folder in os.listdir(SAMPLES_DIR):
                    if crop_folder.lower() in crop_slug:
                        sub = os.path.join(SAMPLES_DIR, crop_folder)
                        for img_name in os.listdir(sub):
                            if "healthy" in img_name.lower():
                                matched_image_src = os.path.join(sub, img_name)
                                break

        sample_rel_path = None
        if matched_image_src and os.path.exists(matched_image_src):
            dest_filename = f"{cls.lower()}.jpg"
            dest_path = os.path.join(samples_dir, dest_filename)
            try:
                shutil.copy2(matched_image_src, dest_path)
                sample_rel_path = f"samples/{dest_filename}"
                summary_stats["images_attached"] += 1
            except Exception as e:
                pass

        enriched_classes.append({
            "class_name": cls,
            "display_name": cls.replace("_", " "),
            "has_sample_image": sample_rel_path is not None,
            "sample_image_path": sample_rel_path,
            "source_dataset_path": matched_image_src if matched_image_src else None
        })

    # Save enriched manifest
    manifest_file = os.path.join(crop_dir, "disease_catalog.json")
    with open(manifest_file, "w", encoding="utf-8") as f:
        json.dump({
            "crop": crop_slug,
            "crop_name": crop_name,
            "num_classes": len(classes),
            "classes": enriched_classes
        }, f, indent=2, ensure_ascii=False)

print("\n--- POPULATION SUMMARY ---")
print(f"Total Crops Processed: {summary_stats['total_crops']}")
print(f"Total Disease Classes: {summary_stats['total_classes']}")
print(f"Sample Disease Images Successfully Attached: {summary_stats['images_attached']}")


import os
import sys
import base64
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from model.predict_pytorch import predict_crop_disease, initialize_and_validate

def predict_custom_image(image_path: str):
    if not os.path.exists(image_path):
        print(f"[ERROR] Image file not found: {image_path}")
        print("Please provide a valid image path. Example: python predict_my_image.py my_leaf.jpg")
        return

    print("=" * 70)
    print(f"AI Crop Disease System - Testing Image: {os.path.basename(image_path)}")
    print("=" * 70)

    initialize_and_validate()
    
    res = predict_crop_disease(image_path)

    print("\n" + "=" * 70)
    print("PREDICTION RESULT SUMMARY")
    print("=" * 70)
    print(f"Crop Name                       : {res['crop_name']}")
    print(f"Disease Name                    : {res['disease_name']}")
    print(f"Confidence                      : {res['confidence'] * 100:.2f}%")
    print(f"Status                          : {res['prediction_status'].upper()}")
    print(f"Inference Time                  : {res['prediction_time_ms']:.2f} ms")
    print("-" * 70)
    print("TOP 3 PREDICTIONS:")
    for idx, p in enumerate(res['top_predictions'], 1):
        print(f"  {idx}. {p['class_name']:<45} {p['confidence'] * 100:.2f}%")
    print("-" * 70)
    print("AGRONOMIC RECOMMENDATIONS:")
    print(f"  Symptoms                     : {res.get('symptoms', 'N/A')}")
    print(f"  Disease Stage                : {res.get('disease_stage', 'N/A')}")
    print(f"  Organic Treatment            : {res.get('organic_treatment', 'N/A')}")
    print(f"  Chemical Treatment           : {res.get('chemical_treatment', 'N/A')}")
    print(f"  Prevention Methods           : {', '.join(res.get('prevention_methods', []))}")
    print("=" * 70)

    # Save heatmap overlay if available
    overlay_b64 = res.get("gradcam_base64")
    if overlay_b64 and overlay_b64.startswith("data:image"):
        try:
            b64_data = overlay_b64.split(",")[1]
            img_data = base64.b64decode(b64_data)
            output_heatmap_path = os.path.join(BASE_DIR, "heatmap_result.jpg")
            with open(output_heatmap_path, "wb") as f:
                f.write(img_data)
            print(f"\n[INFO] Heatmap visualization saved to: {output_heatmap_path}")
        except Exception as e:
            print(f"[WARNING] Could not save heatmap image: {e}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target_path = sys.argv[1]
    else:
        # Default test image
        target_path = os.path.join(BASE_DIR, "test_leaf.jpg")
        
    predict_custom_image(target_path)

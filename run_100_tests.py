import os
import json
import time
from model.predict_pytorch import predict_crop_disease

with open('datasets/crop_disease_samples/dataset_catalog.json', encoding='utf-8') as f:
    catalog = json.load(f)

# Select 100 diverse samples across crops
selected = catalog[:100]
print(f"Loaded {len(selected)} test samples for validation.")

results = []
correct_count = 0
total_time_ms = 0

for i, sample in enumerate(selected, 1):
    img_path = sample['local_dataset_path']
    expected_crop = sample['crop']
    expected_disease = sample['disease']
    
    t0 = time.perf_counter()
    pred = predict_crop_disease(img_path)
    dt_ms = (time.perf_counter() - t0) * 1000
    total_time_ms += dt_ms
    
    pred_crop = pred['crop_name']
    pred_disease = pred['disease_name']
    conf = pred['confidence'] * 100
    
    # Check if crop matches and disease matches or relates
    crop_match = expected_crop.lower() in pred_crop.lower() or pred_crop.lower() in expected_crop.lower()
    disease_match = expected_disease.lower() in pred_disease.lower() or pred_disease.lower() in expected_disease.lower()
    is_match = crop_match and disease_match
    if is_match:
        correct_count += 1
        
    results.append({
        'id': i,
        'image': sample['file_name'],
        'crop': expected_crop,
        'expected': expected_disease,
        'predicted': pred_disease,
        'confidence': round(conf, 2),
        'latency_ms': round(dt_ms, 1),
        'match': is_match
    })
    
    if i % 20 == 0 or i == 100:
        print(f"Processed {i}/100 images... (Accuracy so far: {correct_count}/{i})")

accuracy = (correct_count / len(selected)) * 100
avg_latency = total_time_ms / len(selected)

summary = {
    'total_tests': len(selected),
    'correct_matches': correct_count,
    'accuracy_pct': round(accuracy, 2),
    'avg_latency_ms': round(avg_latency, 2),
    'results': results
}

with open('benchmark_100_results.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2)

print("\n=== BENCHMARK COMPLETE ===")
print(f"Total Images Tested: {len(selected)}")
print(f"Correct Diagnoses: {correct_count}/{len(selected)} ({accuracy:.1f}%)")
print(f"Average Speed per Leaf: {avg_latency:.1f} ms")

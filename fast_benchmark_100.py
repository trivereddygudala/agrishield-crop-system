import os
import json
import time
import numpy as np
from PIL import Image
import onnxruntime as ort

MODEL_PATH = "frontend/public/models/crop_disease_model_int8.onnx"
CLASSES_PATH = "frontend/public/models/model_classes.json"
CATALOG_PATH = "datasets/crop_disease_samples/dataset_catalog.json"

# 1. Load ONNX Model & Classes
print("Loading On-Device INT8 ONNX Model...")
session = ort.InferenceSession(MODEL_PATH, providers=['CPUExecutionProvider'])
input_name = session.get_inputs()[0].name

with open(CLASSES_PATH, "r", encoding="utf-8") as f:
    class_names = json.load(f)

with open(CATALOG_PATH, "r", encoding="utf-8") as f:
    catalog = json.load(f)

# Select first 100 test samples
samples = catalog[:100]

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(3, 1, 1)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(3, 1, 1)

def preprocess(img_path):
    img = Image.open(img_path).convert('RGB')
    img = img.resize((224, 224), Image.Resampling.BILINEAR)
    arr = np.array(img, dtype=np.float32) / 255.0  # HWC
    arr = arr.transpose(2, 0, 1)  # CHW
    arr = (arr - MEAN) / STD
    return np.expand_dims(arr, axis=0)  # [1, 3, 224, 224]

results = []
correct_matches = 0
latencies = []

t_start_all = time.perf_counter()

for idx, item in enumerate(samples, 1):
    img_path = item['local_dataset_path']
    expected_crop = item['crop']
    expected_disease = item['disease']
    
    t0 = time.perf_counter()
    tensor = preprocess(img_path)
    outputs = session.run(None, {input_name: tensor})
    logits = outputs[0][0]
    
    # Softmax
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / np.sum(exp_logits)
    pred_idx = int(np.argmax(probs))
    conf = float(probs[pred_idx]) * 100.0
    raw_class = class_names[pred_idx]
    
    dt_ms = (time.perf_counter() - t0) * 1000.0
    latencies.append(dt_ms)
    
    # Clean label
    clean_label = raw_class.replace('___', ' - ').replace('_', ' ')
    
    # Check match against expected crop and disease
    crop_match = expected_crop.lower() in clean_label.lower()
    disease_match = any(word.lower() in clean_label.lower() for word in expected_disease.split() if len(word) > 3)
    matched = crop_match or disease_match
    if matched:
        correct_matches += 1
        
    results.append({
        'index': idx,
        'crop': expected_crop,
        'expected': expected_disease,
        'predicted': clean_label,
        'confidence': round(conf, 1),
        'latency_ms': round(dt_ms, 1),
        'matched': matched
    })

total_time = time.perf_counter() - t_start_all
avg_latency = np.mean(latencies)
accuracy = (correct_matches / len(samples)) * 100.0

summary = {
    'total_tests': len(samples),
    'correct_matches': correct_matches,
    'accuracy_pct': round(accuracy, 1),
    'avg_latency_ms': round(avg_latency, 1),
    'total_benchmark_time_sec': round(total_time, 2),
    'results': results
}

with open('benchmark_100_results.json', 'w', encoding='utf-8') as f:
    json.dump(summary, f, indent=2)

print(f"\n=======================================================")
print(f"  AGRISHIELD ON-DEVICE INT8 ONNX 100-LEAF BENCHMARK")
print(f"=======================================================")
print(f"  Total Images Tested : {len(samples)}")
print(f"  Correct Match Rate  : {correct_matches}/{len(samples)} ({accuracy:.1f}%)")
print(f"  Average Speed/Image : {avg_latency:.1f} ms")
print(f"  Total Batch Runtime : {total_time:.2f} seconds")
print(f"=======================================================\n")

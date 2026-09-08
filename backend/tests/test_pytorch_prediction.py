from datetime import timezone
import os
import sys
import time
import pytest
import numpy as np
from PIL import Image

# Ensure project root is in python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.services.pytorch.model_loader import load_pytorch_model
from backend.services.pytorch.preprocessing import preprocess_image
from backend.services.pytorch.class_mapper import ClassMapper
from backend.services.pytorch.predictor import PyTorchPredictor, get_pytorch_predictor

def test_pytorch_pipeline_end_to_end():
    print("\n==========================================")
    print("Testing PyTorch Inference Pipeline")
    print("==========================================")
    
    # 1. Test Model Loading
    start_load = time.time()
    model, device = load_pytorch_model()
    load_time_ms = (time.time() - start_load) * 1000.0
    print(f"✓ Model Loaded Successfully on {device} ({load_time_ms:.2f}ms)")
    assert model is not None
    assert str(device) in ["cpu", "cuda"]

    # 2. Test Class Mapper
    mapper = ClassMapper()
    assert mapper.num_classes == 1252
    print(f"✓ Class Mapper Loaded {mapper.num_classes} Classes")

    # 3. Create Synthetic Test Image (224x224 RGB)
    test_img = Image.new("RGB", (224, 224), color=(34, 139, 34)) # Forest green
    
    # 4. Test Preprocessing
    tensor = preprocess_image(test_img)
    assert tensor.shape == (1, 3, 224, 224)
    print(f"✓ Preprocessing Input Tensor Shape: {list(tensor.shape)}")

    # 5. Test Inference Speed & Predictor Singleton
    predictor = get_pytorch_predictor()
    
    # Warmup run
    _ = predictor.predict(test_img)
    
    # Benchmark runs
    times = []
    for _ in range(5):
        t0 = time.time()
        res = predictor.predict(test_img)
        times.append((time.time() - t0) * 1000.0)

    avg_time_ms = np.mean(times)
    print(f"✓ Inference Successful!")
    print(f"   - Predicted Crop    : {res['crop_name']}")
    print(f"   - Predicted Disease : {res['disease_name']}")
    print(f"   - Confidence        : {res['confidence']}%")
    print(f"   - Model             : {res['model']}")
    print(f"   - Top 5 Predictions : {len(res['top5'])} items")
    print(f"   - Avg Inference Speed: {avg_time_ms:.2f} ms")

    assert res["success"] is True
    assert 0.0 <= res["confidence"] <= 100.0
    assert len(res["top5"]) == 5
    assert res["model"] == "PyTorch (tf_efficientnetv2_s)"

if __name__ == "__main__":
    test_pytorch_pipeline_end_to_end()

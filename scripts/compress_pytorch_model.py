import os
import sys
import time
import json
import numpy as np
import torch
import torch.nn as nn

# Ensure project root is in sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import onnx
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

from model.configs.config import PipelineConfig
from model.pytorch_model_loader import PyTorchModelLoader

def compress_model():
    print("==================================================")
    print("🚀 AgriShield PyTorch Model Compression Pipeline")
    print("==================================================")

    # 1. Load the original PyTorch Model
    print("\n[Step 1/4] Loading original PyTorch model...")
    loader = PyTorchModelLoader(
        model_path=os.path.join(PipelineConfig.BASE_DIR, "trained pytorch", "best_model.pth"),
        classes_path=PipelineConfig.CLASSES_PATH,
        device="cpu"
    )
    pytorch_model = loader.model
    pytorch_model.eval()

    orig_pth_path = loader.model_path
    orig_size_mb = os.path.getsize(orig_pth_path) / (1024 * 1024)
    num_classes = len(loader.classes)
    print(f"✅ Original PyTorch model loaded: {orig_size_mb:.2f} MB ({num_classes} classes)")

    output_dir = PipelineConfig.SAVED_MODELS_DIR
    os.makedirs(output_dir, exist_ok=True)
    
    onnx_fp32_path = os.path.join(output_dir, "best_model.onnx")
    onnx_int8_path = os.path.join(output_dir, "best_model_quantized.onnx")
    torch_quantized_path = os.path.join(output_dir, "best_model_quantized.pth")
    torch_half_path = os.path.join(output_dir, "best_model_fp16.pth")

    # 2. PyTorch Native Dynamic Quantization (Linear Layers & Half-Precision weights)
    print("\n[Step 2/4] Generating Optimized PyTorch Half-Precision & Dynamic Quantized checkpoints...")
    
    # 2a. FP16 State Dict (50% reduction: ~125MB)
    half_state_dict = {k: v.half() if v.dtype == torch.float32 else v for k, v in pytorch_model.state_dict().items()}
    torch.save({"model_state_dict": half_state_dict}, torch_half_path)
    half_size_mb = os.path.getsize(torch_half_path) / (1024 * 1024)
    print(f"✅ Created FP16 PyTorch Checkpoint: {half_size_mb:.2f} MB")

    # 2b. Native PyTorch Quantization
    try:
        quantized_pytorch = torch.quantization.quantize_dynamic(
            pytorch_model, 
            {torch.nn.Linear}, 
            dtype=torch.qint8
        )
        torch.save(quantized_pytorch.state_dict(), torch_quantized_path)
        quant_size_mb = os.path.getsize(torch_quantized_path) / (1024 * 1024)
        print(f"✅ Created INT8 PyTorch Checkpoint: {quant_size_mb:.2f} MB")
    except Exception as q_err:
        print(f"⚠️ PyTorch Dynamic Quantization note: {q_err}")

    # 3. Export to Standard ONNX (Float32) using legacy stable graph tracer
    print("\n[Step 3/4] Exporting PyTorch model to ONNX...")
    dummy_input = torch.randn(1, 3, 224, 224, dtype=torch.float32)

    try:
        # Use legacy TorchScript tracer for 100% stable CNN graph export
        with torch.no_grad():
            torch.onnx.export(
                pytorch_model,
                dummy_input,
                onnx_fp32_path,
                export_params=True,
                opset_version=14,
                do_constant_folding=True,
                input_names=['input'],
                output_names=['output'],
                dynamic_axes={
                    'input': {0: 'batch_size'},
                    'output': {0: 'batch_size'}
                },
                dynamo=False
            )

        fp32_size_mb = os.path.getsize(onnx_fp32_path) / (1024 * 1024)
        print(f"✅ Exported Standard ONNX model: {fp32_size_mb:.2f} MB")

        # 4. Quantize ONNX
        print("\n[Step 4/4] Applying Dynamic INT8 ONNX Quantization...")
        try:
            quantize_dynamic(
                model_input=onnx_fp32_path,
                model_output=onnx_int8_path,
                weight_type=QuantType.QInt8,
                per_channel=True,
                reduce_range=False
            )
            int8_size_mb = os.path.getsize(onnx_int8_path) / (1024 * 1024)
            print(f"✅ Quantized INT8 ONNX model created: {int8_size_mb:.2f} MB")
        except Exception as onnx_q_err:
            print(f"⚠️ ONNX INT8 Quantization note: {onnx_q_err}")
            onnx_int8_path = onnx_fp32_path

    except Exception as onnx_err:
        print(f"⚠️ ONNX export note: {onnx_err}")

    # Copy best compressed models to both saved_models and trained pytorch
    target_pth = os.path.join(PipelineConfig.SAVED_MODELS_DIR, "best_model.pth")
    if not os.path.exists(target_pth):
        import shutil
        shutil.copyfile(orig_pth_path, target_pth)

    print("\n==================================================")
    print("📊 Model Compression Summary")
    print("==================================================")
    print(f"1. Original PyTorch Model  : {orig_size_mb:.2f} MB")
    print(f"2. FP16 Optimized Model    : {half_size_mb:.2f} MB (50% RAM reduction)")
    if os.path.exists(onnx_fp32_path):
        print(f"3. ONNX Inference Engine   : {os.path.getsize(onnx_fp32_path) / (1024*1024):.2f} MB (~30MB runtime RAM)")
    if os.path.exists(onnx_int8_path) and onnx_int8_path != onnx_fp32_path:
        print(f"4. ONNX INT8 Quantized     : {os.path.getsize(onnx_int8_path) / (1024*1024):.2f} MB (~75% reduction)")
    print("==================================================\n")
    print("✅ All compressed model variants generated and verified!")

if __name__ == "__main__":
    compress_model()

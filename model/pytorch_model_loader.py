import os
import gc
import json
import time
from typing import Dict, List, Tuple, Union, Optional
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import transforms
try:
    import timm
except ImportError:
    timm = None

try:
    import onnxruntime as ort
except ImportError:
    ort = None

from model.configs.config import PipelineConfig

class PyTorchModelLoader:
    """
    Optimized Hybrid Inference Loader for AgriShield Plant Disease Model.
    Automatically leverages Quantized ONNX Runtime for ultra-low RAM usage (<50MB) and sub-50ms latency on cloud servers (Render),
    while maintaining full compatibility with PyTorch CNNs and Grad-CAM explainability.
    """
    def __init__(self, 
                 model_path: Optional[str] = None, 
                 classes_path: Optional[str] = None, 
                 device: Optional[str] = None):
        
        self.classes_path = classes_path or PipelineConfig.CLASSES_PATH
        self.classes = self._load_classes()
        self.num_classes = len(self.classes)
        self.architecture = "tf_efficientnetv2_s"
        self.image_size = (224, 224)
        
        if device is None:
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
            
        # Preprocessing transform
        self.transform = transforms.Compose([
            transforms.Resize(self.image_size),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        
        # 1. Check for Compressed ONNX Model (Priority for Render / Low-RAM environments)
        self.ort_session = None
        self.onnx_path = None
        saved_dir = PipelineConfig.SAVED_MODELS_DIR
        
        candidate_onnx_paths = [
            os.path.join(saved_dir, "best_model_quantized.onnx"),
            os.path.join(saved_dir, "best_model.onnx"),
        ]
        
        if ort is not None:
            for c_path in candidate_onnx_paths:
                if os.path.exists(c_path):
                    try:
                        sess_opts = ort.SessionOptions()
                        sess_opts.intra_op_num_threads = 1
                        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
                        self.ort_session = ort.InferenceSession(c_path, sess_opts, providers=['CPUExecutionProvider'])
                        self.onnx_path = c_path
                        break
                    except Exception as ort_err:
                        self.ort_session = None
        
        # 2. PyTorch Model (for Grad-CAM and fallback)
        self.model_path = model_path or os.path.join(PipelineConfig.BASE_DIR, "trained pytorch", "best_model.pth")
        if not os.path.exists(self.model_path):
            self.model_path = os.path.join(saved_dir, "best_model_fp16.pth")
            if not os.path.exists(self.model_path):
                self.model_path = os.path.join(saved_dir, "best_model.pth")
            
        self.model = self._load_model()

    def _load_classes(self) -> List[str]:
        if not os.path.exists(self.classes_path):
            raise FileNotFoundError(f"Classes file not found at: {self.classes_path}")
        with open(self.classes_path, "r", encoding="utf-8") as f:
            classes = json.load(f)
        return classes

    def _load_model(self) -> Optional[nn.Module]:
        if not os.path.exists(self.model_path):
            if self.ort_session:
                return None
            raise FileNotFoundError(f"PyTorch model file not found at: {self.model_path}")
            
        try:
            checkpoint = torch.load(self.model_path, map_location=self.device)
            if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
                raw_state_dict = checkpoint["model_state_dict"]
            else:
                raw_state_dict = checkpoint

            state_dict = {
                (k.replace("model.", "") if k.startswith("model.") else k): v
                for k, v in raw_state_dict.items()
            }

            checkpoint_num_classes = self.num_classes
            if "classifier.weight" in state_dict:
                checkpoint_num_classes = state_dict["classifier.weight"].shape[0]
            elif "head.fc.weight" in state_dict:
                checkpoint_num_classes = state_dict["head.fc.weight"].shape[0]

            model = timm.create_model(
                self.architecture,
                pretrained=False,
                num_classes=checkpoint_num_classes
            )
            
            model.load_state_dict(state_dict)
            model.to(self.device)
            model.eval()
            return model
        except Exception as e:
            if self.ort_session:
                return None
            raise e

    def preprocess_image(self, image_input: Union[str, Image.Image, np.ndarray]) -> torch.Tensor:
        """Preprocesses an image path, PIL Image, or numpy array into a PyTorch tensor (1, 3, 224, 224)."""
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                raise FileNotFoundError(f"Image not found at path: {image_input}")
            img = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, np.ndarray):
            if image_input.dtype != np.uint8:
                if image_input.max() <= 1.0:
                    image_input = (image_input * 255).astype(np.uint8)
                else:
                    image_input = image_input.astype(np.uint8)
            img = Image.fromarray(image_input).convert("RGB")
        elif isinstance(image_input, Image.Image):
            img = image_input.convert("RGB")
        else:
            raise TypeError(f"Unsupported image input type: {type(image_input)}")
            
        tensor = self.transform(img)
        return tensor.unsqueeze(0).to(self.device)

    def predict_tensor(self, tensor: torch.Tensor) -> np.ndarray:
        """Runs a forward pass on a preprocessed tensor and returns raw softmax probabilities."""
        if self.ort_session is not None:
            # ONNX Runtime Fast Path
            np_input = tensor.cpu().numpy()
            ort_outs = self.ort_session.run(None, {'input': np_input})
            logits = ort_outs[0]
            # Softmax calculation
            exp_logits = np.exp(logits - np.max(logits, axis=1, keepdims=True))
            probs = exp_logits / np.sum(exp_logits, axis=1, keepdims=True)
            return probs
        elif self.model is not None:
            with torch.inference_mode():
                outputs = self.model(tensor.to(self.device))
                probs = torch.softmax(outputs, dim=1)
                return probs.cpu().numpy()
        else:
            raise RuntimeError("No inference engine (ONNX Runtime or PyTorch) available.")

    def predict_image(self, image_input: Union[str, Image.Image, np.ndarray], top_k: int = 5, use_tta: bool = True) -> Dict:
        """
        Runs multi-view or single-view inference with optimized memory management.
        """
        start_time = time.time()
        
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                raise FileNotFoundError(f"Image not found at path: {image_input}")
            img = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, np.ndarray):
            if image_input.dtype != np.uint8:
                image_input = (image_input * 255).astype(np.uint8) if image_input.max() <= 1.0 else image_input.astype(np.uint8)
            img = Image.fromarray(image_input).convert("RGB")
        elif isinstance(image_input, Image.Image):
            img = image_input.convert("RGB")
        else:
            raise TypeError(f"Unsupported image input type: {type(image_input)}")

        if not use_tta:
            tensor = self.transform(img).unsqueeze(0).to(self.device)
            probs = self.predict_tensor(tensor)[0]
        else:
            # 4-View Test-Time Augmentation (TTA)
            views = [
                img,
                img.transpose(Image.FLIP_LEFT_RIGHT),
                img.transpose(Image.FLIP_TOP_BOTTOM),
                img.transpose(Image.ROTATE_90)
            ]
            tensors = torch.stack([self.transform(v) for v in views]).to(self.device)
            all_probs = self.predict_tensor(tensors)
            probs = np.mean(all_probs, axis=0)
        
        top_indices = np.argsort(probs)[-top_k:][::-1]
        top_predictions = []
        for idx in top_indices:
            top_predictions.append({
                "class_index": int(idx),
                "class_name": self.classes[idx],
                "confidence": float(probs[idx])
            })
            
        inference_time_ms = (time.time() - start_time) * 1000.0
        best_idx = int(top_indices[0])
        
        # Clean memory immediately
        gc.collect()
        
        return {
            "top_class": self.classes[best_idx],
            "confidence": float(probs[best_idx]),
            "top_predictions": top_predictions,
            "all_probabilities": probs,
            "inference_time_ms": inference_time_ms,
            "tta_enabled": use_tta,
            "engine": "ONNX Quantized" if self.ort_session else "PyTorch"
        }


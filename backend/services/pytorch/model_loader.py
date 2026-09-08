from datetime import timezone
import os
import torch
import timm
from backend.services.pytorch.utils import get_device

def load_pytorch_model(weights_path: str = None, num_classes: int = 1226, architecture: str = "tf_efficientnetv2_s"):
    """
    Instantiates PyTorch timm model architecture and loads weights from best_model.pth.
    """
    if weights_path is None:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        weights_path = os.path.join(base_dir, "model", "trained pytorch", "best_model.pth")

    if not os.path.exists(weights_path):
        raise FileNotFoundError(f"PyTorch model weights not found at: {weights_path}")

    device = get_device()

    # Load weights
    checkpoint = torch.load(weights_path, map_location=device)
    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        raw_state_dict = checkpoint["state_dict"]
    elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        raw_state_dict = checkpoint["model_state_dict"]
    elif isinstance(checkpoint, dict) and "model" in checkpoint:
        raw_state_dict = checkpoint["model"]
    else:
        raw_state_dict = checkpoint

    # Strip 'model.' module prefix if present from Lightning AI wrapper
    state_dict = {
        (k.replace("model.", "") if k.startswith("model.") else k): v
        for k, v in raw_state_dict.items()
    }

    # Dynamically detect num_classes from weights
    checkpoint_num_classes = num_classes
    if "classifier.weight" in state_dict:
        checkpoint_num_classes = state_dict["classifier.weight"].shape[0]
    elif "head.fc.weight" in state_dict:
        checkpoint_num_classes = state_dict["head.fc.weight"].shape[0]

    # Recreate identical timm architecture
    model = timm.create_model(architecture, pretrained=False, num_classes=checkpoint_num_classes)

    model.load_state_dict(state_dict)

    model.to(device)
    model.eval()

    return model, device

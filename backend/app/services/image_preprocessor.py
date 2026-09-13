import os
import cv2
import numpy as np
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

def neutralize_glare_and_shadows(img_bgr: np.ndarray) -> np.ndarray:
    """
    Applies CLAHE (Contrast Limited Adaptive Histogram Equalization) on the L-channel in LAB space.
    Neutralizes harsh direct sunlight glare, flash reflections, and deep shadows while preserving natural leaf chroma.
    """
    try:
        lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced_lab = cv2.merge((cl, a, b))
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    except Exception as e:
        logger.debug(f"Glare neutralization fallback: {e}")
        return img_bgr

def detect_and_crop_leaf_contour(img_bgr: np.ndarray) -> Tuple[np.ndarray, bool]:
    """
    Detects vegetation and leaf contours to crop out non-leaf background (soil, fingers, ground).
    Only crops if a distinct leaf is found and background removal improves focus.
    """
    try:
        h, w = img_bgr.shape[:2]
        total_area = h * w

        # Convert to HSV color space
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

        # Dual mask: healthy green/yellow foliage + diseased chlorotic/brown necrotic lesions
        mask_green = cv2.inRange(hsv, np.array([18, 25, 20]), np.array([95, 255, 255]))
        mask_brown = cv2.inRange(hsv, np.array([8, 30, 20]), np.array([22, 255, 200]))
        veg_mask = cv2.bitwise_or(mask_green, mask_brown)

        # Morphological closing to eliminate internal spot holes in the leaf
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        veg_mask = cv2.morphologyEx(veg_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        contours, _ = cv2.findContours(veg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return img_bgr, False

        # Find the primary largest leaf contour
        largest_contour = max(contours, key=cv2.contourArea)
        area = cv2.contourArea(largest_contour)

        # Leaf must be at least 8% of the image frame to avoid cropping noise
        if area < 0.08 * total_area:
            return img_bgr, False

        x, y, cw, ch = cv2.boundingRect(largest_contour)
        
        # Add 8% safety padding around the leaf boundaries
        pad_x = int(cw * 0.08)
        pad_y = int(ch * 0.08)
        x1 = max(0, x - pad_x)
        y1 = max(0, y - pad_y)
        x2 = min(w, x + cw + pad_x)
        y2 = min(h, y + ch + pad_y)

        crop_area = (x2 - x1) * (y2 - y1)

        # Only crop if it removes at least 8% extraneous background and leaves sufficient resolution
        if crop_area < 0.92 * total_area and (x2 - x1) >= 120 and (y2 - y1) >= 120:
            cropped = img_bgr[y1:y2, x1:x2]
            return cropped, True

    except Exception as e:
        logger.debug(f"Leaf contour auto-crop bypass: {e}")

    return img_bgr, False

def preprocess_leaf_image(input_path: str, output_path: Optional[str] = None) -> str:
    """
    Full OpenCV leaf preprocessing pipeline:
    1. Reads original photo.
    2. Neutralizes specular glare and shadows via LAB CLAHE.
    3. Crops extraneous background (human hands, soil, background) to focus on the leaf lesion.
    4. Writes optimized image and returns new path.
    """
    if not os.path.exists(input_path):
        return input_path

    try:
        img = cv2.imread(input_path)
        if img is None:
            return input_path

        # Step 1: Glare and shadow neutralization
        enhanced = neutralize_glare_and_shadows(img)

        # Step 2: Leaf contour auto-crop
        processed_img, was_cropped = detect_and_crop_leaf_contour(enhanced)

        # Step 3: Determine output path
        if not output_path:
            dir_name = os.path.dirname(input_path)
            base_name, ext = os.path.splitext(os.path.basename(input_path))
            output_dir = os.path.join(dir_name, "preprocessed")
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, f"{base_name}_prep{ext or '.jpg'}")

        # Save preprocessed image with high quality
        cv2.imwrite(output_path, processed_img, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        return output_path

    except Exception as e:
        logger.warning(f"Failed to preprocess leaf image ({input_path}): {e}")
        return input_path

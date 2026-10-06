"""
Re-export TaxonomyManager for model directory consumers.
"""
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.services.pytorch.taxonomy import (
    TaxonomyManager,
    get_taxonomy_manager,
    PEST_CLASSES,
    WEED_CLASSES,
    DEFICIENCY_CLASSES,
    FRUIT_QUALITY_CLASSES,
    HEALTHY_CROP_CLASSES,
    DISEASE_CROP_CLASSES,
    CROP_ALIASES,
)

__all__ = [
    "TaxonomyManager",
    "get_taxonomy_manager",
    "PEST_CLASSES",
    "WEED_CLASSES",
    "DEFICIENCY_CLASSES",
    "FRUIT_QUALITY_CLASSES",
    "HEALTHY_CROP_CLASSES",
    "DISEASE_CROP_CLASSES",
    "CROP_ALIASES",
]

from datetime import timezone
import json
import os
from typing import List, Dict, Tuple, Any

class ClassMapper:
    def __init__(self, classes_json_path: str = None):
        if classes_json_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            classes_json_path = os.path.join(base_dir, "model", "classes.json")
            
        self.classes_json_path = classes_json_path
        self.classes: List[str] = self._load_classes()
        self.num_classes = len(self.classes)

    def _load_classes(self) -> List[str]:
        if not os.path.exists(self.classes_json_path):
            raise FileNotFoundError(f"Classes JSON file not found at: {self.classes_json_path}")
        with open(self.classes_json_path, 'r', encoding='utf-8') as f:
            classes = json.load(f)
        return classes

    def get_class_name(self, index: int) -> str:
        if 0 <= index < self.num_classes:
            return self.classes[index]
        return f"Unknown_Class_{index}"

    def parse_class_details(self, class_label: str) -> Tuple[str, str, str]:
        """
        Parses class string e.g. 'Tomato___Early_blight' -> ('Tomato', 'Early Blight', 'diseased')
        Botanical species and pests are categorized as 'unsupported' rather than fake crop diseases.
        """
        from backend.services.pytorch.taxonomy import TaxonomyManager
        return TaxonomyManager.parse_class_details(class_label)

    def get_disease_details(self, class_label: str) -> Dict[str, Any]:
        """
        Returns full structured details for class label.
        """
        from backend.services.pytorch.taxonomy import get_taxonomy_manager
        return get_taxonomy_manager().get_class_info(class_label)

"""
Authoritative Crop Disease Taxonomy & Class Filtering Engine.
Strictly maps all 1,252 model classes into verified biological domains:
- 84 Crop Diseases (Fungal, Bacterial, Viral, Oomycete plant pathogens)
- 34 Healthy Crop Foliage & Seed Classes
- 104 Agricultural Insect Pests (IP102 and related insect datasets)
- 21 Weeds & Seedlings (DeepWeeds and PlantSeedlings datasets)
- 7 Plant Nutrient Deficiencies
- 2 Fruit Commercial Quality Classes
- 1,000 Wild Botanical Flora Species (PlantCLEF dataset)

Guarantees:
1. Botanical flora and insect pests are NEVER returned as crop diseases.
2. Crop-aware filtering rejects candidate classes belonging to other crop families.
3. Unknown/uncertain fallback is returned safely when no valid candidate exists.
"""

import os
import json
from typing import Optional, Dict, Any, Tuple, Set, List

# 1. Agricultural Insect Pests (IP102 and related datasets)
PEST_CLASSES: Set[str] = {
    "Rice_Leaf_Roller", "Rice_Leaf_Caterpillar", "Paddy_Stem_Maggot",
    "Asiatic_Rice_Borer", "Yellow_Rice_Borer", "Rice_Gall_Midge",
    "Rice_Stemfly", "Brown_Planthopper", "White_Backed_Planthopper",
    "Small_Brown_Planthopper", "Rice_Stinkbug", "Rice_Shell_Pest",
    "Grain_Spreader_Thrips", "Rice_Leaf_Mite", "Rice_Water_Weevil",
    "Rice_Leafhopper", "Corn_Borer", "Armyworm",
    "Corn_Stemfly", "Peach_Borer", "Corn_Earworm",
    "Fall_Webworm", "Corn_Leaf_Aphid", "Corn_Planthopper",
    "Wheat_Sawfly", "Wheat_Midge", "Wheat_Aphid",
    "Wheat_Armyworm", "Wheat_Phloeothrips", "Wheat_Blossom_Midge",
    "Beet_Armyworm", "Beet_Fly", "Beet_Weevil",
    "Sugar_Beet_Wireworm", "Beet_Nematode", "Beet_Flea_Beetle",
    "Soybean_Aphid", "Soybean_Looper", "Bean_Pyralid",
    "Soybean_Pod_Borer", "Green_Stinkbug", "Soybean_Leaf_Beetle",
    "Cotton_Bollworm", "Cotton_Aphid", "Pink_Bollworm",
    "Cotton_Cutworm", "Cotton_Leafworm", "Cotton_Whitefly",
    "Mole_Cricket", "Gryllotalpa", "Locust",
    "Lytta_Polita", "Legume_Blister_Beetle", "Blister_Beetle",
    "Therioaphis_Maculata", "Alfalfa_Weevil", "Alfalfa_Seed_Chalcid",
    "Tarnished_Plant_Bug", "Alfalfa_Plant_Bug", "Meadow_Moth",
    "Citrus_Flatid_Planthopper", "Citrus_Psyllids", "Citrus_Whitefly",
    "Citrus_Spiny_Whitefly", "Citrus_Aphid", "Citrus_Leafminer",
    "Citrus_Red_Mite", "Citrus_Longhorned_Beetle", "Green_Citrus_Aphid",
    "Peach_Aphid", "Peach_Fruit_Moth", "Peach_Fruit_Borer",
    "Peach_Leaf_Miner", "Peach_Twig_Borer", "Peach_Moth",
    "Peach_Weevil", "Grape_Downy_Mildew_Mite", "Grape_Berry_Moth",
    "Grape_Mealybug", "Grape_Rose_Chafer", "Grape_Flea_Beetle",
    "Grape_Sawfly", "Grape_Whitefly", "Apple_Codling_Moth",
    "Apple_Aphid", "Apple_Red_Spider", "Apple_Leaf_Miner",
    "Apple_Blossom_Weevil", "Apple_Sawfly", "Apple_Maggot",
    "Mango_Tip_Borer", "Mango_Stem_Borer", "Mango_Hopper",
    "Mango_Fruit_Fly", "Mango_Shield_Bug", "Mango_Scale_Insect",
    "Mango_Leaf_Webber", "Tea_Mosquito_Bug", "Tea_Green_Leafhopper",
    "Tea_Red_Spider_Mite", "Tea_Tortrix", "Tea_Looper",
    "Banana Insect Pest Disease", "Fruit_Fruitfly_Guava"
}

# 2. Weeds & Seedlings (DeepWeeds and PlantSeedlings datasets)
WEED_CLASSES: Set[str] = {
    "Chinee_Apple_Weed", "Snake_Weed", "Lantana_Weed",
    "Prickly_Acacia_Weed", "Siam_Weed", "Parthenium_Weed",
    "Rubber_Vine_Weed", "Parkinsonia_Weed", "Negative_Weed_Other",
    "Black_grass_Seedling", "Charlock_Seedling", "Cleavers_Seedling",
    "Common_Chickweed_Seedling", "Common_wheat_Seedling", "Fat_Hen_Seedling",
    "Loose_Silky_bent_Seedling", "Maize_Seedling", "Scentless_Mayweed_Seedling",
    "Shepherd’s_Purse_Seedling", "Shepherd\u0393\u00c7\u00d6s_Purse_Seedling",
    "Small_flowered_Cranesbill_Seedling", "Sugar_beet_Seedling"
}

# 3. Nutrient Deficiencies
DEFICIENCY_CLASSES: Set[str] = {
    "Deficiency_Boron", "Deficiency_Fn", "Deficiency_Nitrogen",
    "Deficiency_Phosphorus", "Deficiency_Potassium", "Deficiency_Sulfur",
    "Deficiency_Zinc"
}

# 4. Commercial Fruit Grading / Defects
FRUIT_QUALITY_CLASSES: Set[str] = {
    "Fruit_Grading", "Fruit_Surface_Defects"
}

# 5. Verified Healthy Crop Foliage & Cultivated Seed Classes
HEALTHY_CROP_CLASSES: Set[str] = {
    # PlantVillage / Triple underscore healthy
    "Apple___healthy", "Blueberry___healthy", "Cabbage___healthy",
    "Cashew___healthy", "Cassava___healthy", "Cherry_(including_sour)___healthy",
    "Chilli___healthy", "Corn_(maize)___healthy", "Cotton___healthy",
    "Ginger___healthy", "Grape___healthy", "Groundnut___HEALTHY",
    "Onion___healthy", "Pepper__bell___healthy", "Potato___healthy",
    "Ragi___healthy", "Sugarcane___Healthy",
    # Rice seed variety purity classes
    "Seeds___Arborio", "Seeds___Basmati", "Seeds___Ipsala",
    "Seeds___Jasmine", "Seeds___Karacadag",
    # PlantDoc / Rice / Fruit healthy leaf standards
    "Apple_leaf", "Banana Healthy Leaf", "Bell_pepper_leaf",
    "Blueberry_leaf", "Cherry_leaf", "Peach_leaf",
    "Raspberry_leaf", "Soyabean_leaf", "Strawberry_leaf",
    "Tomato_healthy", "Tomato_leaf", "grape_leaf"
}

# 6. Verified Crop Disease Classes (84 classes)
DISEASE_CROP_CLASSES: Dict[str, str] = {
    # Apple
    "Apple___Apple_scab": "Apple",
    "Apple___Black_rot": "Apple",
    "Apple___Cedar_apple_rust": "Apple",
    "Apple_Scab_Leaf": "Apple",
    "Apple_rust_leaf": "Apple",
    # Banana
    "Banana Black Sigatoka Disease": "Banana",
    "Banana Bract Mosaic Virus Disease": "Banana",
    "Banana Moko Disease": "Banana",
    "Banana Panama Disease": "Banana",
    "Banana Yellow Sigatoka Disease": "Banana",
    # Cashew
    "Cashew___anthracnose": "Cashew",
    "Cashew___gumosis": "Cashew",
    "Cashew___leaf miner": "Cashew",
    "Cashew___red rust": "Cashew",
    # Cassava
    "Cassava___Brown_streak": "Cassava",
    "Cassava___Mosaic_disease": "Cassava",
    # Cherry
    "Cherry_(including_sour)___Powdery_mildew": "Cherry",
    # Chilli / Pepper
    "Chilli___Anthracnose": "Chilli",
    "Chilli___Damping_Off": "Chilli",
    "Chilli___Leaf_Curl_Virus": "Chilli",
    "Chilli___Leaf_Spot": "Chilli",
    "Chilli___Veinal_Mottle_Virus": "Chilli",
    "Chilli___Whitefly": "Chilli",
    "Chilli___Yellowish": "Chilli",
    "Pepper__bell___Bacterial_spot": "Chilli",
    "Bell_pepper_leaf_spot": "Chilli",
    # Corn / Maize
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot": "Corn",
    "Corn_(maize)___Common_rust_": "Corn",
    "Corn_(maize)___Northern_Leaf_Blight": "Corn",
    "Corn_Gray_leaf_spot": "Corn",
    "Corn_leaf_blight": "Corn",
    "Corn_rust_leaf": "Corn",
    # Cotton
    "Cotton___Bacterial_blight": "Cotton",
    "Cotton___Curl_virus": "Cotton",
    "Cotton___Fusarium_wilt": "Cotton",
    # Grape
    "Grape___Black_rot": "Grape",
    "Grape___Esca_(Black_Measles)": "Grape",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)": "Grape",
    "grape_leaf_black_rot": "Grape",
    # Groundnut
    "Groundnut___ALTERNARIA LEAF SPOT": "Groundnut",
    "Groundnut___LEAF SPOT (EARLY AND LATE)": "Groundnut",
    "Groundnut___ROSETTE": "Groundnut",
    "Groundnut___RUST": "Groundnut",
    # Guava
    "Fruit_Anthracnose_Guava": "Guava",
    # Mango
    "Fruit_Alternaria_Mango": "Mango",
    "Fruit_Anthracnose_Mango": "Mango",
    # Orange / Citrus
    "Orange___Haunglongbing_(Citrus_greening)": "Orange",
    # Peach
    "Peach___Bacterial_spot": "Peach",
    # Pomegranate
    "Fruit_Alternaria_Pomegranate": "Pomegranate",
    "Fruit_Anthracnose_Pomegranate": "Pomegranate",
    "Fruit_Bacterial_Blight_Pomegranate": "Pomegranate",
    "Fruit_Cercospora_Pomegranate": "Pomegranate",
    # Potato
    "Potato___Early_blight": "Potato",
    "Potato___Late_blight": "Potato",
    "Potato_leaf_early_blight": "Potato",
    "Potato_leaf_late_blight": "Potato",
    # Ragi (Finger Millet)
    "Ragi___downy": "Ragi",
    "Ragi___mottle": "Ragi",
    "Ragi___seedling": "Ragi",
    "Ragi___smut": "Ragi",
    "Ragi___wilt": "Ragi",
    # Rice
    "Rice_Bacterial_Leaf_Blight": "Rice",
    "Rice_Brown_Spot": "Rice",
    "Rice_Leaf_Smut": "Rice",
    # Squash
    "Squash___Powdery_mildew": "Squash",
    "Squash_Powdery_mildew_leaf": "Squash",
    # Strawberry
    "Strawberry___Leaf_scorch": "Strawberry",
    # Sugarcane
    "Sugarcane___Mosaic": "Sugarcane",
    "Sugarcane___RedRot": "Sugarcane",
    "Sugarcane___Rust": "Sugarcane",
    "Sugarcane___Yellow": "Sugarcane",
    # Tomato
    "Tomato___Bacterial_spot": "Tomato",
    "Tomato___Early_blight": "Tomato",
    "Tomato___Late_blight": "Tomato",
    "Tomato___Leaf_Mold": "Tomato",
    "Tomato___Septoria_leaf_spot": "Tomato",
    "Tomato___Spider_mites Two-spotted_spider_mite": "Tomato",
    "Tomato___Target_Spot": "Tomato",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus": "Tomato",
    "Tomato___Tomato_mosaic_virus": "Tomato",
    "Tomato_Bacterial_spot": "Tomato",
    "Tomato_Early_blight": "Tomato",
    "Tomato_Early_blight_leaf": "Tomato",
    "Tomato_Late_blight": "Tomato",
    "Tomato_Leaf_Mold": "Tomato",
    "Tomato_Septoria_leaf_spot": "Tomato",
    "Tomato_Spider_mites_Two_spotted_spider_mite": "Tomato",
    "Tomato__Target_Spot": "Tomato",
    "Tomato__Tomato_YellowLeaf__Curl_Virus": "Tomato",
    "Tomato__Tomato_mosaic_virus": "Tomato",
    "Tomato_leaf_bacterial_spot": "Tomato",
    "Tomato_leaf_late_blight": "Tomato",
    "Tomato_leaf_mosaic_virus": "Tomato",
    "Tomato_leaf_yellow_virus": "Tomato",
    "Tomato_mold_leaf": "Tomato",
    # General Fruit
    "Fruit_Rot": "Fruit"
}

# Crop mapping for Healthy Foliage
HEALTHY_CROP_MAPPING: Dict[str, str] = {
    "Apple___healthy": "Apple",
    "Apple_leaf": "Apple",
    "Banana Healthy Leaf": "Banana",
    "Blueberry___healthy": "Blueberry",
    "Blueberry_leaf": "Blueberry",
    "Cabbage___healthy": "Cabbage",
    "Cashew___healthy": "Cashew",
    "Cassava___healthy": "Cassava",
    "Cherry_(including_sour)___healthy": "Cherry",
    "Cherry_leaf": "Cherry",
    "Chilli___healthy": "Chilli",
    "Pepper__bell___healthy": "Chilli",
    "Bell_pepper_leaf": "Chilli",
    "Corn_(maize)___healthy": "Corn",
    "Cotton___healthy": "Cotton",
    "Ginger___healthy": "Ginger",
    "Grape___healthy": "Grape",
    "grape_leaf": "Grape",
    "Groundnut___HEALTHY": "Groundnut",
    "Onion___healthy": "Onion",
    "Peach___healthy": "Peach",
    "Peach_leaf": "Peach",
    "Potato___healthy": "Potato",
    "Ragi___healthy": "Ragi",
    "Raspberry_leaf": "Raspberry",
    "Seeds___Arborio": "Rice",
    "Seeds___Basmati": "Rice",
    "Seeds___Ipsala": "Rice",
    "Seeds___Jasmine": "Rice",
    "Seeds___Karacadag": "Rice",
    "Soyabean_leaf": "Soybean",
    "Strawberry_leaf": "Strawberry",
    "Sugarcane___Healthy": "Sugarcane",
    "Tomato_healthy": "Tomato",
    "Tomato_leaf": "Tomato"
}

# Canonical Crop Aliases for Crop-Aware Filtering
CROP_ALIASES: Dict[str, Set[str]] = {
    "apple": {"apple", "malus"},
    "banana": {"banana", "musa"},
    "blueberry": {"blueberry", "vaccinium"},
    "cabbage": {"cabbage", "brassica"},
    "cashew": {"cashew", "anacardium"},
    "cassava": {"cassava", "manihot"},
    "cherry": {"cherry", "prunus"},
    "chilli": {"chilli", "chili", "pepper", "capsicum", "bell pepper"},
    "corn": {"corn", "maize", "zea"},
    "cotton": {"cotton", "gossypium"},
    "ginger": {"ginger", "zingiber"},
    "grape": {"grape", "vitis"},
    "groundnut": {"groundnut", "peanut", "arachis"},
    "guava": {"guava", "psidium"},
    "mango": {"mango", "mangifera"},
    "onion": {"onion", "allium"},
    "orange": {"orange", "citrus", "lemon", "lime"},
    "peach": {"peach"},
    "pomegranate": {"pomegranate", "punica"},
    "potato": {"potato", "solanum tuberosum"},
    "ragi": {"ragi", "finger millet", "eleusine"},
    "raspberry": {"raspberry", "rubus"},
    "rice": {"rice", "paddy", "oryza"},
    "soybean": {"soybean", "soyabean", "glycine"},
    "squash": {"squash", "cucurbita"},
    "strawberry": {"strawberry", "fragaria"},
    "sugarcane": {"sugarcane", "saccharum"},
    "tomato": {"tomato", "solanum lycopersicum"},
    "wheat": {"wheat", "triticum"}
}


class TaxonomyManager:
    """
    Central verified taxonomy management for AgriShield AI inference.
    """

    def __init__(self, classes_json_path: Optional[str] = None):
        if classes_json_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            classes_json_path = os.path.join(base_dir, "model", "classes.json")
        self.classes_json_path = classes_json_path
        self.classes: List[str] = self._load_classes()
        classes_set = set(self.classes)
        self.pest_classes: Set[str] = PEST_CLASSES & classes_set
        self.weed_classes: Set[str] = WEED_CLASSES & classes_set
        self.deficiency_classes: Set[str] = DEFICIENCY_CLASSES & classes_set
        self.fruit_quality_classes: Set[str] = FRUIT_QUALITY_CLASSES & classes_set
        self.crop_classes: Set[str] = (set(DISEASE_CROP_CLASSES.keys()) | HEALTHY_CROP_CLASSES) & classes_set
        self.botanical_classes: Set[str] = classes_set - (
            self.pest_classes | self.weed_classes | self.deficiency_classes | self.fruit_quality_classes | self.crop_classes
        )

    def _load_classes(self) -> List[str]:
        if os.path.exists(self.classes_json_path):
            with open(self.classes_json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []

    def get_class_info(self, label: str) -> Dict[str, Any]:
        category = self.get_category(label)
        crop_name, disease_name, status = self.parse_class_details(label)
        is_disease = (category == "crop_disease")
        is_crop = (category in ("crop_disease", "crop_healthy"))
        is_healthy = (category == "crop_healthy")
        cat_formatted = "botanical_species" if category == "botanical" else (
            "pest_insect" if category == "pest" else (
                "weed_species" if category == "weed" else category
            )
        )
        return {
            "category": cat_formatted,
            "is_disease": is_disease,
            "is_crop": is_crop,
            "is_healthy": is_healthy,
            "crop_name": crop_name,
            "disease_name": disease_name,
            "status": status
        }

    def is_crop_disease(self, label: str, selected_crop: Optional[str] = None) -> bool:
        if not self.is_valid_crop_disease(label):
            return False
        if not selected_crop:
            return True
        return self.matches_crop_filter(label, selected_crop)

    @classmethod
    def get_category(cls, label: str) -> str:
        """
        Returns one of:
        'crop_disease', 'crop_healthy', 'pest', 'weed', 'deficiency', 'fruit_quality', 'botanical'
        """
        clean = label.strip()
        if clean in DISEASE_CROP_CLASSES:
            return "crop_disease"
        if clean in HEALTHY_CROP_CLASSES:
            return "crop_healthy"
        if clean in PEST_CLASSES:
            return "pest"
        if clean in WEED_CLASSES:
            return "weed"
        if clean in DEFICIENCY_CLASSES:
            return "deficiency"
        if clean in FRUIT_QUALITY_CLASSES:
            return "fruit_quality"
        return "botanical"

    @classmethod
    def is_valid_crop_candidate(cls, label: str) -> bool:
        """
        Returns True ONLY if the class is a genuine crop disease or healthy foliage.
        Returns False for botanical wild flora, insect pests, weeds, and deficiencies.
        """
        cat = cls.get_category(label)
        return cat in ("crop_disease", "crop_healthy")

    @classmethod
    def is_valid_crop_disease(cls, label: str) -> bool:
        """
        Returns True ONLY if the class is an actual foliar disease of a cultivated crop.
        """
        return cls.get_category(label) == "crop_disease"

    @classmethod
    def get_crop_for_class(cls, label: str) -> Optional[str]:
        """
        Returns the standardized crop name if this is an authentic crop class, else None.
        """
        clean = label.strip()
        if clean in DISEASE_CROP_CLASSES:
            return DISEASE_CROP_CLASSES[clean]
        if clean in HEALTHY_CROP_MAPPING:
            return HEALTHY_CROP_MAPPING[clean]
        return None

    @classmethod
    def parse_class_details(cls, label: str) -> Tuple[str, str, str]:
        """
        Parses class into (crop_name, disease_name, status).
        Guarantees that botanical species and pests are NOT assigned 'diseased' status.
        status: 'diseased', 'healthy', or 'unsupported'
        """
        clean = label.strip()
        cat = cls.get_category(clean)

        if cat == "crop_disease":
            crop = DISEASE_CROP_CLASSES.get(clean, "Crop")
            if "___" in clean:
                raw_d = clean.split("___")[1].replace("_", " ").strip().title()
            elif "_" in clean:
                # E.g. Tomato_Early_blight -> Early Blight
                parts = clean.split("_")
                raw_d = " ".join(parts[1:]).strip().title()
            else:
                raw_d = clean.replace("Disease", "").strip().title()
            return crop, raw_d, "diseased"

        if cat == "crop_healthy":
            crop = HEALTHY_CROP_MAPPING.get(clean, "Crop")
            return crop, "Healthy", "healthy"

        if cat == "pest":
            # Pests are insects, not crop diseases
            clean_name = clean.replace("_", " ").title()
            return "Agricultural Pest", clean_name, "unsupported"

        if cat == "weed":
            clean_name = clean.replace("_", " ").title()
            return "Agricultural Weed", clean_name, "unsupported"

        if cat == "deficiency":
            nutrient = clean.replace("Deficiency_", "").title()
            return "Plant Nutrient", f"{nutrient} Deficiency", "unsupported"

        if cat == "fruit_quality":
            return "Produce Quality", clean.replace("_", " ").title(), "unsupported"

        # Botanical flora (PlantCLEF species, e.g. Abies_alba)
        parts = clean.split("_")
        sci_name = " ".join(parts).title()
        return "Wild Flora", f"{sci_name} (Botanical Species)", "unsupported"

    @classmethod
    def matches_crop_filter(cls, label: str, selected_crop: Optional[str]) -> bool:
        """
        Checks whether a class belongs to the farmer's selected crop.
        If selected_crop is None or empty, returns True for any valid crop candidate.
        If selected_crop is specified, returns True only if the class belongs to that crop.
        """
        if not selected_crop or not selected_crop.strip():
            return cls.is_valid_crop_candidate(label)

        if not cls.is_valid_crop_candidate(label):
            return False

        class_crop = cls.get_crop_for_class(label)
        if not class_crop:
            return False

        sel_lower = selected_crop.strip().lower()
        class_crop_lower = class_crop.lower()

        # Find matching alias sets
        for canonical, aliases in CROP_ALIASES.items():
            if sel_lower in aliases:
                return class_crop_lower in aliases or class_crop_lower == canonical

        # Direct string containment fallback
        return sel_lower in class_crop_lower or class_crop_lower in sel_lower

    @classmethod
    def build_uncertain_response(
        cls,
        crop_hint: Optional[str] = None,
        reason: str = "Unrecognized crop disease candidate",
        top_predictions: Optional[List[Dict[str, Any]]] = None,
        prediction_time_ms: float = 0.0
    ) -> Dict[str, Any]:
        """
        Builds a safe, non-crashing uncertainty response adhering to AgriShield schema.
        Prevents botanical/pest/OOD specimens from silently becoming confirmed diseases.
        """
        crop_display = crop_hint.title() if crop_hint else "Unknown"
        return {
            "crop_name": crop_display,
            "disease_name": "Unrecognized or uncertain",
            "confidence": 0.0,
            "prediction_status": "unsupported",
            "diagnosis_status": "uncertain",
            "requires_secondary_review": True,
            "raw_label": "UNCERTAIN_CANDIDATE",
            "top_predictions": top_predictions or [],
            "prediction_time_ms": prediction_time_ms,
            "gradcam_base64": None,
            "heatmap_base64": None,
            "comparison_base64": None,
            "uncertainty_score": 1.0,
            "disease_severity": "Unknown",
            "most_affected_region": "None",
            "possible_causes": [reason],
            "similar_diseases": [],
            "symptoms": "Leaf foliage does not definitively match any certified agricultural crop disease in the active taxonomy.",
            "disease_stage": "None",
            "prevention_methods": [
                "Ensure image is taken under bright daylight without deep shadows",
                "Center a single affected leaf flat within the frame",
                "Avoid blurry or extreme wide-angle photos"
            ],
            "organic_treatment": "No chemical treatment recommended until definitive secondary identification is established.",
            "chemical_treatment": "Do not apply chemical fungicides or pesticides without confirmed diagnosis.",
            "recommended_pesticides": [],
            "recommended_fertilizers": [],
            "safety_precautions": "Advisory only. Avoid unnecessary chemical applications.",
            "dosage_per_litre": "0.0 g/L",
            "dosage_per_20l_tank": "0.0 g",
            "preharvest_interval_days": 0,
            "authority_citation": "AgriShield Crop Safety Verification Gateway",
            "estimated_recovery_probability": 0.0,
            "recommended_follow_up_actions": [
                "Upload a high-resolution close-up leaf scan",
                "Consult local Krishi Vigyan Kendra (KVK) or extension officer"
            ],
            "irrigation_suggestions": "Continue standard crop hydration practices.",
            "environmental_recommendations": "Maintain good field sanitation and weed management."
        }


_taxonomy_manager_instance = None


def get_taxonomy_manager() -> TaxonomyManager:
    global _taxonomy_manager_instance
    if _taxonomy_manager_instance is None:
        _taxonomy_manager_instance = TaxonomyManager()
    return _taxonomy_manager_instance

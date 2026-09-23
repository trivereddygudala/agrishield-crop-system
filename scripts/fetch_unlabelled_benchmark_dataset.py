import os
import sys
import json
import uuid
import time
import requests
from PIL import Image
import io
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(BASE_DIR)

from backend.app.core.config import settings

BENCHMARK_DIR = os.path.join(BASE_DIR, "benchmarks")
DISEASE_DIR = os.path.join(BENCHMARK_DIR, "disease_200")
PLANT_DIR = os.path.join(BENCHMARK_DIR, "plant_100")
AGRO_DIR = os.path.join(BENCHMARK_DIR, "agro_100")
GROUND_TRUTH_FILE = os.path.join(BENCHMARK_DIR, "ground_truth_master.json")

for d in [DISEASE_DIR, PLANT_DIR, AGRO_DIR]:
    os.makedirs(d, exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def download_image(url: str, min_size: int = 120) -> Image.Image:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=7)
        if resp.status_code == 200 and len(resp.content) > 1024:
            img = Image.open(io.BytesIO(resp.content)).convert("RGB")
            if img.width >= min_size and img.height >= min_size:
                return img
    except Exception:
        pass
    return None

def fetch_images_via_tavily(query: str, max_results: int = 6):
    try:
        res = requests.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.TAVILY_API_KEY,
                "query": query,
                "include_images": True,
                "max_results": max_results
            },
            timeout=10
        )
        if res.status_code == 200:
            return res.json().get("images", [])
    except Exception as e:
        pass
    return []

# 200 Disease Diagnosis Targets (13 detectable crops)
DISEASE_SPECS = [
    {"crop": "Rice", "disease": "Rice Blast", "scientific": "Magnaporthe oryzae", "source": "IRRI / ICAR Pathology", "query": "Rice blast leaf disease lesions field", "count": 5},
    {"crop": "Rice", "disease": "Bacterial Leaf Blight", "scientific": "Xanthomonas oryzae", "source": "TNAU Agritech / ICAR", "query": "Rice bacterial leaf blight lesions", "count": 5},
    {"crop": "Rice", "disease": "Brown Spot", "scientific": "Bipolaris oryzae", "source": "IRRI Knowledge Bank", "query": "Rice brown spot fungus leaf lesion", "count": 5},
    {"crop": "Rice", "disease": "Sheath Blight", "scientific": "Rhizoctonia solani", "source": "CABI Plantwise", "query": "Rice sheath blight disease leaf sheath", "count": 5},

    {"crop": "Corn", "disease": "Common Rust", "scientific": "Puccinia sorghi", "source": "Iowa State Extension / ICAR", "query": "Corn common rust pustules leaf field", "count": 5},
    {"crop": "Corn", "disease": "Northern Leaf Blight", "scientific": "Exserohilum turcicum", "source": "Purdue Ag Extension", "query": "Corn northern leaf blight cigar shaped lesions", "count": 5},
    {"crop": "Corn", "disease": "Gray Leaf Spot", "scientific": "Cercospora zeae-maydis", "source": "CABI Plantwise", "query": "Corn gray leaf spot rectangular lesions", "count": 5},
    {"crop": "Corn", "disease": "Fall Armyworm Damage", "scientific": "Spodoptera frugiperda", "source": "FAO / ICAR-NBAIR", "query": "Corn fall armyworm leaf feeding damage shot holes", "count": 5},

    {"crop": "Tomato", "disease": "Early Blight", "scientific": "Alternaria solani", "source": "TNAU Agritech Portal", "query": "Tomato early blight concentric rings leaf", "count": 5},
    {"crop": "Tomato", "disease": "Late Blight", "scientific": "Phytophthora infestans", "source": "Cornell Veg Edge / CABI", "query": "Tomato late blight water soaked lesion leaf", "count": 5},
    {"crop": "Tomato", "disease": "Bacterial Spot", "scientific": "Xanthomonas vesicatoria", "source": "UF/IFAS Extension", "query": "Tomato bacterial spot leaf lesions", "count": 4},
    {"crop": "Tomato", "disease": "Tomato Yellow Leaf Curl Virus", "scientific": "TYLCV", "source": "AVRDC / ICAR-IIHR", "query": "Tomato yellow leaf curl virus upward curling", "count": 3},
    {"crop": "Tomato", "disease": "Septoria Leaf Spot", "scientific": "Septoria lycopersici", "source": "CABI Plantwise", "query": "Tomato septoria leaf spot circular spots", "count": 3},

    {"crop": "Potato", "disease": "Early Blight", "scientific": "Alternaria solani", "source": "CPRI Shimla / ICAR", "query": "Potato early blight dark concentric lesion leaf", "count": 4},
    {"crop": "Potato", "disease": "Late Blight", "scientific": "Phytophthora infestans", "source": "CPRI Shimla / CABI", "query": "Potato late blight water soaked brown spot leaf", "count": 4},
    {"crop": "Potato", "disease": "Black Scurf / Rhizoctonia", "scientific": "Rhizoctonia solani", "source": "ICAR-CPRI", "query": "Potato rhizoctonia black scurf leaf foliage", "count": 4},
    {"crop": "Potato", "disease": "Healthy Potato Leaf", "scientific": "Solanum tuberosum", "source": "Agricultural Extension", "query": "Healthy green potato leaf foliage plant", "count": 4},

    {"crop": "Chilli", "disease": "Anthracnose / Dieback", "scientific": "Colletotrichum capsici", "source": "TNAU Agritech", "query": "Chilli anthracnose leaf spot fruit rot lesion", "count": 4},
    {"crop": "Chilli", "disease": "Chilli Leaf Curl Virus", "scientific": "Begomovirus / Whitefly vector", "source": "ICAR-IIHR", "query": "Chilli leaf curl virus puckering upward leaf", "count": 4},
    {"crop": "Chilli", "disease": "Bacterial Leaf Spot", "scientific": "Xanthomonas campestris", "source": "CABI Plantwise", "query": "Chilli pepper bacterial leaf spot small dark lesions", "count": 4},
    {"crop": "Chilli", "disease": "Powdery Mildew", "scientific": "Leveillula taurica", "source": "TNAU Agritech", "query": "Chilli powdery mildew white powdery growth leaf", "count": 4},

    {"crop": "Cotton", "disease": "Bacterial Blight / Angular Leaf Spot", "scientific": "Xanthomonas citri pv. malvacearum", "source": "CICR Nagpur / ICAR", "query": "Cotton bacterial blight angular leaf spot veins", "count": 4},
    {"crop": "Cotton", "disease": "Cotton Leaf Curl Virus", "scientific": "CLCuD", "source": "CICR / CABI", "query": "Cotton leaf curl disease vein thickening leaf", "count": 4},
    {"crop": "Cotton", "disease": "Grey Mildew / Areolate Mildew", "scientific": "Ramularia areola", "source": "ICAR-CICR", "query": "Cotton grey mildew areolate white patches leaf", "count": 4},
    {"crop": "Cotton", "disease": "Cotton Aphid Damage", "scientific": "Aphis gossypii", "source": "TNAU Agritech", "query": "Cotton aphid leaf curling honeydew damage", "count": 4},

    {"crop": "Groundnut", "disease": "Early Leaf Spot", "scientific": "Cercospora arachidicola", "source": "ICRISAT / ICAR-DGR", "query": "Groundnut early leaf spot yellow halo tikka", "count": 4},
    {"crop": "Groundnut", "disease": "Late Leaf Spot", "scientific": "Phaeoisariopsis personata", "source": "ICRISAT", "query": "Groundnut late leaf spot tikka disease dark spots", "count": 4},
    {"crop": "Groundnut", "disease": "Groundnut Rust", "scientific": "Puccinia arachidis", "source": "ICRISAT Groundnut Pathology", "query": "Groundnut rust pustules orange brown underside leaf", "count": 4},
    {"crop": "Groundnut", "disease": "Collar Rot", "scientific": "Aspergillus niger", "source": "ICAR-DGR", "query": "Groundnut collar rot aspergillus seedling wilt", "count": 4},

    {"crop": "Wheat", "disease": "Brown Rust / Leaf Rust", "scientific": "Puccinia triticina", "source": "ICAR-IIWBR Karnal", "query": "Wheat brown leaf rust orange pustules leaf", "count": 4},
    {"crop": "Wheat", "disease": "Yellow Rust / Stripe Rust", "scientific": "Puccinia striiformis", "source": "ICAR-IIWBR / CIMMYT", "query": "Wheat stripe rust yellow pustules linear stripes leaf", "count": 4},
    {"crop": "Wheat", "disease": "Powdery Mildew", "scientific": "Blumeria graminis", "source": "CABI Plantwise", "query": "Wheat powdery mildew white cottony patches leaf", "count": 4},
    {"crop": "Wheat", "disease": "Spot Blight / Leaf Blight", "scientific": "Bipolaris sorokiniana", "source": "CIMMYT Wheat Pathology", "query": "Wheat spot blotch leaf blight brown lesions", "count": 4},

    {"crop": "Grape", "disease": "Downy Mildew", "scientific": "Plasmopara viticola", "source": "ICAR-NRC Grapes Pune", "query": "Grape downy mildew oil spots yellow leaf underside white", "count": 4},
    {"crop": "Grape", "disease": "Powdery Mildew", "scientific": "Uncinula necator", "source": "ICAR-NRC Grapes", "query": "Grape powdery mildew ashy gray powdery growth leaf", "count": 4},
    {"crop": "Grape", "disease": "Black Rot", "scientific": "Guignardia bidwellii", "source": "Cornell Viticulture", "query": "Grape black rot circular reddish brown leaf lesions", "count": 4},
    {"crop": "Grape", "disease": "Anthracnose / Bird's Eye", "scientific": "Elsinoe ampelina", "source": "NRC Grapes", "query": "Grape anthracnose birds eye spot leaf lesion", "count": 4},

    {"crop": "Apple", "disease": "Apple Scab", "scientific": "Venturia inaequalis", "source": "Dr YSP UHF Nauni / CABI", "query": "Apple scab olive green velvety spots leaf foliage", "count": 4},
    {"crop": "Apple", "disease": "Black Rot / Frogeye", "scientific": "Botryosphaeria obtusa", "source": "Penn State Extension", "query": "Apple frogeye leaf spot black rot circular spots", "count": 4},
    {"crop": "Apple", "disease": "Cedar Apple Rust", "scientific": "Gymnosporangium juniperi-virginianae", "source": "Virginia Tech Extension", "query": "Apple cedar rust bright orange yellow spots leaf", "count": 4},
    {"crop": "Apple", "disease": "Apple Powdery Mildew", "scientific": "Podosphaera leucotricha", "source": "CABI Plantwise", "query": "Apple powdery mildew white coating stunted leaf terminal", "count": 4},

    {"crop": "Citrus", "disease": "Citrus Canker", "scientific": "Xanthomonas citri", "source": "ICAR-CCRI Nagpur", "query": "Citrus canker raised corky necrotic lesions leaf", "count": 4},
    {"crop": "Citrus", "disease": "Citrus Greening / Huanglongbing", "scientific": "Candidatus Liberibacter", "source": "USDA-ARS / ICAR-CCRI", "query": "Citrus greening hlb blotchy mottle asymmetric leaf", "count": 4},
    {"crop": "Citrus", "disease": "Citrus Black Spot", "scientific": "Phyllosticta citricarpa", "source": "CABI Plantwise", "query": "Citrus black spot hard spot small sunken lesions leaf", "count": 3},
    {"crop": "Citrus", "disease": "Melanose", "scientific": "Diaporthe citri", "source": "UF/IFAS Citrus Extension", "query": "Citrus melanose small dark brown raised pustules leaf sandpaper", "count": 3},

    {"crop": "Sugarcane", "disease": "Red Rot", "scientific": "Colletotrichum falcatum", "source": "ICAR-SBI Coimbatore", "query": "Sugarcane red rot leaf midrib red lesions white center", "count": 4},
    {"crop": "Sugarcane", "disease": "Sugarcane Rust", "scientific": "Puccinia kuehnii", "source": "CABI Plantwise", "query": "Sugarcane rust orange brown pustules leaf surface", "count": 3},
    {"crop": "Sugarcane", "disease": "Sugarcane Mosaic Virus", "scientific": "SCMV", "source": "ICAR-SBI", "query": "Sugarcane mosaic virus chlorotic streaks leaf mottled", "count": 3},

    {"crop": "Soybean", "disease": "Soybean Rust", "scientific": "Phakopsora pachyrhizi", "source": "ICAR-IISR Indore", "query": "Soybean rust tiny tan brown lesions leaf underside", "count": 4},
    {"crop": "Soybean", "disease": "Frogeye Leaf Spot", "scientific": "Cercospora sojina", "source": "Iowa State Soybean Diseases", "query": "Soybean frogeye leaf spot circular brown gray center halo", "count": 3},
    {"crop": "Soybean", "disease": "Bacterial Pustule", "scientific": "Xanthomonas axonopodis pv. glycines", "source": "CABI Plantwise", "query": "Soybean bacterial pustule small yellowish spots raised center leaf", "count": 3}
]

# 100 Botanical Plant/Weed Identification Targets
PLANT_SPECS = [
    {"name": "Rice / Paddy", "scientific": "Oryza sativa", "family": "Poaceae", "category": "Crop", "query": "Rice paddy crop plant green field", "count": 2},
    {"name": "Maize / Corn", "scientific": "Zea mays", "family": "Poaceae", "category": "Crop", "query": "Maize plant field green leaves tassel", "count": 2},
    {"name": "Wheat", "scientific": "Triticum aestivum", "family": "Poaceae", "category": "Crop", "query": "Wheat crop field green plant spike", "count": 2},
    {"name": "Tomato", "scientific": "Solanum lycopersicum", "family": "Solanaceae", "category": "Crop", "query": "Tomato plant healthy leaves yellow flowers", "count": 2},
    {"name": "Brinjal / Eggplant", "scientific": "Solanum melongena", "family": "Solanaceae", "category": "Crop", "query": "Brinjal eggplant plant leaves purple flower", "count": 2},
    {"name": "Okra / Ladyfinger", "scientific": "Abelmoschus esculentus", "family": "Malvaceae", "category": "Crop", "query": "Okra bhendi plant green leaves yellow flower", "count": 2},
    {"name": "Chilli Pepper", "scientific": "Capsicum annuum", "family": "Solanaceae", "category": "Crop", "query": "Chilli pepper plant green leaves white flowers", "count": 2},
    {"name": "Cotton", "scientific": "Gossypium hirsutum", "family": "Malvaceae", "category": "Crop", "query": "Cotton plant green leaves flower bud field", "count": 2},
    {"name": "Sugarcane", "scientific": "Saccharum officinarum", "family": "Poaceae", "category": "Crop", "query": "Sugarcane plant stalk long leaves field", "count": 2},
    {"name": "Groundnut / Peanut", "scientific": "Arachis hypogaea", "family": "Fabaceae", "category": "Crop", "query": "Groundnut peanut plant green leaves yellow flower", "count": 2},
    {"name": "Soybean", "scientific": "Glycine max", "family": "Fabaceae", "category": "Crop", "query": "Soybean plant trifoliate green leaves field", "count": 2},
    {"name": "Onion", "scientific": "Allium cepa", "family": "Amaryllidaceae", "category": "Crop", "query": "Onion crop green hollow leaves field", "count": 2},
    {"name": "Garlic", "scientific": "Allium sativum", "family": "Amaryllidaceae", "category": "Crop", "query": "Garlic plant long flat green leaves field", "count": 2},
    {"name": "Turmeric", "scientific": "Curcuma longa", "family": "Zingiberaceae", "category": "Crop", "query": "Turmeric crop plant broad green leaves field", "count": 2},
    {"name": "Ginger", "scientific": "Zingiber officinale", "family": "Zingiberaceae", "category": "Crop", "query": "Ginger plant narrow green leaves farm", "count": 2},
    {"name": "Mustard", "scientific": "Brassica juncea", "family": "Brassicaceae", "category": "Crop", "query": "Mustard crop plant bright yellow flowers leaves", "count": 2},
    {"name": "Chickpea / Bengal Gram", "scientific": "Cicer arietinum", "family": "Fabaceae", "category": "Crop", "query": "Chickpea gram plant pinnate leaves field", "count": 2},
    {"name": "Banana", "scientific": "Musa acuminata", "family": "Musaceae", "category": "Crop", "query": "Banana plant broad huge leaves farm", "count": 2},
    {"name": "Mango", "scientific": "Mangifera indica", "family": "Anacardiaceae", "category": "Crop", "query": "Mango tree foliage green lanceolate leaves", "count": 2},
    {"name": "Papaya", "scientific": "Carica papaya", "family": "Caricaceae", "category": "Crop", "query": "Papaya plant large palmately lobed green leaves", "count": 2},

    {"name": "Parthenium / Carrot Grass", "scientific": "Parthenium hysterophorus", "family": "Asteraceae", "category": "Weed", "query": "Parthenium hysterophorus weed field leaf flower", "count": 3},
    {"name": "Cyperus / Nut Grass (Motha)", "scientific": "Cyperus rotundus", "family": "Cyperaceae", "category": "Weed", "query": "Cyperus rotundus nut grass weed agricultural field", "count": 3},
    {"name": "Echinochloa / Barnyard Grass", "scientific": "Echinochloa colona", "family": "Poaceae", "category": "Weed", "query": "Echinochloa colona jungle rice weed paddy field", "count": 3},
    {"name": "Amaranthus viridis / Slender Amaranth", "scientific": "Amaranthus viridis", "family": "Amaranthaceae", "category": "Weed", "query": "Amaranthus viridis weed plant leaf flower spike", "count": 3},
    {"name": "Chenopodium album / Bathua", "scientific": "Chenopodium album", "family": "Amaranthaceae", "category": "Weed", "query": "Chenopodium album lambs quarters weed field leaf", "count": 3},
    {"name": "Cynodon dactylon / Bermuda Grass", "scientific": "Cynodon dactylon", "family": "Poaceae", "category": "Weed", "query": "Cynodon dactylon hariali grass weed lawn field", "count": 3},
    {"name": "Trianthema / Horse Purslane", "scientific": "Trianthema portulacastrum", "family": "Aizoaceae", "category": "Weed", "query": "Trianthema portulacastrum weed green succulent leaves", "count": 3},
    {"name": "Commelina / Benghal Dayflower", "scientific": "Commelina benghalensis", "family": "Commelinaceae", "category": "Weed", "query": "Commelina benghalensis weed blue flower oval leaf", "count": 3},
    {"name": "Argemone mexicana / Prickly Poppy", "scientific": "Argemone mexicana", "family": "Papaveraceae", "category": "Weed", "query": "Argemone mexicana mexican poppy weed prickly leaf yellow flower", "count": 3},
    {"name": "Lantana camara", "scientific": "Lantana camara", "family": "Verbenaceae", "category": "Weed", "query": "Lantana camara invasive weed rough leaves colored flowers", "count": 3},

    {"name": "Neem", "scientific": "Azadirachta indica", "family": "Meliaceae", "category": "Medicinal", "query": "Neem tree Azadirachta indica serrated pinnate green leaves", "count": 3},
    {"name": "Tulsi / Holy Basil", "scientific": "Ocimum sanctum", "family": "Lamiaceae", "category": "Medicinal", "query": "Holy basil Ocimum sanctum tulsi plant green leaves", "count": 3},
    {"name": "Ashwagandha", "scientific": "Withania somnifera", "family": "Solanaceae", "category": "Medicinal", "query": "Withania somnifera ashwagandha plant leaves berries", "count": 3},
    {"name": "Aloe Vera", "scientific": "Aloe barbadensis", "family": "Asphodelaceae", "category": "Medicinal", "query": "Aloe vera plant fleshy serrated succulent leaves", "count": 3},
    {"name": "Moringa / Drumstick", "scientific": "Moringa oleifera", "family": "Moringaceae", "category": "Medicinal", "query": "Moringa oleifera drumstick tree tripinnate small leaves", "count": 3},
    {"name": "Giloy / Guduchi", "scientific": "Tinospora cordifolia", "family": "Menispermaceae", "category": "Medicinal", "query": "Tinospora cordifolia giloy heart shaped leaves vine", "count": 3},
    {"name": "Brahmi", "scientific": "Bacopa monnieri", "family": "Plantaginaceae", "category": "Medicinal", "query": "Bacopa monnieri brahmi succulent small leaves creeping", "count": 2},

    {"name": "Teak", "scientific": "Tectona grandis", "family": "Lamiaceae", "category": "Tree", "query": "Teak tree Tectona grandis large broad rough leaves", "count": 2},
    {"name": "Eucalyptus", "scientific": "Eucalyptus tereticornis", "family": "Myrtaceae", "category": "Tree", "query": "Eucalyptus tree narrow drooping leaves smooth bark", "count": 2},
    {"name": "Subabul", "scientific": "Leucaena leucocephala", "family": "Fabaceae", "category": "Tree", "query": "Leucaena leucocephala subabul bipinnate foliage pods", "count": 2},
    {"name": "Pongamia / Karanj", "scientific": "Pongamia pinnata", "family": "Fabaceae", "category": "Tree", "query": "Pongamia pinnata karanj tree glossy green leaves", "count": 2},
    {"name": "Tamarind", "scientific": "Tamarindus indica", "family": "Fabaceae", "category": "Tree", "query": "Tamarind tree pinnate dense foliage compound leaves", "count": 2}
]

# 100 Agrochemical Scanner Targets
AGRO_SPECS = [
    {"brand": "Saaf Fungicide", "active": "Carbendazim 12% + Mancozeb 63% WP", "manufacturer": "UPL", "type": "Fungicide", "query": "Saaf fungicide UPL packet packaging", "count": 4},
    {"brand": "Tilt 25 EC", "active": "Propiconazole 25% EC", "manufacturer": "Syngenta", "type": "Fungicide", "query": "Syngenta Tilt 25 EC fungicide bottle packaging", "count": 3},
    {"brand": "Nativo 75 WG", "active": "Tebuconazole 50% + Trifloxystrobin 25% WG", "manufacturer": "Bayer", "type": "Fungicide", "query": "Bayer Nativo 75 WG fungicide packet bottle", "count": 3},
    {"brand": "Amistar Top", "active": "Azoxystrobin 18.2% + Difenoconazole 11.4% SC", "manufacturer": "Syngenta", "type": "Fungicide", "query": "Syngenta Amistar Top fungicide bottle", "count": 3},
    {"brand": "Ridomil Gold", "active": "Metalaxyl-M 4% + Mancozeb 64% WP", "manufacturer": "Syngenta", "type": "Fungicide", "query": "Syngenta Ridomil Gold fungicide packet", "count": 3},
    {"brand": "Contaf Plus", "active": "Hexaconazole 5% SC", "manufacturer": "Tata Rallis", "type": "Fungicide", "query": "Tata Rallis Contaf Plus fungicide bottle", "count": 3},
    {"brand": "Blitox 50", "active": "Copper Oxychloride 50% WP", "manufacturer": "Rallis India", "type": "Fungicide", "query": "Blitox 50 copper oxychloride fungicide packet", "count": 3},
    {"brand": "Bavistin 50 WP", "active": "Carbendazim 50% WP", "manufacturer": "Crystal Crop Protection", "type": "Fungicide", "query": "Bavistin 50 WP carbendazim fungicide packet", "count": 3},
    {"brand": "Score 25 EC", "active": "Difenoconazole 25% EC", "manufacturer": "Syngenta", "type": "Fungicide", "query": "Syngenta Score 25 EC fungicide bottle", "count": 3},
    {"brand": "Custodia", "active": "Azoxystrobin 11% + Tebuconazole 18.3% SC", "manufacturer": "Adama", "type": "Fungicide", "query": "Adama Custodia fungicide bottle", "count": 3},
    {"brand": "Dithane M-45", "active": "Mancozeb 75% WP", "manufacturer": "Indofil", "type": "Fungicide", "query": "Indofil Dithane M-45 fungicide yellow packet", "count": 3},
    {"brand": "Antracol", "active": "Propineb 70% WP", "manufacturer": "Bayer", "type": "Fungicide", "query": "Bayer Antracol propineb fungicide packet", "count": 3},
    {"brand": "Kavach", "active": "Chlorothalonil 75% WP", "manufacturer": "Syngenta", "type": "Fungicide", "query": "Syngenta Kavach chlorothalonil fungicide packet", "count": 3},

    {"brand": "Coragen", "active": "Chlorantraniliprole 18.5% SC", "manufacturer": "FMC", "type": "Insecticide", "query": "FMC Coragen insecticide bottle packaging", "count": 4},
    {"brand": "Confidor 200 SL", "active": "Imidacloprid 17.8% SL", "manufacturer": "Bayer", "type": "Insecticide", "query": "Bayer Confidor 200 SL insecticide bottle", "count": 3},
    {"brand": "Regent 5 SC", "active": "Fipronil 5% SC", "manufacturer": "Bayer", "type": "Insecticide", "query": "Bayer Regent 5 SC fipronil insecticide bottle", "count": 3},
    {"brand": "Ampligo", "active": "Chlorantraniliprole 9.3% + Lambda-cyhalothrin 4.6% ZC", "manufacturer": "Syngenta", "type": "Insecticide", "query": "Syngenta Ampligo insecticide bottle", "count": 3},
    {"brand": "Tracer 480 SC", "active": "Spinosad 45% SC", "manufacturer": "Corteva", "type": "Insecticide", "query": "Corteva Tracer spinosad insecticide bottle", "count": 3},
    {"brand": "Alika", "active": "Thiamethoxam 12.6% + Lambda-cyhalothrin 9.5% ZC", "manufacturer": "Syngenta", "type": "Insecticide", "query": "Syngenta Alika insecticide bottle", "count": 3},
    {"brand": "Karate 5 EC", "active": "Lambda-cyhalothrin 5% EC", "manufacturer": "Syngenta", "type": "Insecticide", "query": "Syngenta Karate 5 EC insecticide bottle", "count": 3},
    {"brand": "Rogor", "active": "Dimethoate 30% EC", "manufacturer": "FMC", "type": "Insecticide", "query": "Rogor dimethoate 30 EC insecticide bottle", "count": 3},
    {"brand": "Pegasus", "active": "Diafenthiuron 50% WP", "manufacturer": "Syngenta", "type": "Insecticide", "query": "Syngenta Pegasus diafenthiuron insecticide packet", "count": 3},
    {"brand": "Actara", "active": "Thiamethoxam 25% WG", "manufacturer": "Syngenta", "type": "Insecticide", "query": "Syngenta Actara thiamethoxam insecticide packet", "count": 2},

    {"brand": "IFFCO Urea", "active": "46% Nitrogen (N)", "manufacturer": "IFFCO", "type": "Fertilizer", "query": "IFFCO neem coated urea 45kg bag packaging", "count": 3},
    {"brand": "IFFCO DAP 18-46-0", "active": "18% Nitrogen, 46% Phosphorus", "manufacturer": "IFFCO", "type": "Fertilizer", "query": "IFFCO DAP di-ammonium phosphate bag packaging", "count": 3},
    {"brand": "MOP Muriate of Potash", "active": "60% Potassium (K2O)", "manufacturer": "IPL", "type": "Fertilizer", "query": "IPL MOP muriate of potash fertilizer bag", "count": 3},
    {"brand": "NPK 19-19-19 100% Water Soluble", "active": "19% N, 19% P, 19% K", "manufacturer": "Mahadhan / IFFCO", "type": "Fertilizer", "query": "NPK 19 19 19 water soluble fertilizer packet bag", "count": 3},
    {"brand": "Zinc Sulphate 33%", "active": "33% Zinc Monohydrate", "manufacturer": "Uttam / IFFCO", "type": "Micronutrient", "query": "Zinc sulphate monohydrate 33 agricultural fertilizer packet", "count": 3},
    {"brand": "Boron 20%", "active": "Disodium Octaborate Tetrahydrate 20% B", "manufacturer": "Multiplex / Mahadhan", "type": "Micronutrient", "query": "Boron 20 percent agricultural fertilizer packet", "count": 3},
    {"brand": "Sagarika Seaweed Extract", "active": "Kappaphycus alvarezii Seaweed", "manufacturer": "IFFCO", "type": "Biostimulant", "query": "IFFCO Sagarika liquid seaweed extract bottle", "count": 2},

    {"brand": "Roundup / Glyphosate", "active": "Glyphosate 41% SL", "manufacturer": "Bayer", "type": "Herbicide", "query": "Roundup glyphosate 41 SL herbicide bottle", "count": 3},
    {"brand": "Weedmar 2,4-D", "active": "2,4-D Amine Salt 58% SL", "manufacturer": "Dhanuka", "type": "Herbicide", "query": "Dhanuka Weedmar 2 4 D herbicide bottle", "count": 3},
    {"brand": "Stomp Extra", "active": "Pendimethalin 38.7% CS", "manufacturer": "BASF", "type": "Herbicide", "query": "BASF Stomp extra pendimethalin herbicide bottle", "count": 2},
    {"brand": "Nominee Gold", "active": "Bispyribac Sodium 10% SC", "manufacturer": "PI Industries", "type": "Herbicide", "query": "PI Industries Nominee Gold herbicide bottle", "count": 2}
]

def process_spec(spec, folder, module_type):
    records = []
    target_count = spec["count"]
    images = fetch_images_via_tavily(spec["query"], max_results=target_count + 4)
    collected = 0
    for img_url in images:
        if collected >= target_count:
            break
        img = download_image(img_url)
        if img:
            img_id = str(uuid.uuid4())
            filename = f"{img_id}.jpg"
            dest_path = os.path.join(folder, filename)
            img.save(dest_path, "JPEG", quality=90)
            collected += 1
            rel_folder = os.path.basename(folder)
            record = {
                "id": img_id,
                "filename": filename,
                "relative_path": f"benchmarks/{rel_folder}/{filename}",
                "module": module_type,
                "original_url": img_url
            }
            if module_type == "disease":
                record.update({
                    "crop": spec["crop"],
                    "disease": spec["disease"],
                    "scientific_name": spec["scientific"],
                    "authority_source": spec["source"]
                })
            elif module_type == "plant":
                record.update({
                    "plant_name": spec["name"],
                    "scientific_name": spec["scientific"],
                    "family": spec["family"],
                    "category": spec["category"],
                    "authority_source": "Pl@ntNet / Kew Royal Botanic Gardens / Flora of India"
                })
            elif module_type == "agrochemical":
                record.update({
                    "brand": spec["brand"],
                    "active_ingredients": spec["active"],
                    "manufacturer": spec["manufacturer"],
                    "product_type": spec["type"],
                    "authority_source": "CIBRC Registered Products Catalog / Manufacturer Specification"
                })
            records.append(record)
    return records

def main():
    print("=" * 70, flush=True)
    print("🌾 AgriShield High-Speed 400-Scan Real-World Harvest Engine", flush=True)
    print("=" * 70, flush=True)

    all_ground_truth = []

    # 1. Harvest Disease (200)
    print("\n🌿 [Phase 1/3] Harvesting 200 Disease Diagnosis Scans across 13 Crops...", flush=True)
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_spec, spec, DISEASE_DIR, "disease"): spec for spec in DISEASE_SPECS}
        for future in as_completed(futures):
            res = future.result()
            all_ground_truth.extend(res)
            print(f"  ✓ Sourced {len(res)} samples for {futures[future].get('crop')} - {futures[future].get('disease')}", flush=True)

    # 2. Harvest Plant (100)
    print("\n🌸 [Phase 2/3] Harvesting 100 Botanical Plant/Weed Scans...", flush=True)
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_spec, spec, PLANT_DIR, "plant"): spec for spec in PLANT_SPECS}
        for future in as_completed(futures):
            res = future.result()
            all_ground_truth.extend(res)
            print(f"  ✓ Sourced {len(res)} samples for {futures[future].get('name')}", flush=True)

    # 3. Harvest Agrochemical (100)
    print("\n🔬 [Phase 3/3] Harvesting 100 Agrochemical Packaging Scans...", flush=True)
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(process_spec, spec, AGRO_DIR, "agrochemical"): spec for spec in AGRO_SPECS}
        for future in as_completed(futures):
            res = future.result()
            all_ground_truth.extend(res)
            print(f"  ✓ Sourced {len(res)} samples for {futures[future].get('brand')}", flush=True)

    # Save Ground Truth
    with open(GROUND_TRUTH_FILE, "w", encoding="utf-8") as f:
        json.dump(all_ground_truth, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 70, flush=True)
    print(f"🎉 Harvest Complete! Total records in ground truth: {len(all_ground_truth)}", flush=True)
    print(f"Master file saved: {GROUND_TRUTH_FILE}", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()

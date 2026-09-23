import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Sprout, 
  BookOpen, 
  Sun, 
  FlaskConical, 
  Volume2, 
  VolumeX, 
  Droplets, 
  Thermometer, 
  ShieldAlert, 
  Bug, 
  ArrowRight, 
  RotateCcw, 
  Sparkles, 
  Globe, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button } from '../ui/index';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { buildPlantSpeech } from '../../utils/regionalLocale';
import { translateCrop } from '../../utils/diseaseAdvisoryData';
import { ANDHRA_BOTANICAL_BASE } from '../../data/andhraBotanicalData';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import ScanLanguageBar from './ScanLanguageBar';
import API from '../../services/api';

const BASE_CROPS_KNOWLEDGE = {
  rice: {
    commonName: "Rice / Paddy Crop",
    scientificName: "Oryza sativa",
    genus: "Oryza",
    species: "sativa",
    family: "Poaceae (Gramineae Family)",
    identifiedType: "Crop",
    nativeRegion: "South Asia & Tropical Asia",
    growthHabit: "Semi-aquatic annual tillering grass",
    leafType: "Flat linear parallel-veined blade with prominent ligule & auricles",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "5.5 - 6.5 (Clayey loam with standing water retention)",
    suitableSoilType: "Clayey loam, silty clay, or alluvial heavy delta soils (pH 5.5 - 6.5) with low percolation and slow drainage.",
    idealWeatherClimate: "22°C - 34°C, High Relative Humidity (70-85%), 1200mm+ water requirement, Full Sun (6 to 8 hours daily).",
    waterNeed: "Flooded paddy or Alternate Wetting & Drying (AWD)",
    temperature: "22°C - 34°C",
    fertilizer: "NPK 120:60:60 kg/ha split application of Urea & MOP Potash with Zinc Sulfate basal dose",
    micronutrients: "Zinc Sulfate (25 kg/ha) to prevent Khaira disease & Iron (Fe) in calcarous soils",
    description: "Oryza sativa (Rice/Paddy) is a vital semi-aquatic cereal grain and the principal staple food crop nourishing over half the global population. Characterized by fibrous root systems, hollow tillering culms, and flat linear leaf blades with prominent ligules, the plant develops terminal panicles bearing grain spikelets. In South India, it is extensively cultivated across the Krishna-Godavari and Cauvery deltaic plains under lowland flooded conditions and aerobic systems. High temperature, prolonged sunlight, and uniform moisture during vegetative and grain-filling phases are critical for optimal photosynthetic accumulation and grain yield.",
    primaryUseImpact: "Cultivated agricultural food crop serving as the primary staple grain and economic backbone of Indian agriculture.",
    commonDiseases: ["Rice Blast (Magnaporthe oryzae)", "Bacterial Leaf Blight (Xanthomonas oryzae)", "Sheath Blight", "Brown Spot"],
    commonPests: ["Yellow Stem Borer", "Brown Planthopper (BPH)", "Gall Midge", "Leaf Folder"]
  },
  paddy: {
    commonName: "Rice / Paddy Crop",
    scientificName: "Oryza sativa",
    genus: "Oryza",
    species: "sativa",
    family: "Poaceae (Gramineae Family)",
    identifiedType: "Crop",
    nativeRegion: "South Asia & Tropical Asia",
    growthHabit: "Semi-aquatic annual tillering grass",
    leafType: "Flat linear parallel-veined blade with prominent ligule & auricles",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "5.5 - 6.5 (Clayey loam with standing water retention)",
    suitableSoilType: "Clayey loam, silty clay, or alluvial heavy delta soils (pH 5.5 - 6.5) with low percolation and slow drainage.",
    idealWeatherClimate: "22°C - 34°C, High Relative Humidity (70-85%), 1200mm+ water requirement, Full Sun (6 to 8 hours daily).",
    waterNeed: "Flooded paddy or Alternate Wetting & Drying (AWD)",
    temperature: "22°C - 34°C",
    fertilizer: "NPK 120:60:60 kg/ha split application of Urea & MOP Potash with Zinc Sulfate basal dose",
    micronutrients: "Zinc Sulfate (25 kg/ha) to prevent Khaira disease & Iron (Fe) in calcarous soils",
    description: "Oryza sativa (Rice/Paddy) is a vital semi-aquatic cereal grain and the principal staple food crop nourishing over half the global population. Characterized by fibrous root systems, hollow tillering culms, and flat linear leaf blades with prominent ligules, the plant develops terminal panicles bearing grain spikelets. In South India, it is extensively cultivated across the Krishna-Godavari and Cauvery deltaic plains under lowland flooded conditions and aerobic systems. High temperature, prolonged sunlight, and uniform moisture during vegetative and grain-filling phases are critical for optimal photosynthetic accumulation and grain yield.",
    primaryUseImpact: "Cultivated agricultural food crop serving as the primary staple grain and economic backbone of Indian agriculture.",
    commonDiseases: ["Rice Blast (Magnaporthe oryzae)", "Bacterial Leaf Blight (Xanthomonas oryzae)", "Sheath Blight", "Brown Spot"],
    commonPests: ["Yellow Stem Borer", "Brown Planthopper (BPH)", "Gall Midge", "Leaf Folder"]
  },
  cotton: {
    commonName: "Cotton Crop / Kapas",
    scientificName: "Gossypium hirsutum",
    genus: "Gossypium",
    species: "hirsutum",
    family: "Malvaceae (Mallow Family)",
    identifiedType: "Crop",
    nativeRegion: "Central America (Widely bred & grown in India)",
    growthHabit: "Branching taproot shrub (1 to 1.8 m)",
    leafType: "Palmate 3-5 lobed leaves with hairy veins",
    sunlight: "Full Sun (8+ hours daily)",
    soilpH: "6.5 - 8.0 (Deep Black Cotton Soil)",
    suitableSoilType: "Deep black cotton soils (Vertisols) or fertile clay loam with high moisture holding capacity and good drainage.",
    idealWeatherClimate: "21°C - 35°C, Warm tropical climate, 700 - 1200 mm annual rainfall, and Full Sun (8+ hours daily).",
    waterNeed: "Moderate (Critical during flowering and boll development)",
    temperature: "21°C - 35°C",
    fertilizer: "NPK 150:60:60 kg/ha with split Nitrogen top-dressing",
    micronutrients: "Magnesium Sulfate (25 kg/ha) & Boron 0.1% foliar spray",
    description: "Gossypium hirsutum (Upland Cotton) is the world's most vital natural textile fiber and an important commercial cash crop. It exhibits an erect taproot system with monopodial vegetative and sympodial fruiting branches bearing deeply lobed palmate leaves. Large creamy-white to yellow blossoms turn pink after pollination, eventually forming multi-locular seed bolls containing lint and fuzz fibers. Cultivated extensively on the black soils of the Deccan plateau, it thrives under warm temperatures and prolonged bright sunshine.",
    primaryUseImpact: "Commercial fiber crop, cottonseed oil production, and high-protein livestock feed.",
    commonDiseases: ["Cotton Leaf Curl Virus", "Bacterial Blight / Angular Leaf Spot", "Grey Mildew"],
    commonPests: ["Pink Bollworm (Pectinophora gossypiella)", "Whiteflies", "Thrips", "Aphids"]
  },
  wheat: {
    commonName: "Wheat Crop / Gehun",
    scientificName: "Triticum aestivum",
    genus: "Triticum",
    species: "aestivum",
    family: "Poaceae (Gramineae Family)",
    identifiedType: "Crop",
    nativeRegion: "Fertile Crescent (Middle East)",
    growthHabit: "Annual tillering cereal grass (0.8 to 1.2 m)",
    leafType: "Linear lanceolate leaves with auricles clasping stem",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "6.0 - 7.5 (Well-drained fertile loam)",
    suitableSoilType: "Well-drained fertile loam or clay loam soils (pH 6.0 - 7.5) with good tilth and moisture retention.",
    idealWeatherClimate: "12°C - 25°C, Cool winter vegetative season and bright warm grain ripening window.",
    waterNeed: "4 to 6 critical irrigations (CRI, tillering, jointing, flowering, milking)",
    temperature: "12°C - 25°C",
    fertilizer: "NPK 120:60:40 kg/ha with Zinc Sulfate top-dressing",
    micronutrients: "Zinc Sulfate & Manganese foliar nutrition",
    description: "Triticum aestivum (Common Wheat) is a major world staple cereal grass producing nutrient-dense grain rich in gluten and carbohydrates. Developing a dense fibrous root architecture, it produces hollow tillering stems with narrow, parallel-veined leaves and terminal awned or awnless spike inflorescences. Cultivated predominantly as a Rabi crop in northern and central India, it requires cool temperatures during vegetative elongation followed by sunny, dry conditions for grain filling.",
    primaryUseImpact: "Primary staple food crop for flour, bread, chapatis, and cereal products.",
    commonDiseases: ["Yellow / Stripe Rust (Puccinia striiformis)", "Brown / Leaf Rust", "Loose Smut"],
    commonPests: ["Wheat Aphids", "Armyworm", "Termites"]
  },
  onion: {
    commonName: "Onion Crop",
    family: "Vegetable Bulb Crop",
    nativeRegion: "Central Asia & Middle East",
    growthHabit: "Bulbous Herbaceous Crop",
    leafType: "Hollow Tubular Cylindrical Leaves with Basal Swollen Bulb",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "6.0 - 7.0 (Well-drained Fertile Loam)",
    waterNeed: "1 inch per week (Reduce during bulb maturation)",
    temperature: "13°C - 24°C (Cool season leaf growth)",
    fertilizer: "NPK 10-20-10 starter, followed by High-Nitrogen (Urea) during leaf expansion",
    micronutrients: "Sulfur (enhances bulb flavor & pungency) & Zinc",
    commonDiseases: ["Purple Blotch", "Stemphylium Leaf Blight", "Basal Rot"],
    commonPests: ["Thrips", "Onion Maggot"]
  },
  allium: {
    commonName: "Onion / Garlic Crop",
    family: "Vegetable Bulb Crop",
    nativeRegion: "Central Asia & Mediterranean",
    growthHabit: "Bulbous Crop",
    leafType: "Tubular / Flat Sheathing Foliage",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "6.0 - 7.0",
    waterNeed: "1 inch per week",
    temperature: "12°C - 24°C",
    fertilizer: "High Phosphorus at planting + Nitrogen topdress",
    micronutrients: "Sulfur & Zinc",
    commonDiseases: ["Purple Blotch", "Downy Mildew"],
    commonPests: ["Thrips"]
  },
  tomato: {
    commonName: "Tomato Plant",
    family: "Solanaceae (Nightshade Family)",
    nativeRegion: "South America & Mesoamerica",
    growthHabit: "Indeterminate / Bushy Vine",
    leafType: "Compound Odd-Pinnate with Serrated Margins",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "6.0 - 6.8 (Slightly Acidic)",
    waterNeed: "1.5 - 2 inches per week",
    temperature: "21°C - 29°C (Optimal daytime range)",
    fertilizer: "NPK 5-10-10 (High Phosphorus for bloom & fruiting)",
    micronutrients: "Calcium (prevents blossom end rot) & Magnesium",
    commonDiseases: ["Early Blight", "Late Blight", "Bacterial Spot", "Leaf Mold"],
    commonPests: ["Fruit Borer (Helicoverpa)", "Whiteflies", "Leafminer"]
  },
  corn: {
    commonName: "Corn / Maize Crop",
    family: "Poaceae (Cereal Grain Crop)",
    nativeRegion: "Mesoamerica (Southern Mexico)",
    growthHabit: "Tall Annual Grass Cereal",
    leafType: "Long Linear Parallel-Veined Blade Leaf",
    sunlight: "Full Direct Sun (8+ hours daily)",
    soilpH: "5.8 - 7.0",
    waterNeed: "1.5 inches per week (Critical during silking)",
    temperature: "20°C - 32°C",
    fertilizer: "NPK 20-10-10 (High Nitrogen for heavy foliage & kernel fill)",
    micronutrients: "Zinc & Manganese",
    commonDiseases: ["Common Rust", "Northern Corn Leaf Blight", "Gray Leaf Spot"],
    commonPests: ["Fall Armyworm", "Stem Borer", "Corn Earworm"]
  },
  potato: {
    commonName: "Potato Plant",
    family: "Solanaceae (Tuberous Nightshade)",
    nativeRegion: "Andean Region of South America",
    growthHabit: "Underground Stolon Tuberous Herb",
    leafType: "Pinnately Compound Leaves",
    sunlight: "Full Sun (6 hours daily)",
    soilpH: "5.0 - 6.5 (Acidic to neutral)",
    waterNeed: "1 to 2 inches per week",
    temperature: "15°C - 20°C (Cool climate tuber formation)",
    fertilizer: "NPK 5-10-10 or 10-20-20 (High Potash for tuber swelling)",
    micronutrients: "Magnesium & Boron",
    commonDiseases: ["Late Blight", "Early Blight", "Black Scurf"],
    commonPests: ["Potato Tuber Moth", "Aphids"]
  },
  grape: {
    commonName: "Grapevine",
    family: "Vitaceae (Woody Fruit Vine)",
    nativeRegion: "Mediterranean & Caspian Sea Region",
    growthHabit: "Woody Climbing Vine with Tendrils",
    leafType: "Palmate Lobed Leaves with Serrated Margins",
    sunlight: "Full Sun (7 to 8 hours daily)",
    soilpH: "6.0 - 7.0",
    waterNeed: "Low to Moderate (Drip irrigation)",
    temperature: "15°C - 35°C",
    fertilizer: "NPK 10-10-20 (Potassium rich for berry sugar content)",
    micronutrients: "Iron & Zinc foliar spray",
    commonDiseases: ["Powdery Mildew", "Downy Mildew", "Black Rot", "Anthracnose"],
    commonPests: ["Thrips", "Flea Beetle", "Mealybug"]
  },
  apple: {
    commonName: "Apple Tree",
    family: "Rosaceae (Fruit Orchard Crop)",
    nativeRegion: "Central Asia (Tian Shan Mountains)",
    growthHabit: "Deciduous Fruit Tree",
    leafType: "Simple Oval Serrated Leaves",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "6.0 - 7.0",
    waterNeed: "1 to 1.5 inches per week",
    temperature: "Chilling winter requirement + 20°C - 28°C summer",
    fertilizer: "Balanced NPK 10-10-10",
    micronutrients: "Boron (fruit set) & Zinc",
    commonDiseases: ["Apple Scab", "Cedar Apple Rust", "Fire Blight"],
    commonPests: ["Codling Moth", "Woolly Aphid", "San Jose Scale"]
  },
  chilli: {
    commonName: "Chilli Plant",
    family: "Solanaceae (Nightshade Family)",
    nativeRegion: "Central & South America",
    growthHabit: "Branching Herbaceous Shrub",
    leafType: "Simple Ovate Leaves with Smooth Margins",
    sunlight: "Full Sunlight (6 to 8 hours daily)",
    soilpH: "6.0 - 7.5 (Well-drained Sandy Loam)",
    waterNeed: "Moderate (Avoid waterlogging, drip preferred)",
    temperature: "20°C - 35°C (Warm tropical climate)",
    fertilizer: "NPK 120:60:60 kg/ha with Potash split at flowering",
    micronutrients: "Zinc, Boron & Calcium foliar nutrition",
    commonDiseases: ["Chilli Leaf Spot (Cercospora)", "Anthracnose / Dieback", "Leaf Curl Virus"],
    commonPests: ["Chilli Thrips", "Yellow Mites", "Aphids"]
  },
  capsicum: {
    commonName: "Capsicum Frutescens Crop",
    scientificName: "Capsicum frutescens",
    genus: "Capsicum",
    species: "frutescens",
    family: "Solanaceae (Nightshade Family)",
    identifiedType: "Crop",
    nativeRegion: "Tropical Americas (Naturalized & cultivated across Southern India)",
    growthHabit: "Perennial branching subshrub (0.5 to 1.5 m)",
    leafType: "Simple ovate-elliptic deep green leaves with acute apex and entire margins",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "6.0 - 6.8 (Well-drained Fertile Sandy Loam or Red Loam)",
    suitableSoilType: "Well-drained sandy loam or fertile red loam (pH 6.0 - 6.8) with high organic matter, excellent aeration, and non-waterlogging drainage",
    idealWeatherClimate: "Warm tropical & semi-arid climate, 20°C - 35°C optimal temperature, 600 - 1200 mm annual rainfall, and Full Sun (6 to 8 hours daily)",
    waterNeed: "Moderate regular watering (drip irrigation preferred; avoid waterlogging)",
    temperature: "20°C - 35°C (Warm tropical climate)",
    fertilizer: "NPK 120:60:60 kg/ha split application + vermicompost and neem cake",
    micronutrients: "Zinc, Boron & Calcium foliar nutrition",
    description: "Capsicum frutescens is a perennial shrub in the nightshade family (Solanaceae), commonly recognized as bird's eye chilli, wild chilli, or kanthari chilli. It typically develops into a compact, heavily branched subshrub reaching heights of 0.5 to 1.5 meters under favorable agronomic conditions. The foliage exhibits ovate-elliptic, smooth, and vibrant deep-green leaves with entire margins. Its flowers display solitary or paired greenish-white corollas with erect pedicels that face upward. The resulting berries are conical or oblong-lanceolate, point vertically towards the sky, and ripen from pale green to vibrant scarlet-red. Originating from tropical America, it is widely naturalized and cultivated across southern India, especially in Andhra Pradesh, Kerala, and Tamil Nadu homestead farms. The fruits contain exceptionally high concentrations of capsaicin, providing extreme pungency and valuable oleoresin yields. The plant is drought resilient once established, thrives in warm humid agro-climates, and produces continuous flushes over multiple seasons.",
    primaryUseImpact: "Cultivated commercial food crop, therapeutic medicinal spice herb (capsaicin-rich topical analgesic), and natural organic pest repellent.",
    commonDiseases: ["Anthracnose / Fruit Rot", "Cercospora Leaf Spot", "Chilli Leaf Curl Virus", "Bacterial Wilt"],
    commonPests: ["Chilli Thrips (Scirtothrips dorsalis)", "Yellow Mites", "Aphids", "Fruit Borer"]
  }
};

const PLANT_KNOWLEDGE_BASE = {
  ...BASE_CROPS_KNOWLEDGE,
  ...ANDHRA_BOTANICAL_BASE
};

// Client-side localized dictionary for instant vernacular rendering upon language switch
const AGRONOMIC_LOCALIZATIONS = {
  en: {
    sunlight: {
      "full sun": "Full Sun (6 to 8 hours daily)",
      "partial shade": "Partial Shade (3 to 5 hours sunlight)",
      "full direct sun": "Direct Full Sun (8+ hours daily)"
    },
    watering: {
      "moderate": "Moderate Agricultural Irrigation",
      "high": "High Moisture & Frequent Irrigation",
      "low": "Low Water Requirement (Drought Resilient)",
      "drought": "High Drought Resilient Flora"
    },
    soil: {
      "loam": "Fertile Loamy / Red Soil (pH 6.0 - 7.2)",
      "clay": "Moisture-Retentive Heavy Clay Soil (pH 5.5 - 6.5)",
      "sandy": "Light Well-Drained Sandy Soil"
    },
    organs: {
      leaf: "🍃 Leaf Organ",
      flower: "🌸 Flower Organ",
      fruit: "🍎 Fruit Organ",
      bark: "🪵 Bark Organ"
    },
    categories: {
      weed: "🚨 Agricultural Weed",
      tree: "🌳 Tree Species",
      crop: "🌾 Agricultural Crop / Flora"
    },
    ui: {
      speciesMatch: "Species Match",
      confidence: "Identification Confidence",
      inferenceTime: "Inference Time",
      listenVoice: "Listen Summary",
      stopVoice: "Stop Voice",
      overview: "Plant Overview & Agronomic Importance",
      showMore: "Read Full Overview ↓",
      showLess: "Show Less ↑",
      careMatrix: "Agronomic Growth Parameters",
      sunlightTitle: "Sunlight Exposure",
      wateringTitle: "Irrigation & Moisture",
      soilTitle: "Suitable Soil Type",
      tempTitle: "Ideal Weather & Climate",
      taxonomy: "Scientific Classification & Morphology",
      genus: "Genus",
      species: "Species",
      family: "Botanical Family",
      foliage: "Foliage Morphology",
      growthHabit: "Growth Habit",
      nativeRegion: "Native Origin",
      nutrition: "Fertilizer Recommendation & Soil Nutrition",
      recommendedBlend: "Recommended Macronutrient Formula (NPK)",
      essentialMicro: "Essential Micronutrients & Soil Amenders",
      vigilance: "Agricultural Vigilance & Crop Protection",
      commonDiseases: "Vulnerable Crop Diseases",
      commonPests: "Common Destructive Pests",
      weedTitle: "Agricultural Weed Management & Eradication",
      weedPriority: "Crop Protection Priority",
      chemicalControl: "Chemical Control (Herbicides)",
      culturalControl: "Cultural & Manual Eradication",
      scanAnother: "Scan Another Plant",
      checkDisease: "Diagnose Crop Disease →",
      switchLanguage: "Language",
      copyMarkdown: "Copy Markdown Report",
      reportCopied: "Report Copied!"
    }
  },
  te: {
    sunlight: {
      "full sun": "పూర్తి సూర్యరశ్మి (రోజూ 6 నుండి 8 గంటలు)",
      "partial shade": "పాక్షిక నీడ (3 నుండి 5 గంటల ఎండ)",
      "full direct sun": "నేరుగా పూర్తి ఎండ (8+ గంటలు)"
    },
    watering: {
      "moderate": "మితమైన వ్యవసాయ నీటిపారుదల",
      "high": "అధిక తేమ & తరచుగా నీటిపారుదల",
      "low": "తక్కువ నీటి అవసరం (కరువును తట్టుకోగలదు)",
      "drought": "అధిక కరువు తట్టుకునే పంట"
    },
    soil: {
      "loam": "సారవంతమైన గరప / ఎర్ర నేల (pH 6.0 - 7.2)",
      "clay": "తేమను నిలిపి ఉంచే నల్లరేగడి నేల (pH 6.5 - 7.5)",
      "sandy": "తేలికపాటి ఇసుక నేల"
    },
    organs: {
      leaf: "🍃 ఆకు అవయవం",
      flower: "🌸 పువ్వు అవయవం",
      fruit: "🍎 పండు / కాయ అవయవం",
      bark: "🪵 బెరడు అవయవం"
    },
    categories: {
      weed: "🚨 కలుపు మొక్క (Agricultural Weed)",
      tree: "🌳 పెద్ద చెట్టు / వృక్ష జాతి",
      crop: "🌾 వ్యవసాయ పంట / మొక్క"
    },
    ui: {
      speciesMatch: "జాతి నిర్ధారణ",
      confidence: "ఖచ్చితత్వ శాతం",
      inferenceTime: "విశ్లేషణ సమయం",
      listenVoice: "సారాంశం వినండి",
      stopVoice: "వాయిస్ ఆపండి",
      overview: "మొక్క అవలోకనం & వ్యవసాయ ప్రాముఖ్యత",
      showMore: "పూర్తి వివరణ చదవండి ↓",
      showLess: "తక్కువగా చూపించండి ↑",
      careMatrix: "సాగు పరిస్థితులు & సంరక్షణ మార్గదర్శిని",
      sunlightTitle: "సూర్యరశ్మి అవసరం",
      wateringTitle: "నీటిపారుదల అవసరం",
      soilTitle: "నేల రకం & అనుకూల pH",
      tempTitle: "వాతావరణ ఉష్ణోగ్రత",
      taxonomy: "శాస్త్రీయ వర్గీకరణ & నిర్మాణం",
      genus: "ప్రజాతి (Genus)",
      species: "జాతి (Species)",
      family: "వృక్ష కుటుంబం (Family)",
      foliage: "ఆకు లక్షణాలు (Morphology)",
      growthHabit: "పెరుగుదల తీరు",
      nativeRegion: "స్థానిక మూలం",
      nutrition: "ఎరువుల సిఫార్సు & పోషక యాజమాన్యం",
      npkBlend: "సిఫార్సు చేసిన NPK మోతాదు",
      micronutrients: "అవసరమైన సూక్ష్మపోషకాలు",
      vigilance: "తెగుళ్లు & కీటకాల నిఘా",
      commonDiseases: "సోకే ప్రధాన తెగుళ్లు",
      commonPests: "ఆశించే కీటకాలు & పురుగులు",
      weedTitle: "కలుపు నిర్మూలన సమగ్ర మార్గదర్శిని",
      weedPriority: "పంట రక్షణ ప్రాధాన్యత",
      chemicalControl: "రసాయన నియంత్రణ (Herbicides)",
      culturalControl: "సేంద్రీయ & యాంత్రిక నివారణ",
      scanAnother: "మరో మొక్కను స్కాన్ చేయండి",
      checkDisease: "ఈ పంటపై తెగుళ్ల పరీక్ష చేయండి",
      switchLanguage: "భాష ఎంచుకోండి"
    }
  },
  ta: {
    sunlight: {
      "full sun": "முழு சூரிய ஒளி (தினமும் 6 முதல் 8 மணி நேரம்)",
      "partial shade": "பகுதி நிழல் (3 முதல் 5 மணி நேர வெயில்)",
      "full direct sun": "நேரடி முழு சூரிய ஒளி (8+ மணி நேரம்)"
    },
    watering: {
      "moderate": "மிதமான விவசாய பாசனம்",
      "high": "அதிக ஈரப்பதம் & வழக்கமான பாசனம்",
      "low": "குறைந்த நீர் தேவை (வறட்சியைத் தாங்கும்)",
      "drought": "வறட்சியைத் தாங்கும் பயிர்"
    },
    soil: {
      "loam": "நல்ல வடிகால் வசதியுள்ள வளமான வண்டல் மண் (pH 6.0 - 7.2)",
      "clay": "ஈரப்பதம் காக்கும் களிமண் (pH 6.5 - 7.5)",
      "sandy": "மணற்பாங்கான மண்"
    },
    organs: {
      leaf: "🍃 இலை உறுப்பு",
      flower: "🌸 மலர் உறுப்பு",
      fruit: "🍎 காய் / பழ உறுப்பு",
      bark: "🪵 மரப்பட்டை உறுப்பு"
    },
    categories: {
      weed: "🚨 விவசாய களைச்செடி (Agricultural Weed)",
      tree: "🌳 மர இனம் (Tree Species)",
      crop: "🌾 விவசாய பயிர் / தாவரம்"
    },
    ui: {
      speciesMatch: "இன பொருத்தம்",
      confidence: "துல்லியத்தன்மை",
      inferenceTime: "கணிப்பு வேகம்",
      listenVoice: "சுருக்கம் கேளுங்கள்",
      stopVoice: "குரலை நிறுத்துங்கள்",
      overview: "தாவர கண்ணோட்டம் & வேளாண் பயன்பாடு",
      showMore: "முழு விளக்கத்தையும் காண்க ↓",
      showLess: "சுருக்கமாகக் காட்டு ↑",
      careMatrix: "வளர்ப்பு & சாகுபடி வழிகாட்டி",
      sunlightTitle: "சூரிய ஒளி தேவை",
      wateringTitle: "நீர்ப்பாசனத் தேவை",
      soilTitle: "மண் வகை & உகந்த pH",
      tempTitle: "காலநிலை வெப்பநிலை",
      taxonomy: "அறிவியல் வகைப்பாடு & அமைப்பு",
      genus: "பேரினம் (Genus)",
      species: "சிற்றினம் (Species)",
      family: "தாவர குடும்பம் (Family)",
      foliage: "இலை அமைப்பு (Morphology)",
      growthHabit: "வளரும் விதம்",
      nativeRegion: "தாயகம்",
      nutrition: "உர பரிந்துரை & ஊட்டச்சத்து",
      npkBlend: "பரிந்துரைக்கப்பட்ட NPK விகிதம்",
      micronutrients: "அவசிய நுண்ணூட்டச்சத்துக்கள்",
      vigilance: "நோய்கள் & பூச்சிகள் கண்காணிப்பு",
      commonDiseases: "தாக்கும் பொதுவான நோய்கள்",
      commonPests: "பொதுவான பூச்சிகள்",
      weedTitle: "களை மேலாண்மை & அழிப்பு வழிகாட்டி",
      weedPriority: "பயிர் பாதுகாப்பு முன்னுரிமை",
      chemicalControl: "இரசாயன கட்டுப்பாடு (Herbicides)",
      culturalControl: "உழவியல் & கைக்களை முறை",
      scanAnother: "மற்றொரு தாவரத்தை ஸ்கேன் செய்",
      checkDisease: "இந்த பயிரில் நோய் சோதனை செய்",
      switchLanguage: "மொழியைத் தேர்வு செய்க"
    }
  },
  hi: {
    sunlight: {
      "full sun": "पूर्ण धूप (प्रतिदिन 6 से 8 घंटे)",
      "partial shade": "आंशिक छाया (3 से 5 घंटे धूप)",
      "full direct sun": "सीधी पूर्ण धूप (8+ घंटे)"
    },
    watering: {
      "moderate": "मध्यम कृषि सिंचाई",
      "high": "अधिक नमी और नियमित सिंचाई",
      "low": "कम पानी की आवश्यकता (सूखा प्रतिरोधी)",
      "drought": "सूखा सहनशील फसल"
    },
    soil: {
      "loam": "अच्छी जल निकासी वाली उपजाऊ दोमट मिट्टी (pH 6.0 - 7.2)",
      "clay": "नमी धारण करने वाली चिकनी मिट्टी (pH 6.5 - 7.5)",
      "sandy": "बलुई दोमट मिट्टी"
    },
    organs: {
      leaf: "🍃 पत्ती अंग",
      flower: "🌸 फूल अंग",
      fruit: "🍎 फल अंग",
      bark: "🪵 छाल अंग"
    },
    categories: {
      weed: "🚨 कृषि खरपतवार (Agricultural Weed)",
      tree: "🌳 वृक्ष प्रजाति (Tree Species)",
      crop: "🌾 कृषि फसल / पौधा"
    },
    ui: {
      speciesMatch: "प्रजाति पहचान",
      confidence: "सटीकता प्रतिशत",
      inferenceTime: "विश्लेषण समय",
      listenVoice: "सारांश सुनें",
      stopVoice: "आवाज रोकें",
      overview: "पौधे का अवलोकन एवं कृषि महत्व",
      showMore: "पूरा विवरण पढ़ें ↓",
      showLess: "कम दिखाएं ↑",
      careMatrix: "खेती एवं देखभाल की स्थितियां",
      sunlightTitle: "धूप की आवश्यकता",
      wateringTitle: "सिंचाई आवश्यकता",
      soilTitle: "मिट्टी का प्रकार और पीएच",
      tempTitle: "मौसम का तापमान",
      taxonomy: "वैज्ञानिक वर्गीकरण एवं संरचना",
      genus: "वंश (Genus)",
      species: "प्रजाति (Species)",
      family: "वनस्पति कुल (Family)",
      foliage: "पत्ती का स्वरूप (Morphology)",
      growthHabit: "वृद्धि का स्वभाव",
      nativeRegion: "मूल निवास",
      nutrition: "उर्वरक सिफारिश एवं पोषण",
      npkBlend: "अनुशंसित एनपीके मिश्रण",
      micronutrients: "आवश्यक सूक्ष्म पोषक तत्व",
      vigilance: "रोग एवं कीट सतर्कता",
      commonDiseases: "प्रमुख रोग",
      commonPests: "प्रमुख कीट",
      weedTitle: "खरपतवार प्रबंधन एवं नियंत्रण गाइड",
      weedPriority: "फसल सुरक्षा प्राथमिकता",
      chemicalControl: "रासायनिक नियंत्रण (शाकनाशी)",
      culturalControl: "जैविक एवं यांत्रिक निराई",
      scanAnother: "अन्य पौधे को स्कैन करें",
      checkDisease: "इस फसल की बीमारी जांचें",
      switchLanguage: "भाषा चुनें"
    }
  }
};

const SCIENTIFIC_NAME_TO_CROP_KEY = {
  'oryza sativa': 'rice',
  'oryza': 'rice',
  'paddy': 'rice',
  'rice': 'rice',
  'vari': 'rice',
  'solanum lycopersicum': 'tomato',
  'lycopersicon esculentum': 'tomato',
  'tomato': 'tomato',
  'solanum tuberosum': 'potato',
  'potato': 'potato',
  'capsicum annuum': 'chilli',
  'capsicum frutescens': 'capsicum',
  'capsicum': 'chilli',
  'chilli': 'chilli',
  'mirapa': 'chilli',
  'zea mays': 'corn',
  'corn': 'corn',
  'maize': 'corn',
  'gossypium hirsutum': 'cotton',
  'gossypium': 'cotton',
  'cotton': 'cotton',
  'patti': 'cotton',
  'saccharum officinarum': 'sugarcane',
  'sugarcane': 'sugarcane',
  'triticum aestivum': 'wheat',
  'wheat': 'wheat',
  'mangifera indica': 'mango',
  'mango': 'mango',
  'allium cepa': 'onion',
  'onion': 'onion',
  'parthenium hysterophorus': 'parthenium',
  'cyperus rotundus': 'nut_grass',
  'cynodon dactylon': 'bermuda_grass'
};

const getPlantDetails = (liveResult) => {
  if (!liveResult) {
    return PLANT_KNOWLEDGE_BASE["rice"] || PLANT_KNOWLEDGE_BASE["onion"];
  }

  const rawCrop = (liveResult.crop_name || liveResult.raw_label || liveResult.prediction || "").toLowerCase();
  const rawLabel = (liveResult.raw_label || "").toLowerCase();
  const textSearch = `${rawCrop} ${rawLabel}`.trim();

  // Structured API output from /api/identify-plant
  if (liveResult && liveResult.plant) {
    const p = liveResult.plant;
    const conf = liveResult.confidence 
      ? (liveResult.confidence <= 1.0 ? (liveResult.confidence * 100).toFixed(1) : Number(liveResult.confidence).toFixed(1)) + "%" 
      : "98.2%";
    const sciName = p.scientific_name || "";
    const sciLower = sciName.toLowerCase();
    const genus = p.genus || (sciName ? sciName.split(' ')[0] : "Botanical Genus");
    const species = p.species || (sciName ? sciName.split(' ').slice(1).join(' ') : "spp.");
    const isWeed = Boolean(p.is_weed || liveResult.is_weed || (p.category && p.category.toLowerCase().includes('weed')));
    const rawType = (p.identified_type || p.category || (isWeed ? "Weed" : "Crop")).trim();
    let identifiedType = "Crop";
    if (isWeed || rawType.toLowerCase().includes('weed')) identifiedType = "Weed";
    else if (rawType.toLowerCase().includes('tree') || p.is_tree || liveResult.plant_type === 'tree') identifiedType = "Tree";
    else if (rawType.toLowerCase().includes('medicinal')) identifiedType = "Medicinal Plant";
    else if (rawType.toLowerCase().includes('ornamental')) identifiedType = "Ornamental";
    else if (rawType.toLowerCase().includes('crop')) identifiedType = "Crop";
    else identifiedType = rawType;

    // Check if scientific name or label matches rich local botanical knowledge
    const mappedCropKey = SCIENTIFIC_NAME_TO_CROP_KEY[sciLower] ||
      Object.keys(SCIENTIFIC_NAME_TO_CROP_KEY).find(k => sciLower.includes(k) || textSearch.includes(k));
    const kbCrop = mappedCropKey ? (PLANT_KNOWLEDGE_BASE[SCIENTIFIC_NAME_TO_CROP_KEY[mappedCropKey] || mappedCropKey] || null) : null;

    const commonName = (p.common_name && p.common_name !== sciName && !p.common_name.toLowerCase().includes('specimen'))
      ? p.common_name
      : (kbCrop?.commonName || p.common_name || "Identified Plant");

    const description = (p.description && p.description.length > 70 && !p.description.startsWith('Identified agricultural crop') && !p.description.startsWith('Identified agricultural weed'))
      ? p.description
      : (kbCrop?.description || p.description || `${commonName} is an important agricultural plant species.`);

    const primaryUse = (p.primary_use_impact && !p.primary_use_impact.startsWith('Identified'))
      ? p.primary_use_impact
      : (kbCrop?.primaryUseImpact || (isWeed ? "Invasive agricultural weed requiring active field eradication." : "Cultivated agricultural food crop and beneficial economic plant."));

    const suitableSoil = p.suitable_soil_type || kbCrop?.suitableSoilType || p.soil_type || kbCrop?.soilpH || "Well-drained fertile loamy soil (pH 6.0 - 7.0)";
    const idealWeather = p.ideal_weather_climate || kbCrop?.idealWeatherClimate || `${p.temperature_range || kbCrop?.temperature || "20°C - 35°C"}, ${p.sunlight_requirement || kbCrop?.sunlight || "Full Sun (6 to 8 hours daily)"}`;
    const family = (p.family && p.family !== "Botanical Family") ? p.family : (kbCrop?.family || "Poaceae");

    return {
      commonName: commonName,
      scientificName: sciName,
      genus: genus,
      species: species,
      regionalNames: p.regional_names || kbCrop?.regional_names || {},
      family: family,
      category: p.category || (isWeed ? "Agricultural Weed" : "Plant Species"),
      identifiedType: identifiedType,
      isWeed: isWeed,
      nativeRegion: p.native_region || kbCrop?.nativeRegion || "Global & Indian Subcontinent",
      confidence: conf,
      growthHabit: p.growth_stage || p.growth_habit || kbCrop?.growthHabit || "Active Growth / Foliage",
      leafType: p.leaf_type || kbCrop?.leafType || "Standard Foliage Leaf",
      description: description,
      primaryUseImpact: primaryUse,
      sunlight: p.sunlight_requirement || kbCrop?.sunlight || "Full Sun (6 to 8 hours daily)",
      soilpH: p.soil_type || kbCrop?.soilpH || "Well-drained Fertile Soil (pH 6.0 - 7.2)",
      suitableSoilType: suitableSoil,
      idealWeatherClimate: idealWeather,
      waterNeed: p.water_requirement || kbCrop?.waterNeed || "Moderate Agricultural Irrigation",
      temperature: p.temperature_range || kbCrop?.temperature || "18°C - 35°C",
      fertilizer: p.fertilizer_recommendation || kbCrop?.fertilizer || "Balanced Organic Compost & Recommended NPK",
      micronutrients: p.micronutrients || kbCrop?.micronutrients || "Essential Plant Micronutrients (Zinc, Boron, Iron)",
      commonUses: p.common_uses || kbCrop?.common_uses || [],
      commonDiseases: (p.common_diseases && p.common_diseases.length > 2) ? p.common_diseases : (kbCrop?.commonDiseases || ["Rice Blast", "Leaf Spot"]),
      commonPests: (p.common_pests && p.common_pests.length > 2) ? p.common_pests : (kbCrop?.commonPests || ["Stem Borer", "Aphids"]),
      weedEradication: p.weed_eradication_advice || "",
      economicImportance: p.economic_importance || kbCrop?.economic_importance || "",
      organ: liveResult.organ || "leaf",
      source: liveResult.source || "online",
      model: liveResult.model || (liveResult.source === 'plantnet_botanical_ai' ? 'Pl@ntNet Global Flora AI (300,000+ Species)' : liveResult.source === 'gemini_vision_ai' ? 'Google Gemini Multimodal Vision AI' : 'PyTorch Botanical Vision'),
      translations: p.translations || liveResult.translations || {}
    };
  }

  // Check scientific alias map first in fallback mode
  const aliasMatch = Object.keys(SCIENTIFIC_NAME_TO_CROP_KEY).find(k => textSearch.includes(k));
  if (aliasMatch) {
    const kbKey = SCIENTIFIC_NAME_TO_CROP_KEY[aliasMatch];
    if (PLANT_KNOWLEDGE_BASE[kbKey]) {
      const match = { ...PLANT_KNOWLEDGE_BASE[kbKey] };
      if (liveResult.confidence) {
        match.confidence = (liveResult.confidence <= 1.0 ? liveResult.confidence * 100 : liveResult.confidence).toFixed(1) + "%";
      }
      match.identifiedType = match.identifiedType || (match.isWeed ? "Weed" : (match.category?.includes('Tree') ? "Tree" : "Crop"));
      match.primaryUseImpact = match.primaryUseImpact || (match.isWeed ? "Invasive weed requiring control." : "Cultivated agricultural food crop.");
      match.suitableSoilType = match.suitableSoilType || match.soilpH || "Well-drained fertile loam (pH 6.0 - 7.0)";
      match.idealWeatherClimate = match.idealWeatherClimate || `${match.temperature || "20°C - 35°C"}, ${match.sunlight || "Full Sun"}`;
      return match;
    }
  }

  // Check matching key in knowledge base
  for (const key of Object.keys(PLANT_KNOWLEDGE_BASE)) {
    if (textSearch.includes(key)) {
      const match = { ...PLANT_KNOWLEDGE_BASE[key] };
      if (liveResult.confidence) {
        match.confidence = (liveResult.confidence <= 1.0 ? liveResult.confidence * 100 : liveResult.confidence).toFixed(1) + "%";
      }
      match.identifiedType = match.identifiedType || (match.isWeed ? "Weed" : (match.category?.includes('Tree') ? "Tree" : "Crop"));
      match.primaryUseImpact = match.primaryUseImpact || (match.isWeed ? "Invasive weed requiring control." : "Cultivated agricultural food crop.");
      match.suitableSoilType = match.suitableSoilType || match.soilpH || "Well-drained fertile loam (pH 6.0 - 7.0)";
      match.idealWeatherClimate = match.idealWeatherClimate || `${match.temperature || "20°C - 35°C"}, ${match.sunlight || "Full Sun"}`;
      return match;
    }
  }

  // Dynamic fallback for agricultural specimens
  let cropTitle = liveResult.crop_name || "Identified Crop";
  if (cropTitle.toLowerCase().includes("pepper") || cropTitle.toLowerCase().includes("bell")) {
    cropTitle = "Bell Pepper";
  }

  const confidenceStr = liveResult.confidence 
    ? (liveResult.confidence <= 1.0 ? liveResult.confidence * 100 : liveResult.confidence).toFixed(1) + "%"
    : "97.8%";

  return {
    commonName: `${cropTitle} Crop`,
    scientificName: `${cropTitle} spp.`,
    genus: cropTitle,
    species: "cultivar",
    regionalNames: {
      te: translateCrop(cropTitle, 'te'),
      hi: translateCrop(cropTitle, 'hi'),
      ta: translateCrop(cropTitle, 'ta'),
      kn: translateCrop(cropTitle, 'kn'),
      ml: translateCrop(cropTitle, 'ml'),
      mr: translateCrop(cropTitle, 'mr'),
      gu: translateCrop(cropTitle, 'gu'),
      pa: translateCrop(cropTitle, 'pa'),
      bn: translateCrop(cropTitle, 'bn')
    },
    family: `${cropTitle} Botanical Family`,
    identifiedType: "Crop",
    primaryUseImpact: "Cultivated agricultural food crop.",
    suitableSoilType: "Well-drained fertile loam (pH 6.0 - 7.0)",
    idealWeatherClimate: "Warm tropical to temperate climate (18°C - 28°C, Full Sun)",
    nativeRegion: "Global Agricultural Cultivation",
    confidence: confidenceStr,
    growthHabit: "Agricultural Crop / Cultivar",
    leafType: "Standard Foliage Leaf",
    sunlight: "Full Sun (6 to 8 hours daily)",
    soilpH: "6.0 - 7.0 (Optimal neutral range)",
    waterNeed: "Moderate Agricultural Irrigation",
    temperature: "18°C - 28°C (Optimal climate)",
    fertilizer: "Balanced Organic NPK 10-10-10 Crop Fertilizer",
    micronutrients: "Essential Trace Elements (Iron, Zinc, Boron)",
    commonDiseases: ["Foliar Blight", "Leaf Spot"],
    commonPests: ["Aphids", "Thrips"],
    translations: {}
  };
};

const PlantIdResults = ({ liveResult, data, onScanAnother, onCheckDisease }) => {
  const { t, i18n } = useTranslation();
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();

  const currentLang = (i18n.language ? i18n.language.split('-')[0] : 'en').toLowerCase();
  // Tab-isolated language state: persists within this tab without mutating global website
  const [activeLang, setActiveLang] = useState(() => {
    return sessionStorage.getItem('agrishield_tab_lang_plant') || currentLang || 'en';
  });
  const [translatedCache, setTranslatedCache] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const rawInfo = useMemo(() => data || getPlantDetails(liveResult), [data, liveResult]);

  // Merge pre-loaded translations from backend payload
  useEffect(() => {
    if (rawInfo?.translations && typeof rawInfo.translations === 'object') {
      setTranslatedCache(prev => ({ ...prev, ...rawInfo.translations }));
    }
  }, [rawInfo]);

  // Request on-demand translation if user switches to a language not yet in cache
  useEffect(() => {
    if (activeLang === 'en') return;
    if (translatedCache[activeLang]) return;

    let isMounted = true;
    const fetchTranslation = async () => {
      setIsTranslating(true);
      try {
        const res = await API.post('/api/translate-plant', {
          plant: rawInfo,
          language: activeLang
        });
        if (isMounted && res.data?.success && res.data?.plant) {
          setTranslatedCache(prev => ({
            ...prev,
            [activeLang]: res.data.plant
          }));
        }
      } catch (err) {
        console.warn("On-demand plant translation failed:", err);
      } finally {
        if (isMounted) setIsTranslating(false);
      }
    };

    fetchTranslation();
    return () => { isMounted = false; };
  }, [activeLang, rawInfo, translatedCache]);

  // Active localized plant details (merges translated data + client-side dictionary)
  const info = useMemo(() => {
    const localizedOverride = translatedCache[activeLang] || {};
    const merged = { ...rawInfo, ...localizedOverride };

    // Resolve localized common name with high priority
    const cropMapped = translateCrop(rawInfo?.commonName || rawInfo?.genus || rawInfo?.crop_name, activeLang);
    const regional = rawInfo?.regionalNames?.[activeLang];
    let resolvedName = null;
    if (cropMapped && cropMapped !== rawInfo?.commonName && cropMapped !== 'Crop Specimen') {
      resolvedName = cropMapped;
    } else if (regional && !regional.includes('Crop')) {
      resolvedName = regional;
    } else if (localizedOverride?.common_name || localizedOverride?.commonName) {
      resolvedName = localizedOverride?.common_name || localizedOverride?.commonName;
    } else {
      resolvedName = rawInfo?.commonName || 'Plant Specimen';
    }
    const finalCommonName = resolvedName;

    return {
      ...merged,
      commonName: finalCommonName
    };
  }, [rawInfo, translatedCache, activeLang]);

  // Localized UI strings
  const locDict = AGRONOMIC_LOCALIZATIONS[activeLang] || AGRONOMIC_LOCALIZATIONS.en || AGRONOMIC_LOCALIZATIONS.te;
  const locUI = locDict?.ui || {};

  // Speech reader helper
  const speechInfo = { ...info, commonName: info.commonName };
  const fullSpeciesSummary = buildPlantSpeech(speechInfo, activeLang, 'summary');

  const handleLanguageSelect = (langCode) => {
    const clean = (langCode || 'en').split('-')[0].toLowerCase();
    setActiveLang(clean);
    sessionStorage.setItem('agrishield_tab_lang_plant', clean);
    // Explicitly isolated to Plant ID tab: does NOT mutate global website i18n
  };

  const handleScanAnother = () => {
    if (onScanAnother) {
      onScanAnother();
    } else {
      window.dispatchEvent(new CustomEvent('agrishield-scan-another'));
    }
  };

  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const generateMarkdownReport = () => {
    const identifiedType = info.identifiedType || (info.isWeed ? 'Weed' : (info.isTree ? 'Tree' : 'Crop'));
    const commonName = info.commonName || 'Plant Specimen';
    const botanicalName = info.scientificName || 'Botanical classification';
    const family = info.family || 'Botanical Family';
    const description = info.description || `${commonName} is a botanical specimen belonging to the ${family} family.`;
    const primaryUse = info.primaryUseImpact || (info.isWeed ? 'An invasive agricultural weed requiring active field management and eradication.' : 'Cultivated agricultural food crop and beneficial economic plant.');
    const suitableSoil = info.suitableSoilType || info.soilpH || 'Well-drained fertile loamy soil (pH 6.0 - 7.0)';
    const idealWeather = info.idealWeatherClimate || `${info.temperature || '20°C - 35°C'}, Full Sun (6 to 8 hours daily)`;

    return `### 🌿 Plant Classification
- **Identified Type**: ${identifiedType}
- **Common Name**: ${commonName}
- **Botanical Name**: *${botanicalName}*
- **Family**: ${family}

### 📝 Description & Key Details
- **Description**: ${description}
- **Primary Use / Impact**: ${primaryUse}

### 🪵 Environmental Conditions
- **Suitable Soil Type**: ${suitableSoil}
- **Ideal Weather & Climate**: ${idealWeather}`;
  };

  const handleCopyMarkdown = async () => {
    try {
      const md = generateMarkdownReport();
      await navigator.clipboard.writeText(md);
      setCopiedMarkdown(true);
      setTimeout(() => setCopiedMarkdown(false), 2500);
    } catch (err) {
      console.error('Failed to copy markdown report:', err);
    }
  };

  // ==================== CARD 1: HERO SPECIMEN BANNER ====================
  const renderSpecimenHero = () => (
    <Card className="p-6 sm:p-8 bg-gradient-to-r from-teal-950 via-slate-900 to-slate-900 text-white border border-teal-500/20 shadow-2xl relative overflow-hidden rounded-3xl">
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-3 flex-1">
          {/* Top Badges Row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30 flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              {locUI.speciesMatch || 'Species Match'}
            </span>

            {/* Strict Identified Type Badge */}
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1.5 shadow-sm">
              <span>🌿</span>
              <span>{info.identifiedType || 'Crop'}</span>
            </span>

            {/* Category Badges (Crop / Tree / Weed / Medicinal) */}
            {info.isWeed ? (
              <span className="text-xs font-black text-rose-200 bg-rose-950/90 px-3 py-1 rounded-full border border-rose-500/50 flex items-center gap-1.5 shadow-sm animate-pulse">
                <span>🚨</span>
                <span>{locDict?.categories?.weed || 'Agricultural Weed'}</span>
              </span>
            ) : (info.category?.toLowerCase().includes('medicinal') || info.primaryUseImpact?.toLowerCase().includes('medicinal') || info.commonName?.toLowerCase().includes('neem') || info.commonName?.toLowerCase().includes('tulsi')) ? (
              <span className="text-xs font-black text-cyan-200 bg-cyan-950/90 px-3 py-1 rounded-full border border-cyan-500/50 flex items-center gap-1.5 shadow-sm">
                <span>💊</span>
                <span>Medicinal Plant</span>
              </span>
            ) : (info.isTree || info.category?.toLowerCase().includes('tree') || info.commonName?.toLowerCase().includes('tree') || liveResult?.plant_type === 'tree') ? (
              <span className="text-xs font-black text-emerald-300 bg-emerald-950/90 px-3 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                <span>🌳</span>
                <span>{locDict?.categories?.tree || 'Tree Species'}</span>
              </span>
            ) : (
              <span className="text-xs font-black text-amber-300 bg-amber-950/90 px-3 py-1 rounded-full border border-amber-500/40 flex items-center gap-1.5 shadow-sm">
                <span>🌾</span>
                <span>{locDict?.categories?.crop || 'Crop / Botanical Flora'}</span>
              </span>
            )}
          </div>

          {/* Specimen Titles */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-tight">
                {info.commonName}
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="glass"
                  size="sm"
                  onClick={() => speak(fullSpeciesSummary, 'plant_summary', activeLang)}
                  leftIcon={<Volume2 className={`w-4 h-4 ${speakingId === 'plant_summary' ? 'animate-bounce text-teal-300' : 'text-white'}`} />}
                  className="bg-teal-600/80 hover:bg-teal-500 text-white font-bold border-teal-400/40 shadow-sm rounded-xl cursor-pointer"
                >
                  {speakingId === 'plant_summary' ? (locUI.stopVoice || 'Stop Voice') : (locUI.listenVoice || 'Listen Summary')}
                </Button>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="Copy Strict Markdown Report"
                >
                  {copiedMarkdown ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 font-extrabold">Report Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copy Markdown Report</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {info.scientificName && (
              <p className="text-sm font-bold italic text-emerald-300 tracking-wide mt-1">
                {info.scientificName}
              </p>
            )}
          </div>

          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            <span className="font-bold text-teal-200">{info.family}</span> • {info.nativeRegion}
          </p>

          {/* Confidence Progress Meter */}
          <div className="pt-2 max-w-md">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-slate-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                {locUI.confidence || 'Identification Confidence'}
              </span>
              <span className="text-emerald-400 font-extrabold">{info.confidence || "98.4%"}</span>
            </div>
            <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-700">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700" 
                style={{ width: info.confidence || "98.4%" }}
              />
            </div>
          </div>
        </div>

        {/* Right Metrics Cards */}
        <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
          <div className="bg-emerald-500/20 border border-emerald-400/40 px-5 py-4 rounded-2xl backdrop-blur-md text-center min-w-[120px] shadow-lg shadow-emerald-950/40">
            <p className="text-[10px] text-emerald-300 font-black uppercase tracking-wider">{locUI.confidence || 'Confidence'}</p>
            <p className="font-display font-extrabold text-2xl sm:text-3xl text-emerald-400 mt-1">{info.confidence || "98.4%"}</p>
          </div>
          <div className="bg-white/10 border border-white/15 px-5 py-4 rounded-2xl backdrop-blur-md text-center min-w-[120px] shadow-lg">
            <p className="text-[10px] text-slate-300 font-black uppercase tracking-wider">{locUI.inferenceTime || 'Inference'}</p>
            <p className="font-display font-extrabold text-2xl sm:text-3xl text-sky-400 mt-1">
              {liveResult?.prediction_time_ms ? `${liveResult.prediction_time_ms.toFixed(1)} ms` : '42.1 ms'}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );

  // ==================== CARD 2: QUICK LANGUAGE SWITCHER BAR ====================
  const renderLanguageSwitcher = () => (
    <ScanLanguageBar
      activeLang={activeLang}
      onLanguageSelect={handleLanguageSelect}
      isTranslating={isTranslating}
      label={locUI.switchLanguage || 'Identification Language'}
      className="bg-slate-900/95 border-emerald-500/30"
    />
  );

  // ==================== CARD 3: SECTION 1 (PLANT CLASSIFICATION) ====================
  const renderPlantClassification = () => (
    <CollapsibleSection 
      title="🌿 Plant Classification" 
      icon={Sprout} 
      badge={info.identifiedType || "Botanical Profile"} 
      defaultOpen={true}
      onSpeak={() => {
        const text = buildPlantSpeech(speechInfo, activeLang, 'scientific');
        speak(text, 'plant_scientific', activeLang);
      }}
      isSpeaking={speakingId === 'plant_scientific'}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <span className="text-emerald-800 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-wider block mb-1">
            🏷️ Identified Type
          </span>
          <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
            {info.identifiedType || (info.isWeed ? 'Weed' : (info.isTree ? 'Tree' : 'Crop'))}
          </p>
        </div>
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <span className="text-emerald-800 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-wider block mb-1">
            🌾 Common Name
          </span>
          <p className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">{info.commonName}</p>
        </div>
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
          <span className="text-emerald-800 dark:text-emerald-400 font-bold uppercase text-[10px] tracking-wider block mb-1">
            🔬 Botanical Name
          </span>
          <p className="font-extrabold text-emerald-800 dark:text-emerald-300 text-sm italic">{info.scientificName}</p>
        </div>
        <div className="p-3.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <span className="text-slate-600 dark:text-slate-400 font-bold uppercase text-[10px] tracking-wider block mb-1">
            🌿 Family
          </span>
          <p className="font-bold text-slate-900 dark:text-slate-200 text-sm">{info.family}</p>
        </div>
      </div>
    </CollapsibleSection>
  );

  // ==================== CARD 3: SECTION 2 (DESCRIPTION & PRACTICAL IMPACT) ====================
  const renderDescriptionCard = () => (
    info.description ? (
      <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-400 font-bold text-sm uppercase tracking-wider">
            <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>📝 Description & Practical Farm Impact</span>
          </div>
          {info.identifiedType && (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-teal-50 dark:bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-400/30">
              {info.identifiedType}
            </span>
          )}
        </div>

        {/* Primary Use / Impact Callout */}
        <div className="mb-3.5 p-3.5 rounded-xl bg-teal-50/80 dark:bg-teal-950/60 border border-teal-200/80 dark:border-teal-500/30 text-xs">
          <span className="font-extrabold text-teal-800 dark:text-teal-300 uppercase text-[10px] tracking-wider block mb-1 flex items-center gap-1.5">
            <span>🌱</span>
            <span>Primary Use / Impact</span>
          </span>
          <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
            {info.primaryUseImpact || (info.isWeed ? 'Invasive agricultural weed requiring active field management and eradication.' : 'Cultivated agricultural food crop and beneficial economic plant.')}
          </p>
        </div>

        <div className="relative">
          <p className={`text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-normal ${!isDescriptionExpanded ? 'line-clamp-6' : ''}`}>
            {info.description}
          </p>
          {!isDescriptionExpanded && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-slate-900 to-transparent pointer-events-none" />
          )}
        </div>
        <div className="pt-3">
          <button
            type="button"
            onClick={() => setIsDescriptionExpanded(prev => !prev)}
            className="text-xs font-extrabold text-teal-700 dark:text-teal-400 hover:text-teal-600 dark:hover:text-teal-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            {isDescriptionExpanded ? (
              <><span>{locUI.showLess || 'Show Less ↑'}</span><ChevronUp className="w-4 h-4" /></>
            ) : (
              <><span>{locUI.showMore || 'Show More (Read Full Overview) ↓'}</span><ChevronDown className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </Card>
    ) : null
  );

  // ==================== CARD 5: WEED ERADICATION ADVISORY ====================
  const renderWeedAdvisory = () => (
    info.isWeed ? (
      <Card className="p-5 bg-gradient-to-r from-rose-950/80 via-rose-900/60 to-slate-900 border border-rose-500/40 text-white shadow-xl rounded-2xl">
        <div className="flex items-start gap-3.5">
          <span className="text-3xl p-2.5 bg-rose-500/20 rounded-2xl border border-rose-500/30">🚨</span>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-display font-extrabold text-lg text-rose-200">
                {locUI.weedTitle || 'Agricultural Weed Management & Eradication'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/30 text-rose-300 border border-rose-400/40">
                {locUI.weedPriority || 'Crop Protection Priority'}
              </span>
            </div>
            <p className="text-xs text-rose-200/90 leading-relaxed">
              {activeLang === 'te'
                ? 'ఈ మొక్క ప్రధాన పంటలతో పోషకాలు, తేమ మరియు సూర్యరశ్మి కోసం తీవ్రంగా పోటీపడే కలుపు జాతి. సకాలంలో అదుపు చేయకపోతే పంట దిగుబడి 30% నుండి 60% వరకు తగ్గే ప్రమాదం ఉంది.'
                : activeLang === 'ta'
                ? 'இந்த களைச்செடி முக்கிய பயிர்களுடன் நீர், சத்துக்கள் மற்றும் சூரிய ஒளிக்காக தீவிரமாக போட்டியிடும். சரியான நேரத்தில் கட்டுப்படுத்தாவிட்டால் மகசூல் 30% - 60% வரை குறையும்.'
                : activeLang === 'hi'
                ? 'यह खरपतवार मुख्य फसलों से पोषक तत्व, नमी और धूप के लिए प्रतिस्पर्धा करती है। यदि समय पर नियंत्रित न किया जाए तो उपज में 30% से 60% तक की भारी गिरावट आ सकती है।'
                : 'This specimen is an aggressive agricultural weed that actively competes with cultivated crops for vital soil nutrients, moisture, and sunlight. Uncontrolled growth can severely compromise yield by 30% - 60%.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
              <div className="p-3.5 bg-rose-950/50 rounded-xl border border-rose-500/30">
                <span className="font-extrabold text-rose-300 uppercase text-[10px] tracking-wider block mb-1">
                  🧪 {locUI.chemicalControl || 'Chemical Control (Herbicides)'}
                </span>
                <p className="text-slate-200 text-xs leading-relaxed">
                  {info.weedEradication || 'Apply selective post-emergence herbicide (e.g. 2,4-D amine salt 58% SL @ 2-2.5 ml/L, or Pendimethalin 30% EC @ 3.3 L/ha pre-emergence) during early vegetative stages.'}
                </p>
              </div>
              <div className="p-3.5 bg-emerald-950/40 rounded-xl border border-emerald-500/30">
                <span className="font-extrabold text-emerald-300 uppercase text-[10px] tracking-wider block mb-1">
                  🧑‍🌾 {locUI.culturalControl || 'Cultural & Manual Eradication'}
                </span>
                <p className="text-slate-200 text-xs leading-relaxed">
                  {activeLang === 'te'
                    ? 'మొక్క పూత దశకు రాకముందే చేతితో లేదా గుంటుకతో సమూలంగా తొలగించండి. విత్తనాలు నేలలో రాలకముందే కాల్చివేయడం లేదా సేంద్రీయ మల్చింగ్ చేయడం ఉత్తమం.'
                    : activeLang === 'ta'
                    ? 'தாவரம் பூக்கும் தருணத்திற்கு முன்பே வேரோடு பிடுங்கி எறியுங்கள். விதைகள் மண்ணில் விழுவதற்கு முன் உலர்த்தி எரிக்கவும் அல்லது மூடாக்கு இடவும்.'
                    : activeLang === 'hi'
                    ? 'फूल आने से पहले खुरपी से जड़ समेत उखाड़ दें। बीजों के जमीन पर गिरने से पहले उन्हें जला दें अथवा मल्चिंग तकनीक का प्रयोग करें।'
                    : 'Hand-weed or shallow inter-cultivate prior to flowering and seed set. Mulch row spacings with organic straw to suppress sunlight germination.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>
    ) : null
  );

  // ==================== CARD 3: SECTION 3 (ENVIRONMENTAL CONDITIONS) ====================
  const renderAgronomicAdvisory = () => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Sun className="w-4 h-4 text-amber-500" />
        <h3 className="font-display font-extrabold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>🪵 Environmental Conditions</span>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
            ({locUI.careMatrix || 'Agronomic Growth Parameters'})
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Suitable Soil Type */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 text-slate-900 dark:text-white shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wider">
                {locUI.soilTitle || 'Suitable Soil Type'}
              </span>
              <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {info.suitableSoilType || info.soilpH}
            </p>
          </div>
          <span className="text-[10px] text-emerald-700 dark:text-emerald-400/80 font-bold mt-2">Texture & pH Optimal</span>
        </div>

        {/* Ideal Weather & Climate */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/60 text-slate-900 dark:text-white shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-amber-800 dark:text-amber-400 tracking-wider">
                {locUI.tempTitle || 'Ideal Weather & Climate'}
              </span>
              <Sun className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {info.idealWeatherClimate || `${info.temperature} • ${info.sunlight}`}
            </p>
          </div>
          <span className="text-[10px] text-amber-700 dark:text-amber-400/80 font-bold mt-2">Thermal & Sunlight Window</span>
        </div>

        {/* Water Need / Irrigation */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-cyan-200 dark:border-cyan-800/60 text-slate-900 dark:text-white shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-cyan-800 dark:text-cyan-400 tracking-wider">
                {locUI.wateringTitle || 'Irrigation & Moisture'}
              </span>
              <Droplets className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {info.waterNeed}
            </p>
          </div>
          <span className="text-[10px] text-cyan-700 dark:text-cyan-400/80 font-bold mt-2">Moisture Regimen</span>
        </div>

        {/* Temperature Window / Sunlight */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800/60 text-slate-900 dark:text-white shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase text-rose-800 dark:text-rose-400 tracking-wider">
                {locUI.sunlightTitle || 'Sunlight Exposure'}
              </span>
              <Thermometer className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
              {info.sunlight}
            </p>
          </div>
          <span className="text-[10px] text-rose-700 dark:text-rose-400/80 font-bold mt-2">Photoperiod Hours</span>
        </div>
      </div>
    </div>
  );

  // ==================== CARD 4: FERTILIZER & SOIL NUTRITION ====================
  const renderSoilNutrition = () => (
    <CollapsibleSection 
      title={locUI.nutrition || t("results.fertilizer_rec", "Fertilizer Recommendation & Soil Nutrition")} 
      icon={FlaskConical} 
      badge="Nutrition" 
      defaultOpen={false}
      onSpeak={() => {
        const text = activeLang === 'te' 
          ? `ఎరువుల సిఫార్సు. ఎరువుల మిశ్రమం: ${info.fertilizer}. సూక్ష్మపోషకాలు: ${info.micronutrients}.`
          : activeLang === 'ta'
          ? `உர பரிந்துரை. பரிந்துரைக்கப்பட்ட உரம்: ${info.fertilizer}. நுண்ணூட்டச்சத்துக்கள்: ${info.micronutrients}.`
          : activeLang === 'hi'
          ? `उर्वरक सिफारिश। अनुशंसित उर्वरक: ${info.fertilizer}। आवश्यक सूक्ष्म पोषक तत्व: ${info.micronutrients}।`
          : `Recommended fertilizer blend: ${info.fertilizer}. Essential micronutrients: ${info.micronutrients}.`;
        speak(text, 'plant_fertilizer', activeLang);
      }}
      isSpeaking={speakingId === 'plant_fertilizer'}
    >
      <div className="space-y-3 text-xs">
        <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
          <span className="text-amber-800 dark:text-amber-300 font-bold uppercase text-[10px] tracking-wider block mb-1">
            🌱 {locUI.recommendedBlend || 'Recommended Macronutrient Formula (NPK)'}
          </span>
          <p className="text-slate-800 dark:text-slate-200 text-xs font-medium leading-relaxed">
            {info.fertilizer}
          </p>
        </div>
        <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-200/60 dark:border-blue-900/40">
          <span className="text-blue-800 dark:text-blue-300 font-bold uppercase text-[10px] tracking-wider block mb-1">
            🔬 {locUI.essentialMicro || 'Essential Micronutrients & Soil Amenders'}
          </span>
          <p className="text-slate-800 dark:text-slate-200 text-xs font-medium leading-relaxed">
            {info.micronutrients}
          </p>
        </div>
      </div>
    </CollapsibleSection>
  );

  // ==================== CARD 5: AGRICULTURAL VIGILANCE (DISEASES & PESTS) ====================
  const renderDiseasePest = () => (
    ((info.commonDiseases && info.commonDiseases.length > 0) || (info.commonPests && info.commonPests.length > 0)) ? (
      <Card className="p-5 sm:p-6 bg-slate-900/90 dark:bg-slate-900 border border-slate-700/80 text-white rounded-2xl shadow-md">
        <div className="flex items-center gap-2 mb-3 text-rose-400 font-bold text-sm uppercase tracking-wider">
          <ShieldAlert className="w-4 h-4" />
          <span>{locUI.vigilance || 'Agricultural Vigilance & Crop Protection'}</span>
        </div>
        
        <div className="space-y-3">
          {info.commonDiseases && info.commonDiseases.length > 0 && (
            <div className="p-3.5 bg-rose-950/30 rounded-xl border border-rose-500/25">
              <span className="font-bold text-rose-300 uppercase text-[10px] tracking-wider block mb-2 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                {locUI.vulnerableDiseases || 'Vulnerable Crop Diseases'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {info.commonDiseases.map((disease, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-900/40 text-rose-200 border border-rose-500/30 text-[11px] font-semibold">
                    🍂 {disease}
                  </span>
                ))}
              </div>
            </div>
          )}

          {info.commonPests && info.commonPests.length > 0 && (
            <div className="p-3.5 bg-amber-950/30 rounded-xl border border-amber-500/25">
              <span className="font-bold text-amber-300 uppercase text-[10px] tracking-wider block mb-2 flex items-center gap-1.5">
                <Bug className="w-3.5 h-3.5 text-amber-400" />
                {locUI.commonPests || 'Common Target Pests'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {info.commonPests.map((pest, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-amber-900/40 text-amber-200 border border-amber-500/30 text-[11px] font-semibold">
                    🐛 {pest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    ) : null
  );

  const defaultPlantOrder = [
    { key: 'specimen_hero', label: '1. 🌿 Botanical Specimen Hero Card', visible: true },
    { key: 'language_bar', label: '2. 🌐 Quick Language Switcher Bar', visible: true },
    { key: 'plant_classification', label: '3. 🌿 Plant Classification Card', visible: true },
    { key: 'description_impact', label: '4. 📝 Description & Practical Farm Impact', visible: true },
    { key: 'agronomic_advisory', label: '5. 🪵 Environmental & Cultivation Care Matrix (4-Grid)', visible: true },
    { key: 'weed_advisory', label: '6. ⚠️ Weed Eradication Advisory', visible: true }
  ];

  const plantCardMap = {
    specimen_hero: renderSpecimenHero,
    species_hero: renderSpecimenHero,
    language_bar: renderLanguageSwitcher,
    language_switcher: renderLanguageSwitcher,
    plant_classification: renderPlantClassification,
    taxonomy_morphology: renderPlantClassification,
    taxonomy_card: renderPlantClassification,
    description_impact: renderDescriptionCard,
    narrative_desc: renderDescriptionCard,
    agronomic_advisory: renderAgronomicAdvisory,
    care_matrix: renderAgronomicAdvisory,
    weed_advisory: renderWeedAdvisory,
    soil_nutrition: () => null,
    disease_pest: () => null
  };

  const activePlantOrder = defaultPlantOrder;

  return (
    <div className="space-y-4">
      {activePlantOrder.map((cardItem) => {
        if (cardItem.visible === false) return null;
        const renderer = plantCardMap[cardItem.key];
        if (!renderer) return null;
        const renderedNode = renderer();
        if (!renderedNode) return null;

        return (
          <div key={cardItem.key} className="transition-all duration-200">
            {renderedNode}
          </div>
        );
      })}

      {/* ==================== ACTION TOOLBAR ==================== */}
      <div className="pt-2 flex items-center justify-center">
        <Button
          variant="outline"
          size="md"
          onClick={handleScanAnother}
          leftIcon={<RotateCcw className="w-4 h-4" />}
          className="w-full sm:w-auto font-bold border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer rounded-2xl"
        >
          {locUI.scanAnother || 'Scan Another Plant'}
        </Button>
      </div>
    </div>
  );
};

export default PlantIdResults;

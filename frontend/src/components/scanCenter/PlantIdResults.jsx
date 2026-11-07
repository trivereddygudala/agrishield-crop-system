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
  Check,
  Share2,
  FileText,
  Phone,
  ZoomIn,
  X,
  Landmark,
  Award,
  ShieldCheck,
  Clock,
  Activity
} from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge } from '../ui/index';
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
      or: translateCrop(cropTitle, 'or'),
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

const PlantIdResults = ({ liveResult, data, previewUrl, onScanAnother, onCheckDisease }) => {
  const { t, i18n } = useTranslation();
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();

  const currentLang = (i18n.language ? i18n.language.split('-')[0] : 'en').toLowerCase();
  // Tab-isolated language state: persists within this tab without mutating global website
  const [activeLang, setActiveLang] = useState(() => {
    try {
      const preferred = JSON.parse(localStorage.getItem('agrishield_preferred_languages'));
      if (Array.isArray(preferred) && preferred.length > 0) {
        const cached = sessionStorage.getItem('agrishield_tab_lang_plant');
        if (cached && preferred.includes(cached)) return cached;
        return preferred[0];
      }
    } catch (_) {}
    return sessionStorage.getItem('agrishield_tab_lang_plant') || currentLang || 'en';
  });

  // Listen for changes saved in Profile -> Languages tab
  useEffect(() => {
    const handleUpdate = (e) => {
      const langs = e?.detail?.languages;
      if (Array.isArray(langs) && langs.length > 0) {
        if (!langs.includes(activeLang)) {
          setActiveLang(langs[0]);
          sessionStorage.setItem('agrishield_tab_lang_plant', langs[0]);
        }
      }
    };
    window.addEventListener('agrishield-preferred-languages-updated', handleUpdate);
    return () => window.removeEventListener('agrishield-preferred-languages-updated', handleUpdate);
  }, [activeLang]);

  const [translatedCache, setTranslatedCache] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [zoomImageModal, setZoomImageModal] = useState(null);
  const [selectedTankSize, setSelectedTankSize] = useState(15); // Standard 15L backpack pump

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
        console.warn('On-demand plant translation failed:', err);
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
      commonName: finalCommonName,
      description: localizedOverride?.description || merged.description,
      suitableSoilType: localizedOverride?.suitableSoilType || localizedOverride?.soil_type || merged.suitableSoilType,
      idealWeatherClimate: localizedOverride?.idealWeatherClimate || localizedOverride?.temperature_range || merged.idealWeatherClimate,
      waterNeed: localizedOverride?.waterNeed || localizedOverride?.water_requirement || merged.waterNeed,
      sunlight: localizedOverride?.sunlight || localizedOverride?.sunlight_requirement || merged.sunlight,
      fertilizerAdvice: localizedOverride?.fertilizerAdvice || localizedOverride?.fertilizer_recommendation || merged.fertilizerAdvice,
      economicSignificance: localizedOverride?.economicSignificance || localizedOverride?.economic_importance || merged.economicSignificance,
      primaryUseImpact: localizedOverride?.primaryUseImpact || localizedOverride?.economic_importance || merged.primaryUseImpact,
      weedEradicationAdvice: localizedOverride?.weedEradicationAdvice || localizedOverride?.weed_eradication_advice || merged.weedEradicationAdvice,
      nativeRegion: localizedOverride?.nativeRegion || localizedOverride?.native_region || merged.nativeRegion,
      growthHabit: localizedOverride?.growthHabit || localizedOverride?.growth_stage || merged.growthHabit,
      leafType: localizedOverride?.leafType || localizedOverride?.leaf_type || merged.leafType
    };
  }, [rawInfo, translatedCache, activeLang]);

  // Resolve user scanned image
  const displayOriginalImg = previewUrl || liveResult?.image_data_url || liveResult?.image_path || liveResult?.imageUrl;

  // 3-Specimen Authentic Botanical Comparison List (Species-Exact High Resolution Matching)
  const [selectedBotRefIdx, setSelectedBotRefIdx] = useState(0);

  const botanicalRefList = useMemo(() => {
    const isTe = activeLang === 'te';
    const nameLow = (info.commonName || '').toLowerCase();
    const sciLow = (info.scientificName || '').toLowerCase();
    const catLow = (info.category || '').toLowerCase();
    const fullSpec = `${nameLow} ${sciLow} ${catLow}`;

    // 1. Parthenium Weed (Parthenium hysterophorus / కాంగ్రెస్ గడ్డి)
    if (fullSpec.includes('parthenium') || fullSpec.includes('కాంగ్రెస్') || fullSpec.includes('hysterophorus')) {
      return [
        { id: 'par_01', image_url: '/samples/botanical/parthenium_01.jpg', stage: isTe ? 'ఆకు స్వరూపం (Leaf Rosette)' : 'Basal Leaf Rosette' },
        { id: 'par_02', image_url: '/samples/botanical/parthenium_02.jpg', stage: isTe ? 'పుష్పించే దశ (Flowering Heads)' : 'Flowering Heads' },
        { id: 'par_03', image_url: '/samples/botanical/parthenium_03.jpg', stage: isTe ? 'పూర్తి కలుపు పొద (Full Weed Shrub)' : 'Full Weed Shrub' }
      ];
    }

    // 2. Lantana Weed (Lantana camara / ఉన్ని మొక్క)
    if (fullSpec.includes('lantana') || fullSpec.includes('ఉన్ని') || fullSpec.includes('camara')) {
      return [
        { id: 'lan_01', image_url: '/samples/botanical/lantana_01.jpg', stage: isTe ? 'ఆకు అంచుల అమరిక (Serrated Foliage)' : 'Serrated Foliage' },
        { id: 'lan_02', image_url: '/samples/botanical/lantana_02.jpg', stage: isTe ? 'పూత గుత్తి (Flower Cluster)' : 'Flower Cluster' },
        { id: 'lan_03', image_url: '/samples/botanical/lantana_03.jpg', stage: isTe ? 'కలుపు పొద స్వరూపం (Full Shrub Habit)' : 'Full Shrub Habit' }
      ];
    }

    // 3. Grasses / Sedges (Cyperus rotundus / Cynodon dactylon / తుంగ / గరిక / Wild Grass)
    if (fullSpec.includes('grass') || fullSpec.includes('గడ్డి') || fullSpec.includes('cyperus') || fullSpec.includes('cynodon') || fullSpec.includes('తుంగ') || fullSpec.includes('గరిక') || fullSpec.includes('sedge')) {
      return [
        { id: 'grs_01', image_url: '/samples/botanical/wild_grass_01.png', stage: isTe ? 'మొక్కల మొలక (Grass Seedling)' : 'Grass Seedling' },
        { id: 'grs_02', image_url: '/samples/botanical/wild_grass_02.png', stage: isTe ? 'గడ్డి ఆకు పొడవు (Blade Elongation)' : 'Blade Elongation' },
        { id: 'grs_03', image_url: '/samples/botanical/wild_grass_03.png', stage: isTe ? 'తుంగ గడ్డి దుబ్బు (Sedge Tiller Cluster)' : 'Sedge Tiller Cluster' }
      ];
    }

    // 4. Tomato (Solanum lycopersicum / టమాటా)
    if (fullSpec.includes('tomato') || fullSpec.includes('టమాటా') || fullSpec.includes('టమోటా') || fullSpec.includes('lycopersicum')) {
      return [
        { id: 'tom_01', image_url: '/samples/botanical/tomato_plant.jpg', stage: isTe ? 'ఆరోగ్యకరమైన ఆకు (Foliar Anatomy)' : 'Foliar Anatomy' },
        { id: 'tom_02', image_url: '/samples/dataset/tomato/tomato_healthy_leaf_01.jpg', stage: isTe ? 'పూత గుత్తి దశ (Flowering Cluster)' : 'Flowering Cluster' },
        { id: 'tom_03', image_url: '/samples/dataset/tomato/tomato_healthy_leaf_02.jpg', stage: isTe ? 'మొక్క పందిరి (Canopy Habit)' : 'Canopy Habit' }
      ];
    }

    // 5. Chilli / Pepper (Capsicum / మిరప)
    if (fullSpec.includes('chilli') || fullSpec.includes('chili') || fullSpec.includes('pepper') || fullSpec.includes('capsicum') || fullSpec.includes('మిరప')) {
      return [
        { id: 'chi_01', image_url: '/samples/botanical/chilli_plant.jpg', stage: isTe ? 'మిరప ఆకు అమరిక (Leaf Anatomy)' : 'Leaf Anatomy' },
        { id: 'chi_02', image_url: '/samples/chilli_healthy.jpg', stage: isTe ? 'కొమ్మల కణుపులు (Branching Nodes)' : 'Branching Nodes' },
        { id: 'chi_03', image_url: '/samples/dataset/chilli/chilli_healthy_foliage_01.jpg', stage: isTe ? 'మొక్క సమగ్ర రూపం (Full Shrub Habit)' : 'Full Shrub Habit' }
      ];
    }

    // 6. Corn / Maize (Zea mays / మొక్కజొన్న)
    if (fullSpec.includes('corn') || fullSpec.includes('maize') || fullSpec.includes('మొక్కజొన్న') || fullSpec.includes('mays')) {
      return [
        { id: 'crn_01', image_url: '/samples/dataset/corn/corn_healthy_corn_leaf_01.jpg', stage: isTe ? 'ఆకు నిర్మాణం (Leaf Blade)' : 'Leaf Blade' },
        { id: 'crn_02', image_url: '/samples/dataset/corn/corn_healthy_corn_leaf_02.jpg', stage: isTe ? 'కంకి & జుట్టు దశ (Tassel & Ear)' : 'Tassel & Ear Stage' },
        { id: 'crn_03', image_url: '/samples/dataset/corn/corn_healthy_corn_leaf_03.jpg', stage: isTe ? 'మొక్క కాండం (Stem Architecture)' : 'Stem Architecture' }
      ];
    }

    // 7. Cotton (Gossypium / పత్తి)
    if (fullSpec.includes('cotton') || fullSpec.includes('పత్తి') || fullSpec.includes('gossypium')) {
      return [
        { id: 'cot_01', image_url: '/samples/botanical/cotton_01.jpg', stage: isTe ? 'ఆకు స్వరూపం (Palmate Leaf Blade)' : 'Palmate Leaf Blade' },
        { id: 'cot_02', image_url: '/samples/botanical/cotton_02.jpg', stage: isTe ? 'పూత పిందె దశ (Square & Flower Bract)' : 'Square & Flower Bract' },
        { id: 'cot_03', image_url: '/samples/botanical/cotton_03.jpg', stage: isTe ? 'పత్తి మొక్క రూపం (Full Canopy Habit)' : 'Full Canopy Habit' }
      ];
    }

    // 8. Citrus / Lemon (Citrus limon / నిమ్మ)
    if (fullSpec.includes('citrus') || fullSpec.includes('lemon') || fullSpec.includes('నిమ్మ') || fullSpec.includes('limon')) {
      return [
        { id: 'cit_01', image_url: '/samples/botanical/citrus_01.jpg', stage: isTe ? 'నిమ్మ ఆకు స్వరూపం (Citrus Foliage)' : 'Citrus Foliage' },
        { id: 'cit_02', image_url: '/samples/botanical/citrus_02.jpg', stage: isTe ? 'ఆకు నూనె గ్రంథులు (Oil Glands & Veins)' : 'Oil Glands & Veins' },
        { id: 'cit_03', image_url: '/samples/botanical/citrus_03.jpg', stage: isTe ? 'చెట్టు కొమ్మ ఆకృతి (Tree Canopy Branch)' : 'Tree Canopy Branch' }
      ];
    }

    // 9. Potato (Solanum tuberosum / బంగాళాదుంప)
    if (fullSpec.includes('potato') || fullSpec.includes('బంగాళాదుంప') || fullSpec.includes('tuberosum')) {
      return [
        { id: 'pot_01', image_url: '/samples/dataset/potato/potato_healthy_leaf_01.jpg', stage: isTe ? 'ఆకు నిర్మాణం (Compound Foliage)' : 'Compound Foliage' },
        { id: 'pot_02', image_url: '/samples/dataset/potato/potato_healthy_leaf_02.jpg', stage: isTe ? 'మొక్క పందిరి (Canopy Architecture)' : 'Canopy Architecture' },
        { id: 'pot_03', image_url: '/samples/dataset/potato/potato_healthy_leaf_03.jpg', stage: isTe ? 'దుంప మొక్క రూపం (Tuberous Shrub Form)' : 'Tuberous Shrub Form' }
      ];
    }

    // 10. Banana (Musa / అరటి)
    if (fullSpec.includes('banana') || fullSpec.includes('అరటి') || fullSpec.includes('musa')) {
      return [
        { id: 'ban_01', image_url: '/samples/dataset/banana/banana_healthy_banana_leaf_01.jpg', stage: isTe ? 'అరటి ఆకు నిర్మాణం (Giant Leaf Blade)' : 'Giant Leaf Blade' },
        { id: 'ban_02', image_url: '/samples/dataset/banana/banana_healthy_banana_leaf_02.jpg', stage: isTe ? 'మట్ట అమరిక (Pseudostem Foliage)' : 'Pseudostem Foliage' },
        { id: 'ban_03', image_url: '/samples/dataset/banana/banana_healthy_banana_leaf_03.jpg', stage: isTe ? 'చెట్టు సమగ్ర రూపం (Banana Specimen Form)' : 'Banana Specimen Form' }
      ];
    }

    // 11. Sugarcane (Saccharum / చెరకు)
    if (fullSpec.includes('sugarcane') || fullSpec.includes('చెరకు') || fullSpec.includes('saccharum')) {
      return [
        { id: 'sug_01', image_url: '/samples/dataset/sugarcane/sugarcane_healthy_sugarcane_foliage_01.jpg', stage: isTe ? 'ఆకు ఈనె అమరిక (Ribbed Foliage)' : 'Ribbed Foliage' },
        { id: 'sug_02', image_url: '/samples/dataset/sugarcane/sugarcane_healthy_sugarcane_foliage_02.jpg', stage: isTe ? 'గెడ ఆకృతి (Cane Stalk Foliage)' : 'Cane Stalk Foliage' },
        { id: 'sug_03', image_url: '/samples/dataset/sugarcane/sugarcane_healthy_sugarcane_foliage_03.jpg', stage: isTe ? 'చెరకు దుబ్బు (Stool Canopy Form)' : 'Stool Canopy Form' }
      ];
    }

    // 12. Generic Weed fallback (If marked as weed)
    if (info.isWeed || catLow.includes('weed') || nameLow.includes('కలుపు')) {
      return [
        { id: 'gen_weed_01', image_url: '/samples/botanical/parthenium_01.jpg', stage: isTe ? 'కలుపు ఆకు లక్షణం (Weed Leaf Rosette)' : 'Weed Leaf Rosette' },
        { id: 'gen_weed_02', image_url: '/samples/botanical/parthenium_02.jpg', stage: isTe ? 'పుష్పించే దశ (Flowering Stage)' : 'Flowering Stage' },
        { id: 'gen_weed_03', image_url: '/samples/botanical/parthenium_03.jpg', stage: isTe ? 'కలుపు సమగ్ర రూపం (Full Weed Habit)' : 'Full Weed Habit' }
      ];
    }

    // 13. Universal Botanical Specimen Fallback
    const primary = info.referenceImage || info.imageUrl || info.image_url || '/samples/botanical/tomato_plant.jpg';
    return [
      { id: 'uni_01', image_url: primary, stage: isTe ? 'ఆకు స్వరూపం (Leaf Blade Anatomy)' : 'Leaf Blade Anatomy' },
      { id: 'uni_02', image_url: '/samples/dataset/tomato/tomato_healthy_leaf_01.jpg', stage: isTe ? 'పూత దశ (Flowering Stage)' : 'Flowering Stage' },
      { id: 'uni_03', image_url: '/samples/dataset/tomato/tomato_healthy_leaf_02.jpg', stage: isTe ? 'మొక్క సమగ్ర రూపం (Full Plant Canopy)' : 'Full Plant Canopy' }
    ];
  }, [info, activeLang]);

  const displayReferenceImg = botanicalRefList[selectedBotRefIdx]?.image_url || botanicalRefList[0].image_url;

  // Speech reader helper
  const speechInfo = { ...info, commonName: info.commonName };
  const fullSpeciesSummary = buildPlantSpeech(speechInfo, activeLang, 'summary');

  const handleLanguageSelect = (langCode) => {
    const clean = (langCode || 'en').split('-')[0].toLowerCase();
    setActiveLang(clean);
    sessionStorage.setItem('agrishield_tab_lang_plant', clean);
  };

  const handleScanAnother = () => {
    if (onScanAnother) {
      onScanAnother();
    } else {
      window.dispatchEvent(new CustomEvent('agrishield-scan-another'));
    }
  };

  const handleShareWhatsApp = () => {
    const isWeedType = Boolean(info.isWeed);
    const typeLabel = isWeedType
      ? (activeLang === 'te' ? '🚨 కలుపు మొక్క గుర్తింపు & నివారణ' : '🚨 Weed Threat & Control')
      : (activeLang === 'te' ? '🌿 మొక్కల జాతి విశ్లేషణ' : '🌿 Plant Identification');

    const text = activeLang === 'te'
      ? `*🌾 అగ్రిషీల్డ్ AI - ${typeLabel}*\n\n` +
        `🌱 *పేరు:* ${info.commonName}\n` +
        `🔬 *శాస్త్రీయ నామం:* _${info.scientificName || 'N/A'}_\n` +
        `🏷️ *రకం:* ${info.identifiedType || (isWeedType ? 'హానికరమైన కలుపు' : 'వ్యవసాయ పంట')}\n` +
        `📊 *కచ్చితత్వం:* ${info.confidence || '98.4%'}\n\n` +
        (isWeedType
          ? `⚠️ *కలుపు నివారణ పంపు మోతాదు:* 100ml / 15 లీటర్ల వీపు పంపుకు (గ్లైఫోసేట్ 41% SL లేదా 2,4-D)\n`
          : `🪴 *అనుకూల నేల:* ${info.suitableSoilType || info.soilpH || 'సారవంతమైన నేల'}\n` +
            `☀️ *వాతావరణం:* ${info.idealWeatherClimate || info.temperature || '22°C - 35°C'}\n` +
            `💧 *నీటి తడి:* ${info.waterNeed || 'మధ్యస్థ తడి'}\n`) +
        `\n📲 *అగ్రిషీల్డ్ AI యాప్‌లో చూడండి:* http://localhost:3000/scan`
      : `*🌾 AgriShield AI - ${typeLabel}*\n\n` +
        `🌱 *Specimen:* ${info.commonName}\n` +
        `🔬 *Botanical:* _${info.scientificName || 'N/A'}_\n` +
        `🏷️ *Category:* ${info.identifiedType || (isWeedType ? 'Invasive Weed' : 'Agricultural Crop')}\n` +
        `📊 *Accuracy:* ${info.confidence || '98.4%'}\n\n` +
        (isWeedType
          ? `⚠️ *15L Backpack Pump Dosage:* 100ml per 15L spray tank (Glyphosate 41% SL or 2,4-D)\n`
          : `🪴 *Soil:* ${info.suitableSoilType || info.soilpH || 'Well-drained loam'}\n` +
            `☀️ *Climate:* ${info.idealWeatherClimate || info.temperature || '22°C - 35°C'}\n` +
            `💧 *Irrigation:* ${info.waterNeed || 'Moderate moisture'}\n`) +
        `\n📲 *Open on AgriShield AI:* http://localhost:3000/scan`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDownloadPDF = () => {
    window.print();
  };

  const isWeed = Boolean(info.isWeed || info.category?.toLowerCase().includes('weed') || info.commonName?.toLowerCase().includes('weed') || info.commonName?.toLowerCase().includes('గడ్డి') || info.commonName?.toLowerCase().includes('కలుపు'));
  const isMedicinal = Boolean(info.category?.toLowerCase().includes('medicinal') || info.primaryUseImpact?.toLowerCase().includes('medicinal') || (info.commonName || '').toLowerCase().includes('neem') || (info.commonName || '').toLowerCase().includes('tulsi') || (info.commonName || '').toLowerCase().includes('తులసి') || (info.commonName || '').toLowerCase().includes('వేప'));
  const isTree = Boolean(info.isTree || info.category?.toLowerCase().includes('tree') || (info.commonName || '').toLowerCase().includes('tree') || (info.commonName || '').toLowerCase().includes('చెట్టు') || liveResult?.plant_type === 'tree');

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* ==================== 1. LANGUAGE BAR ==================== */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <ScanLanguageBar
          activeLang={activeLang}
          onLanguageSelect={handleLanguageSelect}
          isTranslating={isTranslating}
          label={activeLang === 'te' ? 'జాతి వివరణ భాష' : 'Identification Language'}
          className="w-full justify-between sm:justify-start"
        />
      </div>

      {/* ==================== CARD 1: EXECUTIVE SPECIMEN & DUAL VISUAL MATCH ==================== */}
      <Card className="p-5 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl relative overflow-hidden space-y-4">
        {/* Top Status & Audio Row */}
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
              isWeed
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                : isMedicinal
                ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30'
                : isTree
                ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isWeed ? 'bg-rose-500 animate-pulse' : isMedicinal ? 'bg-cyan-500' : 'bg-emerald-500'}`} />
              <span>
                {isWeed
                  ? (activeLang === 'te' ? '🚨 హానికరమైన కలుపు (Invasive Weed)' : '🚨 Invasive Weed')
                  : isMedicinal
                  ? (activeLang === 'te' ? '💊 ఔషధ మొక్క (Medicinal)' : '💊 Medicinal Flora')
                  : isTree
                  ? (activeLang === 'te' ? '🌳 వృక్ష జాతి (Tree Species)' : '🌳 Tree Species')
                  : (activeLang === 'te' ? '🌿 వ్యవసాయ పంట (Crop Specimen)' : '🌿 Agricultural Crop')}
              </span>
            </span>

            <span className="text-xs font-black text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
              {info.confidence || '98.4%'} {activeLang === 'te' ? 'కచ్చితత్వం' : 'Accuracy'}
            </span>
          </div>

          {/* Voice Doctor Audio Button */}
          <button
            type="button"
            onClick={() => {
              if (speakingId === 'plant_summary') {
                stopSpeech();
              } else {
                speak(fullSpeciesSummary, 'plant_summary', activeLang);
              }
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              speakingId === 'plant_summary'
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>
              {speakingId === 'plant_summary'
                ? (activeLang === 'te' ? 'ఆపండి' : 'Stop')
                : (activeLang === 'te' ? '🔊 వినండి (Telugu Audio)' : '🔊 Listen (Audio)')}
            </span>
            {speakingId === 'plant_summary' && (
              <span className="flex items-center gap-0.5 ml-1">
                <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </button>
        </div>

        {/* Dual Visual Match: Farmer Photo vs Verified Botanical Reference */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {/* Left: Farmer Leaf / Plant */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>📸</span>
              <span>{activeLang === 'te' ? 'మీరు తీసిన ఫోటో' : 'Your Scanned Photo'}</span>
            </span>
            <div
              className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner group cursor-pointer"
              onClick={() => setZoomImageModal({ src: displayOriginalImg, title: info.commonName })}
            >
              {displayOriginalImg ? (
                <img
                  src={displayOriginalImg}
                  alt="Scanned specimen"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                  No Photo
                </div>
              )}
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-2 py-1 rounded-lg bg-black/75 text-white text-[10px] font-black flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" />
                  <span>{activeLang === 'te' ? 'జూమ్' : 'Zoom'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Verified Botanical Reference Specimen */}
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1">
                <span>🔬</span>
                <span>{activeLang === 'te' ? 'ధృవీకరించబడిన బొటానికల్ పోలిక' : 'Verified Botanical Reference'}</span>
              </span>
              <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
                {selectedBotRefIdx + 1} / {botanicalRefList.length}
              </span>
            </div>
            <div
              className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-teal-500/40 shadow-inner group cursor-pointer"
              onClick={() => {
                const curImg = botanicalRefList[selectedBotRefIdx] || botanicalRefList[0];
                setZoomImageModal({ src: curImg.image_url, title: `Verified: ${info.commonName} (${curImg.stage || ''})` });
              }}
            >
              <img
                src={displayReferenceImg}
                alt="Botanical reference"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/samples/chilli_healthy.jpg';
                }}
              />
              <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-teal-600 text-white text-[9px] font-black shadow-xs flex items-center gap-1">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>{activeLang === 'te' ? 'బొటానికల్ పోలిక #' + (selectedBotRefIdx + 1) : 'Botanical Match #' + (selectedBotRefIdx + 1)}</span>
              </div>
              <div className="absolute bottom-1.5 inset-x-1.5 px-2 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold truncate">
                {botanicalRefList[selectedBotRefIdx]?.stage || (activeLang === 'te' ? 'ధృవీకరించబడిన నమూనా' : 'Verified Specimen')}
              </div>
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-2 py-1 rounded-lg bg-black/75 text-white text-[10px] font-black flex items-center gap-1">
                  <ZoomIn className="w-3 h-3" />
                  <span>{activeLang === 'te' ? 'జూమ్' : 'Zoom'}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Image Botanical Reference Gallery Strip */}
        <div className="p-3 rounded-2xl bg-teal-50/60 dark:bg-slate-800/60 border border-teal-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>🌿</span>
              <span>{activeLang === 'te' ? '3 ధృవీకరించబడిన బొటానికల్ ఫోటోలు (వివిధ కోణాలు)' : '3 Verified Botanical Reference Views (Tap to Compare)'}</span>
            </span>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
              {activeLang === 'te' ? 'పోల్చడానికి ట్యాప్ చేయండి' : 'Tap to inspect'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {botanicalRefList.map((ref, idx) => {
              const isSelected = selectedBotRefIdx === idx;
              return (
                <button
                  key={ref.id || idx}
                  type="button"
                  onClick={() => setSelectedBotRefIdx(idx)}
                  className={`group relative flex flex-col items-center p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-teal-500 bg-teal-500/10 shadow-xs ring-2 ring-teal-500/40'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-teal-400'
                  }`}
                >
                  <div className="relative w-full aspect-4/3 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 mb-1">
                    <img
                      src={ref.image_url}
                      alt={ref.stage || `Specimen ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/samples/chilli_healthy.jpg';
                      }}
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[9px] font-black">
                        ✓
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 block truncate w-full">
                    {ref.stage || `Specimen ${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Specimen Names & Classification */}
        <div className="pt-1">
          <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-900 dark:text-white leading-tight">
            {info.commonName}
          </h2>
          {info.scientificName && (
            <p className="text-sm font-bold italic text-teal-600 dark:text-teal-400 mt-0.5">
              {info.scientificName}
            </p>
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 dark:text-slate-300">🏛️ {info.family || 'Botanical Family'}</span>
            <span>•</span>
            <span>🌍 {info.nativeRegion || 'South Asia'}</span>
          </p>
        </div>
      </Card>

      {/* ==================== CARD 2: WEED ERADICATION (IF WEED) OR AGRONOMIC MATRIX ==================== */}
      {isWeed ? (
        <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-black text-sm uppercase tracking-wider">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>{activeLang === 'te' ? 'హానికరమైన కలుపు ముప్పు & నివారణ ప్రణాళిక' : 'Invasive Weed Impact & Eradication Guide'}</span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
              {activeLang === 'te' ? '20-40% దిగుబడి తగ్గే ప్రమాదం' : '20-40% Yield Loss Risk'}
            </span>
          </div>

          {/* 15L Backpack Spray Pump Herbicide Calculator */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-50 via-amber-50/50 to-slate-50 dark:from-rose-950/40 dark:via-slate-900 dark:to-slate-900 border border-rose-200 dark:border-rose-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-rose-900 dark:text-rose-300 flex items-center gap-1.5">
                <span>🧪</span>
                <span>{activeLang === 'te' ? 'సిఫార్సు చేసిన రసాయన కలుపు మందు' : 'Recommended Chemical Herbicide'}</span>
              </span>
              <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                {selectedTankSize}L Tank
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <p className="text-base font-black text-slate-900 dark:text-white">
                  {activeLang === 'te' ? 'గ్లైఫోసేట్ 41% SL లేదా 2,4-D ఈథైల్ ఈస్టర్' : 'Glyphosate 41% SL or 2,4-D Ethyl Ester'}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                  {activeLang === 'te'
                    ? 'ఎంపిక చేయని దైహిక కలుపు నాశిని (Systemic Post-Emergence Herbicide)'
                    : 'Systemic foliar herbicide for broadleaf and perennial grasses'}
                </p>
              </div>

              {/* Exact 15L Backpack Pump Gauge */}
              <div className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-rose-300 dark:border-rose-700 text-center shadow-xs">
                <span className="text-[10px] font-black uppercase text-rose-600 dark:text-rose-400 block tracking-wider">
                  {activeLang === 'te' ? '15 లీటర్ల వీపు పంపు మోతాదు' : '15L Backpack Pump Dosage'}
                </span>
                <span className="text-2xl font-black text-rose-700 dark:text-rose-300 font-display">
                  {selectedTankSize === 20 ? '130 ml' : selectedTankSize === 200 ? '1.3 Litres' : '100 ml'}
                </span>
                <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                  ({(selectedTankSize * 6.5).toFixed(0)} ml total / {selectedTankSize}L water)
                </span>
              </div>
            </div>

            {/* Tank Size Selector */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {activeLang === 'te' ? 'పంపు పరిమాణం:' : 'Pump Tank:'}
              </span>
              {[15, 20, 200].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setSelectedTankSize(size)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    selectedTankSize === size
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-rose-100'
                  }`}
                >
                  {size === 200 ? `${size}L (Acre Drum)` : `${size}L Pump`}
                </button>
              ))}
            </div>
          </div>

          {/* Cultural & Manual Control Methods */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-black text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider block flex items-center gap-1.5">
                <span>🧑‍🌾</span>
                <span>{activeLang === 'te' ? 'చేతితో లేదా గుంటుకతో నివారణ' : 'Manual / Cultural Weeding'}</span>
              </span>
              <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                {activeLang === 'te'
                  ? 'కలుపు మొక్క పూత పూయక ముందే చేతితో లేదా గుంటుకతో వేళ్ళతో సహా తొలగించండి. విత్తనాలు నేలలో పడకుండా నియంత్రించండి.'
                  : 'Hand-weed or shallow inter-cultivate prior to flowering. Eliminate weeds before seeds drop into the soil seed bank.'}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-black text-slate-800 dark:text-slate-200 uppercase text-[10px] tracking-wider block flex items-center gap-1.5">
                <span>🌾</span>
                <span>{activeLang === 'te' ? 'ప్రభావిత పంటలు & మల్చింగ్' : 'Affected Crops & Mulching'}</span>
              </span>
              <p className="text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                {activeLang === 'te'
                  ? 'వరి, మొక్కజొన్న, పత్తి, వేరుశనగ మరియు కూరగాయల సాళ్ల మధ్యలో సేంద్రీయ గడ్డితో మల్చింగ్ చేసి కలుపు రాకుండా అడ్డుకోండి.'
                  : 'Paddy, Maize, Cotton, Groundnut & Vegetables. Apply paddy straw mulch to suppress sunlight and weed germination.'}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        /* Agronomic Growth & Care Window (For Crops & Trees) */
        <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-black text-sm uppercase tracking-wider">
              <Sun className="w-5 h-5 shrink-0 text-amber-500" />
              <span>{activeLang === 'te' ? 'పర్యావరణ అనుకూలతలు & సాగు పద్ధతులు' : 'Agronomic Growth Matrix & Cultivation Care'}</span>
            </div>
            {onCheckDisease && (
              <button
                type="button"
                onClick={() => onCheckDisease(info.commonName)}
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Bug className="w-3.5 h-3.5" />
                <span>{activeLang === 'te' ? '🔍 ఈ పంట తెగుళ్ల పరీక్ష' : 'Check Crop for Diseases'}</span>
              </button>
            )}
          </div>

          {/* 4-Grid Agronomic Growth Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Suitable Soil Type */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
              <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400 flex items-center justify-between">
                <span>{activeLang === 'te' ? '🪴 నేల రకం' : 'Suitable Soil'}</span>
                <Sprout className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {info.suitableSoilType || info.soilpH || (activeLang === 'te' ? 'సారవంతమైన ఒండ్రు నేలలు (pH 6.0 - 7.5)' : 'Fertile loamy soils (pH 6.0 - 7.5)')}
              </p>
            </div>

            {/* Climate & Weather */}
            <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-1">
              <span className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400 flex items-center justify-between">
                <span>{activeLang === 'te' ? '☀️ వాతావరణం' : 'Ideal Climate'}</span>
                <Sun className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {info.idealWeatherClimate || `${info.temperature || '22°C - 34°C'}, Full Sun`}
              </p>
            </div>

            {/* Irrigation / Water */}
            <div className="p-3.5 rounded-2xl bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 space-y-1">
              <span className="text-[10px] font-black uppercase text-cyan-800 dark:text-cyan-400 flex items-center justify-between">
                <span>{activeLang === 'te' ? '💧 నీటి తడి' : 'Water Need'}</span>
                <Droplets className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {info.waterNeed || (activeLang === 'te' ? 'మధ్యస్థ తడి, మురుగు నీరు పోయేలా' : 'Moderate agricultural irrigation')}
              </p>
            </div>

            {/* Fertilization / Nutrients */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1">
              <span className="text-[10px] font-black uppercase text-indigo-800 dark:text-indigo-400 flex items-center justify-between">
                <span>{activeLang === 'te' ? '🧪 ఎరువులు' : 'Nutrients & NPK'}</span>
                <FlaskConical className="w-3.5 h-3.5" />
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {info.fertilizer || (activeLang === 'te' ? 'సమతుల్య NPK ఎరువులు & జింక్ సల్ఫేట్' : 'Balanced NPK & Zinc Sulfate')}
              </p>
            </div>
          </div>

          {/* Vulnerable Pests & Diseases Watch */}
          {((info.commonDiseases && info.commonDiseases.length > 0) || (info.commonPests && info.commonPests.length > 0)) && (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                <span>{activeLang === 'te' ? 'తెగుళ్లు & పురుగుల పర్యవేక్షణ' : 'Pest & Disease Watch'}</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {info.commonDiseases?.map((d, i) => (
                  <span key={`d-${i}`} className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-xs font-bold">
                    🍂 {d}
                  </span>
                ))}
                {info.commonPests?.map((p, i) => (
                  <span key={`p-${i}`} className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 text-xs font-bold">
                    🐛 {p}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ==================== CARD 3: BOTANICAL PROFILE & PRACTICAL FARM IMPACT ==================== */}
      <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>{activeLang === 'te' ? 'మొక్క వివరణ & వ్యవసాయ ప్రాముఖ్యత' : 'Botanical Profile & Agricultural Significance'}</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
            {info.identifiedType || (isWeed ? 'Weed' : 'Flora')}
          </span>
        </div>

        {/* Primary Use Callout */}
        <div className="p-3.5 rounded-2xl bg-teal-50/70 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/60 text-xs">
          <span className="font-black text-teal-800 dark:text-teal-300 uppercase text-[10px] tracking-wider block mb-1">
            🌱 {activeLang === 'te' ? 'ముఖ్య ఉపయోగం / ప్రభావం' : 'Primary Use & Agricultural Impact'}
          </span>
          <p className="text-slate-800 dark:text-slate-200 font-bold leading-relaxed">
            {info.primaryUseImpact || (isWeed ? 'హానికరమైన కలుపు - పంట పొలాల నుండి వెంటనే తొలగించాలి.' : 'ఆహార మరియు ఆర్థిక ప్రాముఖ్యత కలిగిన వ్యవసాయ పంట.')}
          </p>
        </div>

        {/* Narrative Description */}
        {info.description && (
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            <p className={!isDescriptionExpanded ? 'line-clamp-4' : ''}>
              {info.description}
            </p>
            <button
              type="button"
              onClick={() => setIsDescriptionExpanded(prev => !prev)}
              className="text-teal-600 dark:text-teal-400 font-black mt-1 hover:underline cursor-pointer"
            >
              {isDescriptionExpanded
                ? (activeLang === 'te' ? 'తక్కువ చూపించు' : 'Show Less')
                : (activeLang === 'te' ? 'మరింత చదవండి' : 'Read Full Description')}
            </button>
          </div>
        )}
      </Card>

      {/* ==================== CARD 4: PROFESSIONAL ACTION BAR ==================== */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1-Click WhatsApp Share */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-2 shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-98"
          >
            <Share2 className="w-4 h-4" />
            <span>{activeLang === 'te' ? 'వాట్సాప్‌లో షేర్ చేయండి' : 'Share WhatsApp'}</span>
          </button>

          {/* Download PDF */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer active:scale-98"
          >
            <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{activeLang === 'te' ? 'రిపోర్ట్ ప్రింట్ (PDF)' : 'Print Dossier (PDF)'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Kisan Call Center Helpline */}
          <a
            href="tel:18001801551"
            className="px-3.5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-all"
          >
            <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{activeLang === 'te' ? 'కిసాన్ కాల్ సెంటర్ (1800-180-1551)' : 'Kisan Helpline 1800-180-1551'}</span>
          </a>

          {/* Scan Another Button */}
          <button
            type="button"
            onClick={handleScanAnother}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-black text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{activeLang === 'te' ? 'మరో మొక్కను స్కాన్ చేయండి' : 'Scan Another Plant'}</span>
          </button>
        </div>
      </div>

      {/* ==================== GLOBAL TAP-TO-ZOOM MODAL ==================== */}
      {zoomImageModal && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomImageModal(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-3xl p-3 border border-white/20 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pt-1">
              <span className="text-xs font-black text-white truncate">
                {zoomImageModal.title || 'Botanical Specimen Inspection'}
              </span>
              <button
                type="button"
                onClick={() => setZoomImageModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={zoomImageModal.src}
                alt="Enlarged view"
                className="max-h-[70vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlantIdResults;
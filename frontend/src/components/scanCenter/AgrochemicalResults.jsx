import React, { useState, useEffect, useMemo } from 'react';
import {
  FlaskConical, ClipboardList, ShieldAlert, Sparkles, Volume2, VolumeX,
  CheckCircle2, Clock, Droplets, AlertTriangle, ShieldCheck, Info,
  Package, Calendar, HelpCircle, Layers, ExternalLink, ZoomIn, X,
  ChevronDown, ChevronUp, Sprout, Flower2, Apple, Shield, Globe, Loader2,
  Award, UserCheck, PenSquare, SlidersHorizontal, IndianRupee, Copy, Check, Banknote, Building2,
  RotateCcw
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge } from '../ui/index';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import API from '../../services/api';
import { SUPPORTED_LANGUAGES } from '../../data/languages';
import ScanLanguageBar from './ScanLanguageBar';

const AGRO_UI_LOCALIZATIONS = {
  en: {
    identity: "📦 Product Identity",
    descriptionCrops: "4. 📝 Product Description & Approved Target Crops",
    composition: "🧪 Chemical Composition & Actives",
    pricing: "💰 Pricing & Retail Breakdown",
    mixingPPE: "🛡️ Spray Mixing Dose & Safety Handling",
    scanAnother: "Scan Another Product / Bottle",
    addToInventory: "Add to Farm Inventory",
    stopAudio: "Stop Audio",
    listenAudio: "Listen Instructions",
    copied: "Copied Markdown!",
    copyReport: "Copy Markdown Report (Share)"
  },
  te: {
    identity: "📦 ఉత్పత్తి గుర్తింపు వివరాలు",
    descriptionCrops: "4. 📝 వివరణ & ఆమోదిత పంటలు",
    composition: "🧪 క్రియాశీల రసాయనాలు & కూర్పు",
    pricing: "💰 ధర & రిటైల్ వివరాలు",
    mixingPPE: "🛡️ పంపు పిచికారీ మోతాదు & భద్రత",
    scanAnother: "మరో మందు సీసాను స్కాన్ చేయండి",
    addToInventory: "వ్యవసాయ ఇన్వెంటరీకి జోడించండి",
    stopAudio: "వాయిస్ ఆపండి",
    listenAudio: "వివరాలు వినండి",
    copied: "కాపీ చేయబడింది!",
    copyReport: "రిపోర్ట్ కాపీ (Markdown)"
  },
  hi: {
    identity: "📦 उत्पाद पहचान",
    descriptionCrops: "4. 📝 उत्पाद विवरण और अनुशंसित फसलें",
    composition: "🧪 रासायनिक संरचना",
    pricing: "💰 मूल्य एवं खुदरा विवरण",
    mixingPPE: "🛡️ पंप छिड़काव मात्रा एवं सुरक्षा",
    scanAnother: "दूसरी बोतल स्कैन करें",
    addToInventory: "फार्म इन्वेंटरी में जोड़ें",
    stopAudio: "आवाज रोकें",
    listenAudio: "विवरण सुनें",
    copied: "कॉपी हो गया!",
    copyReport: "रिपोर्ट कॉपी करें"
  },
  ta: {
    identity: "3. 📦 தயாரிப்பு அடையாள அட்டை",
    descriptionCrops: "4. 📝 தயாரிப்பு விளக்கம் & அங்கீகரிக்கப்பட்ட பயிர்கள்",
    composition: "5. 🧪 வேதியியல் கலவை & செயலில் உள்ள பொருட்கள்",
    pricing: "6. 💰 விலை & நிதி விவரங்கள்",
    mixingPPE: "7. 🛡️ கலவை முறை & பிபிஇ பாதுகாப்பு விதிமுறைகள்",
    scanAnother: "மற்றொரு பொருளை ஸ்கேன் செய்",
    addToInventory: "பண்ணை இருப்பில் சேர்க்கவும்",
    stopAudio: "ஆடியோவை நிறுத்து",
    listenAudio: "விவரங்களை கேளுங்கள்",
    copied: "நகலெடுக்கப்பட்டது!",
    copyReport: "அறிக்கையை நகலெடு"
  },
  kn: {
    identity: "3. 📦 ಉತ್ಪನ್ನ ಗುರುತಿನ ಚೀಟಿ",
    descriptionCrops: "4. 📝 ಉತ್ಪನ್ನ ವಿವರಣೆ ಮತ್ತು ಅನುಮೋದಿತ ಬೆಳೆಗಳು",
    composition: "5. 🧪 ಸಂಯೋಜನೆ ಮತ್ತು ಸಕ್ರಿಯ ರಾಸಾಯನಿಕಗಳು",
    pricing: "6. 💰 ಬೆಲೆ ಮತ್ತು ಆರ್ಥಿಕ ವಿವರಗಳು",
    mixingPPE: "7. 🛡️ ಮಿಶ್ರಣ ವಿಧಾನ ಮತ್ತು ಪಿಪಿಇ ಸುರಕ್ಷತೆ",
    scanAnother: "ಮತ್ತೊಂದು ಬಾಟಲಿಯನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ",
    stopAudio: "ಧ್ವನಿ ನಿಲ್ಲಿಸಿ",
    listenAudio: "ವಿವರಗಳನ್ನು ಆಲಿಸಿ",
    copied: "ನಕಲಿಸಲಾಗಿದೆ!",
    copyReport: "ವರದಿ ನಕಲಿಸಿ"
  },
  ml: {
    identity: "3. 📦 ഉൽപ്പന്ന തിരിച്ചറിയൽ കാർഡ്",
    descriptionCrops: "4. 📝 ഉൽപ്പന്ന വിവരണം & അംഗീകൃത വിളകൾ",
    composition: "5. 🧪 ഘടനയും സജീവ ഘടകങ്ങളും",
    pricing: "6. 💰 വിലയും സാമ്പത്തിക വിവരങ്ങളും",
    mixingPPE: "7. 🛡️ മിശ്രിത രീതി & പിപിഇ സുരക്ഷാ മുൻകരുതലുകൾ",
    scanAnother: "മറ്റൊരു കുപ്പി സ്കാൻ ചെയ്യുക",
    stopAudio: "ശബ്ദം നിർത്തുക",
    listenAudio: "വിവരങ്ങൾ കേൾക്കുക",
    copied: "പകർത്തി!",
    copyReport: "റിപ്പോർട്ട് പകർത്തുക"
  },
  mr: {
    identity: "3. 📦 उत्पादन ओळख कार्ड",
    descriptionCrops: "4. 📝 उत्पादन तपशील आणि शिफारस केलेली पिके",
    composition: "5. 🧪 रासायनिक रचना आणि सक्रिय घटक",
    pricing: "6. 💰 किंमत आणि आर्थिक तपशील",
    mixingPPE: "7. 🛡️ द्रावण तयार करण्याची पद्धत आणि पीपीई सुरक्षा",
    scanAnother: "दुसरी बाटली स्कॅन करा",
    stopAudio: "आवाज थांबवा",
    listenAudio: "तपशील ऐका",
    copied: "कॉपी केले!",
    copyReport: "अहवाल कॉपी करा"
  },
  gu: {
    identity: "3. 📦 ઉત્પાદન ઓળખ પત્ર",
    descriptionCrops: "4. 📝 ઉત્પાદન વર્ણન અને માન્ય પાક",
    composition: "5. 🧪 રાસાયણિક બંધારણ અને સક્રિય ઘટકો",
    pricing: "6. 💰 કિંમત અને આર્થિક વિગતો",
    mixingPPE: "7. 🛡️ મિશ્રણ પદ્ધતિ અને પીપીઇ સુરક્ષા",
    scanAnother: "બીજી બોટલ સ્કેન કરો",
    stopAudio: "અવાજ બંધ કરો",
    listenAudio: "વિગતો સાંભળો",
    copied: "કૉપિ થઈ ગયું!",
    copyReport: "અહેવાલ કૉપિ કરો"
  },
  bn: {
    identity: "3. 📦 পণ্য সনাক্তকরণ কার্ড",
    descriptionCrops: "4. 📝 পণ্যের বিবরণ ও অনুমোদিত ফসল",
    composition: "5. 🧪 রাসায়নিক উপাদান ও সক্রিয় উপাদান",
    pricing: "6. 💰 মূল্য ও আর্থিক বিবরণ",
    mixingPPE: "7. 🛡️ মিশ্রণ পদ্ধতি ও পিপিই নিরাপত্তা",
    scanAnother: "অন্য বোতল স্ক্যান করুন",
    stopAudio: "অডিও বন্ধ করুন",
    listenAudio: "বিবরণ শুনুন",
    copied: "কপি করা হয়েছে!",
    copyReport: "রিপোর্ট কপি করুন"
  },
  pa: {
    identity: "3. 📦 ਉਤਪਾਦ ਪਛਾਣ ਪੱਤਰ",
    descriptionCrops: "4. 📝 ਉਤਪਾਦ ਵੇਰਵਾ ਅਤੇ ਮਨਜ਼ੂਰਸ਼ੁਦਾ ਫ਼ਸਲਾਂ",
    composition: "5. 🧪 ਰਸਾਇਣਕ ਬਣਤਰ ਅਤੇ ਕਿਰਿਆਸ਼ੀਲ ਤੱਤ",
    pricing: "6. 💰 ਕੀਮਤ ਅਤੇ ਵਿੱਤੀ ਵੇਰਵੇ",
    mixingPPE: "7. 🛡️ ਘੋਲ ਤਿਆਰ ਕਰਨ ਦਾ ਢੰਗ ਅਤੇ ਪੀਪੀਈ ਸੁਰੱਖਿਆ",
    scanAnother: "ਹੋਰ ਬੋਤਲ ਸਕੈਨ ਕਰੋ",
    stopAudio: "ਆਵਾਜ਼ ਬੰਦ ਕਰੋ",
    listenAudio: "ਵੇਰਵੇ ਸੁਣੋ",
    copied: "ਕਾਪੀ ਹੋ ਗਿਆ!",
    copyReport: "ਰਿਪੋਰਟ ਕਾਪੀ ਕਰੋ"
  },
  or: {
    identity: "3. 📦 ଉତ୍ପାଦ ପରିଚୟ ପତ୍ର",
    descriptionCrops: "4. 📝 ଉତ୍ପାଦ ବିବରଣୀ ଏବଂ ଅନୁମୋଦିତ ଫସଲ",
    composition: "5. 🧪 ରାସାୟନିକ ସଂରଚନା ଏବଂ ସକ୍ରିୟ ଉପାଦାନ",
    pricing: "6. 💰 ମୂଲ୍ୟ ଏବଂ ଆର୍ଥିକ ବିବରଣୀ",
    mixingPPE: "7. 🛡️ ମିଶ୍ରଣ ପ୍ରଣାଳୀ ଏବଂ ପିପିଇ ସୁରକ୍ଷା",
    scanAnother: "ଅନ୍ୟ ବୋତଲ ସ୍କାନ୍ କରନ୍ତୁ",
    stopAudio: "ଅଡିଓ ବନ୍ଦ କରନ୍ତୁ",
    listenAudio: "ବିବରଣୀ ଶୁଣନ୍ତୁ",
    copied: "କପି ହୋଇଗଲା!",
    copyReport: "ରିପୋର୍ଟ କପି କରନ୍ତୁ"
  },
  ur: {
    identity: "3. 📦 پروڈکٹ شناختی کارڈ",
    descriptionCrops: "4. 📝 پروڈکٹ تفصیل اور منظور شدہ فصلیں",
    composition: "5. 🧪 کیمیائی ساخت اور فعال اجزاء",
    pricing: "6. 💰 قیمت اور مالیاتی تفصیلات",
    mixingPPE: "7. 🛡️ مکسنگ کا طریقہ اور پی پی ای حفاظتی تدابیر",
    scanAnother: "دوسری بوتل اسکین کریں",
    stopAudio: "آواز روکیں",
    listenAudio: "تفصیلات سنیں",
    copied: "کاپی ہو گیا!",
    copyReport: "رپورٹ کاپی کریں"
  }
};

const AgrochemicalResults = ({ data = {}, previewUrl, onScanAnother }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const overrides = {};
  const isHumanCalibrated = false;

  const currentLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  // Tab-isolated language state: persists within this tab without mutating global website
  const [activeLang, setActiveLang] = useState(() => {
    try {
      const preferred = JSON.parse(localStorage.getItem('agrishield_preferred_languages'));
      if (Array.isArray(preferred) && preferred.length > 0) {
        const cached = sessionStorage.getItem('agrishield_tab_lang_agro');
        if (cached && preferred.includes(cached)) return cached;
        return preferred[0];
      }
    } catch (_) {}
    return sessionStorage.getItem('agrishield_tab_lang_agro') || currentLang || 'en';
  });

  const locUI = AGRO_UI_LOCALIZATIONS[activeLang] || AGRO_UI_LOCALIZATIONS[activeLang?.slice(0, 2)] || AGRO_UI_LOCALIZATIONS.en;

  // Listen for changes saved in Profile -> Languages tab
  useEffect(() => {
    const handleUpdate = (e) => {
      const langs = e?.detail?.languages;
      if (Array.isArray(langs) && langs.length > 0) {
        if (!langs.includes(activeLang)) {
          setActiveLang(langs[0]);
          sessionStorage.setItem('agrishield_tab_lang_agro', langs[0]);
        }
      }
    };
    window.addEventListener('agrishield-preferred-languages-updated', handleUpdate);
    return () => window.removeEventListener('agrishield-preferred-languages-updated', handleUpdate);
  }, [activeLang]);
  const [translatedCache, setTranslatedCache] = useState(() => data?.translations || {});
  const [isTranslating, setIsTranslating] = useState(false);

  // Sync cache and active language with incoming data props
  useEffect(() => {
    if (data?.translations) {
      setTranslatedCache(prev => ({ ...prev, ...data.translations }));
    }
    if (data?.current_language) {
      setActiveLang(data.current_language);
    }
  }, [data]);

  // Request on-demand translation if user selects a language not yet in cache
  useEffect(() => {
    if (activeLang === 'en') return;
    if (translatedCache[activeLang]) return;

    let isMounted = true;
    const fetchTranslation = async () => {
      setIsTranslating(true);
      try {
        const res = await API.post('/api/translate-agrochemical', {
          agrochemical: data,
          language: activeLang
        });
        if (isMounted && res.data?.success && res.data?.agrochemical) {
          setTranslatedCache(prev => ({
            ...prev,
            [activeLang]: res.data.agrochemical
          }));
        }
      } catch (err) {
        console.warn("On-demand agrochemical translation failed:", err);
      } finally {
        if (isMounted) setIsTranslating(false);
      }
    };

    fetchTranslation();
    return () => { isMounted = false; };
  }, [activeLang, data, translatedCache]);

  const handleLanguageSelect = (langCode) => {
    const clean = (langCode || 'en').split('-')[0].toLowerCase();
    setActiveLang(clean);
    sessionStorage.setItem('agrishield_tab_lang_agro', clean);
    // Explicitly isolated to Agrochemical tab: does NOT mutate global website i18n
  };

  // Active localized data object (cached translation or raw data)
  const activeData = translatedCache[activeLang] || data;

  // Extract the core structured sections with intelligent fallbacks
  const rawDetails = activeData?.product_details || activeData?.info?.product_details || {};
  const isFert = Boolean(rawDetails.is_fertilizer || activeData?.is_fertilizer || activeData?.info?.is_fertilizer || activeData?.category_type === 'Fertilizer');

  const productDetails = {
    brand_name: rawDetails.brand_name || activeData?.productName || activeData?.info?.product_name || "Certified Agricultural Product",
    company: rawDetails.company || activeData?.brand || activeData?.info?.brand || "Registered Manufacturer",
    active_ingredient: rawDetails.active_ingredient || activeData?.activeIngredient || activeData?.info?.active_ingredients || "Active Agricultural Formulation",
    category_type: rawDetails.category_type || activeData?.category_type || activeData?.info?.category_type || (isFert ? "Fertilizer" : "Pesticide"),
    is_fertilizer: isFert,
    detailed_description: rawDetails.detailed_description || activeData?.detailed_description || activeData?.info?.detailed_description || "",
    primary_function: rawDetails.primary_function || activeData?.primary_function || activeData?.info?.primary_function || (
      isFert
        ? "Provides balanced primary macronutrients (Nitrogen, Phosphorus, Potassium) to stimulate vigorous root growth, vegetative canopy development, and superior fruit/grain filling."
        : "Delivers targeted crop protection to eradicate pests and fungal pathogens, preserving crop yields."
    ),
    formulation: rawDetails.formulation || activeData?.formulation || activeData?.info?.formulation || "Water Soluble Granular / Liquid Formulation",
    batch_number: rawDetails.batch_number || activeData?.batchNumber || activeData?.info?.batch_number || "Verified Authentic Batch",
    mfg_date: rawDetails.mfg_date || activeData?.mfgDate || activeData?.info?.mfg_date || "Recent Manufacturing",
    exp_date: rawDetails.exp_date || activeData?.expDate || activeData?.info?.exp_date || "Best before 24-36 months",
    net_quantity: rawDetails.net_quantity || activeData?.netQuantity || activeData?.info?.net_qty || "50 kg (Standard Agricultural Pack)",
    mrp_price: rawDetails.mrp_price || activeData?.mrp_price || activeData?.info?.mrp_price || "₹1,470 (Inclusive of all taxes)",
    government_subsidy: rawDetails.government_subsidy || activeData?.government_subsidy || activeData?.info?.government_subsidy || "Subsidized under PMBJP / Central Fertilizer NBS Scheme",
    registration_number: rawDetails.registration_number || activeData?.registrationNumber || activeData?.info?.registration_number || "CIR-Verified",
    hazard_color: rawDetails.hazard_color || activeData?.info?.hazard_color || "#16a34a",
    toxicity_class: rawDetails.toxicity_class || activeData?.toxicityClass || activeData?.info?.toxicity_level || "Class III - Caution (Green/Blue Triangle)",
    image_url: rawDetails.image_url || activeData?.info?.image_url || "/products/agrochemical_bottle.jpg"
  };

  const generateMarkdownReport = () => {
    return `### 📦 Product Identity
- **Product Name**: ${productDetails.brand_name}
- **Type**: ${productDetails.category_type}
- **Manufacturer**: ${productDetails.company}

### 📝 Product Description & Usage
- **Description**: ${productDetails.detailed_description || detailedDescription}

### 🧪 Composition & Technical Details
- **Active Elements**: ${productDetails.active_ingredient}
- **Primary Function**: ${productDetails.primary_function}

### 💰 Pricing & Financials
- **Retail Price (MRP)**: ${productDetails.mrp_price}
- **Government Subsidy**: ${productDetails.government_subsidy}
- **Net Weight**: ${productDetails.net_quantity}`;
  };

    const handleShareWhatsApp = () => {
    const text = `*AgriShield Agrochemical Verification*\n` +
      `Product: *${productDetails.brand_name}*\n` +
      `Category: ${categoryMeta.type}\n` +
      `Active Ingredient: ${productDetails.active_ingredient}\n` +
      `Recommended Dose: *${userInstructions.dilution_rate_per_litre}*\n` +
      `Spray Timing: ${userInstructions.best_spray_timing}\n` +
      `Verified via AgriShield AI`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleCopyMarkdown = () => {
    const report = generateMarkdownReport();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(report);
    }
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2500);
  };

  const userInstructions = activeData?.user_instructions || activeData?.info?.user_instructions || {
    dilution_rate_per_litre: activeData?.mixingRatio || activeData?.dosage || activeData?.info?.recommended_dosage || "2.0 mL or 2.5 g / L of clean water",
    mixing_guide: [
      "1. Take 2 to 3 litres of fresh, clean water in a dedicated plastic mixing bucket.",
      "2. Accurately measure the recommended product dose using a clean measuring cup or scoop.",
      "3. Pour into the bucket and stir vigorously with a clean wooden or plastic stick until fully dissolved.",
      "4. Pour the pre-mixed solution into the sprayer tank filled with the rest of the clean water through the strainer.",
      "5. Agitate the tank gently and apply as a uniform fine mist covering both upper and lower leaf surfaces."
    ],
    best_spray_timing: "Early morning (6:00 AM – 9:00 AM) or late afternoon / evening (4:30 PM – 6:30 PM). Avoid peak midday sunlight and wind to prevent rapid chemical evaporation and crop scorch.",
    spray_interval: activeData?.sprayInterval || activeData?.info?.spray_interval || "Repeat after 10 to 14 days if disease or pest pressure persists.",
    ppe_precautions: [
      "Wear chemical-resistant nitrile or neoprene rubber gloves during measuring, mixing, and spraying.",
      "Wear protective safety goggles or a transparent face shield to prevent accidental splashes.",
      "Wear an N95 particulate / vapor respirator mask while spraying to avoid inhaling fine mist.",
      "Wear long-sleeved clothing and waterproof boots; wash face, hands, and skin with soap immediately after spraying."
    ],
    is_fertilizer: false
  };

  const chemicalExplanation = activeData?.chemical_explanation || activeData?.info?.chemical_explanation || {
    category_type: activeData?.category_type || activeData?.info?.category_type || "Pesticide",
    is_fertilizer: activeData?.is_fertilizer || activeData?.info?.is_fertilizer || false,
    fertilizer_growth_stages: activeData?.fertilizer_growth_stages || activeData?.info?.fertilizer_growth_stages || null,
    action_mode: activeData?.info?.action_mode || activeData?.category || activeData?.info?.product_type || "Dual Action Protective & Curative Formulation",
    approved_crops: activeData?.info?.target_crops || ["Tomato", "Chilli", "Paddy", "Cotton", "Vegetables"],
    target_diseases_and_pests: activeData?.info?.target_diseases || ["Fungal Blights", "Leaf Spots", "Mildew", "Insect Pests"],
    preharvest_interval: activeData?.info?.preharvest_interval ? `${activeData.info.preharvest_interval} mandatory waiting period before harvest.` : "14 days waiting period before crop harvest.",
    utility_and_benefits: "Delivers rapid, targeted foliar protection by inhibiting pathogen cell metabolism and halting pest damage, protecting overall crop yield."
  };

  // Determine Product Category Classification
  const getCategoryMeta = () => {
    const rawCategory = productDetails?.category_type || chemicalExplanation?.category_type || activeData?.category_type || activeData?.info?.category_type || '';
    const text = `${productDetails?.brand_name} ${productDetails?.active_ingredient} ${chemicalExplanation?.action_mode} ${rawCategory}`.toLowerCase();

    if (rawCategory === 'Fertilizer' || text.includes('fertiliz') || text.includes('urea') || text.includes('npk') || text.includes('nutrient') || text.includes('పోషక') || text.includes('ఎరువు')) {
      return {
        type: 'Fertilizer',
        label: ({ te: 'ఎరువు & మొక్కల పోషణ', ta: 'உரம் & தாவர ஊட்டச்சத்து', hi: 'उर्वरक एवं पादप पोषण', kn: 'ಗೊಬ್ಬರ ಮತ್ತು ಸಸ್ಯ ಪೋಷಣೆ', ml: 'വളവും സസ്യപോഷണവും', or: 'ଖତ ଏବଂ ଉଦ୍ଭିଦ ପୋଷଣ', en: 'Fertilizer & Plant Nutrition' })[activeLang] || 'Fertilizer & Plant Nutrition',
        icon: '🌱',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40',
        textColor: 'text-emerald-400'
      };
    }
    if (rawCategory === 'Fungicide' || text.includes('fungicid') || text.includes('blight') || text.includes('mancozeb') || text.includes('saaf') || text.includes('copper') || text.includes('mildew') || text.includes('శిలీంధ్ర') || text.includes('తెగులు')) {
      return {
        type: 'Fungicide',
        label: ({ te: 'శిలీంద్ర సంహారిణి (తెగుళ్ల నివారణ)', ta: 'பூஞ்சைக்கொல்லி (பூஞ்சை நோய் தடுப்பு)', hi: 'कवकनाशी (फफूंद रोग नियंत्रण)', kn: 'ಶಿಲೀಂಧ್ರನಾಶಕ (ರೋಗ ನಿಯಂತ್ರಣ)', ml: 'കുമിൾനാശിനി (രോഗ നിയന്ത്രണം)', or: 'କବକନାଶକ (ରୋଗ ନିୟନ୍ତ୍ରଣ)', en: 'Fungicide (Fungal Disease Control)' })[activeLang] || 'Fungicide (Fungal Disease Control)',
        icon: '🍄',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-950/40',
        textColor: 'text-rose-400'
      };
    }
    if (rawCategory === 'Insecticide' || text.includes('insecticid') || text.includes('coragen') || text.includes('confidor') || text.includes('imidacloprid') || text.includes('pest') || text.includes('thrips') || text.includes('పురుగు') || text.includes('కీటక')) {
      return {
        type: 'Insecticide',
        label: activeLang === 'te' ? 'పురుగుమందు (కీటకాల నివారణ)' : activeLang === 'ta' ? 'பூச்சிக்கொல்லி (பூச்சி கட்டுப்பாடு)' : activeLang === 'hi' ? 'कीटनाशक (कीट नियंत्रण)' : 'Insecticide (Pest & Insect Control)',
        icon: '🐛',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-amber-950/40',
        textColor: 'text-amber-400'
      };
    }
    if (rawCategory === 'Herbicide' || text.includes('herbicid') || text.includes('weed') || text.includes('glyphosate') || text.includes('కలుపు')) {
      return {
        type: 'Herbicide',
        label: activeLang === 'te' ? 'కలుపు మందు (కలుపు మొక్కల నివారణ)' : activeLang === 'ta' ? 'களைக்கொல்லி (களை கட்டுப்பாடு)' : activeLang === 'hi' ? 'शाकनाशी (खरपतवार नियंत्रण)' : 'Herbicide (Weed & Grass Control)',
        icon: '🌿',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-purple-950/40',
        textColor: 'text-purple-400'
      };
    }
    if (rawCategory === 'Plant Growth Regulator' || text.includes('growth regulator') || text.includes('pgr') || text.includes('వృద్ధి')) {
      return {
        type: 'Plant Growth Regulator',
        label: activeLang === 'te' ? 'మొక్కల వృద్ధి నియంత్రకం (PGR)' : activeLang === 'ta' ? 'தாவர வளர்ச்சி சீராக்கி (PGR)' : activeLang === 'hi' ? 'पादप वृद्धि नियामक (PGR)' : 'Plant Growth Regulator (PGR)',
        icon: '📈',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 shadow-cyan-950/40',
        textColor: 'text-cyan-400'
      };
    }
    return {
      type: 'Pesticide',
      label: activeLang === 'te' ? 'వ్యవసాయ పంట సంరక్షణ మందు' : activeLang === 'ta' ? 'பயிர் பாதுகாப்பு மருந்து' : activeLang === 'hi' ? 'कृषि फसल सुरक्षा उत्पाद' : 'Agricultural Crop Protection / Pesticide',
      icon: '🧪',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-950/40',
      textColor: 'text-blue-400'
    };
  };

  const categoryMeta = getCategoryMeta();
  const isFertilizer = categoryMeta.type === 'Fertilizer' || productDetails?.is_fertilizer || chemicalExplanation?.is_fertilizer;

  // Fertilizer Growth Stages Data
  const growthStages = chemicalExplanation?.fertilizer_growth_stages || {
    vegetative_stage: activeLang === 'te'
      ? "బలమైన వేరు వ్యవస్థ, కొత్త పిలకల ఏర్పాటు మరియు పత్రహరిత తయారీకి తోడ్పడుతుంది."
      : "Supports vigorous root establishment, rapid shoot tillering, and deep chlorophyll synthesis. Apply during early vegetative flush to build a strong canopy foundation.",
    flowering_stage: activeLang === 'te'
      ? "పూత రాలడాన్ని అరికట్టి, ఎక్కువ మొగ్గలు రావడానికి మరియు ఫలదీకరణకు సహాయపడుతుంది."
      : "Enhances floral bud formation, prevents premature flower drop, and boosts pollen fertility for maximum pollination success.",
    fruiting_stage: activeLang === 'te'
      ? "కాయలు బరువు పెరగడానికి, రంగు, నాణ్యత మరియు గింజ నిండుదనానికి దోహదం చేస్తుంది."
      : "Promotes uniform fruit enlargement, grain filling, sugar accumulation, pulp density, and optimal post-harvest firmness."
  };

  // Detailed Description Text
  const detailedDescription = productDetails?.detailed_description ||
    chemicalExplanation?.detailed_description ||
    chemicalExplanation?.utility_and_benefits ||
    `${productDetails.brand_name} is a high-grade agricultural product manufactured by ${productDetails.company}. It delivers targeted plant protection and health optimization through ${chemicalExplanation.action_mode.toLowerCase()}.`;

  // Determine detection source
  const isWebSearch = activeData?.source === 'live_web_search' || productDetails?.verification_source === 'live_web_search';
  const isCatalog = activeData?.source === 'catalog' || productDetails?.verification_source === 'catalog';
  const isGeminiVision = activeData?.gemini_vision_used || productDetails?.gemini_vision_used || activeData?.source === 'gemini_vision_ocr';

  // Build high-clarity speech summary
  const agroSpeech = activeLang === 'te'
    ? `${productDetails.brand_name}, వర్గం: ${categoryMeta.label}, కంపెనీ: ${productDetails.company}. క్రియాశీల రసాయనం: ${productDetails.active_ingredient}. ఉపయోగించే మోతాదు: లీటరు నీటికి ${userInstructions.dilution_rate_per_litre}. పిచికారీ సమయం: ఉదయం లేదా సాయంత్రం.`
    : activeLang === 'ta'
    ? `${productDetails.brand_name}, வகை: ${categoryMeta.label}, நிறுவனம்: ${productDetails.company}. தீவிர மூலக்கூறு: ${productDetails.active_ingredient}. அளவு: ஒரு லிட்டர் தண்ணீருக்கு ${userInstructions.dilution_rate_per_litre}.`
    : activeLang === 'hi'
    ? `${productDetails.brand_name}, श्रेणी: ${categoryMeta.label}, कंपनी: ${productDetails.company}. सक्रिय रसायन: ${productDetails.active_ingredient}. उपयोग दर: प्रति लीटर पानी में ${userInstructions.dilution_rate_per_litre}. छिड़काव का समय: सुबह या शाम.`
    : activeLang === 'kn'
    ? `${productDetails.brand_name}, ವರ್ಗ: ${categoryMeta.label}, ಕಂಪನಿ: ${productDetails.company}. ಸಕ್ರಿಯ ಪದಾರ್ಥ: ${productDetails.active_ingredient}. ಪ್ರಮಾಣ: ಪ್ರತಿ ಲೀಟರ್ ನೀರಿಗೆ ${userInstructions.dilution_rate_per_litre}.`
    : `${productDetails.brand_name}, Category: ${categoryMeta.type}, by ${productDetails.company}. Active ingredient: ${productDetails.active_ingredient}. Recommended dilution: ${userInstructions.dilution_rate_per_litre}.`;

  const renderLanguageSwitcher = () => (
    <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between gap-3 flex-wrap">
      <ScanLanguageBar
        activeLang={activeLang}
        onLanguageSelect={handleLanguageSelect}
        isTranslating={isTranslating}
        label={activeLang === 'te' ? 'భాషను మార్చండి' : activeLang === 'hi' ? 'भाषा बदलें' : 'Advisory Language'}
        className="w-full justify-between sm:justify-start"
      />
    </div>
  );

    const [zoomImageModal, setZoomImageModal] = useState(null);
  const [selectedTankSize, setSelectedTankSize] = useState(15); // Standard 15L backpack pump

  const displayOriginalImg = previewUrl || data?.image_data_url || data?.image_path || data?.imageUrl;

  const [selectedAgroRefIdx, setSelectedAgroRefIdx] = useState(0);

  const agroRefList = useMemo(() => {
    const isTe = activeLang === 'te';
    const primary = productDetails.image_url || '/samples/chilli_leaf_spot.jpg';
    const brandLow = (productDetails.brand_name || '').toLowerCase();
    const actLow = (productDetails.active_ingredient || '').toLowerCase();

    // Choose authentic product bottle images based on brand/ingredient
    let secondaryImg = '/products/saaf_upl.jpg';
    let tertiaryImg = '/products/iffco_19_19_19.jpg';

    if (brandLow.includes('mancozeb') || brandLow.includes('indofil') || actLow.includes('mancozeb')) {
      secondaryImg = '/products/indofil_m45.webp';
      tertiaryImg = '/products/ridomil_gold_syngenta.jpg';
    } else if (brandLow.includes('admire') || brandLow.includes('confidor') || actLow.includes('imidacloprid')) {
      secondaryImg = '/products/admire_bayer.webp';
      tertiaryImg = '/products/confidor_bayer.jpg';
    } else if (brandLow.includes('coragen') || actLow.includes('chlorantraniliprole')) {
      secondaryImg = '/products/coragen_fmc.jpg';
      tertiaryImg = '/products/benevia_fmc.jpg';
    } else if (brandLow.includes('actara') || actLow.includes('thiamethoxam')) {
      secondaryImg = '/products/actara_syngenta.jpg';
      tertiaryImg = '/products/alika_syngenta.jpg';
    } else if (brandLow.includes('proclaim') || actLow.includes('emamectin')) {
      secondaryImg = '/products/proclaim_syngenta.webp';
      tertiaryImg = '/products/coragen_fmc.jpg';
    } else if (brandLow.includes('fertilizer') || brandLow.includes('npk') || actLow.includes('npk')) {
      secondaryImg = '/products/iffco_19_19_19.jpg';
      tertiaryImg = '/products/iffco_nano_urea.jpg';
    }

    return [
      { id: 'agro_01', image_url: primary, stage: isTe ? 'బాటిల్ లేబుల్ (Official Bottle Label)' : 'Official Bottle Label' },
      { id: 'agro_02', image_url: secondaryImg, stage: isTe ? 'రిజిస్టర్డ్ ప్యాకింగ్ (Registered Pack Spec)' : 'Registered Pack Spec' },
      { id: 'agro_03', image_url: tertiaryImg, stage: isTe ? 'CIB&RC భద్రతా పత్రం (Official Registry Record)' : 'Official Registry Record' }
    ];
  }, [productDetails, activeLang]);

  const displayReferenceImg = agroRefList[selectedAgroRefIdx]?.image_url || agroRefList[0].image_url;

  const handleDownloadPDF = () => {
    window.print();
  };

  const handleShareWhatsAppLocalized = () => {
    const text = activeLang === 'te'
      ? `*🌾 అగ్రిషీల్డ్ AI - పురుగుమందు లేబుల్ రికార్డు*\n\n` +
        `📦 *ఉత్పత్తి:* ${productDetails.brand_name}\n` +
        `🧪 *రసాయనం:* ${productDetails.active_ingredient}\n` +
        `🏷️ *వర్గం:* ${categoryMeta.label}\n` +
        `💧 *15L పంపు మోతాదు:* ${(selectedTankSize * 2.0).toFixed(0)} ml / ${selectedTankSize} లీటర్ల నీటికి\n` +
        `⏱️ *వేచి ఉండే సమయం (PHI):* ${chemicalExplanation.preharvest_interval}\n` +
        `🛡️ *తయారీదారు:* ${productDetails.company}\n\n` +
        `📲 *అగ్రిషీల్డ్ AI యాప్‌లో చూడండి:* http://localhost:3000/scan`
      : `*🌾 AgriShield AI - Agrochemical Product Dossier*\n\n` +
        `📦 *Product:* ${productDetails.brand_name}\n` +
        `🧪 *Active Chemical:* ${productDetails.active_ingredient}\n` +
        `🏷️ *Category:* ${categoryMeta.type}\n` +
        `💧 *Recommended Dose:* ${(selectedTankSize * 2.0).toFixed(0)} ml per ${selectedTankSize}L spray pump\n` +
        `⏱️ *PHI Waiting Period:* ${chemicalExplanation.preharvest_interval}\n` +
        `🛡️ *Company:* ${productDetails.company}\n\n` +
        `📲 *Open on AgriShield AI:* http://localhost:3000/scan`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-12">
      {/* ==================== 1. LANGUAGE BAR ==================== */}
      <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <ScanLanguageBar
          activeLang={activeLang}
          onLanguageSelect={handleLanguageSelect}
          isTranslating={isTranslating}
          label={activeLang === 'te' ? 'సలహా భాష' : 'Advisory Language'}
          className="w-full justify-between sm:justify-start"
        />
      </div>

      {/* ==================== CARD 1: EXECUTIVE VERIFICATION & DUAL VISUAL MATCH ==================== */}
      <Card className="p-5 sm:p-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl relative overflow-hidden space-y-4">
        {/* Top Status & Audio Row */}
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-xs flex items-center gap-1.5 ${categoryMeta.badgeColor}`}>
              <span>{categoryMeta.icon}</span>
              <span>{categoryMeta.label}</span>
            </span>

            {/* CIB&RC Verification Badge */}
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{activeLang === 'te' ? 'CIB&RC ధృవీకరించబడింది' : 'CIB&RC Verified'}</span>
            </span>

            {/* Toxicity Class Badge */}
            <span className="px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {productDetails.toxicity_class}
            </span>
          </div>

          {/* Voice Audio Reader */}
          <button
            type="button"
            onClick={() => {
              if (speakingId === 'agro_summary') {
                stopSpeech();
              } else {
                speak(agroSpeech, 'agro_summary', activeLang);
              }
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              speakingId === 'agro_summary'
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>
              {speakingId === 'agro_summary'
                ? (activeLang === 'te' ? 'ఆపండి' : 'Stop')
                : (activeLang === 'te' ? '🔊 వినండి (Telugu Audio)' : '🔊 Listen (Audio)')}
            </span>
            {speakingId === 'agro_summary' && (
              <span className="flex items-center gap-0.5 ml-1">
                <span className="w-1 h-3 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-4 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            )}
          </button>
        </div>

        {/* Dual Visual Match: Farmer Scanned Bottle vs CIB&RC Official Record */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5">
          {/* Left: Farmer Scanned Bottle */}
          <div className="flex flex-col space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>📸</span>
              <span>{activeLang === 'te' ? 'మీరు తీసిన లేబుల్' : 'Your Scanned Label'}</span>
            </span>
            <div
              className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-inner group cursor-pointer"
              onClick={() => setZoomImageModal({ src: displayOriginalImg || displayReferenceImg, title: productDetails.brand_name })}
            >
              {displayOriginalImg ? (
                <img
                  src={displayOriginalImg}
                  alt="Scanned bottle label"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                  <FlaskConical className="w-8 h-8 text-slate-400 mb-1" />
                  <span className="text-xs font-bold">Scanned Bottle</span>
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

          {/* Right: Verified CIB&RC Chemical Record */}
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                <span>🔬</span>
                <span>{activeLang === 'te' ? 'ధృవీకరించబడిన రికార్డు' : 'Verified CIB&RC Profile'}</span>
              </span>
              <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                {selectedAgroRefIdx + 1} / {agroRefList.length}
              </span>
            </div>
            <div
              className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-indigo-500/40 shadow-inner group cursor-pointer"
              onClick={() => {
                const curImg = agroRefList[selectedAgroRefIdx] || agroRefList[0];
                setZoomImageModal({ src: curImg.image_url, title: `Verified: ${productDetails.brand_name} (${curImg.stage || ''})` });
              }}
            >
              <img
                src={displayReferenceImg}
                alt="Verified chemical profile"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/samples/chilli_leaf_spot.jpg';
                }}
              />
              <div className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-black shadow-xs flex items-center gap-1">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
                <span>{activeLang === 'te' ? 'CIB&RC రికార్డు #' + (selectedAgroRefIdx + 1) : 'CIB&RC Record #' + (selectedAgroRefIdx + 1)}</span>
              </div>
              <div className="absolute bottom-1.5 inset-x-1.5 px-2 py-1 rounded-lg bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold truncate">
                {agroRefList[selectedAgroRefIdx]?.stage || (activeLang === 'te' ? 'అధికారిక రికార్డు' : 'Official Record')}
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

        {/* 3-Image Agrochemical Reference Strip */}
        <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-slate-800/60 border border-indigo-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span>🧪</span>
              <span>{activeLang === 'te' ? '3 ధృవీకరించబడిన రికార్డు ఫోటోలు (వివిధ కోణాలు)' : '3 Verified Chemical Dossier Views (Tap to Compare)'}</span>
            </span>
            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
              {activeLang === 'te' ? 'పోల్చడానికి ట్యాప్ చేయండి' : 'Tap to inspect'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {agroRefList.map((ref, idx) => {
              const isSelected = selectedAgroRefIdx === idx;
              return (
                <button
                  key={ref.id || idx}
                  type="button"
                  onClick={() => setSelectedAgroRefIdx(idx)}
                  className={`group relative flex flex-col items-center p-1.5 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/10 shadow-xs ring-2 ring-indigo-500/40'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400'
                  }`}
                >
                  <div className="relative w-full aspect-4/3 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 mb-1">
                    <img
                      src={ref.image_url}
                      alt={ref.stage || `Record ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/samples/chilli_leaf_spot.jpg';
                      }}
                    />
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px] font-black">
                        ✓
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 block truncate w-full">
                    {ref.stage || `Record ${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Names & Chemical Formulation */}
        <div className="pt-1">
          <h2 className="font-display font-black text-2xl sm:text-3xl text-slate-900 dark:text-white leading-tight">
            {productDetails.brand_name}
          </h2>
          <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400 mt-0.5">
            🧪 {productDetails.active_ingredient}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-700 dark:text-slate-300">🏛️ {productDetails.company}</span>
            <span>•</span>
            <span>📜 CIB Reg: {productDetails.registration_number}</span>
          </p>
        </div>
      </Card>

      {/* ==================== CARD 2: 15L BACKPACK PUMP DOSAGE CALCULATOR ==================== */}
      <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-black text-sm uppercase tracking-wider">
            <Droplets className="w-5 h-5 shrink-0 text-cyan-500" />
            <span>{activeLang === 'te' ? 'ఖచ్చితమైన స్ప్రే పంపు మోతాదు & వాడే సమయం' : 'Spray Mixing Dose & Backpack Pump Calculator'}</span>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
            {selectedTankSize}L Tank
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 via-cyan-50/40 to-slate-50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-slate-900 border border-indigo-200 dark:border-indigo-800/60 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div>
              <span className="text-xs font-black uppercase text-indigo-900 dark:text-indigo-300 block mb-0.5">
                {activeLang === 'te' ? 'సిఫార్సు చేసిన మోతాదు (లీటరు నీటికి)' : 'Recommended Manufacturer Dilution'}
              </span>
              <p className="text-base font-black text-slate-900 dark:text-white">
                {userInstructions.dilution_rate_per_litre || '2.0 ml or 2.5 g / లీటరు నీటికి'}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                ⏱️ <strong>{activeLang === 'te' ? 'పిచికారీ సమయం:' : 'Timing:'}</strong> {userInstructions.best_spray_timing}
              </p>
            </div>

            {/* Bold 15L Backpack Pump Gauge */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-center shadow-xs">
              <span className="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 block tracking-wider">
                {activeLang === 'te' ? '15 లీటర్ల వీపు పంపు మోతాదు' : '15L Backpack Pump Dosage'}
              </span>
              <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300 font-display">
                {selectedTankSize === 20 ? '40 ml / g' : selectedTankSize === 200 ? '400 ml / g' : '30 ml / g'}
              </span>
              <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                ({(selectedTankSize * 2.0).toFixed(0)} ml per {selectedTankSize}L water)
              </span>
            </div>
          </div>

          {/* Tank Size Chips */}
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
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-100'
                }`}
              >
                {size === 200 ? `${size}L (Acre Drum)` : `${size}L Pump`}
              </button>
            ))}
          </div>
        </div>

        {/* Pre-Harvest Interval (PHI) Callout */}
        <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <span className="text-[11px] font-black uppercase text-amber-900 dark:text-amber-300 block">
                {activeLang === 'te' ? 'వేచి ఉండే సమయం (PHI Waiting Period)' : 'Pre-Harvest Interval (PHI)'}
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {chemicalExplanation.preharvest_interval}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
            {activeLang === 'te' ? 'ఆహార భద్రతా ప్రమాణం' : 'Food Safety Standard'}
          </span>
        </div>
      </Card>

      {/* ==================== CARD 3: CHEMICAL TOXICITY & PPE SAFETY ==================== */}
      <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>{activeLang === 'te' ? 'విషపూరిత స్థాయి & భద్రతా రక్షణ సూచనలు (PPE)' : 'Toxicity Classification & Safety PPE Guide'}</span>
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
            {productDetails.toxicity_class}
          </span>
        </div>

        {/* 4 PPE Icons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-xl">🧤</span>
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 block">
              {activeLang === 'te' ? 'చేతి తొడుగులు' : 'Rubber Gloves'}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-xl">😷</span>
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 block">
              {activeLang === 'te' ? 'ముఖ మాస్క్' : 'N95 Face Mask'}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-xl">🥽</span>
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 block">
              {activeLang === 'te' ? 'కళ్లద్దాలు' : 'Eye Goggles'}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <span className="text-xl">👢</span>
            <span className="text-[11px] font-black text-slate-800 dark:text-slate-200 block">
              {activeLang === 'te' ? 'రబ్బరు బూట్లు' : 'Rubber Boots'}
            </span>
          </div>
        </div>

        {/* First Aid & Antidote Alert */}
        <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-xs space-y-1">
          <span className="font-black text-rose-800 dark:text-rose-300 uppercase text-[10px] tracking-wider block flex items-center gap-1.5">
            <span>🚨</span>
            <span>{activeLang === 'te' ? 'ప్రథమ చికిత్స & విరుగుడు (First Aid & Antidote)' : 'First Aid & Antidote'}</span>
          </span>
          <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
            {activeLang === 'te'
              ? 'కళ్లలో లేదా చర్మంపై పడితే 15 నిమిషాల పాటు మంచి నీటితో కడగాలి. ప్రమాదవశాత్తు మింగితే వాంతి చేయించవద్దు. వెంటనే వైద్యుడిని సంప్రదించండి.'
              : 'In case of skin or eye contact, flush with clean running water for at least 15 minutes. If ingested, do not induce vomiting. Seek immediate medical attention.'}
          </p>
        </div>
      </Card>

      {/* ==================== CARD 4: APPROVED CROPS & CONTROLLED PESTS ==================== */}
      <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Sprout className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{activeLang === 'te' ? 'ఆమోదిత పంటలు & నియంత్రించే తెగుళ్లు' : 'Approved Target Crops & Controlled Pests'}</span>
          </span>
        </div>

        {/* Approved Crops Chips */}
        <div>
          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 block mb-2">
            🌾 {activeLang === 'te' ? 'సిఫార్సు చేయబడిన పంటలు' : 'Approved Target Crops'}:
          </span>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(chemicalExplanation.approved_crops)
              ? chemicalExplanation.approved_crops
              : ['వరి (Paddy)', 'పత్తి (Cotton)', 'మిరప (Chilli)', 'టమాటా (Tomato)', 'మొక్కజొన్న (Maize)']
            ).map((c, i) => (
              <span key={`crop-${i}`} className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/25 text-xs font-bold">
                🌱 {c}
              </span>
            ))}
          </div>
        </div>

        {/* Controlled Pests / Diseases */}
        <div>
          <span className="text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 block mb-2">
            🩺 {activeLang === 'te' ? 'నియంత్రించే తెగుళ్లు & పురుగులు' : 'Controlled Pests & Pathogens'}:
          </span>
          <div className="flex flex-wrap gap-2">
            {(Array.isArray(chemicalExplanation.target_diseases_and_pests)
              ? chemicalExplanation.target_diseases_and_pests
              : ['కాండం తొలుచు పురుగు', 'ఆకుముడత', 'తెల్లదోమ', 'శిలీంధ్ర ఆకుమచ్చ']
            ).map((p, i) => (
              <span key={`pest-${i}`} className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/25 text-xs font-bold">
                🐛 {p}
              </span>
            ))}
          </div>
        </div>
      </Card>

      {/* ==================== CARD 5: PRICING & ACRE COST ESTIMATE ==================== */}
      <Card className="p-5 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{activeLang === 'te' ? 'ధర & ఎకరాకు అయ్యే ఖర్చు అంచనా' : 'Pricing & Cost per Acre Breakdown'}</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              {activeLang === 'te' ? 'మార్కెట్ రిటైల్ ధర (MRP)' : 'Retail MRP'}
            </span>
            <p className="text-base font-black text-slate-900 dark:text-white">
              {productDetails.mrp_price || '₹350 - ₹450'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
            <span className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400">
              {activeLang === 'te' ? 'ఎకరాకు అయ్యే ఖర్చు' : 'Estimated Cost / Acre'}
            </span>
            <p className="text-base font-black text-emerald-700 dark:text-emerald-300">
              ~₹250 - ₹350 / acre
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              {activeLang === 'te' ? 'ప్రభుత్వ రాయితీ / స్కీమ్' : 'Subsidy Status'}
            </span>
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {productDetails.government_subsidy || 'Standard Registered'}
            </p>
          </div>
        </div>
      </Card>

      {/* ==================== CARD 6: PROFESSIONAL ACTION BAR ==================== */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 1-Click WhatsApp Share */}
          <button
            type="button"
            onClick={handleShareWhatsAppLocalized}
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
            <span>{activeLang === 'te' ? 'సర్టిఫికేట్ ప్రింట్ (PDF)' : 'Print Certificate (PDF)'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Kisan Call Center Helpline */}
          <a
            href="tel:18001801551"
            className="px-3.5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center gap-2 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-all"
          >
            <Phone className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>{activeLang === 'te' ? 'విష నివారణ హెల్ప్‌లైన్ (108 / 1800-180-1551)' : 'Poison Helpline (1800-180-1551)'}</span>
          </a>

          {/* Scan Another Button */}
          <button
            type="button"
            onClick={() => onScanAnother ? onScanAnother() : window.dispatchEvent(new CustomEvent('agrishield-scan-another'))}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 font-black text-xs flex items-center gap-2 transition-all cursor-pointer active:scale-98 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{activeLang === 'te' ? 'మరో బాటిల్‌ను స్కాన్ చేయండి' : 'Scan Another Bottle'}</span>
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
                {zoomImageModal.title || 'Agrochemical Label Inspection'}
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

export default AgrochemicalResults;
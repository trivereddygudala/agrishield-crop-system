/**
 * AgriShield Agricultural Notification Content Translator
 * Automatically translates notification titles and bodies into Telugu, Hindi, Tamil,
 * Kannada, Malayalam, Odia, and English for full farmer readability.
 */

export const CROP_TRANSLATIONS = {
  chilli: { te: 'మిరప', hi: 'मिर्च', ta: 'மிளகாய்', kn: 'ಮೆಣಸಿನಕಾಯಿ', ml: 'മുളക്', or: 'ଲଙ୍କା', en: 'Chilli' },
  chili: { te: 'మిరప', hi: 'मिर्च', ta: 'மிளகாய்', kn: 'ಮೆಣಸಿನಕಾಯಿ', ml: 'മുളക്', or: 'ଲଙ୍କା', en: 'Chilli' },
  mirapa: { te: 'మిరప', hi: 'मिर्च', ta: 'மிளகாய்', kn: 'ಮೆಣಸಿನಕಾಯಿ', ml: 'മുളക്', or: 'ଲଙ୍କା', en: 'Chilli' },
  rice: { te: 'వరి', hi: 'धान', ta: 'நெல்', kn: 'ಭತ್ತ', ml: 'നെല്ല്', or: 'ଧାନ', en: 'Paddy / Rice' },
  paddy: { te: 'వరి', hi: 'धान', ta: 'நெல்', kn: 'ಭತ್ತ', ml: 'നെല്ല്', or: 'ଧାନ', en: 'Paddy' },
  corn: { te: 'మొక్కజొన్న', hi: 'मक्का', ta: 'மக்காச்சோளம்', kn: 'ಮೆಕ್ಕೆಜೋಳ', ml: 'ചോളം', or: 'ମକା', en: 'Maize' },
  maize: { te: 'మొక్కజొన్న', hi: 'मक्का', ta: 'மக்காச்சோளம்', kn: 'ಮೆಕ್ಕೆಜೋಳ', ml: 'ചോളം', or: 'ମକା', en: 'Maize' },
  tomato: { te: 'టమాటా', hi: 'टमाटर', ta: 'தக்காளி', kn: 'ಟೊಮೆಟೊ', ml: 'തക്കാളി', or: 'ଟମାଟୋ', en: 'Tomato' },
  cotton: { te: 'పత్తి', hi: 'कपास', ta: 'பருத்தி', kn: 'ಹತ್ತಿ', ml: 'പരുത്തി', or: 'କପା', en: 'Cotton' },
  potato: { te: 'బంగాళాదుంప', hi: 'आलू', ta: 'உருளைக்கிழங்கு', kn: 'ಆಲೂಗಡ್ಡೆ', ml: 'ഉരുളക്കിഴങ്ങ്', or: 'ଆଳୁ', en: 'Potato' },
  apple: { te: 'యాపిల్', hi: 'सेब', ta: 'ஆப்பிள்', kn: 'ಸೇಬು', ml: 'ആപ്പിൾ', or: 'ସେଓ', en: 'Apple' },
  grape: { te: 'ద్రాక్ష', hi: 'अंगूर', ta: 'திராட்சை', kn: 'ದ್ರಾಕ್ಷಿ', ml: 'മുന്തിരി', or: 'ଅଙ୍ଗୁର', en: 'Grape' },
  grapes: { te: 'ద్రాక్ష', hi: 'अंगूर', ta: 'திராட்சை', kn: 'ದ್ರಾಕ್ಷಿ', ml: 'മുന്തിരി', or: 'ଅଙ୍ଗୁର', en: 'Grapes' },
  mango: { te: 'మామిడి', hi: 'आम', ta: 'மாம்பழம்', kn: 'ಮಾವು', ml: 'മാങ്ങ', or: 'ଆମ୍ବ', en: 'Mango' },
  groundnut: { te: 'వేరుశనగ', hi: 'मूंगफली', ta: 'நிலக்கடலை', kn: 'ಕಡಲೆಕಾಯಿ', ml: 'നിലക്കടല', or: 'ଚିନାବାଦାମ', en: 'Groundnut' },
  peanut: { te: 'వేరుశనగ', hi: 'मूंगफली', ta: 'நிலக்கடலை', kn: 'ಕಡಲೆಕಾಯಿ', ml: 'നിലക്കടല', or: 'ଚିନାବାଦାମ', en: 'Peanut' },
  wheat: { te: 'గోధుమ', hi: 'गेहूं', ta: 'கோதுமை', kn: 'ಗೋಧಿ', ml: 'ഗോതമ്പ്', or: 'ଗହମ', en: 'Wheat' },
  sugarcane: { te: 'చెరకు', hi: 'गन्ना', ta: 'கரும்பு', kn: 'ಕಬ್ಬು', ml: 'കരിമ്പ്', or: 'ଆଖୁ', en: 'Sugarcane' },
  onion: { te: 'ఉల్లిపాయ', hi: 'प्याज', ta: 'வெங்காயம்', kn: 'ಈರುಳ್ಳಿ', ml: 'സവാള', or: 'ପିଆଜ', en: 'Onion' },
  soybean: { te: 'సోయాబీన్', hi: 'सोयाबीन', ta: 'சோயாபீன்', kn: 'ಸೋಯಾಬೀನ್', ml: 'സോയാബീൻ', or: 'ସୋୟାବିନ୍', en: 'Soybean' },
  banana: { te: 'అరటి', hi: 'केला', ta: 'வாழை', kn: 'ಬಾಳೆ', ml: 'വാഴ', or: 'କଦଳୀ', en: 'Banana' },
  citrus: { te: 'నిమ్మ', hi: 'नींबू', ta: 'எலுமிச்சை', kn: 'ನಿಂಬೆ', ml: 'നാരങ്ങ', or: 'ଲେମ୍ବୁ', en: 'Citrus' },
  lemon: { te: 'నిమ్మ', hi: 'नींबू', ta: 'எலுமிச்சை', kn: 'ನಿಂಬೆ', ml: 'നാരങ്ങ', or: 'ଲେମ୍ବୁ', en: 'Lemon' },
  orange: { te: 'నారింజ', hi: 'संतरा', ta: 'ஆரஞ்சு', kn: 'ಕಿತ್ತಳೆ', ml: 'ഓറഞ്ച്', or: 'କମଳା', en: 'Orange' },
  pepper: { te: 'మిరియాలు', hi: 'काली मिर्च', ta: 'மிளகு', kn: 'ಮೆಣಸು', ml: 'കുരുമുളക്', or: 'ଗୋଲମରିଚ', en: 'Pepper' },
  capsicum: { te: 'క్యాప్సికమ్', hi: 'शिमला मिर्च', ta: 'குடைமிளகாய்', kn: 'ದೊಣ್ಣೆ ಮೆಣಸಿನಕಾಯಿ', ml: 'ക്യാപ്സിക്കം', or: 'କ୍ୟାପ୍ସିକମ୍', en: 'Capsicum' },
  crop: { te: 'పంట', hi: 'फसल', ta: 'பயிர்', kn: 'ಬೆಳೆ', ml: 'വിള', or: 'ଫସଲ', en: 'Crop' },
  plant: { te: 'మొక్క', hi: 'पौधा', ta: 'செடி', kn: 'ಗಿಡ', ml: 'ചെടി', or: 'ଗଛ', en: 'Plant' }
};

export const DISEASE_TRANSLATIONS = {
  'leaf spot': { te: 'ఆకు మచ్చ తెగులు', hi: 'पत्ती धब्बा रोग', ta: 'இலைப்புள்ளி நோய்', kn: 'ಎಲೆ ಚುಕ್ಕೆ ರೋಗ', ml: 'ഇലപ്പുള്ളി രോഗം', or: 'ପତ୍ର ଦାଗ ରୋଗ', en: 'Leaf Spot' },
  'early blight': { te: 'ముందస్తు ఆకు ఎండు తెగులు', hi: 'अगेती झुलसा रोग', ta: 'முன் கருகல் நோய்', kn: 'ಮುಂಗಾರು ರೋಗ', ml: 'ഏർലി ബ്ലൈറ്റ്', or: 'ଆଗୁଆ ଝାଉଁଳା ରୋଗ', en: 'Early Blight' },
  'late blight': { te: 'మలి ఎండు తెగులు', hi: 'पछेती झुलसा रोग', ta: 'பின் கருகல் நோய்', kn: 'ತಡವಾದ ರೋಗ', ml: 'ലേറ്റ് ബ്ലൈറ്റ്', or: 'ପଛୁଆ ଝାଉଁଳା ରୋଗ', en: 'Late Blight' },
  'powdery mildew': { te: 'బూడిద తెగులు', hi: 'चूर्णिल आसिता (पाउडरी फफूंदी)', ta: 'சாம்பல் நோய்', kn: 'ಬೂದಿ ರೋಗ', ml: 'ചാരപ്പൂപ്പ് രോഗം', or: 'ପାଉଡର ଫିମ୍ପି', en: 'Powdery Mildew' },
  'downy mildew': { te: 'డౌనీ మిల్డ్యూ తెగులు', hi: 'मृदुरोमिल आसिता', ta: 'அடிச்சாம்பல் நோய்', kn: 'ಡೌನಿ ಮಿಲ್ಡ್ಯೂ ರೋಗ', ml: 'ഡൗണി മിൽഡ്യൂ', or: 'ତଳିଆ ଫିମ୍ପି', en: 'Downy Mildew' },
  'anthracnose': { te: 'కాయ కుళ్లు / ఆంత్రాక్నోస్', hi: 'एन्थ्रेक्नोज / फल सड़न', ta: 'ஆந்த்ராக்னோஸ் / பழ அழுகல்', kn: 'ಆಂಥ್ರಾಕ್ನೋಸ್ / ಕಾಯಿ ಕೊಳೆ', ml: 'ആന്ത്രാക്നോസ് / കായ്ചീയൽ', or: 'ଆନ୍ଥ୍ରାକନୋଜ୍ / ଫଳ ପଚା', en: 'Anthracnose' },
  'bacterial spot': { te: 'బాక్టీరియల్ మచ్చ తెగులు', hi: 'जीवाणु धब्बा रोग', ta: 'பாக்டீரியா புள்ளி நோய்', kn: 'ಬ್ಯಾಕ್ಟೀರಿಯಾ ಚುಕ್ಕೆ ರೋಗ', ml: 'ബാക്ടീരിയൽ ഇലപ്പുള്ളി', or: 'ଜୀବାଣୁ ଦାଗ ରୋଗ', en: 'Bacterial Spot' },
  'bacterial blight': { te: 'బాక్టీరియల్ బ్లైట్', hi: 'जीवाणु झुलसा रोग', ta: 'பாக்டீரியா கருகல் நோய்', kn: 'ಬ್ಯಾಕ್ಟೀರಿಯಾ ಬ್ಲೈಟ್', ml: 'ബാക്ടീരിയൽ ബ്ലാസ്റ്റ്', or: 'ଜୀବାଣୁ ଝାଉଁଳା ରୋଗ', en: 'Bacterial Blight' },
  'common rust': { te: 'తుప్పు తెగులు', hi: 'गेरुआ / रस्ट रोग', ta: 'துரு நோய்', kn: 'ತುಕ್ಕು ರೋಗ', ml: 'തുരുമ്പ് രോഗം', or: 'କଳଙ୍କି ରୋଗ', en: 'Common Rust' },
  'rust': { te: 'తుప్పు తెగులు', hi: 'गेरुआ / रस्ट रोग', ta: 'துரு நோய்', kn: 'ತುಕ್ಕು ರೋಗ', ml: 'തുരുമ്പ് രോഗം', or: 'କଳଙ୍କି ରୋଗ', en: 'Rust' },
  'blast': { te: 'అగ్గి తెగులు', hi: 'झोंका / ब्लास्ट रोग', ta: 'குலை நோய் (பிளாஸ்ட்)', kn: 'ಬೆಂಕಿ ರೋಗ (ಬ್ಲಾಸ್ಟ್)', ml: 'കുലവാട്ടം (ബ്ലാസ്റ്റ്)', or: 'ପତ୍ରପୋଡ଼ା ରୋଗ', en: 'Blast' },
  'yellow leaf curl': { te: 'పసుపు ఆకు ముడత వైరస్', hi: 'पीली पत्ती मरोड़ विषाणु', ta: 'மஞ்சள் இலை சுருள் வைரஸ்', kn: 'ಹಳದಿ ಎಲೆ ಮುದುರು ವೈರಸ್', ml: 'മഞ്ഞളിപ്പ് ഇലച്ചുരുൾ വൈറസ്', or: 'ହଳଦିଆ ପତ୍ର କୁଞ୍ଚନ ଭୂତାଣୁ', en: 'Yellow Leaf Curl Virus' },
  'leaf curl': { te: 'ఆకు ముడత తెగులు', hi: 'पत्ती मरोड़ रोग (लीफ कर्ल)', ta: 'இலை சுருள் நோய்', kn: 'ಎಲೆ ಮುದುರು ರೋಗ', ml: 'ഇലച്ചുരുൾ രോഗം', or: 'ପତ୍ର କୁଞ୍ଚନ ରୋଗ', en: 'Leaf Curl' },
  'mosaic virus': { te: 'మొజాయిక్ వైరస్', hi: 'मोज़ेक वायरस', ta: 'மொசைக் வைரஸ்', kn: 'ಮೊಸಾಯಿಕ್ ವೈರಸ್', ml: 'മൊസൈക് വൈറസ്', or: 'ମୋଜାଇକ୍ ଭୂତାଣୁ', en: 'Mosaic Virus' },
  'mosaic': { te: 'మొజాయిక్ వైరస్', hi: 'मोज़ेक वायरस', ta: 'மொசைக் வைரஸ்', kn: 'ಮೊಸಾಯಿಕ್ ವೈರಸ್', ml: 'മൊസൈക് വൈറസ്', or: 'ମୋଜାଇକ୍ ଭୂତାଣୁ', en: 'Mosaic' },
  'spider mites': { te: 'ఎర్ర నల్లి తెగులు', hi: 'लाल मकड़ी कीट', ta: 'செம்பேன்', kn: 'ಕೆಂಪು ನುಸಿ ಕೀಟ', ml: 'ചുവന്ന മണ്ഡരി', or: 'ନାଲି ବୁଢ଼ିଆଣୀ ପୋକ', en: 'Spider Mites' },
  'fusarium wilt': { te: 'ఎండు తెగులు (ఫ్యుసేరియం)', hi: 'उकठा रोग (फ्यूजेरियम)', ta: 'வாடல் நோய் (பியூசேரியம்)', kn: 'ಸೊರಗು ರೋಗ (ಫ್ಯೂಸಾರಿಯಮ್)', ml: 'വാട്ട രോഗം (ഫ്യൂസേറിയം)', or: 'ଝାଉଁଳା ରୋଗ (ଫ୍ୟୁଜାରିୟମ୍)', en: 'Fusarium Wilt' },
  'wilt': { te: 'ఎండు తెగులు', hi: 'उकठा / विल्ट रोग', ta: 'வாடல் நோய்', kn: 'ಸೊರಗು ರೋಗ', ml: 'വാട്ട രോഗം', or: 'ଝାଉଁଳା ରୋଗ', en: 'Wilt' },
  'scab': { te: 'గజ్జి తెగులు', hi: 'पपड़ी / स्कैब रोग', ta: 'சொறி நோய்', kn: 'ಹುರುಕು ರೋಗ', ml: 'തുരുമ്പ് വ്രണം', or: 'ଖସୁ ରୋଗ', en: 'Scab' },
  'caterpillar': { te: 'పొగాకు లద్దెపురుగు', hi: 'तम्बाकू की इल्ली / कटवर्म', ta: 'புகையிலை வெட்டுப்புழு', kn: 'ತಂಬಾಕು ಕಟಾವಿ ಹುಳು', ml: 'പുകയിലപ്പുഴു', or: 'ତମାଖୁ ଲଦିପୋକ', en: 'Caterpillar' },
  'spodoptera': { te: 'పొగాకు లద్దెపురుగు', hi: 'तम्बाकू की इल्ली / कटवर्म', ta: 'புகையிலை வெட்டுப்புழு', kn: 'ತಂಬಾಕು ಕಟಾವಿ ಹುಳು', ml: 'പുകയിലപ്പുഴു', or: 'ତମାଖୁ ଲଦିପୋକ', en: 'Spodoptera Litura' },
  'healthy': { te: 'ఆరోగ్యకరమైన పంట', hi: 'स्वस्थ फसल', ta: 'ஆரோக்கியமான பயிர்', kn: 'ಆರೋಗ್ಯಕರ ಬೆಳೆ', ml: 'ആരോഗ്യമുള്ള വിള', or: 'ସୁସ୍ଥ ଫସଲ', en: 'Healthy Crop' }
};

export function resolveLocalizedCrop(rawCrop = '', lang = 'en') {
  if (!rawCrop) return 'Crop';
  const clean = rawCrop.trim().toLowerCase();
  const langKey = (lang || 'en').toLowerCase().slice(0, 2);
  
  if (CROP_TRANSLATIONS[clean]) {
    return CROP_TRANSLATIONS[clean][langKey] || CROP_TRANSLATIONS[clean].en || rawCrop;
  }
  for (const [k, v] of Object.entries(CROP_TRANSLATIONS)) {
    if (clean.includes(k)) {
      return v[langKey] || v.en || rawCrop;
    }
  }
  return rawCrop.trim();
}

export function resolveLocalizedDisease(rawDis = '', lang = 'en') {
  if (!rawDis) return 'Plant Disease';
  const clean = rawDis.trim().toLowerCase();
  const langKey = (lang || 'en').toLowerCase().slice(0, 2);

  if (DISEASE_TRANSLATIONS[clean]) {
    return DISEASE_TRANSLATIONS[clean][langKey] || DISEASE_TRANSLATIONS[clean].en || rawDis;
  }
  for (const [k, v] of Object.entries(DISEASE_TRANSLATIONS)) {
    if (clean.includes(k)) {
      return v[langKey] || v.en || rawDis;
    }
  }
  return rawDis.trim();
}

export function translateNotification(title = '', message = '', lang = 'te') {
  const currentLang = (lang || 'en').toLowerCase().slice(0, 2);
  if (currentLang === 'en') {
    return { title, message };
  }

  let transTitle = title;
  let transMessage = message;

  const locCrop = (crop) => resolveLocalizedCrop(crop, currentLang);
  const locDis = (dis) => resolveLocalizedDisease(dis, currentLang);

  // ─── 1. TRANSLATE TITLE ───
  const trimmedTitle = (title || '').trim();
  const matchDet = trimmedTitle.match(/(?:🚨\s*)?(?:Disease Detected|Disease Alert):\s*([^\n.]+?)(?:\s*Detected)?$/i);
  
  if (matchDet) {
    const dName = locDis(matchDet[1]);
    const titles = {
      te: `🚨 రోగం గుర్తించబడింది: ${dName}`,
      hi: `🚨 रोग का पता चला: ${dName}`,
      ta: `🚨 நோய் கண்டறியப்பட்டது: ${dName}`,
      kn: `🚨 ರೋಗ ಪತ್ತೆಯಾಗಿದೆ: ${dName}`,
      ml: `🚨 രോഗം കണ്ടെത്തി: ${dName}`,
      or: `🚨 ରୋଗ ଚିହ୍ନଟ ହେଲା: ${dName}`
    };
    transTitle = titles[currentLang] || `🚨 Disease Detected: ${dName}`;
  } else if (/Healthy Crop Verified/i.test(trimmedTitle)) {
    const cropPart = trimmedTitle.replace(/🌱\s*Healthy Crop Verified:\s*/i, '').trim();
    const cName = locCrop(cropPart);
    const titles = {
      te: `🌱 ఆరోగ్యకరమైన పంట: ${cName}`,
      hi: `🌱 स्वस्थ फसल: ${cName}`,
      ta: `🌱 ஆரோக்கியமான பயிர்: ${cName}`,
      kn: `🌱 ಆರೋಗ್ಯಕರ ಬೆಳೆ: ${cName}`,
      ml: `🌱 ആരോഗ്യമുള്ള വിള: ${cName}`,
      or: `🌱 ସୁସ୍ଥ ଫସଲ: ${cName}`
    };
    transTitle = titles[currentLang] || `🌱 Healthy Crop: ${cName}`;
  } else if (/^testing$/i.test(trimmedTitle) || /^test$/i.test(trimmedTitle)) {
    const titles = {
      te: `పరీక్ష నోటిఫికేషన్`,
      hi: `परीक्षण अधिसूचना`,
      ta: `சோதனை அறிவிப்பு`,
      kn: `ಪರೀಕ್ಷಾ ಅಧಿಸೂಚನೆ`,
      ml: `ടെസ്റ്റ് അറിയിപ്പ്`,
      or: `ପରୀକ୍ଷଣ ବିଜ୍ଞପ୍ତି`
    };
    transTitle = titles[currentLang] || `Test Notification`;
  } else if (/High Disease Vulnerability Alert/i.test(trimmedTitle)) {
    const titles = {
      te: `🚨 అధిక పంట తెగులు ముప్పు హెచ్చరిక`,
      hi: `🚨 उच्च फसल रोग जोखिम चेतावनी`,
      ta: `🚨 அதிக பயிர் நோய் அபாய எச்சரிக்கை`,
      kn: `🚨 ಹೆಚ್ಚಿನ ಬೆಳೆ ರೋಗ ಅಪಾಯದ ಎಚ್ಚರಿಕೆ`,
      ml: `🚨 ഉയർന്ന വിള രോഗ സാധ്യത മുന്നറിയിപ്പ്`,
      or: `🚨 ଉଚ୍ଚ ଫସଲ ରୋଗ ବିପଦ ଚେତାବନୀ`
    };
    transTitle = titles[currentLang] || `🚨 High Disease Vulnerability Alert`;
  } else if (/ESP32 Battery Critical/i.test(trimmedTitle)) {
    const titles = {
      te: `🚨 ESP32 బ్యాటరీ తక్కువగా ఉంది`,
      hi: `🚨 ESP32 बैटरी कम है`,
      ta: `🚨 ESP32 பேட்டரி குறைவாக உள்ளது`,
      kn: `🚨 ESP32 ಬ್ಯಾಟರಿ ಕಡಿಮೆಯಾಗಿದೆ`,
      ml: `🚨 ESP32 ബാറ്ററി കുറവാണ്`,
      or: `🚨 ESP32 ବ୍ୟାଟେରୀ କମ ଅଛି`
    };
    transTitle = titles[currentLang] || `🚨 ESP32 Battery Critical`;
  } else if (/Outbreak Alert:/i.test(trimmedTitle)) {
    const prefix = {
      te: '⚠️ గ్రామ పరిధి తెగులు హెచ్చరిక:',
      hi: '⚠️ क्षेत्रीय प्रकोप चेतावनी:',
      ta: '⚠️ பகுதி நோய் எச்சரிக்கை:',
      kn: '⚠️ ಪ್ರದೇಶ ರೋಗ ಎಚ್ಚರಿಕೆ:',
      ml: '⚠️ മേഖലാ രോഗ മുന്നറിയിപ്പ്:',
      or: '⚠️ ଆଞ୍ଚଳିକ ରୋଗ ଚେତାବନୀ:'
    };
    transTitle = trimmedTitle.replace(/⚠️\s*Outbreak Alert:/i, prefix[currentLang] || '⚠️ Outbreak Alert:');
  }

  // ─── 2. TRANSLATE BODY / MATTER ───
  const trimmedMsg = (message || '').trim();

  // Pattern A: "Leaf Spot detected on Chilli with 66.1% confidence. Immediate treatment is..."
  const matchBody = trimmedMsg.match(/([^\n]+?)\s+(?:detected|identified)\s+on\s+([^\n]+?)\s+with\s+([\d.]+%?\s*confidence)(?:[.\s\S]*)/i);
  if (matchBody) {
    const dName = locDis(matchBody[1]);
    const cName = locCrop(matchBody[2]);
    const conf = matchBody[3].includes('%') ? matchBody[3] : `${matchBody[3]}%`;

    const msgs = {
      te: `${cName} పంటలో ${conf} ఖచ్చితత్వంతో ${dName} గుర్తించబడింది. పంట నష్టం జరగకుండా వెంటనే తగిన నివారణ చికిత్స చేపట్టండి. మందులు & పూర్తి మార్గదర్శకాల కోసం స్కాన్ ఫలితాలను చూడండి.`,
      hi: `${cName} में ${conf} सटीकता के साथ ${dName} पाया गया है। फसल को नुकसान से बचाने के लिए तुरंत अनुशंसित उपचार शुरू करें। दवा की खुराक और पूरी गाइड के लिए परिणाम देखें।`,
      ta: `${cName} பயிரில் ${conf} துல்லியத்துடன் ${dName} கண்டறியப்பட்டுள்ளது. மகசூல் இழப்பைத் தடுக்க உடனடியாக பரிந்துரைக்கப்பட்ட சிகிச்சையைத் தொடங்குங்கள். மருந்து விபரங்களுக்கு முடிவுகளைப் பார்க்கவும்.`,
      kn: `${cName} ಬೆಳೆಯಲ್ಲಿ ${conf} ನಿಖರತೆಯೊಂದಿಗೆ ${dName} ಕಂಡುಬಂದಿದೆ. ಬೆಳೆ ನಷ್ಟವನ್ನು ತಡೆಗಟ್ಟಲು ತಕ್ಷಣ ಶಿಫಾರಸು ಮಾಡಿದ ಚಿಕಿತ್ಸೆಯನ್ನು ಕೈಗೊಳ್ಳಿ. ಔಷಧಿಗಳ ವಿವರಗಳಿಗಾಗಿ ಫಲಿತಾಂಶಗಳನ್ನು ವೀಕ್ಷಿಸಿ.`,
      ml: `${cName} വിളയിൽ ${conf} കൃത്യതയോടെ ${dName} കണ്ടെത്തി. വിളനാശം ഒഴിവാക്കാൻ ഉടൻ പ്രതിരോധ നടപടികൾ സ്വീകരിക്കുക. മരുന്നുകളുടെ വിവരങ്ങൾക്ക് ഫലം കാണുക.`,
      or: `${cName} ରେ ${conf} ସଠିକତା ସହିତ ${dName} ଚିହ୍ନଟ ହୋଇଛି | ଫସଲ ନଷ୍ଟକୁ ରୋକିବା ପାଇଁ ତୁରନ୍ତ ଚିକିତ୍ସା କରନ୍ତୁ | ଔଷଧ ମାତ୍ରା ପାଇଁ ପରିଣାମ ଦେଖନ୍ତୁ |`
    };
    transMessage = msgs[currentLang] || `${dName} detected on ${cName} with ${conf}. Initiate appropriate treatment immediately to prevent crop damage.`;
  }
  // Pattern B: Healthy crop confirmation
  else if (/AI diagnosis complete: Your\s+([^\n]+?)\s+foliage is healthy with\s+([\d.]+%\s*confidence)/i.test(trimmedMsg)) {
    const matchHealthy = trimmedMsg.match(/AI diagnosis complete: Your\s+([^\n]+?)\s+foliage is healthy with\s+([\d.]+%\s*confidence)/i);
    const cName = locCrop(matchHealthy[1]);
    const conf = matchHealthy[2];

    const msgs = {
      te: `AI పంట నిర్ధారణ పూర్తయింది: మీ ${cName} ఆకులు ${conf} ఖచ్చితత్వంతో సంపూర్ణ ఆరోగ్యంగా ఉన్నాయి. సాధారణ నీటిపారుదల & ఎరువుల షెడ్యూల్ కొనసాగించండి.`,
      hi: `एआई फसल निदान पूर्ण: आपकी ${cName} की पत्तियां ${conf} सटीकता के साथ पूरी तरह स्वस्थ हैं। सामान्य सिंचाई और पोषण जारी रखें।`,
      ta: `AI பயிர் ஆய்வு முடிந்தது: உங்கள் ${cName} பயிர் ${conf} துல்லியத்துடன் முற்றிலும் ஆரோக்கியமாக உள்ளது. வழக்கமான பாசனத்தை தொடரவும்.`,
      kn: `AI ಬೆಳೆ ರೋಗ ಪತ್ತೆ ಪೂರ್ಣಗೊಂಡಿದೆ: ನಿಮ್ಮ ${cName} ಸಸ್ಯಗಳು ${conf} ನಿಖರತೆಯೊಂದಿಗೆ ಸಂಪೂರ್ಣವಾಗಿ ಆರೋಗ್ಯಕರವಾಗಿವೆ.`,
      ml: `AI വിള പരിശോധന പൂർത്തിയായി: നിങ്ങളുടെ ${cName} ചെടികൾ ${conf} കൃത്യതയോടെ തികച്ചും ആരോഗ്യകരമാണ്.`,
      or: `AI ଫସଲ ନିଦାନ ସମ୍ପୂର୍ଣ୍ଣ: ଆପଣଙ୍କ ${cName} ${conf} ସଠିକତା ସହିତ ସମ୍ପୂର୍ଣ୍ଣ ସୁସ୍ଥ ଅଛି |`
    };
    transMessage = msgs[currentLang] || `AI diagnosis complete: Your ${cName} foliage is healthy with ${conf}.`;
  }
  // Pattern C: Environmental & Weather humidity warnings
  else if (/Persistent canopy humidity/i.test(trimmedMsg)) {
    const msgs = {
      te: `పంటపై నిరంతర తేమ (>88%) నమోదైంది. ముందస్తు ఆకు ఎండు తెగులు వ్యాపించే అధిక ప్రమాదం ఉంది. ముందుజాగ్రత్తగా కాపర్ లేదా వేపనూనె పిచికారీ చేయండి.`,
      hi: `फसल पर लगातार नमी (>88%) दर्ज की गई है। झुलसा रोग फैलने का उच्च जोखिम है। सावधानी के रूप में कॉपर या नीम के तेल का छिड़काव करें।`,
      ta: `பயிரில் தொடர் ஈரப்பதம் (>88%) பதிவாகியுள்ளது. கருகல் நோய் பரவும் அபாயம் உள்ளது. முன்னெச்சரிக்கையாக வேப்ப எண்ணெய் தெளிக்கவும்.`,
      kn: `ಬೆಳೆಯ ಮೇಲೆ ನಿರಂತರ ತೇವಾಂಶ (>88%) ದಾಖಲಾಗಿದೆ. ಮುಂಗಾರು ರೋಗ ಹರಡುವ ಸಾಧ್ಯತೆಯಿದೆ. ತಡೆಗಟ್ಟಲು ಬೇವಿನ ಎಣ್ಣೆ ಸಿಂಪಡಿಸಿ.`,
      ml: `വിളയിൽ ഉയർന്ന ഈർപ്പം (>88%) രേഖപ്പെടുത്തി. ഇലക്കരിച്ചിൽ ഉണ്ടാകാൻ സാധ്യതയുണ്ട്. വേപ്പെണ്ണ തളിക്കുക.`,
      or: `ଫସଲରେ ଅତ୍ୟଧିକ ଆର୍ଦ୍ରତା (>88%) ରେକର୍ଡ ହୋଇଛି | ଝାଉଁଳା ରୋଗ ବ୍ୟାପିବାର ଆଶଙ୍କା ଅଛି | ପ୍ରତିକାର ଭାବେ ନିମ୍ବ ତେଲ ସ୍ପ୍ରେ କରନ୍ତୁ |`
    };
    transMessage = msgs[currentLang] || message;
  }
  // Pattern D: Neighborhood outbreak warning
  else if (/Alert: A severe case of\s+([^\n]+?)\s+on\s+([^\n]+?)\s+has been diagnosed in nearby\s+([^\n]+?)\s+village/i.test(trimmedMsg)) {
    const matchOutbreak = trimmedMsg.match(/Alert: A severe case of\s+([^\n]+?)\s+on\s+([^\n]+?)\s+has been diagnosed in nearby\s+([^\n]+?)\s+village/i);
    const dName = locDis(matchOutbreak[1]);
    const cName = locCrop(matchOutbreak[2]);
    const village = matchOutbreak[3].trim();

    const msgs = {
      te: `గ్రామ పరిధి హెచ్చరిక: సమీపంలోని ${village} గ్రామంలో ${cName}లో తీవ్రమైన ${dName} తెగులు గుర్తించబడింది. వెంటనే మీ పొలాన్ని తనిఖీ చేయండి.`,
      hi: `ग्राम चेतावनी: निकटवर्ती ${village} गाँव में ${cName} में गंभीर ${dName} पाया गया है। तुरंत अपने खेत का निरीक्षण करें।`,
      ta: `கிராம எச்சரிக்கை: அருகிலுள்ள ${village} கிராமத்தில் ${cName} பயிரில் தீவிர ${dName} கண்டறியப்பட்டுள்ளது. உங்கள் வயலை உடனடியாக ஆய்வு செய்யவும்.`,
      kn: `ಗ್ರಾಮ ಎಚ್ಚರಿಕೆ: ಹತ್ತಿರದ ${village} ಗ್ರಾಮದಲ್ಲಿ ${cName} ಬೆಳೆಯಲ್ಲಿ ತೀವ್ರ ${dName} ರೋಗ ಕಂಡುಬಂದಿದೆ. ತಕ್ಷಣ ನಿಮ್ಮ ಜಮೀನನ್ನು ಪರಿಶೀಲಿಸಿ.`,
      ml: `ഗ്രാമ മുന്നറിയിപ്പ്: സമീപത്തുള്ള ${village} ഗ്രാമത്തിൽ ${cName} വിളയിൽ കഠിനമായ ${dName} രോഗം കണ്ടെത്തി. നിങ്ങളുടെ കൃഷിയിടം പരിശോധിക്കുക.`,
      or: `ଗ୍ରାମ ଚେତାବନୀ: ନିକଟସ୍ଥ ${village} ଗାଁରେ ${cName} ରେ ଗମ୍ଭୀର ${dName} ଚିହ୍ନଟ ହୋଇଛି | ତୁରନ୍ତ ନିଜ ଜମି ଯାଞ୍ଚ କରନ୍ତୁ |`
    };
    transMessage = msgs[currentLang] || message;
  }
  // Pattern E: Battery warning
  else if (/ESP32 field node battery dropped to/i.test(trimmedMsg)) {
    const msgs = {
      te: `ఫీల్డ్ సెన్సార్ నోడ్ బ్యాటరీ తగ్గిపోయింది. డేటా నిలిచిపోకుండా ఉండేందుకు దయచేసి వెంటనే సోలార్ లేదా బ్యాటరీ ఛార్జ్ చేయండి.`,
      hi: `फील्ड सेंसर नोड की बैटरी कम हो गई है। डेटा रुकावट से बचने के लिए कृपया तुरंत सौर या बैटरी चार्ज करें।`,
      ta: `சென்சார் நோடின் பேட்டரி குறைந்துள்ளது. தரவு இழப்பைத் தவிர்க்க உடனடியாக சார்ஜ் செய்யவும்.`,
      kn: `ಫೀಲ್ಡ್ ಸಂವೇದಕ ನೋಡ್‌ನ ಬ್ಯಾಟರಿ ಕಡಿಮೆಯಾಗಿದೆ. ಡೇಟಾ ಅಡಚಣೆ ತಪ್ಪಿಸಲು ದಯವಿಟ್ಟು ತಕ್ಷಣ ಚಾರ್ಜ್ ಮಾಡಿ.`,
      ml: `സെൻസർ നോഡിന്റെ ബാറ്ററി കുറഞ്ഞു. ഡാറ്റ നഷ്ടപ്പെടാതിരിക്കാൻ ദയവായി ഉടൻ ചാർജ് ചെയ്യുക.`,
      or: `ସେନସର ନୋଡ୍ ବ୍ୟାଟେରୀ କମିଯାଇଛି | ଡାଟା ବନ୍ଦ ନହେବା ପାଇଁ ଦୟାକରି ତୁରନ୍ତ ଚାର୍ଜ କରନ୍ତୁ |`
    };
    transMessage = msgs[currentLang] || message;
  }

  return { title: transTitle, message: transMessage };
}

/**
 * Real-time Conversational Chat Message Translator for Equipment Booking & Farmer Queries
 * Instantly translates spoken and typed sentences into Telugu, Hindi, Tamil, etc.
 */
export const CHAT_PHRASES = [
  // ── Authentic Romanized Telugu (Telinglish) Real Field Phrases ──
  {
    regex: /(?:ok\s*nenu\s*vastanu|nenu\s*vastanu|nenu\s*vastunna|vastanu|vastunna|vastanu\s*lendi)/i,
    te: 'సరే, నేను వస్తాను.',
    hi: 'हाँ, मैं आ रहा हूँ।',
    ta: 'சரி, நான் வருகிறேன்.',
    kn: 'ಸರಿ, ನಾನು ಬರುತ್ತೇನೆ.',
    ml: 'ശരി, ഞാൻ വരാം.',
    or: 'ଠିକ୍ ଅଛି, ମୁଁ ଆସୁଛି।',
    en: 'Okay, I will come.'
  },
  {
    regex: /(?:ekkadunnav|ekada\s*unnav|ekkada\s*unnav|ekadunnav)/i,
    te: 'మీరు ఎక్కడ ఉన్నారు? లొకేషన్ చెప్పండి.',
    hi: 'आप कहाँ हैं? लोकेशन बताइए।',
    ta: 'எங்கே இருக்கிறீர்கள்? இருப்பிடம் சொல்லுங்கள்.',
    kn: 'ಎಲ್ಲಿದ್ದೀರಿ? ಸ್ಥಳ ತಿಳಿಸಿ.',
    ml: 'എവിടെയാണ്? ലൊക്കേഷൻ പറയൂ.',
    or: 'କେଉଁଠି ଅଛନ୍ତି? ଲୋକେସନ କୁହନ୍ତୁ।',
    en: 'Where are you? Share location.'
  },
  {
    regex: /(?:call\s*chey|call\s*cheyandi|phone\s*chey|phone\s*cheyandi)/i,
    te: 'దయచేసి ఫోన్ కాల్ చేయండి.',
    hi: 'कृपया फोन कॉल करें।',
    ta: 'தயவுசெய்து போன் கால் செய்யுங்கள்.',
    kn: 'ದಯವಿಟ್ಟು ಫೋನ್ ಮಾಡಿ.',
    ml: 'ദയവായി ഫോൺ ചെയ്യുക.',
    or: 'ଦୟାକରି ଫୋନ୍ କଲ୍ କରନ୍ତୁ।',
    en: 'Please make a phone call.'
  },
  {
    regex: /(?:ippude\s*bayaluderanu|bayaluderanu|bayaluderam|vastunna\s*dharilo)/i,
    te: 'ఇప్పుడే బయలుదేరాను, దారిలో ఉన్నాను.',
    hi: 'अभी निकल चुका हूँ, रास्ते में हूँ।',
    ta: 'இப்போதே கிளம்பிவிட்டேன், வழியில் உள்ளேன்.',
    kn: 'ಈಗಷ್ಟೇ ಹೊರಟಿದ್ದೇನೆ, ದಾರಿಯಲ್ಲಿದ್ದೇನೆ.',
    ml: 'ഇപ്പോൾ പുറപ്പെട്ടു, വഴിയിലാണ്.',
    or: 'ଏବେ ବାହାରିଲି, ରାସ୍ତାରେ ଅଛି।',
    en: 'Just departed, on the way.'
  },
  {
    regex: /(?:repu\s*vastanu|repu\s*vastam|repu\s*morning)/i,
    te: 'రేపు ఉదయం వస్తాను.',
    hi: 'कल सुबह आऊँगा।',
    ta: 'நாளை காலை வருகிறேன்.',
    kn: 'ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಬರುತ್ತೇನೆ.',
    ml: 'നാളെ രാവിലെ വരാം.',
    or: 'କାଲି ସକାଳେ ଆସିବି।',
    en: 'Will come tomorrow morning.'
  },
  {
    regex: /(?:entha\s*karchu|rate\s*entha|rate\s*enta|cost\s*entha)/i,
    te: 'ఎకరాకు ఎంత ఖర్చు అవుతుంది?',
    hi: 'प्रति एकड़ कितना खर्च होगा?',
    ta: 'ஏக்கருக்கு எவ்வளவு கட்டணம்?',
    kn: 'ಎಕರೆಗೆ ಎಷ್ಟು ವೆಚ್ಚವಾಗುತ್ತದೆ?',
    ml: 'ഏക്കറിന് എത്ര ചിലവാകും?',
    or: 'ଏକର ପ୍ରତି କେତେ ଖର୍ଚ୍ଚ ହେବ?',
    en: 'How much is the cost per acre?'
  },
  {
    regex: /(?:tractor\s+ready|machine\s+ready|ready\s+ga\s+undi)/i,
    te: 'ట్రాక్టర్ / యంత్రం సిద్ధంగా ఉంది.',
    hi: 'ट्रैक्टर / मशीन तैयार है।',
    ta: 'டிராக்டர் / இயந்திரம் தயாராக உள்ளது.',
    kn: 'ಟ್ರಾಕ್ಟರ್ / ಯಂತ್ರ ಸಿದ್ಧವಾಗಿದೆ.',
    ml: 'ട്രാക്ടർ / മെഷീൻ തയ്യാറാണ്.',
    or: 'ଟ୍ରାକ୍ଟର / ମେସିନ୍ ପ୍ରସ୍ତୁତ ଅଛି।',
    en: 'Tractor / Machinery is ready.'
  },
  {
    regex: /(?:tractor\s+is\s+dispatched|tractor\s+dispatched|20\s+minutes?)/i,
    te: 'ట్రాక్టర్ బయలుదేరింది, 20 నిమిషాల్లో మీ పొలానికి చేరుకుంటుంది.',
    hi: 'ट्रैक्टर निकल चुका है, 20 मिनट में आपके खेत पर पहुंच जाएगा।',
    ta: 'டிராக்டர் புறப்பட்டுவிட்டது, 20 நிமிடங்களில் உங்கள் வயலுக்கு வந்து சேரும்.',
    kn: 'ಟ್ರಾಕ್ಟರ್ ಹೊರಟಿದೆ, 20 ನಿಮಿಷಗಳಲ್ಲಿ ನಿಮ್ಮ ಜಮೀನನ್ನು ತಲುಪುತ್ತದೆ.',
    ml: 'ട്രാക്ടർ പുറപ്പെട്ടു, 20 മിനിറ്റിനുള്ളിൽ നിങ്ങളുടെ വയലിലെത്തും.',
    or: 'ଟ୍ରାକ୍ଟର ବାହାରିଛି, ୨୦ ମିନିଟରେ ଆପଣଙ୍କ ଜମିରେ ପହଞ୍ଚିବ।'
  },
  {
    regex: /(?:please\s+call\s+me\s+when\s+the\s+tractor\s+departs|call\s+me\s+when\s+tractor\s+departs|call\s+when\s+depart)/i,
    te: 'ట్రాక్టర్ బయలుదేరినప్పుడు దయచేసి నాకు కాల్ చేయండి.',
    hi: 'कृपया ट्रैक्टर निकलते समय मुझे कॉल करें।',
    ta: 'டிராக்டர் புறப்படும்போது தயவுசெய்து எனக்கு அழைக்கவும்.',
    kn: 'ದಯವಿಟ್ಟು ಟ್ರಾಕ್ಟರ್ ಹೊರಡುವಾಗ ನನಗೆ ಕರೆ ಮಾಡಿ.',
    ml: 'ട്രാക്ടർ പുറപ്പെടുമ്പോൾ ദയവായി എന്നെ വിളിക്കുക.',
    or: 'ଟ୍ରାକ୍ଟର ବାହାରିବା ସମୟରେ ଦୟାକରି ମୋତେ କଲ୍ କରନ୍ତୁ।'
  },
  {
    regex: /^(?:hello|hii|hi|hey)\b/i,
    te: 'హలో / నమస్కారం! ఎలా ఉన్నారు?',
    hi: 'नमस्ते / हैलो! कैसे हैं?',
    ta: 'வணக்கம்! எப்படி இருக்கிறீர்கள்?',
    kn: 'ನಮಸ್ಕಾರ! ಹೇಗಿದ್ದೀರಾ?',
    ml: 'ഹലോ / നമസ്കാരം!',
    or: 'ନମସ୍କାର / ହାଲୋ!'
  },
  {
    regex: /(?:what\s+is\s+the\s+time|what\s+time|when\s+will\s+you\s+arrive|when\s+you\s+come|when\s+will\s+you\s+come|reach|time\s+tell)/i,
    te: 'మీరు ఏ సమయానికి వస్తారు? దయచేసి చెప్పండి.',
    hi: 'आप किस समय आएंगे? कृपया बताएं।',
    ta: 'நீங்கள் எந்த நேரத்திற்கு வருவீர்கள்? சொல்லுங்கள்.',
    kn: 'ನೀವು ಎಷ್ಟು ಗಂಟೆಗೆ ಬರುತ್ತೀರಿ? ದಯವಿಟ್ಟು ತಿಳಿಸಿ.',
    ml: 'നിങ്ങൾ എപ്പോൾ എത്തും? ദയവായി പറയുക.',
    or: 'ଆପଣ କେତେବେଳେ ଆସିବେ? ଦୟାକରି କୁହନ୍ତୁ।'
  },
  {
    regex: /\b10\s*(?:to|-)\s*11\b/i,
    te: 'ఉదయం 10:00 నుండి 11:00 గంటల మధ్యలో వస్తాను.',
    hi: 'सुबह 10:00 से 11:00 बजे के बीच आऊंगा।',
    ta: 'காலை 10:00 முதல் 11:00 மணிக்குள் வருகிறேன்.',
    kn: 'ಬೆಳಿಗ್ಗೆ 10:00 ರಿಂದ 11:00 ರ ನಡುವೆ ಬರುತ್ತೇನೆ.',
    ml: 'രാവിലെ 10:00 നും 11:00 നും ഇടയിൽ എത്തും.',
    or: 'ସକାଳ ୧୦:୦୦ ରୁ ୧୧:୦୦ ମଧ୍ୟରେ ଆସିବି।'
  },
  {
    regex: /(?:waiting\s+at\s+the\s+field|waiting\s+at\s+farm|in\s+the\s+field|reach\s+soon)/i,
    te: 'నేను పొలం వద్ద వేచి చూస్తున్నాను, దయచేసి త్వరగా రండి.',
    hi: 'मैं खेत पर प्रतीक्षा कर रहा हूँ, कृपया जल्दी आएं।',
    ta: 'நான் வயலில் காத்திருக்கிறேன், தயவுசெய்து விரைவாக வாருங்கள்.',
    kn: 'ನಾನು ಜಮೀನಿನಲ್ಲಿ ಕಾಯುತ್ತಿದ್ದೇನೆ, ದಯವಿಟ್ಟು ಬೇಗ ಬನ್ನಿ.',
    ml: 'ഞാൻ വയലിൽ കാത്തിരിക്കുന്നു, ദയവായി വേഗം വരൂ.',
    or: 'ମୁଁ ଜମିରେ ଅପେକ୍ଷା କରିଛି, ଦୟାକରି ଶୀଘ୍ର ଆସନ୍ତୁ।'
  },
  {
    regex: /(?:send\s+location|share\s+location|where\s+are\s+you)/i,
    te: 'మీరు ఎక్కడ ఉన్నారు? దయచేసి మీ లొకేషన్ పంపండి.',
    hi: 'आप कहाँ हैं? कृपया अपनी लोकेशन भेजें।',
    ta: 'நீங்கள் எங்கே இருக்கிறீர்கள்? உங்கள் இருப்பிடத்தை அனுப்பவும்.',
    kn: 'ನೀವು ಎಲ್ಲಿದ್ದೀರಿ? ದಯವಿಟ್ಟು ನಿಮ್ಮ ಸ್ಥಳ ಕಳುಹಿಸಿ.',
    ml: 'നിങ്ങൾ എവിടെയാണ്? ദയവായി ലൊക്കേഷൻ അയക്കുക.',
    or: 'ଆପଣ କେଉଁଠି ଅଛନ୍ତି? ଦୟାକରି ଲୋକେସନ ପଠାନ୍ତୁ।'
  },
  {
    regex: /(?:how\s+much\s+is\s+the\s+cost|total\s+cost|rate\s+per\s+acre|rate|price)/i,
    te: 'ఎకరాకు ఎంత ఖర్చు అవుతుంది? మొత్తం ఎంత?',
    hi: 'प्रति एकड़ कितना खर्च होगा? कुल राशि कितनी है?',
    ta: 'ஏக்கருக்கு எவ்வளவு கட்டணம்? மொத்தம் எவ்வளவு?',
    kn: 'ಎಕರೆಗೆ ಎಷ್ಟು ವೆಚ್ಚವಾಗುತ್ತದೆ? ಒಟ್ಟು ದರ ಎಷ್ಟು?',
    ml: 'ഏക്കറിന് എത്ര ചിലവാകും? ആകെ തുക എത്ര?',
    or: 'ଏକର ପ୍ରତି କେତେ ଖର୍ଚ୍ଚ ହେବ? ମୋଟ କେତେ ଟଙ୍କା?'
  },
  {
    regex: /(?:okay|ok|thank\s*you|thanks|done|confirmed)/i,
    te: 'సరే, ధన్యవాదాలు! పని పూర్తయింది.',
    hi: 'ठीक है, धन्यवाद! कार्य पक्का हुआ।',
    ta: 'சரி, நன்றி! வேலை முடிந்தது.',
    kn: 'ಸರಿ, ಧನ್ಯವಾದಗಳು! ಖಚಿತವಾಯಿತು.',
    ml: 'ശരി, നന്ദി!',
    or: 'ଠିକ୍ ଅଛି, ଧନ୍ୟବାଦ!'
  }
];

export function translateChatMessage(text = '', lang = 'te') {
  if (!text || typeof text !== 'string') return text;
  const currentLang = (lang || 'en').toLowerCase().slice(0, 2);
  if (currentLang === 'en') return text;

  const trimmed = text.trim();

  // 1. Direct regex rule lookup
  for (const item of CHAT_PHRASES) {
    if (item.regex.test(trimmed)) {
      return item[currentLang] || item.te || text;
    }
  }

  // 2. Booking system notices
  if (/Machinery Booking Confirmed/i.test(trimmed)) {
    const s = { te: 'బుకింగ్ ధృవీకరించబడింది', hi: 'बुकिंग कन्फर्म हो गई', ta: 'முன்பதிவு உறுதி செய்யப்பட்டது', kn: 'ಬುಕಿಂಗ್ ದೃಢೀಕರಿಸಲಾಗಿದೆ' };
    return s[currentLang] || text;
  }
  if (/Booking Request Pending/i.test(trimmed)) {
    const s = { te: 'బుకింగ్ అభ్యర్థన పెండింగ్‌లో ఉంది', hi: 'बुकिंग अनुरोध लंबित है', ta: 'முன்பதிவு கோரிக்கை நிலுவையில் உள்ளது', kn: 'ಬುಕಿಂಗ್ ಬಾಕಿ ಉಳಿದಿದೆ' };
    return s[currentLang] || text;
  }
  if (/Booking Declined/i.test(trimmed)) {
    const s = { te: 'బుకింగ్ తిరస్కరించబడింది', hi: 'बुकिंग अस्वीकार कर दी गई', ta: 'முன்பதிவு நிராகரிக்கப்பட்டது', kn: 'ಬುಕಿಂಗ್ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ' };
    return s[currentLang] || text;
  }

  return text;
}


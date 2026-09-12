/**
 * AgriShield Agricultural Notification Content Translator
 * Automatically translates notification titles and bodies into Telugu / regional languages
 * for full farmer readability.
 */

const CROP_MAP_TE = {
  'chilli': 'మిరప',
  'chili': 'మిరప',
  'mirapa': 'మిరప',
  'rice': 'వరి',
  'paddy': 'వరి',
  'వరి పంట': 'వరి పంట',
  'corn': 'మొక్కజొన్న',
  'maize': 'మొక్కజొన్న',
  'tomato': 'టమోటా',
  'cotton': 'పత్తి',
  'potato': 'బంగాళాదుంప',
  'apple': 'యాపిల్',
  'grape': 'ద్రాక్ష',
  'grapes': 'ద్రాక్ష',
  'mango': 'మామిడి',
  'groundnut': 'వేరుశెనగ',
  'peanut': 'వేరుశెనగ',
  'wheat': 'గోధుమ',
  'sugarcane': 'చెరకు',
  'onion': 'ఉల్లిపాయ',
  'soybean': 'సోయాబీన్',
  'banana': 'అరటి',
  'citrus': 'నిమ్మ / బత్తాయి',
  'lemon': 'నిమ్మ',
  'orange': 'నారింజ',
  'pepper': 'మిరియాలు',
  'bell pepper': 'బెంగళూరు మిరప (క్యాప్సికమ్)',
  'capsicum': 'క్యాప్సికమ్',
  'crop': 'పంట',
  'general plant': 'మొక్క'
};

const DISEASE_MAP_TE = {
  'leaf spot': 'ఆకు మచ్చ తెగులు',
  'early blight': 'ముందస్తు ఆకు ఎండు తెగులు',
  'late blight': 'మలి ఎండు తెగులు',
  'powdery mildew': 'బూడిద తెగులు',
  'downy mildew': 'డౌనీ మిల్డ్యూ తెగులు',
  'anthracnose': 'కాయ కుళ్లు / ఆంత్రాక్నోస్',
  'bacterial spot': 'బాక్టీరియల్ మచ్చ తెగులు',
  'bacterial blight': 'బాక్టీరియల్ బ్లైట్',
  'common rust': 'తుప్పు తెగులు',
  'rust': 'తుప్పు తెగులు',
  'stinkbug': 'గండీ నల్లి (దుర్వాసన పురుగు)',
  'blast': 'అగ్గి తెగులు',
  'yellow leaf curl virus': 'పసుపు ఆకు ముడత వైరస్',
  'yellow leaf curl': 'పసుపు ఆకు ముడత వైరస్',
  'leaf curl': 'ఆకు ముడత తెగులు',
  'mosaic virus': 'మొజాయిక్ వైరస్',
  'mosaic': 'మొజాయిక్ వైరస్',
  'spider mites': 'ఎర్ర నల్లి తెగులు',
  'two-spotted spider mite': 'ఎర్ర నల్లి పురుగు',
  'red spider': 'ఎర్ర నల్లి తెగులు',
  'brown spot': 'గోధుమ రంగు మచ్చ తెగులు',
  'sheath blight': 'కాండం కుళ్ళు తెగులు',
  'stem rot': 'కాండం కుళ్ళు తెగులు',
  'collar rot': 'మొలక కుళ్లు తెగులు',
  'root rot': 'వేరు కుళ్ళు తెగులు',
  'fusarium wilt': 'ఎండు తెగులు (ఫ్యుసేరియం)',
  'wilt': 'ఎండు తెగులు',
  'scab': 'గజ్జి తెగులు',
  'black rot': 'నల్ల కుళ్లు తెగులు',
  'canker': 'క్యాంకర్ తెగులు',
  'septoria leaf spot': 'సెప్టోరియా ఆకు మచ్చ తెగులు',
  'cercospora leaf spot': 'సెర్కోస్పోరా ఆకు మచ్చ తెగులు',
  'target spot': 'లక్ష్య మచ్చ తెగులు',
  'leaf mold': 'ఆకు బూజు తెగులు',
  'damping off': 'మొక్క కుళ్లు తెగులు',
  'dieback': 'కొమ్మ ఎండు తెగులు',
  'aphids': 'పేనుబంక',
  'whitefly': 'తెల్లదోమ',
  'thrips': 'తామర పురుగులు',
  'stem borer': 'కాండం తొలిచే పురుగు',
  'armyworm': 'లద్దె పురుగు',
  'bollworm': 'కాయ తొలిచే పురుగు',
  'healthy': 'ఆరోగ్యకరమైన పంట'
};

function resolveCropNameTe(rawCrop = '') {
  if (!rawCrop) return 'పంట';
  const clean = rawCrop.trim().toLowerCase();
  if (CROP_MAP_TE[clean]) return CROP_MAP_TE[clean];
  for (const [k, v] of Object.entries(CROP_MAP_TE)) {
    if (clean.includes(k)) return v;
  }
  return rawCrop.trim();
}

function resolveDiseaseNameTe(rawDis = '') {
  if (!rawDis) return 'తెగులు';
  const clean = rawDis.trim().toLowerCase();
  if (DISEASE_MAP_TE[clean]) return DISEASE_MAP_TE[clean];
  for (const [k, v] of Object.entries(DISEASE_MAP_TE)) {
    if (clean.includes(k)) return v;
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

  // ─── 1. TRANSLATE TITLE ───
  const trimmedTitle = (title || '').trim();
  const matchDet = trimmedTitle.match(/(?:🚨\s*)?(?:Disease Detected|Disease Alert):\s*([^\n.]+?)(?:\s*Detected)?$/i);
  if (matchDet) {
    const teDis = resolveDiseaseNameTe(matchDet[1]);
    transTitle = `🚨 రోగం గుర్తించబడింది: ${teDis}`;
  } else if (/Healthy Crop Verified/i.test(trimmedTitle)) {
    const cropPart = trimmedTitle.replace(/🌱\s*Healthy Crop Verified:\s*/i, '').trim();
    const teCrop = resolveCropNameTe(cropPart);
    transTitle = `🌱 ఆరోగ్యకరమైన పంట: ${teCrop}`;
  } else if (/^testing$/i.test(trimmedTitle) || /^test$/i.test(trimmedTitle)) {
    transTitle = `పరీక్ష నోటిఫికేషన్`;
  } else if (/High Disease Vulnerability Alert/i.test(trimmedTitle)) {
    transTitle = `🚨 అధిక పంట తెగులు ముప్పు హెచ్చరిక`;
  } else if (/ESP32 Battery Critical/i.test(trimmedTitle)) {
    transTitle = `🚨 ESP32 బ్యాటరీ తక్కువగా ఉంది`;
  } else if (/Outbreak Alert:/i.test(trimmedTitle)) {
    transTitle = trimmedTitle.replace(/⚠️\s*Outbreak Alert:/i, '⚠️ గ్రామ పరిధి తెగులు హెచ్చరిక:');
  }

  // ─── 2. TRANSLATE BODY / MATTER ───
  const trimmedMsg = (message || '').trim();

  // Pattern A: "Leaf Spot detected on Chilli with 66.1% confidence. Immediate treatment is..." / "identified on..."
  const matchBody = trimmedMsg.match(/([^\n]+?)\s+(?:detected|identified)\s+on\s+([^\n]+?)\s+with\s+([\d.]+%?\s*confidence)(?:[.\s\S]*)/i);
  if (matchBody) {
    const teDis = resolveDiseaseNameTe(matchBody[1]);
    const teCrop = resolveCropNameTe(matchBody[2]);
    const conf = matchBody[3].includes('%') ? matchBody[3] : `${matchBody[3]}%`;
    const cropLabel = teCrop.endsWith('పంట') ? teCrop : `${teCrop} పంట`;
    transMessage = `${cropLabel}లో ${conf} ఖచ్చితత్వంతో ${teDis} గుర్తించబడింది. పంట నష్టం జరగకుండా వెంటనే తగిన నివారణ చికిత్స చేపట్టండి. మందులు & పూర్తి మార్గదర్శకాల కోసం స్కాన్ ఫలితాలను చూడండి.`;
  }
  // Pattern B: Healthy crop confirmation
  else if (/AI diagnosis complete: Your\s+([^\n]+?)\s+foliage is healthy with\s+([\d.]+%\s*confidence)/i.test(trimmedMsg)) {
    const matchHealthy = trimmedMsg.match(/AI diagnosis complete: Your\s+([^\n]+?)\s+foliage is healthy with\s+([\d.]+%\s*confidence)/i);
    const teCrop = resolveCropNameTe(matchHealthy[1]);
    const cropLabel = teCrop.endsWith('పంట') ? teCrop : `${teCrop} పంట`;
    transMessage = `AI పంట నిర్ధారణ పూర్తయింది: మీ ${cropLabel} ఆకులు ${matchHealthy[2]} ఖచ్చితత్వంతో సంపూర్ణ ఆరోగ్యంగా ఉన్నాయి. సాధారణ నీటిపారుదల & ఎరువుల షెడ్యూల్ కొనసాగించండి.`;
  }
  // Pattern C: Testing notifications
  else if (/this is only for testing do not panic for this/i.test(trimmedMsg)) {
    transMessage = `ఇది కేవలం సిస్టమ్ పనితీరు పరీక్ష కోసం పంపబడిన సందేశం, దయచేసి ఆందోళన చెందవద్దు.`;
  } else if (/^test$/i.test(trimmedMsg) || /^testing$/i.test(trimmedMsg)) {
    transMessage = `సిస్టమ్ తనిఖీ సందేశం విజయవంతంగా చేరింది.`;
  }
  // Pattern D: Environmental & Weather humidity warnings
  else if (/Persistent canopy humidity/i.test(trimmedMsg)) {
    transMessage = `పంటపై నిరంతర తేమ (>88%) నమోదైంది. ముందస్తు ఆకు ఎండు తెగులు వ్యాపించే అధిక ప్రమాదం ఉంది. ముందుజాగ్రత్తగా కాపర్ లేదా వేపనూనె పిచికారీ చేయండి.`;
  }
  // Pattern E: Neighborhood outbreak warning
  else if (/Alert: A severe case of\s+([^\n]+?)\s+on\s+([^\n]+?)\s+has been diagnosed in nearby\s+([^\n]+?)\s+village/i.test(trimmedMsg)) {
    const matchOutbreak = trimmedMsg.match(/Alert: A severe case of\s+([^\n]+?)\s+on\s+([^\n]+?)\s+has been diagnosed in nearby\s+([^\n]+?)\s+village/i);
    const teDis = resolveDiseaseNameTe(matchOutbreak[1]);
    const teCrop = resolveCropNameTe(matchOutbreak[2]);
    const cropLabel = teCrop.endsWith('పంట') ? teCrop : `${teCrop} పంట`;
    transMessage = `గ్రామ పరిధి హెచ్చరిక: సమీపంలోని ${matchOutbreak[3].trim()} గ్రామంలో ${cropLabel}లో తీవ్రమైన ${teDis} తెగులు గుర్తించబడింది. వెంటనే మీ పొలాన్ని తనిఖీ చేయండి.`;
  }
  // Pattern F: Battery warning
  else if (/ESP32 field node battery dropped to/i.test(trimmedMsg)) {
    transMessage = `ఫీల్డ్ సెన్సార్ నోడ్ బ్యాటరీ తగ్గిపోయింది. డేటా నిలిచిపోకుండా ఉండేందుకు దయచేసి వెంటనే సోలార్ లేదా బ్యాటరీ ఛార్జ్ చేయండి.`;
  }

  return { title: transTitle, message: transMessage };
}


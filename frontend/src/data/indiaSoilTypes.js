/**
 * Regional India Soil Classification & 12-Language Agronomic Dictionary
 * Tailored to Indian Agro-Climatic Zones & States.
 */

export const SOIL_TYPES_DATABASE = {
  red_loamy: {
    key: 'red_loamy',
    waterRetentionDays: 2,
    drainage: 'Fast / Well-Draining',
    phRange: '5.5 - 7.0 (Slightly Acidic to Neutral)',
    bestCrops: ['Tomato', 'Chilli', 'Groundnut', 'Maize', 'Pulses', 'Millets'],
    names: {
      en: 'Red Loamy / Sandy Soil',
      te: 'ఎర్ర చల్కా నేలలు / ఎర్ర నేలలు',
      hi: 'लाल बलुई / दोमट मिट्टी',
      ta: 'செம்மண் / சிவப்பு மணல் மண்',
      kn: 'ಕೆಂಪು ಮರಳು / ಗೋಡು ಮಣ್ಣು',
      ml: 'ചുവന്ന മണ്ണ്',
      mr: 'तांबडी माती',
      gu: 'રાતી રેતાળ જમીન',
      pa: 'ਲਾਲ ਰੇਤਲੀ ਮਿੱਟੀ',
      ur: 'سرخ ریتلی مٹی',
      or: 'ଲାଲ୍ ଦୋରସା ମାଟି',
      as: 'ৰঙা পলসুৱা মাটি'
    }
  },
  black_cotton: {
    key: 'black_cotton',
    waterRetentionDays: 5,
    drainage: 'Slow / High Clay Retention',
    phRange: '7.2 - 8.5 (Alkaline / Calcareous)',
    bestCrops: ['Cotton', 'Chilli', 'Soybean', 'Wheat', 'Onion', 'Sorghum'],
    names: {
      en: 'Black Cotton Soil (Regur)',
      te: 'నల్ల రేగడి నేలలు',
      hi: 'काली रेगुर मिट्टी',
      ta: 'கரிசல் மண்',
      kn: 'ಕಪ್ಪು ರೇಗಡ್ ಮಣ್ಣು',
      ml: 'കറുത്ത പരുത്തി മണ്ണ്',
      mr: 'काळी रेगूर माती',
      gu: 'કાળી રેગુર જમીન',
      pa: 'ਕਾਲੀ ਕਪਾਹ ਮਿੱਟੀ',
      ur: 'کالی ریگڑ مٹی',
      or: 'କଳା କପାସ ମାଟି',
      as: 'কলা কপাহী মাটি'
    }
  },
  alluvial_loam: {
    key: 'alluvial_loam',
    waterRetentionDays: 3,
    drainage: 'Moderate / Highly Fertile',
    phRange: '6.5 - 7.8 (Neutral)',
    bestCrops: ['Rice / Paddy', 'Wheat', 'Sugarcane', 'Banana', 'Vegetables', 'Mustard'],
    names: {
      en: 'Alluvial / Delta Loam Soil',
      te: 'ఒండ్రు నేలలు / డెల్టా భూములు',
      hi: 'जलोढ़ दोमट मिट्टी',
      ta: 'வண்டல் மண் / ஆற்றுப் படுகை',
      kn: 'ಮೆಕ್ಕಲು ಗೋಡು ಮಣ್ಣು',
      ml: 'എക്കൽ മണ്ണ്',
      mr: 'गाळाची सुपीक माती',
      gu: 'કાંપવાળી ગોરાડુ જમીન',
      pa: 'ਦਰਿਆਈ ਜਲੋੜ ਮਿੱਟੀ',
      ur: 'زرخیز جل بھری مٹی',
      or: 'ପଟୁ / ନଦୀତଟ ମାଟି',
      as: 'পলসুৱা নদী কাষৰীয়া মাটি'
    }
  },
  laterite: {
    key: 'laterite',
    waterRetentionDays: 2,
    drainage: 'Porous / Leached Gravel',
    phRange: '4.5 - 6.0 (Acidic)',
    bestCrops: ['Cashew', 'Coconut', 'Coffee', 'Tea', 'Arecanut', 'Pepper'],
    names: {
      en: 'Laterite / Gravelly Red Soil',
      te: 'లాటరైట్ / ఎర్ర కంకర నేలలు',
      hi: 'लैटेराइट कंकड़ मिट्टी',
      ta: 'செம்புறை மண் / சரளை மண்',
      kn: 'ಲ್ಯಾಟರೈಟ್ / ಮುರುಕಲ್ಲು ಮಣ್ಣು',
      ml: 'വെട്ടുകല്ല് മണ്ണ് (ലാറ്ററൈറ്റ്)',
      mr: 'जांभा / मुरूमी माती',
      gu: 'લેટેરાઈટ કાંકરાવાળી જમીન',
      pa: 'ਲੈਟੇਰਾਈਟ ਪਥਰੀਲੀ ਮਿੱਟੀ',
      ur: 'لیٹرائیٹ سنگلاخ مٹی',
      or: 'ଲାଟେରାଇଟ୍ ପଥୁରିଆ ମାଟି',
      as: 'লেটেৰাইট শিলনি মাটি'
    }
  },
  coastal_sandy: {
    key: 'coastal_sandy',
    waterRetentionDays: 1,
    drainage: 'Very Fast / Light Texture',
    phRange: '6.5 - 8.0',
    bestCrops: ['Groundnut', 'Coconut', 'Watermelon', 'Casuarina', 'Vegetables'],
    names: {
      en: 'Coastal Sandy Soil',
      te: 'తీరప్రాంత ఇసుక నేలలు',
      hi: 'तटीय बलुई मिट्टी',
      ta: 'கடலோர மணல் மண்',
      kn: 'ಕರಾವಳಿ ಮರಳು ಮಣ್ಣು',
      ml: 'തീരദേശ മണൽ മണ്ണ്',
      mr: 'किनारी वाळूची माती',
      gu: 'દરિયાકાંઠાની રેતાળ જમીન',
      pa: 'ਤੱਟਵਰਤੀ ਰੇਤਲੀ ਮਿੱਟੀ',
      ur: 'ساحلی ریتلی مٹی',
      or: 'ଉପକୂଳ ବାଲିଆ ମାଟି',
      as: 'উপকূলীয় বালিচহীয়া মাটি'
    }
  },
  clayey_wetland: {
    key: 'clayey_wetland',
    waterRetentionDays: 6,
    drainage: 'Very Slow / Waterlogged Capacity',
    phRange: '6.0 - 7.5',
    bestCrops: ['Paddy / Rice', 'Sugarcane', 'Jute', 'Taro'],
    names: {
      en: 'Clayey Wetland / Paddy Soil',
      te: 'బంకమట్టి / మాగాణి నేలలు',
      hi: 'चिकनी मटियार मिट्टी',
      ta: 'களிமண் / நன்செய் நிலம்',
      kn: 'ಜೇಡಿ / ಗದ್ದೆ ಮಣ್ಣು',
      ml: 'കളിമണ്ണ് (വയൽ മണ്ണ്)',
      mr: 'चिकणमाती / पाणथळ माती',
      gu: 'ચીકણી ગોરાળુ માટી',
      pa: 'ਚੀਕਣੀ ਮਿੱਟੀ',
      ur: 'چکنی گیلی مٹی',
      or: 'ମଟିକାଦୁଆ ମାଟି',
      as: 'আলতীয়া বোকা মাটি'
    }
  }
};

/**
 * State to Predominant Soil Types Priority Mapping
 */
export const STATE_SOIL_PREFERENCES = {
  "Andhra Pradesh": ['red_loamy', 'black_cotton', 'alluvial_loam', 'coastal_sandy', 'laterite'],
  "Telangana": ['red_loamy', 'black_cotton', 'laterite', 'alluvial_loam'],
  "Karnataka": ['red_loamy', 'black_cotton', 'laterite', 'coastal_sandy', 'alluvial_loam'],
  "Tamil Nadu": ['red_loamy', 'black_cotton', 'alluvial_loam', 'coastal_sandy', 'laterite'],
  "Maharashtra": ['black_cotton', 'laterite', 'red_loamy', 'alluvial_loam'],
  "Gujarat": ['black_cotton', 'alluvial_loam', 'coastal_sandy', 'red_loamy'],
  "Madhya Pradesh": ['black_cotton', 'alluvial_loam', 'red_loamy'],
  "Punjab": ['alluvial_loam', 'clayey_wetland', 'red_loamy'],
  "Haryana": ['alluvial_loam', 'clayey_wetland', 'red_loamy'],
  "Uttar Pradesh": ['alluvial_loam', 'clayey_wetland', 'red_loamy'],
  "Bihar": ['alluvial_loam', 'clayey_wetland', 'red_loamy'],
  "West Bengal": ['alluvial_loam', 'clayey_wetland', 'coastal_sandy', 'laterite'],
  "Odisha": ['red_loamy', 'laterite', 'alluvial_loam', 'coastal_sandy', 'black_cotton'],
  "Kerala": ['laterite', 'coastal_sandy', 'alluvial_loam', 'clayey_wetland'],
  "Assam": ['alluvial_loam', 'laterite', 'clayey_wetland', 'red_loamy'],
  "Rajasthan": ['coastal_sandy', 'alluvial_loam', 'black_cotton'],
  "Chhattisgarh": ['red_loamy', 'black_cotton', 'laterite'],
  "Jharkhand": ['red_loamy', 'laterite', 'alluvial_loam']
};

/**
 * Get prioritized soil keys for a state
 */
export function getSoilsForState(stateName) {
  if (stateName && STATE_SOIL_PREFERENCES[stateName]) {
    return STATE_SOIL_PREFERENCES[stateName];
  }
  // Default national priority
  return ['red_loamy', 'black_cotton', 'alluvial_loam', 'laterite', 'coastal_sandy', 'clayey_wetland'];
}

/**
 * Get localized soil name in any supported language
 */
export function getLocalizedSoilName(soilKey, lang = 'en') {
  const code = (lang || 'en').split('-')[0];
  const soil = SOIL_TYPES_DATABASE[soilKey];
  if (!soil) return soilKey || 'Soil';
  return soil.names[code] || soil.names.en || soil.key;
}

/**
 * Get all soil options localized and prioritized for a state
 */
export function getSoilOptions(stateName, lang = 'en') {
  const prioritizedKeys = getSoilsForState(stateName);
  return prioritizedKeys.map(key => {
    const soil = SOIL_TYPES_DATABASE[key];
    return {
      value: key,
      label: getLocalizedSoilName(key, lang),
      waterRetentionDays: soil?.waterRetentionDays || 3,
      bestCrops: soil?.bestCrops || []
    };
  });
}

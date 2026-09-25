/**
 * Plantix Diagnosis Helper
 * Provides disease categorization, concise 4-bullet symptoms, scientific taxonomy,
 * and 6-tier field severity survey questions aligned with Plantix app specifications.
 */

export const getDiseaseCategory = (cropName = '', diseaseName = '', lang = 'te') => {
  const dLow = (diseaseName || '').toLowerCase();
  const isHealthy = dLow.includes('healthy') || dLow.includes('ఆరోగ్య');

  if (isHealthy) {
    return {
      key: 'healthy',
      icon: '🌿',
      label: lang === 'te' ? 'ఆరోగ్యకరమైన పంట' : lang === 'hi' ? 'स्वस्थ फसल' : lang === 'ta' ? 'ஆரோக்கியமான பயிர்' : 'Healthy Crop',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800'
    };
  }

  if (dLow.includes('thrip') || dLow.includes('mite') || dLow.includes('caterpillar') || 
      dLow.includes('spodoptera') || dLow.includes('borer') || dLow.includes('aphid') || 
      dLow.includes('hopper') || dLow.includes('bug') || dLow.includes('pest') || 
      dLow.includes('fly') || dLow.includes('worm') || dLow.includes('పురుగు')) {
    return {
      key: 'pest',
      icon: '🐛',
      label: lang === 'te' ? 'కీటకం' : lang === 'hi' ? 'कीट' : lang === 'ta' ? 'பூச்சி' : 'Insect / Pest',
      color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800'
    };
  }

  if (dLow.includes('virus') || dLow.includes('mosaic') || dLow.includes('curl') || dLow.includes('వైరస్') || dLow.includes('ముడత')) {
    return {
      key: 'virus',
      icon: '🧬',
      label: lang === 'te' ? 'వైరస్' : lang === 'hi' ? 'वायरस' : lang === 'ta' ? 'வைரஸ்' : 'Viral Infection',
      color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800'
    };
  }

  if (dLow.includes('bacterial') || dLow.includes('canker') || dLow.includes('బ్యాక్టీరియా')) {
    return {
      key: 'bacteria',
      icon: '🧫',
      label: lang === 'te' ? 'బ్యాక్టీరియా' : lang === 'hi' ? 'जीवाणु' : lang === 'ta' ? 'பாக்டீரியா' : 'Bacterial Pathogen',
      color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/70 dark:text-cyan-300 dark:border-cyan-800'
    };
  }

  if (dLow.includes('deficiency') || dLow.includes('chlorosis') || dLow.includes('yellow') || dLow.includes('లోపం')) {
    return {
      key: 'deficiency',
      icon: '⚡',
      label: lang === 'te' ? 'పోషక లోపం' : lang === 'hi' ? 'पोषक तत्व कमी' : lang === 'ta' ? 'ஊட்டச்சத்து குறைபாடு' : 'Nutrient Deficiency',
      color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/70 dark:text-yellow-300 dark:border-yellow-800'
    };
  }

  // Default: Fungal
  return {
    key: 'fungus',
    icon: '🍄',
    label: lang === 'te' ? 'శిలీంధ్రం' : lang === 'hi' ? 'फफूंद' : lang === 'ta' ? 'பூஞ்சை' : 'Fungal Disease',
    color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800'
  };
};

export const getScientificName = (cropName = '', diseaseName = '') => {
  const dLow = (diseaseName || '').toLowerCase();
  const cLow = (cropName || '').toLowerCase();

  if (dLow.includes('thrip')) return 'Scirtothrips dorsalis';
  if (dLow.includes('mite')) return 'Polyphagotarsonemus latus';
  if (dLow.includes('spodoptera') || dLow.includes('caterpillar') || dLow.includes('cutworm')) return 'Spodoptera litura';
  if (dLow.includes('anthracnose') || dLow.includes('dieback')) return 'Colletotrichum capsici';
  if (dLow.includes('cercospora') || (dLow.includes('leaf spot') && cLow.includes('chilli'))) return 'Cercospora capsici';
  if (dLow.includes('curl') || dLow.includes('mosaic')) return 'Chilli Leaf Curl Begomovirus (ChiLCV)';
  if (dLow.includes('early blight')) return 'Alternaria solani';
  if (dLow.includes('late blight')) return 'Phytophthora infestans';
  if (dLow.includes('powdery mildew')) return 'Leveillula taurica';
  if (dLow.includes('blast')) return 'Magnaporthe oryzae';
  if (dLow.includes('sheath blight')) return 'Rhizoctonia solani';
  if (dLow.includes('rust')) return 'Puccinia sorghi';
  if (dLow.includes('bacterial')) return 'Xanthomonas campestris';
  if (dLow.includes('aphid')) return 'Aphis gossypii';
  if (dLow.includes('whitefly')) return 'Bemisia tabaci';
  if (dLow.includes('healthy')) return 'Capsicum annuum (Healthy Canopy)';

  return 'Phytopathogenic Complex';
};

/**
 * Returns exactly 4 concise, scannable bullet points matching Plantix UI/UX style.
 */
export const getPlantixSymptomList = (cropName = '', diseaseName = '', lang = 'te', observedText = '') => {
  const dLow = (diseaseName || '').toLowerCase();
  const isHealthy = dLow.includes('healthy') || dLow.includes('ఆరోగ్య');

  if (isHealthy) {
    if (lang === 'te') {
      return [
        'ఆకులు ముదురు ఆకుపచ్చ రంగులో పుష్టిగా, ఆరోగ్యంగా ఉన్నాయి.',
        'ఎటువంటి తెగులు మచ్చలు, రంధ్రాలు లేదా ముడత లక్షణాలు లేవు.',
        'మొక్క సహజ సిద్ధమైన కిరణజన్య సంయోగ క్రియతో ఎదుగుతోంది.',
        'రసాయన మందులు వాడవలసిన అవసరం లేదు; క్రమం తప్పకుండా నీరు అందించండి.'
      ];
    }
    if (lang === 'hi') {
      return [
        'पत्तियां गहरे हरे रंग की, पुष्ट और पूरी तरह स्वस्थ हैं।',
        'किसी प्रकार के धब्बे, छेद या पत्तियों के मुड़ने के लक्षण नहीं हैं।',
        'पौधे का विकास प्राकृतिक एवं संतुलित अवस्था में है।',
        'रासायनिक दवाओं के छिड़काव की कोई आवश्यकता नहीं है।'
      ];
    }
    return [
      'Leaves display vibrant chlorophyll density with uniform green color.',
      'No foliar lesions, necrotic punctures, or curl deformities detected.',
      'Vegetative growth and vascular transpiration are optimal.',
      'No chemical intervention required; continue standard irrigation.'
    ];
  }

  // Chilli Thrips (Matches Plantix Pages 1 & 10 exactly!)
  if (dLow.includes('thrip') || (dLow.includes('chilli') && dLow.includes('curl'))) {
    if (lang === 'te') {
      return [
        'ఆకులు పైకి వంకర తిరిగి ఉంటాయి (బోటు ఆకారంలో).',
        'ఆకులు మరియు లేత పూత ముందుగానే రాలిపోతాయి.',
        'పువ్వులు మరియు పిందెలు కూడా ప్రభావితమై ఎదుగుదల ఆగిపోతుంది.',
        'నల్లని గోధుమ రంగు శరీరం మరియు పసుపు రంగు రెక్కలతో చిన్న మరియు సన్నని కీటకాలు రసం పీల్చుతాయి.'
      ];
    }
    if (lang === 'hi') {
      return [
        'पत्तियां ऊपर की ओर मुड़कर नाव का आकार ले लेती हैं।',
        'पत्तियां और कोमल कलियां समय से पहले झड़ने लगती हैं।',
        'फूल और नए फल प्रभावित होकर विकास रुक जाता है।',
        'पीले/भूरे रंग के छोटे और पतले कीट कोमल भागों का रस चूसते हैं।'
      ];
    }
    return [
      'Leaves curl upwards into characteristic boat-shaped or cup-like forms.',
      'Premature leaf shedding and flower bud drop occur.',
      'Flowers and young fruit pods are severely stunted.',
      'Slender dark brown insects with fringed wings suck sap from tender shoots.'
    ];
  }

  // Caterpillar / Spodoptera
  if (dLow.includes('caterpillar') || dLow.includes('spodoptera') || dLow.includes('cutworm') || dLow.includes('borer')) {
    if (lang === 'te') {
      return [
        'ఆకులను పురుగులు కొరికి తినడం వల్ల పెద్ద పెద్ద రంధ్రాలు ఏర్పడతాయి.',
        'ఆకుల అంచులు చిరిగిపోయి కేవలం ఈనెలు మాత్రమే మిగులుతాయి.',
        'మొక్క లేత చిగుళ్ళు మరియు కాయలను రంధ్రాలు చేసి దెబ్బతీస్తాయి.',
        'ఆకుల వెనుక భాగంలో గుడ్ల సముదాయాలు లేదా లద్దెపురుగులు కనిపిస్తాయి.'
      ];
    }
    if (lang === 'hi') {
      return [
        'पत्तियों को कुतरने से बड़े-बड़े अनियमित छेद बन जाते हैं।',
        'पत्तियों के किनारे कट जाते हैं और केवल नसें बाकी रह जाती हैं।',
        'कोमल शाखाओं और फलों में छेद करके गंभीर नुकसान पहुंचाती हैं।',
        'पत्तियों की निचली सतह पर अंडों के गुच्छे या इल्लियां देखी जा सकती हैं।'
      ];
    }
    return [
      'Larvae chew extensive irregular holes directly through foliage.',
      'Leaf margins are skeletonized, leaving only hard vascular veins.',
      'Growing shoot tips and developing pods are bored and damaged.',
      'Egg masses covered with brownish fuzz visible on leaf undersides.'
    ];
  }

  // Fungal Leaf Spots / Blight / Anthracnose
  if (dLow.includes('spot') || dLow.includes('blight') || dLow.includes('anthracnose') || dLow.includes('cercospora')) {
    if (lang === 'te') {
      return [
        'ఆకులపై వలయాకారపు గోధుమ లేదా నల్లటి మచ్చలు కనిపిస్తాయి.',
        'మచ్చల చుట్టూ లేత పసుపు రంగు వలయం (హలో) ఏర్పడుతుంది.',
        'వ్యాధి తీవ్రత పెరిగితే ఆకులు పసుపుపచ్చగా మారి ముందుగానే రాలిపోతాయి.',
        'కాయలు మరియు కాండంపై కూడా నల్లటి కుళ్లు మచ్చలు వ్యాపిస్తాయి.'
      ];
    }
    if (lang === 'hi') {
      return [
        'पत्तियों पर गोलाकार भूरे या काले रंग के धब्बे दिखाई देते हैं।',
        'धब्बों के चारों ओर पीले रंग का घेरा (हेलो) बन जाता है।',
        'रोग बढ़ने पर पत्तियां पीली पड़कर समय से पहले गिर जाती हैं।',
        'फलों और तनों पर भी काले सड़न वाले धब्बे फैलने लगते हैं।'
      ];
    }
    return [
      'Circular necrotic brown to black lesions develop on foliage.',
      'A distinct chlorotic yellow halo surrounds expanding spots.',
      'Severe infection causes premature yellowing and heavy defoliation.',
      'Sunken lesions may extend onto stems and ripening fruit pods.'
    ];
  }

  // Generic / Default Fallback
  if (lang === 'te') {
    return [
      'ఆకుల ఉపరితలంపై రంగు మార్పు మరియు వ్యాధి లక్షణాలు స్పష్టంగా కనిపిస్తున్నాయి.',
      'కిరణజన్య సంయోగ క్రియ దెబ్బతినడం వల్ల మొక్క ఎదుగుదల కుంటుపడుతుంది.',
      'మొక్క రోగనిరోధక శక్తి తగ్గి పూత మరియు కాయల ఉత్పత్తి ప్రభావితమవుతుంది.',
      'వ్యాధి విస్తరించకుండా సకాలంలో రక్షక మందులు పిచికారీ చేయడం అత్యవసరం.'
    ];
  }
  if (lang === 'hi') {
    return [
      'पत्तियों की सतह पर रंग में बदलाव और रोग के स्पष्ट लक्षण दिख रहे हैं।',
      'प्रकाश संश्लेषण बाधित होने से पौधे का समग्र विकास धीमा हो जाता है।',
      'रोग प्रतिरोधक क्षमता घटने से फूलों और फलों की पैदावार प्रभावित होती है।',
      'रोग को अन्य पौधों में फैलने से रोकने के लिए तुरंत छिड़काव जरूरी है।'
    ];
  }
  return [
    'Visible foliar discoloration and structural lesion formation present.',
    'Chlorophyll activity is compromised, impacting plant vegetative vigor.',
    'Flowering and fruit set are at risk without targeted intervention.',
    'Timely application of recommended treatment prevents field outbreak.'
  ];
};

/**
 * 6 Field-Level Damage Severity Tiers (Matching Plantix Pages 5 & 6)
 */
export const FIELD_SEVERITY_OPTIONS = [
  {
    id: 1,
    percent: '0%',
    badge: 'Healthy',
    label: {
      te: 'పొలం పూర్తిగా ఆరోగ్యంగా కనిపిస్తోంది - ఎటువంటి వ్యాధి లక్షణాలు కనిపించడం లేదు.',
      hi: 'खेत पूरी तरह स्वस्थ दिख रहा है - कोई रोग लक्षण दिखाई नहीं दे रहा है।',
      en: 'Field looks completely healthy - no disease symptoms visible anywhere.'
    }
  },
  {
    id: 2,
    percent: '< 10%',
    badge: 'Isolated',
    label: {
      te: 'అక్కడక్కడ కొన్ని మొక్కలు మాత్రమే ప్రభావితమయ్యాయి.',
      hi: 'यहाँ-वहाँ केवल कुछ पौधे ही प्रभावित हुए हैं।',
      en: 'Only a few scattered plants affected here and there across the field.'
    }
  },
  {
    id: 3,
    percent: '10 - 25%',
    badge: 'Patches',
    label: {
      te: 'పొలంలోని కొన్ని ప్రాంతాల్లో వ్యాధి లక్షణాలు కనిపిస్తున్నాయి (మొత్తం పొలంలో 50% కంటే తక్కువ).',
      hi: 'खेत के कुछ हिस्सों में लक्षण दिख रहे हैं (पूरे खेत के 50% से कम)।',
      en: 'Disease symptoms visible in distinct patches (< 50% of total field).'
    }
  },
  {
    id: 4,
    percent: '25 - 50%',
    badge: 'Moderate',
    label: {
      te: 'సగం పొలంలో వ్యాధి లక్షణాలు కనిపిస్తున్నాయి - ప్రతి రెండవ పంట ప్రభావితమైంది.',
      hi: 'आधे खेत में लक्षण दिख रहे हैं - हर दूसरा पौधा प्रभावित है।',
      en: 'Symptoms visible across half the field - every second plant affected.'
    }
  },
  {
    id: 5,
    percent: '50 - 75%',
    badge: 'Severe',
    label: {
      te: 'పొలంలో అధిక భాగం ప్రభావితమైంది (50% కంటే ఎక్కువ పంటలో).',
      hi: 'खेत का अधिकांश हिस्सा प्रभावित है (50% से अधिक फसल में)।',
      en: 'Majority of the field is affected (more than 50% of the crop).'
    }
  },
  {
    id: 6,
    percent: '75 - 100%',
    badge: 'Critical',
    label: {
      te: 'మొత్తం పొలం ప్రభావితమైంది (ప్రతి పంటలో వ్యాధి లక్షణాలు కనిపిస్తున్నాయి).',
      hi: 'पूरा खेत प्रभावित हो चुका है (हर एक पौधे पर लक्षण दिख रहे हैं)।',
      en: 'Entire field is affected (every single plant exhibits symptoms).'
    }
  }
];

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
  if (dLow.includes('choanephora') || dLow.includes('wet rot')) return 'Choanephora cucurbitarum';
  if (dLow.includes('phytophthora')) return 'Phytophthora capsici';
  if (dLow.includes('damping')) return 'Pythium aphanidermatum';
  if (dLow.includes('nematode') || dLow.includes('root knot') || dLow.includes('root-knot')) return 'Meloidogyne incognita';
  if (dLow.includes('bacterial wilt') || dLow.includes('ralstonia')) return 'Ralstonia solanacearum';
  if (dLow.includes('fusarium') || dLow.includes('wilt')) return 'Fusarium oxysporum';
  if (dLow.includes('stem borer') || dLow.includes('shoot borer') || dLow.includes('borer')) return 'Chilo partellus';
  if (dLow.includes('fruit fly') || dLow.includes('maggot')) return 'Bactrocera cucurbitae';
  if (dLow.includes('clubroot')) return 'Plasmodiophora brassicae';
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

/**
 * Returns deep agronomic pathology narrative matching Plantix Picture 1
 */
export const getPlantixAgronomicNarrative = (cropName = '', diseaseName = '', lang = 'te') => {
  const dLow = (diseaseName || '').toLowerCase();
  const cLow = (cropName || '').toLowerCase();
  const isHealthy = dLow.includes('healthy') || dLow.includes('ఆరోగ్య');

  if (isHealthy) {
    if (lang === 'te') {
      return 'మొక్క యొక్క ఆకులు, కొమ్మలు మరియు పూత సహజమైన పచ్చదనం మరియు పుష్టితో కనిపిస్తున్నాయి. ఎటువంటి కీటకాల రసం పీల్చే గాయాలు లేదా శిలీంధ్రపు మచ్చలు కనిపించడం లేదు. సరైన సమయానికి సమతుల్య నీటి పారుదల మరియు సేంద్రీయ పోషకాలు అందించడం ద్వారా మొక్క రోగనిరోధక శక్తిని నిలబెట్టుకోవచ్చు.';
    }
    if (lang === 'hi') {
      return 'पौधे की पत्तियां, शाखाएं और फूल प्राकृतिक हरेपन और मजबूती के साथ दिख रहे हैं। किसी भी कीट के रस चूसने के घाव या फंगल धब्बे नहीं हैं। समय पर संतुलित सिंचाई और जैविक पोषण देकर पौधे की रोग प्रतिरोधक क्षमता बनाए रखें।';
    }
    return 'The foliage, vegetative nodes, and emerging buds exhibit robust chlorophyll synthesis and structural integrity. No pest feeding puncture marks or fungal necrotic lesions are present. Continue disciplined drip irrigation and balanced micronutrient nutrition.';
  }

  // Chilli Thrips / Leaf Curl (Matches Plantix Picture 1 verbatim!)
  if (dLow.includes('thrip') || (cLow.includes('chilli') && (dLow.includes('curl') || dLow.includes('virus')))) {
    if (lang === 'te') {
      return 'చిన్న పురుగులు ఇంకా పెద్ద పురుగులు మొక్కల క్రిందిభాగాలపై ఉపరితలాన్ని గీకి అక్కడనుండి బైటికి వచ్చే కణ ద్రవ్యాన్ని పీల్చుతాయి. తెగులు బారిన పడిన ఆకులు గోధుమ రంగు నుండి నలుపుగా మారతాయి. కొన్ని తీవ్రమైన సందర్భాల్లో ఆకులు మొత్తం వైకల్యం చెంది తర్వాత ఆకులు మొత్తం ముందుగానే రాలిపోతాయి. పువ్వులను తినడం వలన పూరేకులపై చారలు ఏర్పడి రాలిపోవడం మరియు చనిపోవడానికి దారితీస్తుంది. పండ్లపై పొక్కులు, మచ్చలు మరియు పండ్ల రూపం మారడం వలన వాటి మార్కెట్ విలువ తగ్గుతుంది. ఈ తెగులు సంవత్సరమంతా సంక్రమించే అవకాశం ఉన్నప్పటికీ పొడిగా వుండే వాతావరణంలో మరియు మట్టిలో నత్రజని అధికంగా వున్నప్పుడు ఈ తెగులు తీవ్రత అధికంగా ఉంటుంది.';
    }
    if (lang === 'hi') {
      return 'छोटे और वयस्क कीट पत्तियों की निचली सतह को खुरचकर निकलने वाले रस को चूसते हैं। प्रभावित पत्तियां भूरे से काले रंग में बदलने लगती हैं। गंभीर स्थिति में पत्तियां पूरी तरह विकृत होकर नाव के आकार में ऊपर मुड़ जाती हैं और समय से पहले झड़ जाती हैं। फूलों पर आक्रमण से पंखुड़ियों पर धारियां बन जाती हैं और फूल गिर जाते हैं। फलों पर धब्बे और खुरदुरापन आने से बाजार मूल्य घट जाता है। शुष्क मौसम और मिट्टी में अधिक नाइट्रोजन होने पर इसका प्रकोप बहुत तीव्र होता है।';
    }
    return 'Both nymphs and adult insects scrape the lower leaf surface and voraciously suck the exuded cellular sap. Damaged foliage transitions from chlorotic bronze to dark brownish-black. In severe infestations, leaves become heavily distorted, curl upwards into characteristic boat shapes, and shed prematurely. Blossom feeding causes petal streaking and bud drop, arresting fruit set. Scabbing and deformities on fruit pods lower market value. While present year-round, dry weather and excessive soil nitrogen accelerate pest severity.';
  }

  // Leaf Spot / Cercospora (Picture 2)
  if (dLow.includes('spot') || dLow.includes('cercospora') || dLow.includes('blight')) {
    if (lang === 'te') {
      return 'శిలీంధ్ర బీజాంశాలు గాలి మరియు నీటి తుంపర్ల ద్వారా వ్యాపించి ఆకుల కణజాలంపై దాడి చేస్తాయి. మొదట చిన్న వలయాకారపు గోధుమ మచ్చలుగా ప్రారంభమై, చుట్టూ పసుపు రంగు వలయంతో పెద్ద మచ్చలుగా విస్తరిస్తాయి. మచ్చల మధ్యభాగం ఎండిపోయి రాలిపోవడం వల్ల ఆకులకు రంధ్రాలు ఏర్పడతాయి. తీవ్రత పెరిగితే ఆకులు పసుపుపచ్చగా మారి కిరణజన్య సంయోగ క్రియ తగ్గి దిగుబడి భారీగా పడిపోతుంది. అధిక తేమ మరియు రాత్రి వేళల్లో మంచు ఎక్కువగా ఉన్నప్పుడు ఈ వ్యాధి వేగంగా వ్యాపిస్తుంది.';
    }
    if (lang === 'hi') {
      return 'फंगल बीजाणु हवा और बारिश की बूंदों से फैलकर पत्तियों के ऊतकों पर हमला करते हैं। शुरुआत में छोटे गोलाकार भूरे धब्बे बनते हैं, जिनके चारों ओर पीला घेरा होता है। धब्बों का केंद्र सूखकर गिर जाता है जिससे पत्तियों में छेद हो जाते हैं। अधिक संक्रमण में पत्तियां पीली पड़कर गिर जाती हैं जिससे प्रकाश संश्लेषण कम होकर पैदावार घट जाती है। उच्च आर्द्रता और ओस में यह तेजी से फैलता है।';
    }
    return 'Fungal spores spread via wind and rain splashes, invading leaf parenchymal cells. Symptoms initiate as small circular necrotic spots with defined dark margins and chlorotic haloes. Central necrotic tissue dries and drops out, creating a shot-hole appearance. Severe defoliation inhibits photosynthesis and stunts crop yield. High relative humidity (>85%) and nocturnal dew accelerate spore germination.';
  }

  // Wet Rot / Choanephora Blight
  if (dLow.includes('choanephora') || dLow.includes('wet rot')) {
    if (lang === 'te') {
      return 'ఈ శిలీంధ్ర తెగులు ప్రధానంగా పువ్వులు, లేత పిందెలు మరియు చిగుళ్లపై నీటితో నానిన నల్లటి తడి కుళ్లును కలిగిస్తుంది. అధిక గాలి తేమ మరియు వర్షపు జల్లులు ఉన్నప్పుడు పూలపై నల్లటి పిన్ హెడ్ లాంటి సన్నని వెంట్రుకల బూజు స్పష్టంగా కనిపిస్తుంది. పూత మొత్తం కుళ్ళిపోయి రాలిపోవడం వల్ల కాయలు ఏర్పడక భారీగా పంట నష్టం జరుగుతుంది.';
    }
    if (lang === 'hi') {
      return 'यह फफूंद रोग मुख्य रूप से फूलों, नई कलियों और कोमल शाखाओं पर गीला काला सड़न पैदा करता है। अधिक नमी में फूलों पर काले पिन जैसी बारीक फफूंद उग आती है। फूल और छोटी फलियां सड़कर गिर जाती हैं जिससे पैदावार में भारी कमी आती है।';
    }
    return 'Choanephora causes a water-soaked, wet blackish decay of flowers, young pods, and tender growing shoot tips. Under high relative humidity, conspicuous stiff silvery fungal threads with black pin-head heads (sporangiophores) develop. Blighted blossoms wither and shed prematurely, drastically inhibiting fruit set.';
  }

  // Phytophthora Root Rot & Collar Rot
  if (dLow.includes('phytophthora') || dLow.includes('root rot') || dLow.includes('collar rot')) {
    if (lang === 'te') {
      return 'ఈ శిలీంధ్రం నేల నుండి మొదలయ్యి ప్రధాన వేర్లు మరియు కాండం మొదలును కుళ్ళిపోయేలా చేస్తుంది. తెగులు సోకిన వేర్లు నల్లగా మారి నీటితో నానినట్లుగా ఊడిపోతాయి. నేలలో అధిక నీరు నిలవడం వల్ల ఆకస్మికంగా ఆకులు ఆకుపచ్చగా ఉన్నప్పుడే వాడిపోయి మొత్తం మొక్క కుప్పకూలి చనిపోతుంది.';
    }
    if (lang === 'hi') {
      return 'यह रोग मिट्टी से फैलकर मुख्य जड़ों और तने के निचले हिस्से को सड़ा देता है। संक्रमित जड़ें काली और पिलपिली होकर आसानी से टूट जाती हैं। जलभराव होने पर पौधा हरा रहते हुए भी अचानक सूखकर गिर जाता है।';
    }
    return 'Phytophthora attacks the subterranean taproot and basal collar tissue, inducing dark water-soaked cortical decay. Diseased roots rot and easily slough away. Because water translocation is severed at the soil line, entire plants collapse into sudden green wilting during saturated field conditions.';
  }

  // Vascular Wilt (Fusarium & Bacterial Wilt)
  if (dLow.includes('wilt') || dLow.includes('fusarium') || dLow.includes('ralstonia')) {
    if (lang === 'te') {
      return 'ఈ తెగులు మొక్కల నాళికా వ్యవస్థ (జైలమ్) లోకి చొరబడి నీరు మరియు పోషకాల ప్రసరణను నిరోధిస్తుంది. ప్రారంభంలో తీవ్రమైన ఎండ వేళల్లో ఆకులు వాలిపోయి, రాత్రి వేళల్లో కోలుకుంటాయి. కొన్ని రోజుల తర్వాత శాశ్వతంగా వాడిపోయి ఎండిపోతాయి. కాండం పొడవునా చీల్చి చూసినప్పుడు లోపలి నాళాలు గోధుమ రంగులోకి మారడం కనిపిస్తుంది.';
    }
    if (lang === 'hi') {
      return 'यह रोग पौधे की जल संवहनी नलिकाओं में प्रवेश करके रस के प्रवाह को रोक देता है। शुरुआत में दोपहर की तेज धूप में पौधा मुरझाता है और रात में ठीक दिखता है, लेकिन कुछ दिनों में पूरी तरह सूख जाता है। तने को चीरकर देखने पर अंदर भूरी धारियां दिखती हैं।';
    }
    return 'Wilt pathogens colonize the xylem vascular bundles, physically impeding moisture and nutrient translocation. Foliage manifests flaccid mid-day wilting while recovering during nocturnal transpiration dips, before irreversible vascular collapse. Splitting the lower stem reveals characteristic dark brown vascular ring discoloration.';
  }

  // Damping-Off (Nursery Seedlings)
  if (dLow.includes('damping')) {
    if (lang === 'te') {
      return 'నారుమడులలో విత్తనాలు మొలకెత్తే దశలో లేదా చిన్న నారు దశలో ఈ తెగులు తీవ్ర నష్టం కలిగిస్తుంది. కాండం మొదలు వద్ద నీటితో నానిన గోధుమ రంగు మచ్చ ఏర్పడి కాండం మెత్తబడి నారు నేలపై పడిపోయి కుళ్ళిపోతుంది. నారుమడిలో నీరు నిలవడం వల్ల తెగులు వేగంగా వ్యాపిస్తుంది.';
    }
    if (lang === 'hi') {
      return 'नर्सरी में अंकुरण या छोटे पौधों की अवस्था में यह रोग लगता है। तने के आधार पर पानी जैसा भूरा धब्बा बनता है, जिससे तना कमजोर होकर पौधा जमीन पर गिर जाता है और सड़ जाता है।';
    }
    return 'Pythium damping-off causes severe post-emergence seedling mortality in nursery beds. Water-soaked constricted lesions girdle the stem base at the soil line, softening seedling tissues until they topple over and rot in waterlogged seedbeds.';
  }

  // Root-Knot Nematodes
  if (dLow.includes('nematode') || dLow.includes('root knot') || dLow.includes('root-knot')) {
    if (lang === 'te') {
      return 'నేలలోని సూక్ష్మ నులిపురుగులు మొక్క వేర్లలోకి చొరబడి పెద్ద పెద్ద బుడిపెలు లేదా గడ్డలను ఏర్పరుస్తాయి. దీనివల్ల వేర్ల ద్వారా నీరు మరియు పోషకాలు అందక మొక్కలు గిడసబారి పసుపు రంగులోకి మారుతాయి. ఎండ వేళల్లో మొక్కలు త్వరగా వాడిపోతాయి మరియు దిగుబడి భారీగా పడిపోతుంది.';
    }
    if (lang === 'hi') {
      return 'मिट्टी में मौजूद सूत्रकृमि जड़ों में प्रवेश कर गांठे बना देते हैं। इससे पौधे को पोषक तत्व और पानी नहीं मिल पाता, पौधे बौने रह जाते हैं और पत्तियां पीली पड़ जाती हैं।';
    }
    return 'Microscopic Meloidogyne nematodes penetrate root tips and induce hypertrophy, resulting in swollen, knobby root galls. Compromised root vascular systems cause chronic chlorosis, stunted terminal nodes, and mid-day wilting across field patches.';
  }

  // Stem Borer / Shoot Borer
  if (dLow.includes('stem borer') || dLow.includes('shoot borer') || dLow.includes('borer')) {
    if (lang === 'te') {
      return 'ఈ పురుగులు కాండం లోపలికి లేదా కాయల్లోకి తొలిచి లోపలి గుజ్జును తినివేస్తాయి. కాండంపై చిన్న రంధ్రాలు మరియు రంపపు పొట్టు లాంటి పురుగు మలము కనిపిస్తుంది. చిగురు కొమ్మలు ఎండిపోయి "డెడ్ హార్ట్" గా మారి కొమ్మలు విరిగిపోతాయి.';
    }
    if (lang === 'hi') {
      return 'यह इल्ली तने या फल के अंदर छेद करके भीतरी गूदे को खाती है। तने पर छेद और बुरादे जैसा मल दिखाई देता है। मुख्य शाखा सूख जाती है जिसे "डेड हार्ट" कहते हैं।';
    }
    return 'Larvae bore into central stems or developing fruits, excavating feeding tunnels packed with granular excreta (frass). Apical shoots wither into characteristic dry "dead hearts" that snap easily under light wind pressure.';
  }

  // Caterpillar / Spodoptera
  if (dLow.includes('spodoptera') || dLow.includes('caterpillar') || dLow.includes('cutworm')) {
    if (lang === 'te') {
      return 'ఈ లద్దెపురుగులు రాత్రి వేళల్లో చురుకుగా ఉండి ఆకులను విపరీతంగా కొరికి తింటాయి. లేత దశలో ఉన్న పురుగులు గుంపులుగా ఆకు అడుగుభాగాన్ని గీకి తిని పత్రహరితాన్ని నాశనం చేస్తాయి. పెద్ద పురుగులు ఆకులను పూర్తిగా కొరికి తిని కేవలం ఈనెలను మాత్రమే మిగులుస్తాయి. లేత మొగ్గలు మరియు కాయలను రంధ్రాలు చేసి తీవ్ర నష్టాన్ని కలిగిస్తాయి. పగటి వేళల్లో ఇవి నేలలోని పగుళ్లలో లేదా ఆకుల కింద దాక్కుంటాయి.';
    }
    return 'Caterpillars are nocturnal feeders that voraciously chew foliar blades. Gregarious young instars scrape green chlorophyll from leaf undersides, while mature larvae consume entire leaf lamina leaving only skeletonized veins. Developing flower buds and fruit pods are bored and destroyed. During the day, larvae conceal themselves in soil crevices or leaf litter.';
  }

  // Default
  if (lang === 'te') {
    return 'ఈ తెగులు మొక్క యొక్క పోషక రవాణా వ్యవస్థను మరియు పత్రహరితాన్ని దెబ్బతీస్తుంది. సకాలంలో సరైన నివారణ మందులు వాడకపోతే వ్యాధి పొలమంతా విస్తరించి పంట దిగుబడిపై తీవ్ర ప్రభావం చూపుతుంది.';
  }
  return 'This pathological condition compromises cellular translocation and chlorophyll integrity. Without targeted management, infection expands across neighboring rows, substantially diminishing market yield.';
};


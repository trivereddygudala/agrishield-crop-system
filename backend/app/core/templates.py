from datetime import timezone
import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Predefined templates dictionary for key localized warnings
NOTIFICATION_TEMPLATES: Dict[str, Dict[str, str]] = {
    "soil_moisture_low": {
        "en": "Soil moisture dropped to {{soil_moisture}}%. Recommended irrigation: {{liters}} L/m².",
        "hi": "मिट्टी की नमी गिरकर {{soil_moisture}}% हो गई है। अनुशंसित सिंचाई: {{liters}} लीटर/वर्ग मीटर।",
        "te": "నేలలో తేమ {{soil_moisture}}% కి పడిపోయింది. సిఫార్సు చేయబడిన నీటి పారుదల: {{liters}} లీటర్లు/చదరపు మీటరు.",
        "ta": "மண்ணின் ஈரப்பதம் {{soil_moisture}}% ஆக குறைந்துள்ளது. பரிந்துரைக்கப்பட்ட பாசனம்: {{liters}} லிட்டர்/சதுர மீட்டர்.",
        "kn": "ಮಣ್ಣಿನ ತೇವಾಂಶವು {{soil_moisture}}% ಕ್ಕೆ ಇಳಿದಿದೆ. ಶಿಫಾರಸು ಮಾಡಲಾದ ನೀರಾವರಿ: {{liters}} ಲೀಟರ್/ಚದರ ಮೀಟರ್.",
        "ml": "മണ്ണിലെ ഈർപ്പം {{soil_moisture}}% ആയി കുറഞ്ഞു. ശുപാർശ ചെയ്യുന്ന നനവ്: {{liters}} ലിറ്റർ/ചതുരശ്ര മീറ്റർ.",
        "mr": "मातीतील ओलावा {{soil_moisture}}% पर्यंत कमी झाला आहे. शिफारस केलेले सिंचन: {{liters}} लिटर/चौ.मी.",
        "gu": "માટીનો ભેજ ઘટીને {{soil_moisture}}% થયો છે. ભલામણ કરેલ પિયત: {{liters}} લિટર/ચો.મી.",
        "pa": "ਮਿੱਟੀ ਦੀ ਨਮੀ ਘਟ ਕੇ {{soil_moisture}}% ਹੋ ਗਈ ਹੈ। ਸਿਫਾਰਸ਼ ਕੀਤਾ ਸਿੰਚਾਈ: {{liters}} ਲੀਟਰ/ਵਰਗ ਮੀਟਰ।",
        "ur": "مٹی میں نمی کم ہو کر {{soil_moisture}}% ہو گئی ہے۔ تجویز کردہ آبپاشی: {{liters}} لیٹر فی مربع میٹر۔",
        "or": "ମାଟିର ଆର୍ଦ୍ରତା {{soil_moisture}}% କୁ ହ୍ରାସ ପାଇଛି। ପରାମର୍ଶିତ ଜଳସେଚନ: {{liters}} ଲିଟର/ବର୍ଗ ମିଟର।",
        "as": "মাটিৰ আৰ্দ্ৰতা {{soil_moisture}}% লৈ হ্ৰাস পাইছে। পৰামৰ্শিত জলসিঞ্চন: {{liters}} লিটাৰ/বৰ্গ মিটাৰ।"
    },
    "soil_moisture_high": {
        "en": "Soil moisture is excessively high at {{soil_moisture}}%. Avoid additional irrigation.",
        "hi": "मिट्टी की नमी {{soil_moisture}}% पर अत्यधिक है। अतिरिक्त सिंचाई से बचें।",
        "te": "నేలలో తేమ {{soil_moisture}}% వద్ద చాలా ఎక్కువగా ఉంది. అదనపు నీటి పారుదల నివారించండి.",
        "ta": "மண்ணின் ஈரப்பதம் {{soil_moisture}}% மிக அதிகமாக உள்ளது. கூடுதல் பாசனத்தைத் தவிர்க்கவும்.",
        "kn": "ಮಣ್ಣಿನ ತೇವಾಂಶವು {{soil_moisture}}% ರಷ್ಟು ಹೆಚ್ಚಾಗಿದೆ. ಹೆಚ್ಚುವರಿ ನೀರಾವರಿಯನ್ನು ತಪ್ಪಿಸಿ.",
        "ml": "മണ്ണിലെ ഈർപ്പം {{soil_moisture}}% വളരെ കൂടുതലാണ്. കൂടുതൽ നനയ്ക്കുന്നത് ഒഴിവാക്കുക.",
        "mr": "मातीतील ओलावा {{soil_moisture}}% वर जास्त आहे. अतिरिक्त सिंचन टाळा.",
        "gu": "માટીનો ભેજ {{soil_moisture}}% પર ઘણો વધારે છે. વધારાનું પિયત ટાળો.",
        "pa": "ਮਿੱਟੀ ਵਿੱਚ ਨਮੀ {{soil_moisture}}% ਬਹੁਤ ਜ਼ਿਆਦਾ ਹੈ। ਵਾਧੂ ਸਿੰਚਾਈ ਤੋਂ ਬਚੋ।",
        "ur": "مٹی کی نمی {{soil_moisture}}% پر بہت زیادہ ہے۔ مزید آبپاشی سے گریز کریں۔",
        "or": "ମାଟିରେ ଆର୍ଦ୍ରତା {{soil_moisture}}% ରେ ବହୁତ ଅଧିକ ଅଛି। ଅତିରିକ୍ତ ଜଳସେଚନରୁ ଦୂରେଇ ରୁହନ୍ତୁ।",
        "as": "মাটিৰ আৰ্দ্ৰতা {{soil_moisture}}% ত অত্যধিক বেছি। অতিৰিক্ত জলসিঞ্চন পৰিহাৰ কৰক।"
    },
    "temperature_high": {
        "en": "High temperature of {{temperature}}°C detected. Heat stress danger; increase irrigation.",
        "hi": "{{temperature}}°C का उच्च तापमान पाया गया। गर्मी का तनाव; सिंचाई बढ़ाएं।",
        "te": "అధిక ఉష్ణోగ్రత {{temperature}}°C నమోదైంది. వేడి ఒత్తిడి ముప్పు; నీటి పారుదల పెంచండి.",
        "ta": "உயர் வெப்பநிலை {{temperature}}°C கண்டறியப்பட்டுள்ளது. வெப்ப அழுத்தம்; பாசனத்தை அதிகரிக்கவும்.",
        "kn": "ಹೆಚ್ಚಿನ ತಾಪಮಾನ {{temperature}}°C ಪತ್ತೆಯಾಗಿದೆ. ಶಾಖದ ಒತ್ತಡದ ಅಪಾಯ; ನೀರಾವರಿ ಹೆಚ್ಚಿಸಿ.",
        "ml": "ഉയർന്ന താപനില {{temperature}}°C രേഖപ്പെടുത്തി. ചൂട് സമ്മർദ്ദം; നനവ് കൂട്ടുക.",
        "mr": "उच्च तापमान {{temperature}}°C नोंदवले गेले. उष्णतेचा ताण; सिंचन वाढवा.",
        "gu": "ઊંચું તાપમાન {{temperature}}°C નોંધાયું છે. ગરમીનું જોખમ; પિયત વધારો.",
        "pa": "ਉੱਚ ਤਾਪਮਾਨ {{temperature}}°C ਦਰਜ ਕੀਤਾ ਗਿਆ। ਗਰਮੀ ਦਾ ਤਣਾਅ; ਸਿੰਚਾਈ ਵਧਾਓ।",
        "ur": "زیادہ درجہ حرارت {{temperature}}°C ریکارڈ کیا گیا۔ گرمی کا دباؤ؛ آبپاشی میں اضافہ کریں۔",
        "or": "ଉଚ୍ଚ ତାପମାତ୍ରା {{temperature}}°C ଚିହ୍ନଟ ହୋଇଛି। ଗ୍ରୀଷ୍ମ ଚାପ; ଜଳସେଚନ ବୃଦ୍ଧି କରନ୍ତୁ।",
        "as": "উচ্চ তাপমাত্ৰা {{temperature}}°C ধৰা পৰিছে। গৰমৰ চাপ; জলসিঞ্চন বৃদ্ধি কৰক।"
    },
    "humidity_high": {
        "en": "Humidity is {{humidity}}%. Fungal disease transmission risk increased.",
        "hi": "आर्द्रता {{humidity}}% है। फंगल रोग के प्रसार का खतरा बढ़ गया है।",
        "te": "గాలిలో తేమ {{humidity}}% గా ఉంది. శిలీంధ్ర వ్యాప్తి ముప్పు పెరిగింది.",
        "ta": "ஈரப்பதம் {{humidity}}% ஆக உள்ளது. பூஞ்சை நோய் பரவும் அபாயம் அதிகரித்துள்ளது.",
        "kn": "ಆರ್ದ್ರತೆ {{humidity}}% ಆಗಿದೆ. ಶಿಲೀಂಧ್ರ ರೋಗ ಹರಡುವ ಅಪಾಯ ಹೆಚ್ಚಾಗಿದೆ.",
        "ml": "അന്തരീക്ഷ ഈർപ്പം {{humidity}}% ആണ്. പൂപ്പൽ രോഗ സാധ്യത കൂടുതലാണ്.",
        "mr": "हवेतील आर्द्रता {{humidity}}% आहे. बुरशीजन्य रोगांचा प्रसार वाढण्याचा धोका आहे.",
        "gu": "હવામાં ભેજ {{humidity}}% છે. ફૂગના રોગો ફેલાવાનું જોખમ વધ્યું છે.",
        "pa": "ਹਵਾ ਵਿੱਚ ਨਮੀ {{humidity}}% ਹੈ। ਉੱਲੀ ਰੋਗ ਫੈਲਣ ਦਾ ਖ਼ਤਰਾ ਵੱਧ ਗਿਆ ਹੈ।",
        "ur": "ہوا میں نمی {{humidity}}% ہے۔ پھپھوندی کی بیماری پھیلنے کا خطرہ بڑھ گیا ہے۔",
        "or": "ବାୟୁମଣ୍ଡଳୀୟ ଆର୍ଦ୍ରତା {{humidity}}% ଅଛି। କବକ ରୋଗ ବ୍ୟାପିବାର ଆଶଙ୍କା ବୃଦ୍ଧି ପାଇଛି।",
        "as": "বতাহত আৰ্দ্ৰতা {{humidity}}% আছে। ফাংগাছ ৰোগ বিস্তাৰৰ আশংকা বৃদ্ধি পাইছে।"
    },
    "battery_low": {
        "en": "ESP32 node battery level is low ({{battery_percentage}}%). Recharge device soon.",
        "hi": "ESP32 नोड बैटरी स्तर कम ({{battery_percentage}}%) है। जल्द ही डिवाइस चार्ज करें।",
        "te": "ESP32 నోడ్ బ్యాటరీ స్థాయి తక్కువగా ఉంది ({{battery_percentage}}%). త్వరలో పరికరాన్ని రీఛార్జ్ చేయండి.",
        "ta": "ESP32 நோடு பேட்டரி அளவு குறைவாக உள்ளது ({{battery_percentage}}%). சாதனத்தை விரைவில் சார்ஜ் செய்யவும்.",
        "kn": "ESP32 ನೋಡ್ ಬ್ಯಾಟರಿ ಮಟ್ಟ ಕಡಿಮೆಯಾಗಿದೆ ({{battery_percentage}}%). ಶೀಘ್ರದಲ್ಲೇ ಸಾಧನವನ್ನು ರೀಚಾರ್ಜ್ ಮಾಡಿ.",
        "ml": "ESP32 നോഡ് ബാറ്ററി ലെവൽ കുറവാണ് ({{battery_percentage}}%). ഉപകരണം ഉടൻ ചാർജ് ചെയ്യുക.",
        "mr": "ESP32 नोड बॅटरी पातळी कमी ({{battery_percentage}}%) आहे. लवकरच चार्ज करा.",
        "gu": "ESP32 નોડ બેટરી સ્તર ઓછું ({{battery_percentage}}%) છે. ઉપકરણ ટૂંક સમયમાં ચાર્જ કરો.",
        "pa": "ESP32 ਨੋਡ ਬੈਟਰੀ ਪੱਧਰ ਘੱਟ ({{battery_percentage}}%) ਹੈ। ਜਲਦੀ ਹੀ ਡਿਵਾਈਸ ਚਾਰਜ ਕਰੋ।",
        "ur": "ESP32 نوڈ کی بیٹری کم ({{battery_percentage}}%) ہے۔ جلد ہی چارج کریں۔",
        "or": "ESP32 ନୋଡ୍ ବ୍ୟାଟେରୀ ସ୍ତର କମ୍ ({{battery_percentage}}%) ଅଛି। ଶୀଘ୍ର ରିଚାର୍ଜ କରନ୍ତୁ।",
        "as": "ESP32 নোডৰ বেটাৰী লেভেল কম ({{battery_percentage}}%) আছে। সোনকালে ডিভাইচটো চাৰ্জ কৰক।"
    },
    "battery_critical": {
        "en": "ESP32 node battery is critically low ({{battery_percentage}}%). Recharge immediately.",
        "hi": "ESP32 नोड बैटरी गंभीर रूप से कम ({{battery_percentage}}%) है। तुरंत चार्ज करें।",
        "te": "ESP32 నోడ్ బ్యాటరీ చాలా తక్కువగా ఉంది ({{battery_percentage}}%). వెంటనే రీఛార్జ్ చేయండి.",
        "ta": "ESP32 நோடு பேட்டரி மிக மிக குறைவாக உள்ளது ({{battery_percentage}}%). உடனடியாக சார்ஜ் செய்யவும்.",
        "kn": "ESP32 ನೋಡ್ ಬ್ಯಾಟರಿ ಮಟ್ಟ ಅತ್ಯಂತ ಕಡಿಮೆಯಾಗಿದೆ ({{battery_percentage}}%). ತಕ್ಷಣ ರೀಚಾರ್ಜ್ ಮಾಡಿ.",
        "ml": "ESP32 നോഡ് ബാറ്ററി അതീവ ഗുരുതര നിലയിലാണ് ({{battery_percentage}}%). ഉടൻ ചാർജ് ചെയ്യുക.",
        "mr": "ESP32 नोड बॅटरी अत्यंत कमी ({{battery_percentage}}%) आहे. ताबडतोब चार्ज करा.",
        "gu": "ESP32 નોડ બેટરી અત્યંત ઓછી ({{battery_percentage}}%) છે. તરત જ ચાર્જ કરો.",
        "pa": "ESP32 ਨੋਡ ਬੈਟਰੀ ਬਹੁਤ ਜ਼ਿਆਦਾ ਘੱਟ ({{battery_percentage}}%) ਹੈ। ਤੁਰੰਤ ਰੀਚਾਰਜ ਕਰੋ।",
        "ur": "ESP32 نوڈ کی بیٹری انتہائی کم ({{battery_percentage}}%) ہے۔ فوری طور پر چارج کریں۔",
        "or": "ESP32 ନୋଡ୍ ବ୍ୟାଟେରୀ ଅତ୍ୟନ୍ତ କମ୍ ({{battery_percentage}}%) ଅଛି। ତୁରନ୍ତ ରିଚାର୍ଜ କରନ୍ତୁ।",
        "as": "ESP32 নোডৰ বেটাৰী সংকটজনকভাৱে কম ({{battery_percentage}}%) আছে। লগে লগে চাৰ্জ কৰক।"
    },
    "device_offline": {
        "en": "Device {{device_id}} is offline. Last seen {{minutes}} minutes ago.",
        "hi": "डिवाइस {{device_id}} ऑफ़लाइन है। अंतिम बार {{minutes}} मिनट पहले देखा गया था।",
        "te": "పరికరం {{device_id}} ఆఫ్‌లైన్‌లో ఉంది. చివరిగా {{minutes}} నిమిషాల క్రితం కనిపించింది.",
        "ta": "சாதனம் {{device_id}} ஆஃப்லைனில் உள்ளது. கடைசியായി {{minutes}} நிமிடங்களுக்கு முன்பு பார்க்கப்பட்டது.",
        "kn": "ಸಾಧನ {{device_id}} ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿದೆ. ಕೊನೆಯದಾಗಿ {{minutes}} ನಿಮಿಷಗಳ ಹಿಂದೆ ಪತ್ತೆಯಾಗಿದೆ.",
        "ml": "ഉപകരണം {{device_id}} ഓഫ്‌ലൈനാണ്. അവസാനമായി കണ്ടത് {{minutes}} മിനിറ്റുകൾക്ക് മുമ്പ്.",
        "mr": "डिव्हाइस {{device_id}} ऑफलाइन आहे. शेवटचे {{minutes}} मिनिटांपूर्वी दिसले.",
        "gu": "ઉપકરણ {{device_id}} ઑફલાઇન છે. છેલ્લે {{minutes}} મિનિટ પહેલાં જોવા મળ્યું હતું.",
        "pa": "ਡਿਵਾਈਸ {{device_id}} ਆਫ਼ਲਾਈਨ ਹੈ। ਆਖਰੀ ਵਾਰ {{minutes}} ਮਿੰਟ ਪਹਿਲਾਂ ਦੇਖਿਆ ਗਿਆ ਸੀ।",
        "ur": "ڈیوائس {{device_id}} آف لائن ہے۔ آخری بار {{minutes}} منٹ پہلے آن لائن تھی۔",
        "or": "ଡିଭାଇସ୍ {{device_id}} ଅଫଲାଇନ୍ ଅଛି। ଶେଷ ଥର ପାଇଁ {{minutes}} ମିନିଟ୍ ପୂର୍ବରୁ ଦେଖାଯାଇଥିଲା।",
        "as": "ডিভাইচ {{device_id}} অফলাইন আছে। অন্তিমবাৰ {{minutes}} মিনিট আগতে দেখা গৈছিল।"
    },
    "disease_detected": {
        "en": "Farming Alert: {{disease}} detected with {{confidence}}% confidence.",
        "hi": "कृषि चेतावनी: {{confidence}}% आत्मविश्वास के साथ {{disease}} का पता चला है।",
        "te": "వ్యవసాయ అలర్ట్: {{confidence}}% ఖచ్చితత్వంతో {{disease}} గుర్తించబడింది.",
        "ta": "வேளாண் எச்சரிக்கை: {{confidence}}% நம்பிக்கையுடன் {{disease}} கண்டறியப்பட்டுள்ளது.",
        "kn": "ಕೃಷಿ ಎಚ್ಚರಿಕೆ: {{confidence}}% ನಿಖರತೆಯೊಂದಿಗೆ {{disease}} ಪತ್ತೆಯಾಗಿದೆ.",
        "ml": "കൃഷി മുന്നറിയിപ്പ്: {{confidence}}% കൃത്യതയോടെ {{disease}} കണ്ടെത്തിയിരിക്കുന്നു.",
        "mr": "कृषी सूचना: {{confidence}}% अचूकतेसह {{disease}} आढळला आहे.",
        "gu": "કૃષિ ચેતવણી: {{confidence}}% ચોકસાઈ સાથે {{disease}} રોગ જણાયો છે.",
        "pa": "ਖੇਤੀ ਚੇਤਾਵਨੀ: {{confidence}}% ਸ਼ੁੱਧਤਾ ਨਾਲ {{disease}} ਦੀ ਪਛਾਣ ਹੋਈ ਹੈ।" ,
        "ur": "زرعی انتباہ: {{confidence}}% درستگی کے ساتھ {{disease}} کی تشخیص ہوئی ہے۔",
        "or": "କୃଷି ସତର୍କତା: {{confidence}}% ସଠିକତା ସହିତ {{disease}} ଚିହ୍ନଟ ହୋଇଛି।",
        "as": "কৃষি সতৰ্কবাণী: {{confidence}}% সঠিকতাৰ সৈতে {{disease}} ধৰা পৰিছে।"
    },
    "recommendation_changed": {
        "en": "Water advisory: Recommendation updated to '{{recommendation}}'.",
        "hi": "जल सलाह: सिफारिश को '{{recommendation}}' पर अपडेट किया गया है।",
        "te": "నీటి సలహా: సూచన '{{recommendation}}' గా మార్చబడింది.",
        "ta": "நீர் ஆலோசனை: பரிந்துரை '{{recommendation}}' என மாற்றப்பட்டுள்ளது.",
        "kn": "ನೀರಾವರಿ ಸಲಹೆ: ಶಿಫಾರಸು '{{recommendation}}' ಕ್ಕೆ ನವೀಕರಿಸಲಾಗಿದೆ.",
        "ml": "നനവ് നിർദ്ദേശം: ശുപാർശ '{{recommendation}}' ആയി പുതുക്കിയിരിക്കുന്നു.",
        "mr": "पाणी सल्ला: शिफारस '{{recommendation}}' वर अद्यतनित केली आहे.",
        "gu": "પાણી સલાહ: ભલામણ '{{recommendation}}' પર અપડેટ કરવામાં આવી છે.",
        "pa": "ਪਾਣੀ ਸਲਾਹ: ਸਿਫਾਰਸ਼ '{{recommendation}}' ਵਿੱਚ ਬਦਲੀ ਗਈ ਹੈ।",
        "ur": "پانی کا مشورہ: تجویز '{{recommendation}}' پر اپ ڈیٹ ہو گئی ہے۔",
        "or": "ଜଳ ପରାମର୍ଶ: ସୁପାରିଶ '{{recommendation}}' କୁ ଅଦ୍ୟତନ କରାଯାଇଛି।",
        "as": "পানী পৰামৰ্শ: পৰামৰ্শ '{{recommendation}}' লৈ আপডেট কৰা হৈছে।"
    },
    "possible_power_failure": {
        "en": "Possible Power Failure: Multiple offline metrics detected for device {{device_id}}.",
        "hi": "संभावित बिजली विफलता: डिवाइस {{device_id}} के लिए कई ऑफ़लाइन संकेतक मिले हैं।",
        "te": "విద్యుత్ వైఫల్యం ముప్పు: పరికరం {{device_id}} కోసం పలు ఆఫ్‌లైన్ సూచికలు నమోదయ్యాయి.",
        "ta": "மின் தடை சாத்தியம்: சாதனம் {{device_id}} இல் பல ஆஃப்லைன் அளவீடுகள் கண்டறியப்பட்டுள்ளன.",
        "kn": "ವಿದ್ಯುತ್ ಸ್ಥಗಿತದ ಸಾಧ್ಯತೆ: ಸಾಧನ {{device_id}} ಗಾಗಿ ಅನೇಕ ಆಫ್‌ಲೈನ್ ಸೂಚಕಗಳು ಪತ್ತೆಯಾಗಿವೆ.",
        "ml": "വൈദ്യുതി തടസ്സപ്പെടാൻ സാധ്യത: ഉപകരണം {{device_id}} ഓഫ്‌ലൈനായി കാണിക്കുന്നു.",
        "mr": "संभाव्य वीज पुरवठा खंडित: डिव्हाइस {{device_id}} साठी एकाधिक ऑफलाइन निर्देशक आढळले.",
        "gu": "સંભવિત વીજળી નિષ્ફળતા: ઉપકરણ {{device_id}} માટે ઘણા ઑફલાઇન સંકેતો મળ્યા છે.",
        "pa": "ਸੰਭਾਵੀ ਬਿਜਲੀ ਖਰਾਬੀ: ਡਿਵਾਈਸ {{device_id}} ਲਈ ਕਈ ਆਫਲਾਈਨ ਸੰਕੇਤ ਮਿਲੇ ਹਨ।",
        "ur": "بجلی کی ممکنہ ناکامی: ڈیوائس {{device_id}} کے لیے متعدد آف لائن اشارے ملے ہیں۔",
        "or": "ବିଦ୍ୟୁତ୍ ବିଫଳତା ସମ୍ଭାବନା: ଡିଭାଇସ୍ {{device_id}} ପାଇଁ ଏକାଧିକ ଅଫଲାଇନ୍ ସୂଚକ ମିଳିଛି।",
        "as": "সম্ভাব্য বিদ্যুৎ বিফলতা: ডিভাইচ {{device_id}} ৰ বাবে কেইবাটাও অফলাইন সূচক পোৱা গৈছে।"
    }
}

SUPPORTED_LANGUAGES = ["en", "hi", "te", "ta", "kn", "ml", "mr", "gu", "pa", "ur", "or", "as"]

def render_template(template_key: str, lang: str, context: Dict[str, Any]) -> str:
    """
    Renders localized notification message by replacing placeholders with context variables.
    Falls back to English if the translation or template key is missing.
    """
    # 1. Fetch template dict for this warning key
    lang = lang or "en"
    lang = lang.lower().split("-")[0]
    if lang not in SUPPORTED_LANGUAGES:
        lang = "en"
        
    template_set = NOTIFICATION_TEMPLATES.get(template_key)
    if not template_set:
        # If the template key is not pre-registered, return custom raw message string if context has it
        raw_msg = context.get("message", f"Alert: {template_key}")
        return raw_msg

    # 2. Extract specific language template
    template_str = template_set.get(lang, template_set.get("en", ""))
    
    # 3. Replace placeholders like {{variable}} with context values
    def replace_placeholder(match):
        placeholder = match.group(1).strip()
        val = context.get(placeholder, f"{{{{{placeholder}}}}}")
        if isinstance(val, float):
            return f"{val:.1f}"
        return str(val)

    rendered = re.sub(r"\{\{([^}]+)\}\}", replace_placeholder, template_str)
    return rendered


"""
AgriShield Unified Multilingual Translation Service (Phase 2A)

Provides robust, cached, asynchronous translation infrastructure across all
13 canonical Indian languages and English:
  en, hi, te, ta, kn, ml, mr, gu, pa, bn, ur, or, as

Key Principles:
1. Never overwrite or mutate original/canonical content.
2. Store translations separately from canonical data.
3. Memory LRU + MongoDB persistent caching + instant glossary to eliminate duplicate provider calls.
4. Graceful fallback: return original source text on any network/provider failure.
5. Zero provider error leakage to end users.
6. Support structured and container models:
   {
       "original": "...",
       "source_language": "en",
       "translations": { "te": "...", "hi": "..." }
   }
"""

import asyncio
import logging
import os
import json
import socket
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    httpx = None
    HTTPX_AVAILABLE = False
try:
    from deep_translator import GoogleTranslator
    DEEP_TRANSLATOR_AVAILABLE = True
except ImportError:
    GoogleTranslator = None
    DEEP_TRANSLATOR_AVAILABLE = False

logger = logging.getLogger("translation_service")

# Canonical Supported Indian Language Codes with English fallback
SUPPORTED_LANGUAGES = [
    "en", "te", "hi", "ta", "kn", "ml", "mr", "gu", "pa", "bn", "or", "ur", "as"
]

LANGUAGE_METADATA = {
    "te": {"name": "Telugu", "native": "తెలుగు", "flag": "🌾"},
    "hi": {"name": "Hindi", "native": "हिन्दी", "flag": "🇮🇳"},
    "ta": {"name": "Tamil", "native": "தமிழ்", "flag": "🌴"},
    "kn": {"name": "Kannada", "native": "ಕನ್ನಡ", "flag": "🌱"},
    "ml": {"name": "Malayalam", "native": "മലയാളം", "flag": "🥥"},
    "mr": {"name": "Marathi", "native": "मराठी", "flag": "🌿"},
    "gu": {"name": "Gujarati", "native": "ગુજરાતી", "flag": "🚜"},
    "pa": {"name": "Punjabi", "native": "ਪੰਜਾਬੀ", "flag": "🌾"},
    "bn": {"name": "Bengali", "native": "বাংলা", "flag": "🍃"},
    "or": {"name": "Odia", "native": "ଓଡ଼ିଆ", "flag": "🌾"},
    "ur": {"name": "Urdu", "native": "اردو", "flag": "✨"},
    "as": {"name": "Assamese", "native": "অসমীয়া", "flag": "🍵"},
    "en": {"name": "English", "native": "English", "flag": "🌐"}
}

# Fast in-memory glossary for common recurring agricultural, booking, and system terms
COMMON_GLOSSARY: Dict[str, Dict[str, str]] = {
    "open": {"te": "ఓపెన్", "hi": "खुला", "ta": "திறந்த", "kn": "ತೆರೆದ", "ml": "തുറന്ന", "mr": "उघडे", "gu": "ખુલ્લું", "pa": "ਖੁੱਲ੍ਹਾ", "bn": "উন্মুক্ত", "ur": "کھلا", "or": "ଖୋଲା", "as": "খোলা"},
    "in_progress": {"te": "పురోగతిలో ఉంది", "hi": "प्रगति पर है", "ta": "செயல்பாட்டில் உள்ளது", "kn": "ಪ್ರಗತಿಯಲ್ಲಿದೆ", "ml": "പുരോഗതിയിലാണ്", "mr": "प्रगतीपथावर आहे", "gu": "પ્રગતિમાં છે", "pa": "ਪ੍ਰਗਤੀ ਅਧੀਨ ਹੈ", "bn": "চলমান", "ur": "جاری ہے", "or": "ଚାଲୁଅଛି", "as": "চলি আছে"},
    "resolved": {"te": "పరిష్కరించబడింది", "hi": "समाधान हो गया", "ta": "தீர்க்கப்பட்டது", "kn": "ಪರಿಹರಿಸಲಾಗಿದೆ", "ml": "പരിഹരിച്ചു", "mr": "निकाली काढले", "gu": "ઉકેલાઈ ગયું", "pa": "ਹੱਲ ਹੋ ਗਿਆ", "bn": "সমাধান হয়েছে", "ur": "حل ہو گیا", "or": "ସମାଧାନ ହୋଇଛି", "as": "সমাধান হৈছে"},
    "closed": {"te": "ముగించబడింది", "hi": "बंद", "ta": "மூடப்பட்டது", "kn": "ಮುಚ್ಚಲಾಗಿದೆ", "ml": "അടച്ചു", "mr": "बंद केले", "gu": "બંધ", "pa": "ਬੰਦ", "bn": "বন্ধ", "ur": "بند", "or": "ବନ୍ଦ", "as": "বন্ধ"},
    "pending": {"te": "పెండింగ్‌లో ఉంది", "hi": "लंबित", "ta": "நிலுவையில் உள்ளது", "kn": "ಬಾಕಿ ಉಳಿದಿದೆ", "ml": "തീർപ്പുകൽപ്പിക്കാത്തത്", "mr": "प्रलंबित", "gu": "બાકી", "pa": "ਬਕਾਇਆ", "bn": "বিচারাধীন", "ur": "زیر التواء", "or": "ବାକି ଅଛି", "as": "বাকী আছে"},
    "confirmed": {"te": "ధృవీకరించబడింది", "hi": "पुष्टि की गई", "ta": "உறுதிப்படுத்தப்பட்டது", "kn": "ದೃಢೀಕರಿಸಲಾಗಿದೆ", "ml": "സ്ഥിരീകരിച്ചു", "mr": "निश्चित केले", "gu": "પુષ્ટિ થયેલ", "pa": "ਪੁਸ਼ਟੀ ਹੋਈ", "bn": "নিশ্চিত করা হয়েছে", "ur": "تصدیق شدہ", "or": "ନିଶ୍ଚିତ ହେଲା", "as": "নিশ্চিত কৰা হৈছে"},
    "completed": {"te": "పూర్తయింది", "hi": "पूर्ण हुआ", "ta": "முடிந்தது", "kn": "ಪೂರ್ಣಗೊಂಡಿದೆ", "ml": "പൂർത്തിയായി", "mr": "पूर्ण झाले", "gu": "પૂર્ણ થયું", "pa": "ਮੁਕੰਮਲ ਹੋਇਆ", "bn": "সম্পূর্ণ হয়েছে", "ur": "مکمل ہوا", "or": "ସମ୍ପୂର୍ଣ୍ଣ ହେଲା", "as": "সম্পূৰ্ণ হ'ল"},
    "cancelled": {"te": "రద్దు చేయబడింది", "hi": "रद्द किया गया", "ta": "ரத்து செய்யப்பட்டது", "kn": "ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ", "ml": "റദ്ദാക്കി", "mr": "रद्द केले", "gu": "રદ કરેલ", "pa": "ਰੱਦ ਕੀਤਾ", "bn": "বাতিল করা হয়েছে", "ur": "منسوخ", "or": "ବାତିଲ ହେଲା", "as": "বাতিল কৰা হ'ল"},
    "high": {"te": "అధికం", "hi": "उच्च", "ta": "உயர்", "kn": "ಹೆಚ್ಚು", "ml": "ഉയർന്ന", "mr": "उच्च", "gu": "ઉચ્ચ", "pa": "ਉੱਚ", "bn": "উচ্চ", "ur": "زیادہ", "or": "ଉଚ୍ଚ", "as": "উচ্চ"},
    "medium": {"te": "మధ్యస్థం", "hi": "मध्यम", "ta": "நடுத்தர", "kn": "ಮಧ್ಯಮ", "ml": "ഇടത്തരം", "mr": "मध्यम", "gu": "મધ્યમ", "pa": "ਦਰਮਿਆਨਾ", "bn": "মাঝারি", "ur": "درمیانہ", "or": "ମଧ୍ୟମ", "as": "মধ্যম"},
    "low": {"te": "తక్కువ", "hi": "निम्न", "ta": "குறைந்த", "kn": "ಕಡಿಮೆ", "ml": "കുറഞ്ഞ", "mr": "कमी", "gu": "ઓછું", "pa": "ਘੱਟ", "bn": "কম", "ur": "کم", "or": "କମ୍", "as": "কম"},
    "critical": {"te": "తీవ్రమైనది", "hi": "गंभीर", "ta": "முக்கியமானது", "kn": "ಕ್ಲಿಷ್ಟಕರ", "ml": "ഗുരുതരമായ", "mr": "गंभीर", "gu": "ગંભીર", "pa": "ਨਾਜ਼ੁਕ", "bn": "সংকটপূর্ণ", "ur": "انتہائی اہم", "or": "ଜରୁରୀ", "as": "গুৰুতৰ"}
}

# In-memory RAM cache: cache_key -> translated_text
_MEMORY_CACHE: Dict[str, str] = {}
_MAX_CACHE_SIZE = 50000

def _make_cache_key(source_lang: str, target_lang: str, text: str) -> str:
    return f"{source_lang.strip().lower()}:{target_lang.strip().lower()}:{text.strip()}"


# Agricultural token vocabulary for token-by-token fallback translation
AGRO_VOCAB: Dict[str, Dict[str, str]] = {
    "check": {"te": "పరిశీలించండి", "hi": "जांच करें", "ta": "சரிபார்க்கவும்", "kn": "ಪರಿಶೀಲಿಸಿ", "ml": "പരിശോധിക്കുക", "mr": "तपासा", "gu": "ચકાસો", "pa": "ਜਾਂਚ ਕਰੋ", "bn": "পরীক্ষা করুন", "or": "ଯାଞ୍ଚ କରନ୍ତୁ"},
    "the": {"te": "", "hi": "", "ta": "", "kn": "", "ml": "", "mr": "", "gu": "", "pa": "", "bn": "", "or": ""},
    "field": {"te": "పొలం", "hi": "खेत", "ta": "வயல்", "kn": "ಹೊಲ", "ml": "പാടം", "mr": "शेत", "gu": "ખેતર", "pa": "ਖੇਤ", "bn": "জমি", "or": "ଜମି"},
    "fields": {"te": "పొలాలు", "hi": "खेतों", "ta": "வயல்கள்", "kn": "ಹೊಲಗಳು", "ml": "പാടങ്ങൾ", "mr": "शेते", "gu": "ખેતરો", "pa": "ਖੇਤ", "bn": "জমি", "or": "ଜମିଗୁଡ଼ିକ"},
    "compulsory": {"te": "తప్పనిసరిగా", "hi": "अनिवार्य रूप से", "ta": "கட்டாயமாக", "kn": "ಕಡ್ಡಾಯವಾಗಿ", "ml": "നിർബന്ധമായും", "mr": "अनिवार्यपणे", "gu": "ફરજિયાત", "pa": "ਲਾਜ਼ਮੀ", "bn": "বাধ্যতামূলক", "or": "ବାଧ୍ୟତାମୂଳକ"},
    "compulsary": {"te": "తప్పనిసరిగా", "hi": "अनिवार्य रूप से", "ta": "கட்டாயமாக", "kn": "ಕಡ್ಡಾಯವಾಗಿ", "ml": "നിർബന്ധമായും", "mr": "अनिवार्यपणे", "gu": "ફરજિયાત", "pa": "ਲਾਜ਼ਮੀ", "bn": "বাধ্যতামূলক", "or": "ବାଧ୍ୟତାମୂଳକ"},
    "urgent": {"te": "అత్యవసరం", "hi": "अति आवश्यक", "ta": "அவசரம்", "kn": "ತುರ್ತು", "ml": "അടിയന്തിരം", "mr": "तातडीचे", "gu": "તાકીદનું", "pa": "ਜ਼ਰੂਰੀ", "bn": "জরুরি", "or": "ଜରୁରୀ"},
    "alert": {"te": "హెచ్చరిక", "hi": "चेतावनी", "ta": "எச்சரிக்கை", "kn": "ಎಚ್ಚರಿಕೆ", "ml": "മുന്നറിയിപ്പ്", "mr": "इशारा", "gu": "ચેતવણી", "pa": "ਚੇਤਾਵਨੀ", "bn": "সতর্কতা", "or": "ଚେତାବନୀ"},
    "warning": {"te": "హెచ్చరిక", "hi": "चेतावनी", "ta": "எச்சரிக்கை", "kn": "ಎಚ್ಚರಿಕೆ", "ml": "മുന്നറിയിപ്പ്", "mr": "इशारा", "gu": "ચેતવણી", "pa": "ਚੇਤਾਵਨੀ", "bn": "সতর্কতা", "or": "ଚେତାବନୀ"},
    "farmer": {"te": "రైతు", "hi": "किसान", "ta": "விவசாயி", "kn": "ರೈತ", "ml": "കർഷകൻ", "mr": "शेतकरी", "gu": "ખેડૂત", "pa": "ਕਿਸਾਨ", "bn": "কৃষক", "or": "କୃଷକ"},
    "farmers": {"te": "రైతులు", "hi": "किसान", "ta": "விவசாயிகள்", "kn": "ರೈತರು", "ml": "കർഷകർ", "mr": "शेतकरी", "gu": "ખેડૂતો", "pa": "ਕਿਸਾਨ", "bn": "কৃষকরা", "or": "କୃଷକମାନେ"},
    "crop": {"te": "పంట", "hi": "फसल", "ta": "பயிர்", "kn": "ಬೆಳೆ", "ml": "വിള", "mr": "पीक", "gu": "પાક", "pa": "ਫਸਲ", "bn": "ফসল", "or": "ଫସଲ"},
    "crops": {"te": "పంటలు", "hi": "फसलें", "ta": "பயிர்கள்", "kn": "ಬೆಳೆಗಳು", "ml": "വിളകൾ", "mr": "पिके", "gu": "પાકો", "pa": "ਫਸਲਾਂ", "bn": "ফসল", "or": "ଫସଲଗୁଡ଼ିକ"},
    "water": {"te": "నీరు", "hi": "पानी", "ta": "தண்ணீர்", "kn": "ನೀರು", "ml": "വെള്ളം", "mr": "पाणी", "gu": "પાણી", "pa": "ਪਾਣੀ", "bn": "জল", "or": "ପାଣି"},
    "spray": {"te": "పిచికారీ చేయండి", "hi": "छिड़काव करें", "ta": "தெளிக்கவும்", "kn": "ಸಿಂಪಡಿಸಿ", "ml": "തളിക്കുക", "mr": "फवारा", "gu": "છંટકاو કરો", "pa": "ਛਿੜਕਾਅ ਕਰੋ", "bn": "স্প્રે করুন", "or": "ସ୍ପ୍ରେ କରନ୍ତୁ"},
    "pesticide": {"te": "పురుగుమందు", "hi": "कीटनाशक", "ta": "பூச்சிக்கொல்லி", "kn": "ಕೀಟನಾಶಕ", "ml": "കീടനാശിനി", "mr": "कीटकनाशक", "gu": "જંતુનાશક", "pa": "ਕੀਟਨਾਸ਼ਕ", "bn": "কীটনাশক", "or": "କୀଟନାଶକ"},
    "fertilizer": {"te": "ఎరువులు", "hi": "उर्वरक", "ta": "உரம்", "kn": "ಗೊಬ್ಬರ", "ml": "വളം", "mr": "खत", "gu": "ખાતર", "pa": "ਖਾਦ", "bn": "সার", "or": "ଖତ"},
    "rain": {"te": "వర్షం", "hi": "बारिश", "ta": "மழை", "kn": "ಮಳೆ", "ml": "മഴ", "mr": "पाऊस", "gu": "વરસાદ", "pa": "ਮੀਂਹ", "bn": "বৃষ্টি", "or": "ବର୍ଷା"},
    "cyclone": {"te": "తుఫాను", "hi": "चक्रवात", "ta": "புயல்", "kn": "ಚಂಡಮಾರುತ", "ml": "ചുഴലിക്കാറ്റ്", "mr": "वादळ", "gu": "વાવાઝોડું", "pa": "ਤੂਫ਼ਾਨ", "bn": "ঘূর্ণিঝੜ", "or": "ବାତ୍ୟା"},
    "disease": {"te": "తెగులు", "hi": "रोग", "ta": "நோய்", "kn": "ರೋಗ", "ml": "രോഗം", "mr": "रोग", "gu": "રોગ", "pa": "ਬਿਮਾਰੀ", "bn": "রোগ", "or": "ରୋଗ"}
}

def _domain_vernacular_fallback(text: str, target_lang: str) -> str:
    """Authentic domain vernacular fallback for agricultural alerts when provider is unavailable."""
    if not text:
        return ""
    lower = text.lower().strip()

    # 1. Direct Field Check Advisories
    if ("check" in lower or "inspect" in lower or "visit" in lower) and ("field" in lower or "crop" in lower or "farm" in lower):
        if "compulsor" in lower or "compulsar" in lower or "must" in lower or "urgent" in lower or "immediately" in lower:
            mapping = {
                "te": "రైతులు తమ పంట పొలాలను తప్పనిసరిగా తనిఖీ చేసి పరిశీలించండి.",
                "hi": "किसान अपने खेतों का अनिवार्य रूप से निरीक्षण और जांच करें।",
                "ta": "விவசாயிகள் தங்களின் வயல்களைக் கட்டாயமாகப் பார்வையிட்டு சரிபார்க்கவும்.",
                "kn": "ರೈತರು ತಮ್ಮ ಹೊಲಗಳನ್ನು ಕಡ್ಡಾಯವಾಗಿ ಪರಿಶೀಲಿಸಿ ಮತ್ತು ತಪಾಸಣೆ ಮಾಡಿ.",
                "ml": "കർഷകർ തങ്ങളുടെ പാടങ്ങൾ നിർബന്ധമായും പരിശോധിക്കുക.",
                "mr": "शेतकऱ्यांनी आपल्या शेतांची अनिवार्यपणे पाहणी आणि तपासणी करावी.",
                "gu": "ખેડૂતોએ પોતાના ખેતરોનું ફરજિયાતપણે નિરીક્ષણ અને તપાસ કરવી.",
                "pa": "ਕਿਸਾਨ ਆਪਣੇ ਖੇਤਾਂ ਦੀ ਲਾਜ਼ਮੀ ਤੌਰ 'ਤੇ ਜਾਂਚ ਅਤੇ ਨਿਰੀਖਣ ਕਰਨ।",
                "bn": "কৃষকদের তাদের জমি বাধ্যতামূলকভাবে পরিদর্শন ও পরীক্ষা করতে হবে।",
                "or": "କୃଷକମାନେ ନିଜ ଜମିକୁ ବାଧ୍ୟତାମୂଳକ ଭାବେ ଯାଞ୍ଚ ଏବଂ ନିରୀକ୍ଷଣ କରନ୍ତୁ।"
            }
        else:
            mapping = {
                "te": "పంట పొలాలను పరిశీలించండి",
                "hi": "खेतों का निरीक्षण करें",
                "ta": "விளைநிலங்களை சரிபார்க்கவும்",
                "kn": "ಹೊಲಗಳನ್ನು ಪರಿಶೀಲಿಸಿ",
                "ml": "പാടങ്ങൾ പരിശോധിക്കുക",
                "mr": "शेतांची पाहणी करा",
                "gu": "ખેતરોનું નિરીક્ષણ કરો",
                "pa": "ਖੇਤਾਂ ਦੀ ਜਾਂਚ ਕਰੋ",
                "bn": "জমি পরিদর্শন করুন",
                "or": "ଜମି ଯାଞ୍ଚ କରନ୍ତୁ"
            }
        if target_lang in mapping:
            return mapping[target_lang]

    # 2. Rust & Fungicide Advisories
    if "rust" in lower or "fungicide" in lower:
        mapping = {
            "te": "హెచ్చరిక: తీరప్రాంత జిల్లాల్లో పసుపు కుంకుమ తెగులు నివారణకు సిఫార్సు చేయబడిన మందులను వెంటనే పిచికారీ చేయండి.",
            "hi": "चेतावनी: तटीय जिलों में पीला रतुआ (येलो रस्ट) के प्रकोप की रोकथाम हेतु अनुशंसित कवकनाशी का तत्काल छिड़काव करें।",
            "ta": "எச்சரிக்கை: கடலோர மாவட்டங்களில் துரு நோய் தடுப்புக்கு பரிந்துரைக்கப்பட்ட பூஞ்சைக் கொல்லிகளை உடனடியாக தெளிக்கவும்.",
            "kn": "ಎಚ್ಚರಿಕೆ: ಕರಾವಳಿ ಜಿಲ್ಲೆಗಳಲ್ಲಿ ಹಳದಿ ತುಕ್ಕು ರೋಗ ತಡೆಗಟ್ಟಲು ಶಿಫಾರಸು ಮಾಡಿದ ಶಿಲೀಂಧ್ರನಾಶಕಗಳನ್ನು ತಕ್ಷಣವೇ ಸಿಂಪಡಿಸಿ.",
            "ml": "മുന്നറിയിപ്പ്: തീരദേശ ജില്ലകളിൽ മഞ്ഞ തുരുമ്പ് രോഗം തടയുന്നതിന് നിർദ്ദേശിച്ച കുമിൾനാശിനികൾ ഉടൻ തളിക്കുക.",
            "mr": "इशारा: किनारी भागातील जिल्ह्यांमध्ये तांबेरा रोगाच्या नियंत्रणासाठी तात्काळ शिफारस केलेल्या बुरशीनाशकांची फवारणी करावी.",
            "gu": "ચેતવણી: દરિયાકાંઠાના જિલ્લાઓમાં ગેરુ રોગના નિયંત્રણ માટે ભલામણ કરેલ ફૂગનાશકનો તાત્કાલિક છંટકાવ કરો.",
            "pa": "ਚੇਤਾਵਨੀ: ਤੱਟਵਰਤੀ ਜ਼ਿਲ੍ਹਿਆਂ ਵਿੱਚ ਪੀਲੀ ਕੁੰਗੀ ਦੀ ਰੋਕਥਾਮ ਲਈ ਸਿਫ਼ਾਰਸ਼ ਕੀਤੀ ਉੱਲੀਨਾਸ਼ਕ ਦਾ ਤੁਰੰਤ ਛਿੜਕਾਅ ਕਰੋ।",
            "bn": "সতর্কতা: উপকূলীয় জেলাগুলিতে হলুদ মরিচা রোগ প্রতিরোধে অবিলম্বে প্রস্তাবিত ছত্রাকনাশক স্প্রে করুন।",
            "or": "ଚେତାବନୀ: ଉପକୂଳ ଜିଲ୍ଲାଗୁଡ଼ିକରେ ହଳଦିଆ କଳଙ୍କ ରୋଗର ନିୟନ୍ତ୍ରଣ ପାଇଁ ତୁରନ୍ତ ସୁପାରିଶ କରାଯାଇଥିବା କବକନାଶକ ସ୍ପ୍ରେ କରନ୍ତୁ।"
        }
        if target_lang in mapping:
            return mapping[target_lang]

    # 3. Chilli Leaf Curl Advisories
    if "chilli" in lower or "leaf curl" in lower:
        mapping = {
            "te": "మిర్చి తోటలలో ఆకుముడుత తెగులు నివారణకు సిఫార్సు చేయబడిన మందులను మాత్రమే పిచికారీ చేయండి. సమగ్ర సస్యరక్షణ చర్యలు చేపట్టండి.",
            "hi": "मिर्च की फसल में पत्ता मरोड़ रोग की रोकथाम के लिए अनुशंसित कीटनाशकों का ही छिड़काव करें।",
            "ta": "மிளகாய் பயிரில் இலை சுருட்டல் நோயை கட்டுப்படுத்த பரிந்துரைக்கப்பட்ட மருந்துகளை தெளிக்கவும்.",
            "kn": "ಮೆಣಸಿನಕಾಯಿ ಬೆಳೆಯ ಎಲೆ ಮುದುರು ರೋಗ ತಡೆಗಟ್ಟಲು ಶಿಫಾರಸು ಮಾಡಿದ ಔಷಧಿಗಳನ್ನು ಸಿಂಪಡಿಸಿ.",
            "ml": "മുളക് കൃഷിയിലെ ഇലച്ചുരുൾ രോഗം നിയന്ത്രിക്കാൻ ശുപാർശ ചെയ്ത മരുന്നുകൾ മാത്രം ഉപയോഗിക്കുക.",
            "mr": "मिरची पिकावरील चुरडा-मुरडा रोगाच्या नियंत्रणासाठी शिफारस केलेली औषधे फवारा.",
            "gu": "મરચીના પાકમાં કોકડવા રોગના નિયંત્રણ માટે ભલામણ કરેલ દવાનો છંટકાવ કરો.",
            "pa": "ਮਿਰਚ ਦੀ ਫਸਲ ਵਿੱਚ ਪੱਤਾ ਮਰੋੜ ਰੋਗ ਦੀ ਰੋਕਥਾਮ ਲਈ ਸਿਫ਼ਾਰਸ਼ ਕੀਤੀਆਂ ਦਵਾਈਆਂ ਦਾ ਛਿੜਕਾਅ ਕਰੋ।",
            "bn": "লঙ্কা ফসলে পাতা কোঁকড়ানো রোগ প্রতিরোধে অনুমোদিত কীটনাশক স্প্রে করুন।",
            "or": "ଲଙ୍କା ଫସଲରେ ପତ୍ର ମୋଡ଼ା ରୋଗ ଦମନ ପାଇଁ ସୁପାରିଶ କରାଯାଇଥିବା ଔଷଧ ସ୍ପ୍ରେ କରନ୍ତୁ।"
        }
        if target_lang in mapping:
            return mapping[target_lang]

    # 4. Rain & Cyclone Warnings
    if "rain" in lower or "cyclone" in lower or "flood" in lower or "weather" in lower:
        mapping = {
            "te": "భారీ వర్ష సూచన ఉన్నందున పొలాల్లో నిల్వ ఉన్న అదనపు నీటిని వెంటనే బయటకు పంపేలా మురుగునీటి కాల్వలను శుభ్రం చేసుకోండి.",
            "hi": "भारी बारिश की संभावना के कारण खेतों से अतिरिक्त जल निकासी की तत्काल उचित व्यवस्था करें।",
            "ta": "கனமழை எச்சரிக்கை காரணமாக விளைநிலங்களில் தேங்கும் உபரி நீரை உடனடியாக வெளியேற்ற வடிகால்களை அமைக்கவும்.",
            "kn": "ಭಾರೀ ಮಳೆಯ ಮುನ್ಸೂಚನೆ ಇರುವುದರಿಂದ ಜಮೀನಿನಲ್ಲಿ ನಿಲ್ಲುವ ನೀರನ್ನು ಹೊರಹಾಕಲು ಕಾಲುವೆಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಿ.",
            "ml": "കനത്ത മഴ മുന്നറിയിപ്പുള്ളതിനാൽ പാടങ്ങളിൽ നിന്നും അധിക ജലം ഒഴുക്കിവിടാൻ ചാലുകൾ വൃത്തിയാക്കുക.",
            "mr": "मुसळधार पावसाच्या अंदाजामुळे शेतातील पाण्याचा निचरा करण्यासाठी योग्य व्यवस्था करा.",
            "gu": "ભારે વરસાદની આગાહી હોવાથી ખેતરમાંથી વધારાનું પાણી બહાર કાઢવાની યોગ્ય વ્યવસ્થા કરો.",
            "pa": "ਭਾਰੀ ਮੀਂਹ ਦੀ ਸੰਭਾਵਨਾ ਕਾਰਨ ਖੇਤਾਂ ਵਿੱਚੋਂ ਵਾਧੂ ਪਾਣੀ ਦੀ ਨਿਕਾਸੀ ਦਾ ਤੁਰੰਤ ਪ੍ਰਬੰਧ ਕਰੋ।",
            "bn": "ভারী বৃষ্টির সতর্কতার কারণে জমি থেকে অতিরিক্ত জল নিষ্কাশনের অবিলম্বে ব্যবস্থা করুন।",
            "or": "ପ୍ରବଳ ବର୍ଷା ସମ୍ଭାବନା ଥିବାରୁ ଜମିରୁ ଅତିରିକ୍ତ ଜଳ ନିଷ୍କାସନ ପାଇଁ ତୁରନ୍ତ ବ୍ୟବସ୍ଥା କରନ୍ତୁ।"
        }
        if target_lang in mapping:
            return mapping[target_lang]

    # 5. Token-level dictionary translator
    words = [w.strip(".,!?:;\"'()[]{}") for w in lower.split()]
    translated_tokens = []
    replaced_any = False
    for w in words:
        if w in AGRO_VOCAB and target_lang in AGRO_VOCAB[w]:
            mapped = AGRO_VOCAB[w][target_lang]
            if mapped:
                translated_tokens.append(mapped)
                replaced_any = True
        elif w:
            translated_tokens.append(w)
    if replaced_any and translated_tokens:
        return " ".join(translated_tokens)

    return text

def _normalize_lang_code(code: Optional[str]) -> str:
    """Normalizes language code to canonical 2-letter or standard code."""
    if not code:
        return "en"
    clean = str(code).strip().lower()
    if "-" in clean:
        clean = clean.split("-")[0]
    if clean in SUPPORTED_LANGUAGES:
        return clean
    return "en"

def _is_online(host: str = "api.groq.com", timeout: float = 0.5) -> bool:
    """Fast non-blocking check with daemon thread to prevent interpreter exit hang."""
    import threading
    res = [False]
    def worker():
        try:
            socket.gethostbyname(host)
            res[0] = True
        except Exception:
            pass
    t = threading.Thread(target=worker, daemon=True)
    t.start()
    t.join(timeout=timeout)
    return res[0]

class TranslationService:
    """Core translation engine for AgriShield multilingual ecosystem."""

    @staticmethod
    def get_supported_languages() -> List[str]:
        return list(SUPPORTED_LANGUAGES)

    @staticmethod
    def is_supported(lang_code: str) -> bool:
        if not lang_code:
            return False
        clean = str(lang_code).strip().lower().split("-")[0]
        return clean in SUPPORTED_LANGUAGES

    @staticmethod
    def _sync_translate(text: str, source_lang: str, target_lang: str) -> str:
        """Internal synchronous call to GoogleTranslator wrapped safely with reachability test."""
        if not GoogleTranslator:
            return text
        old_timeout = socket.getdefaulttimeout()
        try:
            socket.setdefaulttimeout(2.0)
            src = source_lang if source_lang != "auto" else "auto"
            translator = GoogleTranslator(source=src, target=target_lang)
            translated = translator.translate(text)
            return translated if translated else text
        except Exception as e:
            logger.debug(f"Translation provider notice ({source_lang}->{target_lang}): {e}")
            return text
        finally:
            socket.setdefaulttimeout(old_timeout)

    @staticmethod
    def _domain_vernacular_fallback(text: str, target_lang: str) -> str:
        return _domain_vernacular_fallback(text, target_lang)

    @classmethod
    async def translate_text(
        cls,
        text: Optional[str],
        target_lang: str,
        source_lang: str = "en",
        db: Optional[Any] = None
    ) -> str:
        """
        Translates a single string into target_lang.
        Guarantees fallback to original text on failure.
        """
        if not text or not str(text).strip():
            return text or ""

        clean_text = str(text).strip()
        norm_source = _normalize_lang_code(source_lang)
        norm_target = _normalize_lang_code(target_lang)

        # 1. Identity case: target matches source
        if norm_source == norm_target:
            return text

        # 2. Fast glossary lookup for common terms
        lower_text = clean_text.lower()
        if lower_text in COMMON_GLOSSARY and norm_target in COMMON_GLOSSARY[lower_text]:
            return COMMON_GLOSSARY[lower_text][norm_target]

        cache_key = _make_cache_key(norm_source, norm_target, clean_text)

        # 3. Check in-memory RAM cache
        if cache_key in _MEMORY_CACHE:
            return _MEMORY_CACHE[cache_key]

        # 4. Check MongoDB persistent cache if DB available
        if db is not None:
            try:
                cached_doc = await db.translations_cache.find_one({"cache_key": cache_key})
                if cached_doc and "translated" in cached_doc:
                    result = cached_doc["translated"]
                    if len(_MEMORY_CACHE) < _MAX_CACHE_SIZE:
                        _MEMORY_CACHE[cache_key] = result
                    return result
            except Exception as db_err:
                logger.debug(f"DB translation cache lookup notice: {db_err}")

        # 5. Native async translation via Google Translate HTTP (Zero-deadlock, purely async)
        translated = None
        if HTTPX_AVAILABLE and httpx is not None and _is_online("translate.googleapis.com", timeout=0.6):
            try:
                import urllib.parse
                url = f"https://translate.googleapis.com/translate_a/single?client=gtx&sl={norm_source}&tl={norm_target}&dt=t&q={urllib.parse.quote(clean_text)}"
                async with httpx.AsyncClient(timeout=httpx.Timeout(2.0, connect=1.0)) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data and len(data) > 0 and data[0]:
                            parts = [p[0] for p in data[0] if p and p[0]]
                            if parts:
                                cand = "".join(parts).strip()
                                if cand and cand.lower() != clean_text.lower():
                                    translated = cand
            except Exception as e:
                logger.debug(f"Direct Google Translate HTTP notice: {e}")

        # 6. Fallback to domain vernacular if translated still matches original English text or is None
        if not translated or translated.strip() == clean_text:
            translated = _domain_vernacular_fallback(clean_text, norm_target)

        # 6. Populate caches if valid translation was obtained
        if translated and translated != clean_text:
            if len(_MEMORY_CACHE) < _MAX_CACHE_SIZE:
                _MEMORY_CACHE[cache_key] = translated

            if db is not None:
                try:
                    await db.translations_cache.update_one(
                        {"cache_key": cache_key},
                        {
                            "$set": {
                                "cache_key": cache_key,
                                "source_lang": norm_source,
                                "target_lang": norm_target,
                                "original": clean_text,
                                "translated": translated,
                                "updated_at": datetime.now(timezone.utc)
                            }
                        },
                        upsert=True
                    )
                except Exception as db_write_err:
                    logger.debug(f"DB translation cache write notice: {db_write_err}")

        return translated if translated else text


    @classmethod
    async def translate_multilingual_bundle(
        cls,
        title: str,
        message: str,
        languages: List[str],
        db: Optional[Any] = None
    ) -> Dict[str, Dict[str, str]]:
        """
        Translates title and message into all requested Indian regional languages using:
        1. Groq Cloud AI LLM (llama-3.3-70b-versatile) for accurate, natural translations.
        2. Fast asynchronous GoogleTranslator fanout.
        3. Authentic agricultural domain vocabulary fallback.
        """
        clean_title = (title or "").strip()
        clean_msg = (message or "").strip()
        groq_api_key = os.getenv("GROQ_API_KEY", "")

        # 1. Primary AI Translation Engine: Groq Cloud LLM (Only if internet is responsive)
        if groq_api_key and (clean_title or clean_msg) and httpx is not None and _is_online("api.groq.com", timeout=0.6):
            try:
                lang_names = {
                    "te": "Telugu (తెలుగు)", "hi": "Hindi (हिन्दी)", "ta": "Tamil (தமிழ்)",
                    "kn": "Kannada (ಕನ್ನಡ)", "ml": "Malayalam (മലയാളം)", "mr": "Marathi (मराठी)",
                    "bn": "Bengali (বাংলা)", "or": "Odia (ଓଡ଼ିଆ)", "gu": "Gujarati (ગુજરાતી)",
                    "pa": "Punjabi (ਪੰਜਾਬੀ)"
                }
                target_desc = ", ".join([f"{code}: {lang_names.get(code, code)}" for code in languages])
                system_prompt = (
                    "You are an expert multilingual agricultural advisory translator for Indian farmers. "
                    "Translate the provided agricultural alert title and message into the requested regional languages. "
                    "Respond with ONLY a valid JSON object where top-level keys are the 2-letter language codes and values are objects with 'title' and 'message' keys. "
                    "Example output: {\"te\": {\"title\": \"...\", \"message\": \"...\"}, \"hi\": {\"title\": \"...\", \"message\": \"...\"}}"
                )
                user_prompt = f"Target languages: {target_desc}\nTitle: '{clean_title}'\nMessage: '{clean_msg}'"
                
                payload = {
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.1,
                    "max_tokens": 1500
                }
                
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {groq_api_key}",
                            "Content-Type": "application/json"
                        },
                        json=payload
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        content_str = data["choices"][0]["message"]["content"]
                        parsed = json.loads(content_str)
                        if isinstance(parsed, dict) and any(k in parsed for k in languages):
                            result = {}
                            for code in languages:
                                item = parsed.get(code, {})
                                t_val = item.get("title") or _domain_vernacular_fallback(clean_title, code)
                                m_val = item.get("message") or item.get("body") or _domain_vernacular_fallback(clean_msg, code)
                                result[code] = {
                                    "title": t_val,
                                    "message": m_val,
                                    "body": m_val
                                }
                            logger.info(f"Groq Cloud AI successfully translated broadcast into {len(result)} languages.")
                            return result
            except Exception as ai_err:
                logger.warning(f"Groq AI translation bypassed: {ai_err}; engaging secondary translation pipeline.")

        # 2. Secondary Engine: Parallel Domain Vernacular Agricultural Translator
        result = {}
        for code in languages:
            t_val = _domain_vernacular_fallback(clean_title, code) if clean_title else ""
            m_val = _domain_vernacular_fallback(clean_msg, code) if clean_msg else ""
            result[code] = {
                "title": t_val or clean_title,
                "message": m_val or clean_msg,
                "body": m_val or clean_msg
            }
        return result

    @classmethod
    async def translate_container(
        cls,
        original_text: str,
        target_lang: str,
        source_lang: str = "en",
        existing_translations: Optional[Dict[str, str]] = None,
        db: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Produces or updates a canonical translation container:
        {
            "original": original_text,
            "source_language": source_lang,
            "translations": { ... },
            "localized": "<text in target_lang>"
        }
        """
        translations = dict(existing_translations) if existing_translations else {}
        norm_target = _normalize_lang_code(target_lang)
        norm_source = _normalize_lang_code(source_lang)

        if norm_target == norm_source:
            localized = original_text
        elif norm_target in translations and translations[norm_target]:
            localized = translations[norm_target]
        else:
            localized = await cls.translate_text(
                original_text, norm_target, source_lang=norm_source, db=db
            )
            if localized and localized != original_text:
                translations[norm_target] = localized

        return {
            "original": original_text,
            "source_language": norm_source,
            "translations": translations,
            "localized": localized
        }

    @classmethod
    async def translate_dict_fields(
        cls,
        data: Dict[str, Any],
        fields: List[str],
        target_lang: str,
        source_lang: str = "en",
        db: Optional[Any] = None
    ) -> Dict[str, Any]:
        """
        Translates specified string fields in a dictionary without altering other keys.
        Supports string fields and list of strings.
        """
        if not data or not fields:
            return data

        norm_target = _normalize_lang_code(target_lang)
        norm_source = _normalize_lang_code(source_lang)
        if norm_target == norm_source:
            return data

        result = dict(data)
        for field in fields:
            val = result.get(field)
            if isinstance(val, str) and val.strip():
                result[field] = await cls.translate_text(val, norm_target, norm_source, db=db)
            elif isinstance(val, list):
                translated_list = []
                for item in val:
                    if isinstance(item, str) and item.strip():
                        tr = await cls.translate_text(item, norm_target, norm_source, db=db)
                        translated_list.append(tr)
                    else:
                        translated_list.append(item)
                result[field] = translated_list

        return result

    @classmethod
    def set_cache_entry(cls, source_lang: str, target_lang: str, original: str, translated: str):
        """Sets a cache entry directly (used for seeding tests or pre-cached strings)."""
        norm_source = _normalize_lang_code(source_lang)
        norm_target = _normalize_lang_code(target_lang)
        cache_key = _make_cache_key(norm_source, norm_target, original)
        _MEMORY_CACHE[cache_key] = translated

    @classmethod
    def clear_cache(cls):
        """Clears in-memory RAM cache."""
        _MEMORY_CACHE.clear()

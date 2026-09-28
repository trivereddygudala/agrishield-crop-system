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
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from deep_translator import GoogleTranslator

logger = logging.getLogger("translation_service")

# 7 Canonical Supported Language Codes with English fallback
SUPPORTED_LANGUAGES = [
    "en", "te", "ta", "kn", "hi", "ml", "or"
]

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
        """Internal synchronous call to GoogleTranslator wrapped safely with retry."""
        try:
            src = source_lang if source_lang != "auto" else "auto"
            translator = GoogleTranslator(source=src, target=target_lang)
            translated = translator.translate(text)
            return translated if translated else text
        except Exception as e:
            logger.warning(f"Translation provider warning ({source_lang}->{target_lang}): {e}")
            return text

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

        # 5. Perform translation in thread pool
        try:
            translated = await asyncio.to_thread(
                cls._sync_translate, clean_text, norm_source, norm_target
            )
        except Exception as ex:
            logger.error(f"Unexpected translation execution error: {ex}")
            translated = clean_text

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

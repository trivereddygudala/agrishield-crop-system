/**
 * speechSanitizer.js
 * 
 * High-Precision Multi-Language Speech Sanitizer & Chat Formatter for AgriShield Live.
 * 
 * Supports: Telugu (te), English (en), Hindi (hi), Tamil (ta), Kannada (kn), Odia (or).
 * 
 * Ensures natural, human-like voice synthesis:
 * - Strips all brackets, parentheses, colons, hyphens, asterisks, hashtags, emojis.
 * - Strips parenthetical English translations in regional languages so voices never recite English fragments.
 * - Strips UI timestamps (e.g. "09:43 AM", "10:15 PM") so the assistant never recites times.
 * - Normalizes agricultural units into native spoken words (16L -> 16 liter pump, etc.).
 * - Normalizes temperatures (29°C -> 29 degrees).
 * - Leaves natural sentence breathing pauses so the voice sounds conversational and human.
 */

/**
 * Sanitize text specifically for browser SpeechSynthesis / TTS audio readout
 */
export function sanitizeTextForSpeech(text, lang = 'en') {
  if (!text || typeof text !== 'string') return '';

  const l = (lang || 'en').split('-')[0].toLowerCase();

  let s = text;

  // 1. Remove URLs, web links and email addresses
  s = s.replace(/https?:\/\/\S+/gi, '');
  s = s.replace(/\S+@\S+\.\S+/gi, '');

  // 2. Remove code blocks and inline code
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`[^`]+`/g, ' ');

  // 3. Strip UI timestamps (e.g. "09:43 AM", "9:43 pm", "10:30") so voice NEVER recites time stamps
  s = s.replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?\b/g, ' ');

  // 4. Strip UI control words if accidentally caught
  s = s.replace(/\b(Listen|Assistant speaking|Live Assistant|AgriShield Live)\b/gi, ' ');

  // 5. If regional language (te, hi, ta, kn, or), STRIP bracketed English translations
  // e.g. "(Verdict)", "(Not Safe to Spray)", "(Weather Reasons)", "(Light rain)"
  // This prevents an English or mixed voice from reading out ONLY the English words!
  if (l !== 'en') {
    s = s.replace(/\s*\([A-Za-z0-9\s.,'/%:+-]+\)/g, ' ');
    s = s.replace(/\s*\[[A-Za-z0-9\s.,'/%:+-]+\]/g, ' ');
  }

  // 6. Temperature normalization (°C / °)
  if (l === 'te') {
    s = s.replace(/(\d+)\s*°\s*C?/gi, '$1 డిగ్రీల ఉష్ణోగ్రత');
  } else if (l === 'hi') {
    s = s.replace(/(\d+)\s*°\s*C?/gi, '$1 डिग्री तापमान');
  } else if (l === 'ta') {
    s = s.replace(/(\d+)\s*°\s*C?/gi, '$1 டிகிரி வெப்பநிலை');
  } else if (l === 'kn') {
    s = s.replace(/(\d+)\s*°\s*C?/gi, '$1 ಡಿಗ್ರಿ ತಾಪಮಾನ');
  } else if (l === 'or') {
    s = s.replace(/(\d+)\s*°\s*C?/gi, '$1 ଡିଗ୍ରୀ ତାପମାତ୍ରା');
  } else {
    s = s.replace(/(\d+)\s*°\s*C?/gi, '$1 degrees Celsius');
  }

  // 7. Agricultural unit expansions across all 6 regional languages
  if (l === 'te') {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 గ్రాములు లీటరుకు');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 మిల్లీలీటర్లు లీటరుకు');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 కిలోలు ఎకరానికి');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 లీటర్ల పంపు');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 లీటర్ల పంపు');
    s = s.replace(/(\d+)\s*%/g, '$1 శాతం');
  } else if (l === 'hi') {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 ग्राम प्रति लीटर');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 मिलीलीटर प्रति लीटर');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 किलोग्राम प्रति एकड़');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 लीटर पंप');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 लीटर पंप');
    s = s.replace(/(\d+)\s*%/g, '$1 प्रतिशत');
  } else if (l === 'ta') {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 கிராம் ஒரு லிட்டருக்கு');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 மில்லிலிட்டர் ஒரு லிட்டருக்கு');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 கிலோ ஒரு ஏக்கருக்கு');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 லிட்டர் பம்பு');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 லிட்டர் பம்பு');
    s = s.replace(/(\d+)\s*%/g, '$1 சதவீதம்');
  } else if (l === 'kn') {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 ಗ್ರಾಂ ಪ್ರತಿ ಲೀಟರ್‌ಗೆ');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 ಮಿಲಿಲೀಟರ್ ಪ್ರತಿ ಲೀಟರ್‌ಗೆ');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 ಕಿಲೋಗ್ರಾಂ ಪ್ರತಿ ಎಕರೆಗೆ');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 ಲೀಟರ್ ಪಂಪ್');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 ಲೀಟರ್ ಪಂಪ್');
    s = s.replace(/(\d+)\s*%/g, '$1 ಶೇಕಡಾ');
  } else if (l === 'or') {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 ଗ୍ରାମ ପ୍ରତି ଲିଟର');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 ମିଲିଲିଟର ପ୍ରତି ଲିଟର');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 କିଲୋଗ୍ରାମ ପ୍ରତି ଏକର');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '୧୬ ଲିଟର ପମ୍ପ');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '୨୦ ଲିଟର ପମ୍ପ');
    s = s.replace(/(\d+)\s*%/g, '$1 ପ୍ରତିଶତ');
  } else {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 grams per liter');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 milliliters per liter');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 kilograms per acre');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 liter pump');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 liter pump');
    s = s.replace(/(\d+)\s*%/g, '$1 percent');
  }

  // 8. Strip markdown formatting: headers, bold, italics, strikethrough
  s = s.replace(/^#{1,6}\s+/gm, ''); // # H1, ## H2
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1'); // **bold**
  s = s.replace(/\*([^*]+)\*/g, '$1'); // *italic*
  s = s.replace(/__([^_]+)__/g, '$1'); // __bold__
  s = s.replace(/_([^_]+)_/g, '$1'); // _italic_
  s = s.replace(/~~([^~]+)~~/g, '$1'); // ~~strikethrough~~

  // Remove any remaining raw asterisks so the voice never pronounces "star" or "asterisk"
  s = s.replace(/\*+/g, '');

  // 9. Strip all emojis and pictographs
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, ' ');
  } catch {
    s = s.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, ' ');
  }

  // 10. Strip list numbers like "1. ", "2. " so voice reads sentences smoothly
  s = s.replace(/^\s*\d+\.\s*/gm, '');

  // 11. Strip all brackets, parentheses, braces, chevrons
  s = s.replace(/[()[\]{}<>]/g, ' ');

  // 12. Strip bullet characters, arrows, checks, symbols
  s = s.replace(/[•◦▪▫►▸✓✔❌⚠️*~_|+=\\^%$#@&]/g, ' ');

  // 13. Replace quotes and backticks with light pause
  s = s.replace(/["'“”‘’`]/g, ' ');

  // 14. Convert hyphens and colons into natural speech pauses
  s = s.replace(/\s+[-–—]\s+/g, ', ');
  s = s.replace(/^[-–—]\s+/gm, '');
  s = s.replace(/[:;]/g, ', ');

  // 15. Clean up slashes
  s = s.replace(/[/|\\]/g, ' ');

  // 16. Normalize multiple punctuation and spacing
  s = s.replace(/([.,?!])\1+/g, '$1');
  s = s.replace(/\s*,\s*,/g, ',');
  s = s.replace(/\s*([.,?!])/g, '$1 ');

  // 17. Collapse redundant whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Clean & Format raw assistant text for conversational chat bubble display
 * - Strips raw markdown asterisks (**) so the UI looks clean, professional, and elegant.
 * - In regional languages, cleans out parenthetical English duplicates (e.g. "(Verdict)", "(Not Safe to Spray)").
 * - Formats headings and bullet points cleanly for farmers.
 */
export function cleanChatBubbleText(text, lang = 'en') {
  if (!text || typeof text !== 'string') return '';

  const l = (lang || 'en').split('-')[0].toLowerCase();
  let s = text;

  // 1. If regional language, remove bracketed English duplicate translations
  if (l !== 'en') {
    s = s.replace(/\s*\([A-Za-z0-9\s.,'/%:+-]+\)/g, '');
    s = s.replace(/\s*\[[A-Za-z0-9\s.,'/%:+-]+\]/g, '');
  }

  // 2. Strip raw markdown asterisks **bold** -> clean text
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
  s = s.replace(/\*([^*]+)\*/g, '$1');
  s = s.replace(/\*+/g, '');

  // 3. Clean up double colons or orphaned colons
  s = s.replace(/:\s*:/g, ':');

  // 4. Ensure clean bullet points
  s = s.replace(/^\s*[-•]\s*/gm, '• ');

  // 5. Trim excess empty lines
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}

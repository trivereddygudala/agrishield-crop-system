/**
 * speechSanitizer.js
 * 
 * Sanitizes markdown, punctuation symbols, brackets, and emojis before passing
 * text to browser SpeechSynthesis (TTS). Ensures human-like, fluid speech
 * without the TTS engine reading out words like "bracket", "parenthesis",
 * "colon", "comma", "hyphen", "star", or emojis.
 */

export function sanitizeTextForSpeech(text, lang = 'en') {
  if (!text || typeof text !== 'string') return '';

  const isTe = lang.startsWith('te');
  const isHi = lang.startsWith('hi');

  let s = text;

  // 1. Remove URLs and links
  s = s.replace(/https?:\/\/\S+/gi, '');

  // 2. Remove code blocks and inline code
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/`[^`]+`/g, ' ');

  // 3. Normalize common agronomic unit slashes before general slash removal
  if (isTe) {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 గ్రాములు లీటరుకు');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 మిల్లీలీటర్లు లీటరుకు');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 కిలోలు ఎకరానికి');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 లీటర్ల పంపు');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 లీటర్ల పంపు');
  } else if (isHi) {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 ग्राम प्रति लीटर');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 मिलीलीटर प्रति लीटर');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 किलोग्राम प्रति एकड़');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 लीटर पंप');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 लीटर पंप');
  } else {
    s = s.replace(/(\d+)\s*g(?:rams?)?\s*\/\s*L(?:iter)?/gi, '$1 grams per liter');
    s = s.replace(/(\d+)\s*ml\s*\/\s*L(?:iter)?/gi, '$1 milliliters per liter');
    s = s.replace(/(\d+)\s*kg\s*\/\s*acre/gi, '$1 kilograms per acre');
    s = s.replace(/16\s*L(?:\s*pump)?/gi, '16 liter pump');
    s = s.replace(/20\s*L(?:\s*pump)?/gi, '20 liter pump');
  }

  // 4. Strip markdown formatting: headers, bold, italics, strikethrough
  s = s.replace(/^#{1,6}\s+/gm, ''); // # H1, ## H2
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1'); // **bold**
  s = s.replace(/\*([^*]+)\*/g, '$1'); // *italic*
  s = s.replace(/__([^_]+)__/g, '$1'); // __bold__
  s = s.replace(/_([^_]+)_/g, '$1'); // _italic_
  s = s.replace(/~~([^~]+)~~/g, '$1'); // ~~strikethrough~~

  // 5. Strip all emojis and pictographs
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, ' ');
  } catch {
    s = s.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, ' ');
  }

  // 6. Strip all brackets, parentheses, braces, chevrons
  // (Prevents voice from saying "open bracket", "close parenthesis", etc.)
  s = s.replace(/[()[\]{}<>]/g, ' ');

  // 7. Strip bullet characters, arrows, checks, crosses
  s = s.replace(/[•◦▪▫►▸✓✔❌⚠️*~_|+=\\^%$#@&]/g, ' ');

  // 8. Replace quotes, backticks, dashes between words with pauses
  s = s.replace(/["'“”‘’`]/g, ' ');
  s = s.replace(/\s+[-–—]\s+/g, ', '); // convert standalone dash into natural comma pause
  s = s.replace(/^[-–—]\s+/gm, '');

  // 9. Replace colons and semicolons with natural comma pauses
  s = s.replace(/[:;]/g, ', ');

  // 10. Clean up slashes
  s = s.replace(/[/|\\]/g, ' ');

  // 11. Normalize multiple punctuation (e.g. "...", ",,", "??")
  s = s.replace(/([.,?!])\1+/g, '$1');
  s = s.replace(/\s*,\s*,/g, ',');
  s = s.replace(/\s*([.,?!])/g, '$1 ');

  // 12. Collapse redundant spaces and line breaks
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

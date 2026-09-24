import React, { useState } from 'react';
import { Share2, MessageCircle, Copy, Check, Send, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function WhatsAppAlertButton({
  cropName = "Tomato",
  sectorName = "Sector A",
  riskLevel = "High Fungal Spore Risk",
  temperature = 28,
  humidity = 76,
  prescription = "Indofil M-45 (Mancozeb 75% WP) @ 40g per 20L tank",
  isUrgent = false,
  className = ""
}) {
  const { i18n } = useTranslation();
  const isTe = i18n.language === 'te';
  const isHi = i18n.language === 'hi';
  const [copied, setCopied] = useState(false);

  const getAlertText = () => {
    if (isTe) {
      return `🚨 *అగ్రిషీల్డ్ అత్యవసర పంట హెచ్చరిక* 🚨%0A%0A` +
        `🌾 *పంట:* ${cropName} (${sectorName})%0A` +
        `⚠️ *పరిస్థితి:* ${riskLevel}%0A` +
        `🌡️ *వాతావరణం:* ఉష్ణోగ్రత ${temperature}°C, తేమ ${humidity}%%0A` +
        `💊 *సిఫార్సు చేసిన మందు:*%0A${prescription}%0A%0A` +
        `📌 *సూచన:* తెగులు వ్యాపించకముందే ఉదయం 10 గంటల లోపు పిచికారీ పూర్తి చేయండి.%0A` +
        `_అగ్రిషీల్డ్ AI ఫార్మ్ సెంటినెల్ ద్వారా స్వయంచాలకంగా పంపబడింది._`;
    } else if (isHi) {
      return `🚨 *एग्रीशील्ड आपातकालीन फसल चेतावनी* 🚨%0A%0A` +
        `🌾 *फसल:* ${cropName} (${sectorName})%0A` +
        `⚠️ *जोखिम:* ${riskLevel}%0A` +
        `🌡️ *मौसम:* तापमान ${temperature}°C, आर्द्रता ${humidity}%%0A` +
        `💊 *अनुशंसित दवा और खुराक:*%0A${prescription}%0A%0A` +
        `📌 *सलाह:* बीमारी फैलने से पहले सुबह 10 बजे से पहले छिड़काव पूरा करें।%0A` +
        `_एग्रीशील्ड AI फार्म सेंटिनल द्वारा स्वचालित रूप से प्रेषित।_`;
    } else {
      return `🚨 *AGRISHIELD CROP HEALTH ALERT* 🚨%0A%0A` +
        `🌾 *Crop:* ${cropName} (${sectorName})%0A` +
        `⚠️ *Risk:* ${riskLevel}%0A` +
        `🌡️ *Telemetry:* Temp ${temperature}°C, Humidity ${humidity}%%0A` +
        `💊 *Recommended CIBRC Spray:*%0A${prescription}%0A%0A` +
        `📌 *Action:* Complete spraying before 10 AM before spore germination.%0A` +
        `_Automated Alert via AgriShield AI Farm Sentinel._`;
    }
  };

  const handleWhatsAppSend = (e) => {
    e.stopPropagation();
    const encoded = getAlertText();
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  const handleCopySMS = (e) => {
    e.stopPropagation();
    const cleanText = decodeURIComponent(getAlertText().replace(/%0A/g, '\n').replace(/\*/g, ''));
    navigator.clipboard.writeText(cleanText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      {/* 1-Click WhatsApp Button */}
      <button
        type="button"
        onClick={handleWhatsAppSend}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs shadow-md shadow-[#25D366]/25 transition-all cursor-pointer active:scale-95 shrink-0"
        title="Send alert to farm laborers or farmers on WhatsApp"
      >
        <MessageCircle className="w-3.5 h-3.5 fill-current" />
        <span>{isTe ? 'WhatsApp హెచ్చరిక' : isHi ? 'WhatsApp अलर्ट' : 'WhatsApp Alert'}</span>
      </button>

      {/* Copy SMS Button */}
      <button
        type="button"
        onClick={handleCopySMS}
        className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10 text-xs transition-all cursor-pointer active:scale-95"
        title="Copy SMS / Text Alert"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

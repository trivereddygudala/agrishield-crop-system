import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Trash2, Share2, ShieldCheck, CheckCheck,
  FileText, Sparkles, Volume2, VolumeX, ChevronRight,
  X, CheckCircle2, Pill, Sprout, AlertTriangle,
  Truck, Calendar, MapPin, Check, MessageSquare,
  Play, Pause, Paperclip, Send, Mic, ExternalLink,
  Clock, MoreVertical, Lock, ShieldAlert, Cpu, Activity,
  BatteryWarning, CloudRain, WifiOff, AlertOctagon, HelpCircle
} from 'lucide-react';
import { formatDateTime, timeAgo } from '../../utils/dateUtils';
import { useSpeechReader } from '../../hooks/useSpeechReader';
import { getDiseaseDetails, translateCrop, translateDisease } from '../../utils/diseaseAdvisoryData';
import { useAuth } from '../../context/AuthContext';
import API from '../../services/api';

/**
 * Intelligent crop & disease extractor
 */
function extractCropDetails(item, isTelugu = false) {
  if (!item) {
    return {
      cropKey: 'crop',
      cropName: isTelugu ? 'పంట' : 'Crop',
      cropEmoji: '🌿',
      diseaseName: null,
      threadTitle: isTelugu ? '🌿 పంట రక్షణ సలహా' : '🌿 Crop Health Advisory'
    };
  }

  const rawText = `${item.crop_name || ''} ${item.crop || ''} ${item.crop_type || ''} ${item.title || ''} ${item.title_te || ''} ${item.message || ''} ${item.message_te || ''}`.toLowerCase();

  const CROPS = [
    { key: 'chilli', en: 'Chilli', te: 'మిరప', emoji: '🌶️', regex: /(chilli|chili|pepper|మిరప|mirapa)/i },
    { key: 'maize', en: 'Maize', te: 'మొక్కజొన్న', emoji: '🌽', regex: /(maize|corn|మొక్కజొన్న|mokkajonna)/i },
    { key: 'tomato', en: 'Tomato', te: 'టమాటా', emoji: '🍅', regex: /(tomato|టమాటా|టమాట|tamata)/i },
    { key: 'paddy', en: 'Paddy', te: 'వరి', emoji: '🌾', regex: /(paddy|rice|వరి|vari)/i },
    { key: 'cotton', en: 'Cotton', te: 'పత్తి', emoji: '🧶', regex: /(cotton|పత్తి|patti)/i },
    { key: 'groundnut', en: 'Groundnut', te: 'వేరుశనగ', emoji: '🥜', regex: /(groundnut|peanut|వేరుశనగ|verusanaga)/i },
    { key: 'sugarcane', en: 'Sugarcane', te: 'చెరకు', emoji: '🎋', regex: /(sugarcane|చెరకు|cheraku)/i },
    { key: 'banana', en: 'Banana', te: 'అరటి', emoji: '🍌', regex: /(banana|అరటి|arati)/i },
    { key: 'mango', en: 'Mango', te: 'మామిడి', emoji: '🥭', regex: /(mango|మామిడి|mamidi)/i },
    { key: 'onion', en: 'Onion', te: 'ఉల్లి', emoji: '🧅', regex: /(onion|ఉల్లి|ulli)/i },
    { key: 'potato', en: 'Potato', te: 'బంగాళాదుంప', emoji: '🥔', regex: /(potato|బంగాళాదుంప|bangaladumpa)/i },
    { key: 'soybean', en: 'Soybean', te: 'సోయాబీన్', emoji: '🫘', regex: /(soybean|soya|సోయా)/i },
    { key: 'wheat', en: 'Wheat', te: 'గోధుమ', emoji: '🌾', regex: /(wheat|గోధుమ|godhuma)/i },
    { key: 'grape', en: 'Grape', te: 'ద్రాక్ష', emoji: '🍇', regex: /(grape|ద్రాక్ష|draksha)/i },
    { key: 'citrus', en: 'Citrus', te: 'నిమ్మ', emoji: '🍋', regex: /(citrus|lemon|lime|నిమ్మ|nimma)/i },
  ];

  const matchedCrop = CROPS.find(c => c.regex.test(rawText));

  const DISEASES = [
    { key: 'early_blight', en: 'Early Blight', te: 'ఎర్లీ బ్లైట్', regex: /(early blight|ఎర్లీ బ్లైట్)/i },
    { key: 'late_blight', en: 'Late Blight', te: 'లేట్ బ్లైట్', regex: /(late blight|లేట్ బ్లైట్)/i },
    { key: 'leaf_spot', en: 'Leaf Spot', te: 'ఆకు మచ్చతెగులు', regex: /(leaf spot|cercospora|ఆకు మచ్చ|మచ్చతెగులు)/i },
    { key: 'powdery_mildew', en: 'Powdery Mildew', te: 'బూడిద తెగులు', regex: /(powdery mildew|బూడిద తెగులు)/i },
    { key: 'rust', en: 'Rust', te: 'తుప్పు తెగులు', regex: /(rust|తుప్పు)/i },
    { key: 'wilt', en: 'Wilt', te: 'ఎండు తెగులు', regex: /(wilt|fusarium|ఎండు తెగులు)/i },
    { key: 'bacterial_blight', en: 'Bacterial Blight', te: 'బాక్టీరియల్ బ్లైట్', regex: /(bacterial blight|బాక్టీరియల్ బ్లైట్)/i },
    { key: 'blast', en: 'Blast', te: 'అగ్గి తెగులు', regex: /(blast|magnaporthe|అగ్గి తెగులు)/i },
    { key: 'spodoptera', en: 'Caterpillar / Cutworm', te: 'లద్దెపురుగు', regex: /(spodoptera|caterpillar|cutworm|లద్దెపురుగు)/i }
  ];

  const matchedDisease = DISEASES.find(d => d.regex.test(rawText));

  if (matchedCrop) {
    const cropName = isTelugu ? matchedCrop.te : matchedCrop.en;
    let title = '';
    if (matchedDisease) {
      const diseaseName = isTelugu ? matchedDisease.te : matchedDisease.en;
      title = `${matchedCrop.emoji} ${cropName} • ${diseaseName}`;
    } else {
      title = isTelugu ? `${matchedCrop.emoji} ${cropName} పంట సలహా` : `${matchedCrop.emoji} ${cropName} Crop Advisory`;
    }
    return {
      cropKey: matchedCrop.key,
      cropName,
      cropEmoji: matchedCrop.emoji,
      diseaseName: matchedDisease ? (isTelugu ? matchedDisease.te : matchedDisease.en) : null,
      threadTitle: title
    };
  }

  return {
    cropKey: 'crop',
    cropName: isTelugu ? 'పంట' : 'Crop',
    cropEmoji: '🌿',
    diseaseName: matchedDisease ? (isTelugu ? matchedDisease.te : matchedDisease.en) : null,
    threadTitle: isTelugu ? '🌿 పంట రక్షణ సలహా' : '🌿 Crop Health Advisory'
  };
}

export default function GoogleMessageReader({
  message,
  translatedTitle,
  translatedBody,
  onBack,
  onDelete,
  lang = 'te'
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isProvider = user?.role === 'equipment_provider';
  const isTelugu = (lang || '').toLowerCase().startsWith('te');

  const [showFullReview, setShowFullReview] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  const messagesEndRef = useRef(null);
  const { speak, stop, speakingId } = useSpeechReader();

  const messageId = message?.notification_id || message?.id || 'sms_active';

  // Stop speech synthesis on unmount
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  if (!message) return null;

  // ── Determine Differentiated Notification Pattern ──
  const isBooking = message.category === 'booking' || message.type === 'booking' || Boolean(message.booking_id || message.bookingId);
  const isDisease = message.category === 'disease' || (!isBooking && Boolean(message.crop || message.disease || /(blight|spot|mildew|rust|wilt|blast|rot|caterpillar|లద్దెపురుగు|తెగులు|మచ్చ)/i.test(`${message.title || ''} ${message.message || ''}`)));
  const isSystemOrHardware = !isBooking && !isDisease;

  // ── Crop & Disease Extraction ──
  const cropInfo = useMemo(() => {
    return extractCropDetails(message, isTelugu);
  }, [message, isTelugu]);

  const parsedInfo = useMemo(() => {
    let crop = message.crop || cropInfo.cropKey || '';
    let disease = message.disease || cropInfo.diseaseName || '';
    let confidence = message.confidence_score != null ? (message.confidence_score > 1 ? message.confidence_score : message.confidence_score * 100).toFixed(1) : null;
    const fullText = `${message.title || ''} ${message.message || ''}`;
    if (!confidence) {
      const confMatch = fullText.match(/(\d+(?:\.\d+)?)\s*%\s*confidence/i);
      if (confMatch) confidence = parseFloat(confMatch[1]).toFixed(1);
    }
    const matched = getDiseaseDetails(crop, disease, isTelugu ? 'te' : 'en');
    return {
      crop,
      teluguCrop: translateCrop(crop, 'te'),
      disease,
      teluguDisease: translateDisease(disease, 'te', crop),
      confidence: confidence || '94.6',
      advisory: matched
    };
  }, [message, cropInfo, isTelugu]);

  // ── Equipment Booking State & Precise Village Details ──
  const rawBookingId = message.booking_id || message.bookingId || (message.id?.startsWith('notif-') ? message.id.replace('notif-', '') : message.id) || 'BK-21407';

  const savedBooking = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
      if (Array.isArray(saved)) {
        return saved.find(b => b && (b.id === rawBookingId || `BK-${b.id}` === rawBookingId || (b.id && rawBookingId.includes(b.id))));
      }
    } catch (_) {}
    return null;
  }, [rawBookingId]);

  const [bookingStatus, setBookingStatus] = useState(() => {
    return savedBooking?.status || message.status || 'confirmed';
  });

  useEffect(() => {
    if (savedBooking?.status) {
      setBookingStatus(savedBooking.status);
    }
  }, [savedBooking]);

  const bookingFarmerName = savedBooking?.farmerName || message.farmerName || message.farmer_name || 'Farmer';
  const bookingFarmerPhone = savedBooking?.farmerPhone || savedBooking?.phone || message.farmerPhone || message.farmer_phone || message.phone || '9440182736';
  const cleanFarmerPhone = String(bookingFarmerPhone).replace(/[^0-9]/g, '');

  const bookingProviderName = savedBooking?.provider_name || savedBooking?.providerName || message.provider_name || message.providerName || (isTelugu ? 'రమేష్ ఫార్మ్ సర్వీసెస్' : 'Ramesh Farm Services');
  const bookingProviderPhone = savedBooking?.provider_phone || savedBooking?.providerPhone || message.provider_phone || message.providerPhone || '9848012345';
  const cleanProviderPhone = String(bookingProviderPhone).replace(/[^0-9]/g, '');

  const bookingEquipmentTitle = savedBooking?.equipmentTitle || savedBooking?.title || message.equipmentTitle || message.equipment_title || 'Mahindra 575 DI 45HP Tractor';
  const bookingAcres = savedBooking?.acres || savedBooking?.acreage || message.acres || '1.5';
  const bookingFieldStatus = savedBooking?.fieldStatus || savedBooking?.crop || message.field_status || message.fieldStatus || 'Field';
  const bookingOperation = savedBooking?.operation || message.operation || 'Rotavator / Secondary Tillage';
  const bookingDate = savedBooking?.bookingDate || savedBooking?.date || message.date || 'Tomorrow';
  const bookingTimeSlot = savedBooking?.timeSlot || savedBooking?.slot || message.timeSlot || '6:00 AM - 10:00 AM';

  // Resolved Village, Mandal, and District
  const bookingVillage = savedBooking?.village ||
                         message.village ||
                         message.locationVillage ||
                         message.location?.village ||
                         user?.farm_location?.village ||
                         user?.village ||
                         'Pasupugallu';

  const bookingMandal = savedBooking?.mandal ||
                        message.mandal ||
                        message.location?.mandal ||
                        user?.farm_location?.mandal ||
                        user?.mandal ||
                        '';

  const bookingDistrict = savedBooking?.district ||
                          message.district ||
                          message.location?.district ||
                          user?.farm_location?.district ||
                          user?.district ||
                          '';

  const bookingLocationDisplay = `${bookingVillage}${bookingMandal ? `, ${bookingMandal}` : ''}${bookingDistrict ? ` (${bookingDistrict})` : ''}`;
  const bookingTotalCost = savedBooking?.totalCost || message.totalCost || message.total_cost || '1,200';

  // ── Booking Interactive Chat Stream ──
  const chatStorageKey = `agrishield_chat_thread_${messageId}`;

  const defaultMessages = useMemo(() => {
    if (isBooking) {
      return [
        {
          id: 'msg_f1',
          sender: 'farmer',
          type: 'text_location',
          text: isTelugu
            ? `నమస్కారం, మా పొలం లొకేషన్ పంపిస్తున్నాను (${bookingLocationDisplay}). దయచేసి చూడండి.`
            : `Hello, sending our field location (${bookingLocationDisplay}). Please check.`,
          location: {
            name: `${bookingVillage}, Agri Field Plot`,
            teluguName: `${bookingVillage} గ్రామం, పొలం లొకేషన్`,
            coords: '15.2845° N, 79.9124° E'
          },
          time: '9:15 AM',
          status: 'read'
        },
        {
          id: 'msg_p1',
          sender: 'provider',
          type: 'audio_text',
          text: isTelugu
            ? `లొకేషన్ చూశాను, సరైన సమయానికి (${bookingTimeSlot}) వస్తున్నాము. డ్రైవర్ ఫోన్: ${cleanProviderPhone}`
            : `Saw the location, driver is arriving on schedule (${bookingTimeSlot}). Driver Phone: ${cleanProviderPhone}`,
          audioDuration: '0:14',
          audioNarration: isTelugu
            ? `నమస్కారం రైతు గారు, మీ పొలం లొకేషన్ చూశాము. నిర్ణీత సమయానికి డ్రైవర్ మీ ${bookingVillage} పొలానికి చేరుకుంటారు.`
            : `Hello farmer, we received your field location. The driver will reach your field in ${bookingVillage} on schedule.`,
          time: '9:16 AM'
        }
      ];
    }
    return [];
  }, [isBooking, isTelugu, bookingLocationDisplay, bookingVillage, bookingTimeSlot, cleanProviderPhone]);

  const [chatMessages, setChatMessages] = useState(() => {
    if (!isBooking) return [];
    try {
      const stored = localStorage.getItem(chatStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}
    return defaultMessages;
  });

  useEffect(() => {
    if (isBooking && chatMessages.length > 0) {
      try {
        localStorage.setItem(chatStorageKey, JSON.stringify(chatMessages));
      } catch (_) {}
    }
  }, [chatMessages, chatStorageKey, isBooking]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isBooking) scrollToBottom();
  }, [chatMessages, isBooking]);

  // ── Actions ──
  const handleBack = () => {
    stop();
    if (onBack) onBack();
  };

  const handleDelete = () => {
    stop();
    try {
      localStorage.removeItem(chatStorageKey);
    } catch (_) {}
    if (onDelete) onDelete(message.notification_id || message.id);
    if (onBack) onBack();
  };

  const handleShareWhatsApp = () => {
    let shareText = '';
    if (isDisease) {
      shareText = `*AgriShield Disease Alert / పంట తెగులు హెచ్చరిక*\n\n*${cropInfo.threadTitle}*\n${translatedBody || message.message}\n\n*AI Confidence:* ${parsedInfo.confidence}%\n\n- AgriShield AI Crop Protection`;
    } else if (isSystemOrHardware) {
      shareText = `*AgriShield System Alert / సిస్టమ్ హెచ్చరిక*\n\n*${translatedTitle || message.title}*\n${translatedBody || message.message}\n\n- AgriShield Kisan Network`;
    } else {
      shareText = `*AgriShield Machinery Booking Voucher*\n\n*Machine:* ${bookingEquipmentTitle}\n*Location:* ${bookingLocationDisplay}\n*Date:* ${bookingDate} (${bookingTimeSlot})\n*Fare:* ₹${bookingTotalCost}\n\n- AgriShield Farm Hub`;
    }
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank');
  };

  const handlePlayVoiceNote = (audioText) => {
    if (isPlayingAudio) {
      stop();
      setIsPlayingAudio(false);
    } else {
      setIsPlayingAudio(true);
      speak(
        audioText,
        `audio_note_${messageId}`,
        lang || 'te',
        0.95
      );
      setTimeout(() => {
        setIsPlayingAudio(false);
      }, 10000);
    }
  };

  const handleSendMessage = (customText = null) => {
    const textToSend = customText || inputText.trim();
    if (!textToSend) return;

    const newMsg = {
      id: `msg_f_${Date.now()}`,
      sender: 'farmer',
      type: 'text',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read'
    };

    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    if (!customText) setInputText('');

    setTimeout(() => {
      const providerReplies = isTelugu ? [
        `సరేనండి, మీ సందేశం అందింది. డ్రైవర్‌కు సూచనలు ఇచ్చాము.`,
        `ధన్యవాదాలు రైతు గారు, పని సజావుగా పూర్తవుతుంది. చింతించకండి.`,
        `లొకేషన్ మరియు సమయం సరిగ్గా గుర్తించాము. సరైన సమయానికి హాజరవుతాము.`
      ] : [
        `Understood, message received. We have notified our driver.`,
        `Thank you farmer, the operation will be completed smoothly on time.`,
        `Noted. Our driver is prepared with the necessary equipment attachments.`
      ];
      const randomReply = providerReplies[Math.floor(Math.random() * providerReplies.length)];

      setChatMessages(prev => [
        ...prev,
        {
          id: `msg_p_${Date.now()}`,
          sender: 'provider',
          type: 'text',
          text: randomReply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }, 1200);
  };

  const handleSendLiveLocation = () => {
    setShowAttachMenu(false);
    const locationMsg = {
      id: `msg_f_loc_${Date.now()}`,
      sender: 'farmer',
      type: 'location',
      text: isTelugu ? `📍 నా ప్రస్తుత వ్యవసాయ క్షేత్రం GPS లొకేషన్ పంపాను (${bookingVillage}).` : `📍 Sent my live farm GPS coordinates (${bookingVillage}).`,
      location: {
        name: `${bookingVillage}, Agri Field Plot`,
        teluguName: `${bookingVillage} పొలం, ప్లాట్`,
        coords: '15.2845° N, 79.9124° E'
      },
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'read'
    };
    setChatMessages(prev => [...prev, locationMsg]);
  };

  const handleUpdateBookingStatus = async (nextStatus) => {
    setBookingStatus(nextStatus);
    const bId = rawBookingId;
    try {
      const saved = JSON.parse(localStorage.getItem('agrishield_equipment_bookings') || '[]');
      if (Array.isArray(saved)) {
        const updated = saved.map(b => (b && (b.id === bId || `BK-${b.id}` === bId)) ? { ...b, status: nextStatus } : b);
        localStorage.setItem('agrishield_equipment_bookings', JSON.stringify(updated));
        window.dispatchEvent(new Event('agrishield_bookings_updated'));
      }
    } catch (_) {}
    try {
      await API.patch(`/api/v1/equipment/bookings/${bId}/status`, { status: nextStatus });
    } catch (_) {}
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f1f3f9] dark:bg-[#0d1117] text-slate-900 dark:text-slate-100 overflow-hidden select-none">

      {/* ─── 1. TOP APP BAR ─── */}
      <header className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white dark:bg-[#161b22] border-b border-slate-200/90 dark:border-slate-800 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            title={isTelugu ? "వెనుకకు" : "Back"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Differentiated Avatar */}
          <div className="relative shrink-0">
            {isDisease ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 via-emerald-600 to-teal-500 flex items-center justify-center text-white font-black shadow-md">
                <Sprout className="w-5 h-5 text-white" />
              </div>
            ) : isBooking ? (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 flex items-center justify-center text-white font-black shadow-md">
                <Truck className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-slate-700 flex items-center justify-center text-white font-black shadow-md">
                <Cpu className="w-5 h-5 text-white" />
              </div>
            )}
            {isBooking && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#161b22] animate-pulse" />
            )}
          </div>

          {/* Header Title & Subtitle */}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-slate-900 dark:text-white truncate">
                {isDisease
                  ? cropInfo.threadTitle
                  : isBooking
                    ? bookingProviderName
                    : (translatedTitle || message.title || (isTelugu ? 'సిస్టమ్ అలర్ట్' : 'System Alert'))}
              </h2>
              <span className="text-emerald-500 shrink-0">
                <CheckCircle2 className="w-4 h-4 fill-emerald-500 text-white dark:text-[#161b22]" />
              </span>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1">
              {isDisease ? (
                <span>{isTelugu ? 'ధృవీకరించబడిన వ్యాధి సలహా • స్వయంచాలక నివేదిక' : 'Verified AI Diagnostic Advisory • Automated Broadcast'}</span>
              ) : isBooking ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{isTelugu ? 'ఆన్‌లైన్ • 2 నిమిషాల్లో ప్రత్యుత్తరం' : 'Online • Replies in 2 mins'}</span>
                </span>
              ) : (
                <span>{isTelugu ? 'సిస్టమ్ టెలిమెట్రీ బ్రాడ్‌కాస్ట్' : 'System Telemetry Broadcast'}</span>
              )}
            </p>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Audio TTS toggle button for Disease Advisories */}
          {isDisease && (
            <button
              type="button"
              onClick={() => handlePlayVoiceNote(`${cropInfo.threadTitle}. ${translatedBody || message.message}`)}
              className={`p-2.5 rounded-full transition-colors cursor-pointer ${
                isPlayingAudio
                  ? 'bg-amber-500 text-white shadow-md animate-pulse'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
              }`}
              title={isTelugu ? "వాయిస్ సలహా వినండి" : "Listen to Voice Advisory"}
            >
              {isPlayingAudio ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          )}

          {/* Direct Phone Call Button (Booking only) */}
          {isBooking && cleanProviderPhone && (
            <a
              href={`tel:${cleanProviderPhone}`}
              className="p-2.5 rounded-full bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
              title={isTelugu ? "కాల్ చేయండి" : "Direct Phone Call"}
            >
              <Phone className="w-4 h-4" />
            </a>
          )}

          {/* WhatsApp Direct Chat Button (Booking only) */}
          {isBooking && cleanProviderPhone && (
            <a
              href={`https://wa.me/${cleanProviderPhone}?text=${encodeURIComponent(`Hello, regarding machinery booking #${rawBookingId} on AgriShield...`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer shadow-xs"
              title="WhatsApp"
            >
              <MessageSquare className="w-4 h-4" />
            </a>
          )}

          {/* Share WhatsApp Button */}
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
            title={isTelugu ? "షేర్ చేయండి" : "Share"}
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Delete Button */}
          <button
            type="button"
            onClick={handleDelete}
            className="p-2 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
            title={isTelugu ? "తొలగించండి" : "Delete Notification"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ─── 2. MAIN BODY AREA: PATTERN-SPECIFIC RENDERING ─── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-4 bg-[#f3f5fa] dark:bg-[#0d1117] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px]">

        {/* Date Divider Pill */}
        <div className="flex justify-center my-1">
          <div className="px-3.5 py-1 rounded-full bg-white/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-xs backdrop-blur-sm">
            {isTelugu ? 'ఈ రోజు' : 'Today'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            PATTERN A: DISEASE DETECTION ALERTS
            Brief summary, symptoms, audio player, chemical & organic
            treatments, leaf scan button. Strictly read-only.
           ══════════════════════════════════════════════════════════════ */}
        {isDisease && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-4"
          >
            {/* Disease Pathology Card */}
            <div className="rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cropInfo.cropEmoji}</span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    {cropInfo.cropName}
                  </span>
                  {parsedInfo.disease && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                      {isTelugu ? (parsedInfo.teluguDisease || parsedInfo.disease) : parsedInfo.disease}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                    {message.priority || 'High'}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    {parsedInfo.confidence}% AI Accuracy
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">
                  {cropInfo.threadTitle}
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 font-normal leading-relaxed mt-2 whitespace-pre-line">
                  {translatedBody || message.message}
                </p>
              </div>

              {/* Inline Audio Player Waveform */}
              <div className="mt-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePlayVoiceNote(`${cropInfo.threadTitle}. ${translatedBody || message.message}`)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${
                    isPlayingAudio ? 'bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title={isTelugu ? "వాయిస్ గైడ్ వినండి" : "Play Voice Guide"}
                >
                  {isPlayingAudio ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    <span>{isTelugu ? 'ఆడియో చికిత్సా సలహా (తెలుగు)' : 'Voice Treatment Advisory'}</span>
                    <span className="text-[10px] text-slate-500 font-mono">0:24</span>
                  </div>

                  {/* Pulsing Audio Waves */}
                  <div className="flex items-center gap-1 h-5 mt-1">
                    {[40, 75, 50, 90, 65, 80, 45, 100, 70, 55, 85, 60, 40, 65, 90, 50, 30].map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h}%` }}
                        className={`w-1 rounded-full transition-all ${
                          isPlayingAudio
                            ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                            : 'bg-slate-300 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Treatment Recommendations Card */}
            <div className="rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{isTelugu ? 'సిఫార్సు చేయబడిన నివారణ చర్యలు & మోతాదు' : 'Recommended Treatments & Dosages'}</span>
              </h4>

              {/* Chemical Sprays */}
              <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                <span className="text-[11px] font-extrabold uppercase text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  <span>🧪</span>
                  <span>{isTelugu ? 'రసాయన మందుల పిచికారీ (Chemical Spray)' : 'Chemical Foliar Protection'}</span>
                </span>
                <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-1.5 list-disc list-inside">
                  {parsedInfo.advisory?.chemicals && parsedInfo.advisory.chemicals.length > 0 ? (
                    parsedInfo.advisory.chemicals.slice(0, 3).map((chem, idx) => (
                      <li key={idx} className="leading-relaxed">{chem}</li>
                    ))
                  ) : (
                    <>
                      <li>{isTelugu ? 'మాంకోజెబ్ 75% WP @ 2.5 గ్రా/లీటర్ నీటికి పిచికారీ చేయాలి.' : 'Mancozeb 75% WP @ 2.5 g/L of water foliar spray.'}</li>
                      <li>{isTelugu ? 'కాపర్ ఆక్సిక్లోరైడ్ 50% WP @ 3.0 గ్రా/లీటర్ నీటికి కలిపి పిచికారీ చేయాలి.' : 'Copper Oxychloride 50% WP @ 3.0 g/L of water.'}</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Organic Remedies */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-800/60 space-y-2">
                <span className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <span>🌿</span>
                  <span>{isTelugu ? 'సేంద్రీయ & జీవ నియంత్రణ (Organic Remedies)' : 'Organic & Biological Controls'}</span>
                </span>
                <ul className="text-xs text-slate-800 dark:text-slate-200 space-y-1.5 list-disc list-inside">
                  {parsedInfo.advisory?.organic && parsedInfo.advisory.organic.length > 0 ? (
                    parsedInfo.advisory.organic.slice(0, 2).map((org, idx) => (
                      <li key={idx} className="leading-relaxed">{org}</li>
                    ))
                  ) : (
                    <>
                      <li>{isTelugu ? 'వేప నూనె (10,000 ppm) @ 5 మి.లీ/లీటర్ నీటికి కొద్దిగా సబ్బు నీరు కలిపి పిచికారీ చేయాలి.' : 'Cold-pressed Neem Oil (10,000 ppm) @ 5 ml/L of water with mild emulsifier.'}</li>
                      <li>{isTelugu ? 'ట్రైకోడెర్మా విరిడే @ 5 గ్రా/లీటర్ నీటికి కలిపి భూమిలో తడపాలి.' : 'Trichoderma viride bio-fungicide soil drenching.'}</li>
                    </>
                  )}
                </ul>
              </div>

              {/* Action Buttons for Disease */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/disease-detection')}
                  className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
                >
                  <Sprout className="w-4 h-4" />
                  <span>{isTelugu ? '🌿 పంట ఆకును స్కాన్ చేయండి' : '🌿 Scan Leaf'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{isTelugu ? '📢 వాట్సాప్‌లో షేర్ చేయండి' : '📢 Share Advisory'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PATTERN B: ESP32 IOT & SYSTEM ADMIN ALERTS
            Clean text, sensor issue details, single Share button.
            Strictly read-only.
           ══════════════════════════════════════════════════════════════ */}
        {isSystemOrHardware && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-4"
          >
            <div className="rounded-3xl bg-white dark:bg-[#161b22] border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-4">
              {/* Badge & Timestamp */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {translatedTitle || message.title || (isTelugu ? 'సిస్టమ్ అలర్ట్' : 'System Hardware Alert')}
                    </h3>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {formatDateTime(message.lifecycle?.created_at || message.created_at)}
                    </span>
                  </div>
                </div>

                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {message.priority || 'Normal'}
                </span>
              </div>

              {/* Alert Content Text */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-line font-medium">
                {translatedBody || message.message}
              </div>

              {/* Hardware Telemetry Snippet if present */}
              {(message.battery != null || message.humidity != null || message.node_id) && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                  {message.node_id && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Node ID</span>
                      <span className="font-bold text-slate-900 dark:text-white">#{message.node_id}</span>
                    </div>
                  )}
                  {message.battery != null && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Battery</span>
                      <span className="font-bold text-amber-600">{message.battery}%</span>
                    </div>
                  )}
                  {message.humidity != null && (
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                      <span className="text-[10px] text-slate-500 block">Humidity</span>
                      <span className="font-bold text-blue-600">{message.humidity}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Only Share Button */}
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>{isTelugu ? '📢 వాట్సాప్‌లో షేర్ చేయండి' : '📢 Share Alert on WhatsApp'}</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            PATTERN C: EQUIPMENT PROVIDER BOOKING
            Interactive 2-way conversation, ticket voucher with accurate
            village details, map preview, quick chips, and active reply composer.
           ══════════════════════════════════════════════════════════════ */}
        {isBooking && (
          <div className="max-w-2xl mx-auto space-y-4">
            {/* Ticket Voucher Card with Correct Village Details */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => setShowFullReview(true)}
              className="rounded-3xl bg-white dark:bg-gradient-to-br dark:from-[#16231e] dark:to-[#121921] border border-slate-200/90 dark:border-emerald-500/30 p-4 shadow-sm relative overflow-hidden cursor-pointer hover:border-emerald-500/50 transition-all group"
            >
              {/* Top Row: Machine & Badge */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                      {bookingEquipmentTitle}
                    </h3>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{isTelugu ? 'బుకింగ్ ధృవీకరించబడింది' : 'Machinery Booking Confirmed'}</span>
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  {isTelugu ? 'ధృవీకరించబడింది' : 'Confirmed'}
                </span>
              </div>

              {/* Middle Divider with Ticket Cutouts */}
              <div className="relative my-3 border-t border-dashed border-slate-200 dark:border-emerald-500/25">
                <div className="absolute -left-6 -top-2 w-4 h-4 rounded-full bg-[#f3f5fa] dark:bg-[#0d1117]" />
                <div className="absolute -right-6 -top-2 w-4 h-4 rounded-full bg-[#f3f5fa] dark:bg-[#0d1117]" />
              </div>

              {/* Exact Village & Field Location Details */}
              <div className="p-2.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/40 text-xs space-y-1 mb-2">
                <div className="flex items-center gap-1.5 text-emerald-900 dark:text-emerald-200 font-bold">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="text-[11px]">{isTelugu ? 'పొలం లొకేషన్:' : 'Field Location:'}</span>
                  <span className="text-[12px] font-black text-slate-900 dark:text-white">{bookingLocationDisplay}</span>
                </div>
                <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2 pl-5">
                  <span>{bookingAcres} Acres</span> • <span>⚙️ {bookingOperation}</span>
                </div>
              </div>

              {/* Bottom Row: Date, Time & Cost */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <div className="text-slate-600 dark:text-slate-300 font-medium">
                  <span>{bookingDate}</span> • <span className="text-emerald-600 dark:text-emerald-300 font-bold">{bookingTimeSlot}</span>
                </div>
                <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                  ₹{bookingTotalCost}
                </div>
              </div>

              {/* Voucher Subtext Footer */}
              <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{isTelugu ? 'వోచర్ వివరాలు • క్లిక్ చేయండి' : 'Confirms voucher • Tap for details'}</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  <span>{isTelugu ? 'వివరాలు' : 'Details'}</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </motion.div>

            {/* 2-Way Chat Stream Bubbles */}
            <div className="space-y-3 pt-2">
              {chatMessages.map((msg) => {
                const isFarmer = msg.sender === 'farmer';

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex flex-col ${isFarmer ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-md rounded-3xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-sm ${
                        isFarmer
                          ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-500/10'
                          : 'bg-white dark:bg-[#161b22] text-slate-800 dark:text-slate-200 border border-slate-200/90 dark:border-slate-800 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {msg.text && (
                        <p className="whitespace-pre-line font-medium leading-relaxed">
                          {msg.text}
                        </p>
                      )}

                      {/* Map Location Card */}
                      {msg.location && (
                        <div className="mt-2.5 rounded-2xl bg-black/30 border border-white/10 p-2.5 overflow-hidden shadow-inner space-y-2">
                          <div className="h-28 rounded-xl bg-gradient-to-br from-emerald-950/80 via-slate-900 to-teal-950 flex flex-col items-center justify-center relative border border-emerald-500/20 group cursor-pointer">
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:12px_12px]" />
                            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-lg animate-bounce">
                              <MapPin className="w-5 h-5 fill-emerald-400 text-emerald-900" />
                            </div>
                            <span className="text-[10px] font-bold text-emerald-300 mt-1 relative z-10">
                              {isTelugu ? 'పొలం GPS గుర్తించబడింది' : 'Farm GPS Marked'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div>
                              <span className="text-[11px] font-black text-white block">
                                {isTelugu ? msg.location.teluguName : msg.location.name}
                              </span>
                              <span className="text-[9px] text-slate-400 font-mono">
                                {msg.location.coords}
                              </span>
                            </div>
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(msg.location.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-bold flex items-center gap-1 border border-emerald-500/30"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{isTelugu ? 'మ్యాప్' : 'View'}</span>
                            </a>
                          </div>
                        </div>
                      )}

                      {/* Audio Waveform */}
                      {(msg.audioDuration || msg.audioNarration) && (
                        <div className="mt-2 pt-2 border-t border-slate-700/60">
                          <div className="flex items-center gap-3 p-2 rounded-2xl bg-black/25 border border-slate-700/60">
                            <button
                              type="button"
                              onClick={() => handlePlayVoiceNote(msg.audioNarration || msg.text)}
                              className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-90 cursor-pointer shadow-md ${
                                isPlayingAudio ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-slate-950'
                              }`}
                            >
                              {isPlayingAudio ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-slate-950 ml-0.5" />}
                            </button>

                            <div className="flex-1 flex items-center gap-1 h-6">
                              {[40, 75, 50, 90, 65, 80, 45, 100, 70, 55, 85, 60, 40].map((h, i) => (
                                <span
                                  key={i}
                                  style={{ height: `${h}%` }}
                                  className={`w-1 rounded-full transition-all ${
                                    isPlayingAudio ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                  }`}
                                />
                              ))}
                            </div>

                            <span className="text-[10px] font-mono font-bold text-slate-400">
                              {msg.audioDuration || '0:14'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isFarmer ? 'text-blue-100' : 'text-slate-400'}`}>
                        <span>{msg.time}</span>
                        {isFarmer && <CheckCheck className="w-3.5 h-3.5 text-blue-100 inline ml-0.5" />}
                      </div>
                    </div>
                  </motion.div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* ─── 3. BOTTOM FOOTER / INPUT CONTROLS ─── */}
      {isBooking ? (
        /* Pattern C Interactive Composer for Machinery Providers */
        <div className="bg-white dark:bg-[#161b22] border-t border-slate-200/90 dark:border-slate-800 shrink-0">
          {/* Quick Action Chips */}
          <div className="px-3 sm:px-4 py-2 border-b border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
              <button
                type="button"
                onClick={handleSendLiveLocation}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0 transition-colors cursor-pointer active:scale-95 shadow-xs"
              >
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                <span>{isTelugu ? '📍 పొలం GPS పంపండి' : '📍 Send Field GPS'}</span>
              </button>

              {cleanProviderPhone && (
                <a
                  href={`tel:${cleanProviderPhone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-bold shrink-0 transition-colors cursor-pointer active:scale-95 shadow-xs"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{isTelugu ? `📞 డ్రైవర్‌కు కాల్ చేయండి (${cleanProviderPhone})` : `📞 Call Driver (${cleanProviderPhone})`}</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setShowFullReview(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0 transition-colors cursor-pointer active:scale-95 shadow-xs"
              >
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                <span>{isTelugu ? '📜 రసీదు చూడండి' : '📜 View Receipt'}</span>
              </button>

              {cleanProviderPhone && (
                <a
                  href={`https://wa.me/${cleanProviderPhone}?text=${encodeURIComponent(`Hello, regarding booking #${rawBookingId}...`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-xs"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          {/* Active Reply Composer Form */}
          <footer className="p-2.5 sm:p-3 relative">
            <AnimatePresence>
              {showAttachMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-16 left-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-3 shadow-2xl space-y-2 z-30 text-xs w-64"
                >
                  <button
                    type="button"
                    onClick={handleSendLiveLocation}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900 dark:text-white">{isTelugu ? 'పొలం లొకేషన్ పంపండి' : 'Share Field Location'}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{bookingVillage}</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false);
                      handleSendMessage(isTelugu ? 'ట్రాక్టర్ బయలుదేరినప్పుడు దయచేసి నాకు కాల్ చేయండి.' : 'Please call me when the tractor departs.');
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left text-slate-800 dark:text-slate-200 transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold block text-slate-900 dark:text-white">{isTelugu ? 'రాక సమయం అడగండి' : 'Request Arrival Call'}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">{isTelugu ? 'డ్రైవర్ బయలుదేరినప్పుడు కాల్' : 'Notify upon departure'}</span>
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 max-w-4xl mx-auto"
            >
              <button
                type="button"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                className="p-2.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer shrink-0"
                title={isTelugu ? "జోడించండి" : "Attach"}
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <div className="flex-1 relative flex items-center">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={isTelugu ? 'ప్రొవైడర్‌కు సందేశం టైప్ చేయండి...' : 'Type message to Provider...'}
                  className="w-full py-2.5 px-4 pr-10 rounded-full bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {inputText.trim() ? (
                <button
                  type="submit"
                  className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-95 cursor-pointer shrink-0"
                  title={isTelugu ? "పంపండి" : "Send"}
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSendMessage(isTelugu ? 'నమస్కారం, రేపు పని సమయం ఖరారు చేయండి.' : 'Hello, please confirm tomorrow working hours.')}
                  className="p-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-95 cursor-pointer shrink-0"
                  title={isTelugu ? "వాయిస్ లేదా శీఘ్ర సందేశం" : "Voice / Quick Message"}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </form>
          </footer>
        </div>
      ) : (
        /* Pattern A & B Strictly Read-Only Footer Banner (No Reply Composer) */
        <footer className="p-3.5 bg-white dark:bg-[#161b22] border-t border-slate-200/90 dark:border-slate-800 shrink-0">
          <div className="max-w-md mx-auto py-2.5 px-4 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-xs">
            <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>
              {isDisease
                ? (isTelugu ? 'స్వయంచాలక నిర్ధారణ సలహా • ప్రత్యుత్తరం సాధ్యం కాదు' : 'Automated diagnostic advisory. Replies are disabled.')
                : (isTelugu ? 'సిస్టమ్ నోటీస్ బ్రాడ్‌కాస్ట్ • ప్రత్యుత్తరం అనుమతించబడదు' : 'System notice broadcast. Replies are disabled.')}
            </span>
          </div>
        </footer>
      )}

      {/* ─── 4. FULL DETAIL REVIEW MODAL (Voucher & Order Scope) ─── */}
      <AnimatePresence>
        {showFullReview && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 bg-[#161b22] border-b border-slate-800 shrink-0 sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFullReview(false)}
                  className="p-2 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h3 className="text-sm font-black text-white">
                  {isBooking
                    ? (isTelugu ? '🚜 బుకింగ్ వోచర్ & పని వివరాలు' : '🚜 Machinery Booking Voucher')
                    : (isTelugu ? 'పూర్తి AI నిర్ధారణ నివేదిక' : 'Full Diagnostic Advisory')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFullReview(false)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 max-w-2xl mx-auto w-full space-y-4">
              {isBooking ? (
                <>
                  <div className="p-4 rounded-3xl bg-gradient-to-br from-emerald-950/80 to-slate-900 border border-emerald-500/30 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      {isTelugu ? 'ధృవీకరించబడిన బుకింగ్' : 'Verified Machinery Booking'}
                    </span>
                    <h2 className="text-lg font-black text-white">{bookingEquipmentTitle}</h2>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                      <span className="text-xs text-slate-400">Total Rental Fare</span>
                      <span className="text-xl font-black text-emerald-400">₹{bookingTotalCost}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Truck className="w-4 h-4 text-emerald-400" />
                      <span>{isTelugu ? 'యంత్రాల ప్రదాత సమాచారం' : 'Equipment Provider Details'}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'ప్రదాత / సేవా కేంద్రం' : 'Provider Service Hub'}</span>
                        <span className="text-sm font-black text-white mt-0.5 block">{bookingProviderName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'హబ్ హెల్ప్‌లైన్' : 'Hub Helpline'}</span>
                        <span className="text-sm font-black text-white mt-0.5 block">{bookingProviderPhone}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-800">
                      <a
                        href={`tel:${cleanProviderPhone}`}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{isTelugu ? 'ప్రొవైడర్‌కు కాల్' : 'Call Provider'}</span>
                      </a>
                      <a
                        href={`https://wa.me/${cleanProviderPhone}?text=${encodeURIComponent(`Hello, regarding booking #${rawBookingId}...`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>

                  <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      <span>{isTelugu ? 'పని వివరాలు & ఖచ్చితమైన స్థలం' : 'Field Work Scope & Exact Location'}</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'గ్రామం / ప్రదేశం' : 'Village / Location'}</span>
                        <span className="text-xs font-black text-emerald-300 mt-0.5 block">{bookingLocationDisplay}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'పని రకం' : 'Operation'}</span>
                        <span className="text-xs font-black text-indigo-300 mt-0.5 block">⚙️ {bookingOperation}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'విస్తీర్ణం' : 'Total Area'}</span>
                        <span className="text-xs font-bold text-white mt-0.5 block">{bookingAcres} Acres</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{isTelugu ? 'షెడ్యూల్' : 'Schedule'}</span>
                        <span className="text-xs font-bold text-white mt-0.5 block">{bookingDate} ({bookingTimeSlot})</span>
                      </div>
                    </div>
                  </div>

                  {isProvider && (
                    <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                        {isTelugu ? 'ప్రొవైడర్ చర్యలు' : 'Provider Order Actions'}
                      </h4>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleUpdateBookingStatus('confirmed')}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          <span>{isTelugu ? 'ఆమోదించండి' : 'Accept'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBookingStatus('rejected')}
                          className="py-2.5 px-4 rounded-xl border border-rose-800 text-rose-400 hover:bg-rose-950 font-bold text-xs cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                          <span>{isTelugu ? 'తిరస్కరించండి' : 'Decline'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {!isProvider && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowFullReview(false);
                        navigate('/equipment');
                      }}
                      className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                    >
                      <Truck className="w-4 h-4" />
                      <span>{isTelugu ? 'నా బుకింగ్‌ల పేజీకి వెళ్లండి' : 'Open My Equipment Bookings'}</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {parsedInfo.disease && (
                    <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-400">Detected Pathology</h4>
                      <p className="text-base font-black text-rose-400">{parsedInfo.disease}</p>
                      {parsedInfo.confidence && (
                        <p className="text-xs text-emerald-400">{parsedInfo.confidence}% AI Neural Confidence</p>
                      )}
                    </div>
                  )}
                  {parsedInfo.advisory?.chemicals && (
                    <div className="p-4 rounded-3xl bg-[#161b22] border border-slate-800 space-y-2">
                      <h4 className="text-xs font-black uppercase text-slate-400">Chemical Spray Advisory</h4>
                      {parsedInfo.advisory.chemicals.map((c, i) => (
                        <p key={i} className="text-xs text-slate-200">• {c}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowFullReview(false)}
                className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
              >
                {isTelugu ? 'వెనుకకు' : 'Back'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

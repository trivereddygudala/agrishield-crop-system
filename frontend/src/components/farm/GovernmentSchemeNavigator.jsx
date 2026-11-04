import { getLocalizedField } from '../../utils/localizationHelper';
import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, Landmark, CheckCircle2, ExternalLink, 
  Share2, Shield, Sparkles, Filter, ChevronRight, 
  FileText, Award, HelpCircle, Users, Check
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SCHEMES_DATABASE = [
  {
    id: 'pm-kisan',
    nameEn: 'PM-Kisan Samman Nidhi',
    nameTe: 'పీఎం కిసాన్ సమ్మాన్ నిధి',
    sponsor: 'Central Govt',
    benefitEn: '₹6,000 / year (3 installments of ₹2,000 each)',
    benefitTe: 'ఏడాదికి ₹6,000 (రూ.2,000 చొప్పున 3 విడతల్లో)',
    category: 'all',
    maxAcreage: 100,
    tags: ['Direct Cash Transfer', 'All Landholders', 'DBT'],
    descriptionEn: 'Direct income support credited directly into the farmer Aadhaar-linked bank account.',
    descriptionTe: 'రైతుల ఆధార్ లింక్డ్ బ్యాంక్ ఖాతాలో నేరుగా జమ చేయబడే వార్షిక పెట్టుబడి సాయం.',
    portalUrl: 'https://pmkisan.gov.in',
    docs: ['Aadhaar Card', '1B / Land Pattadar Passbook', 'Active Bank Passbook']
  },
  {
    id: 'rythu-bharosa',
    nameEn: 'YSR Rythu Bharosa / Annadata Sukhibhava',
    nameTe: 'వైఎస్సార్ రైతు భరోసా / అన్నదాత సుఖీభవ',
    sponsor: 'AP State Govt',
    benefitEn: '₹13,500 – ₹20,000 / year input assistance',
    benefitTe: 'ఏడాదికి ₹13,500 – ₹20,000 పెట్టుబడి ఆర్థిక సాయం',
    category: 'tenant_and_owner',
    maxAcreage: 25,
    tags: ['AP State Welfare', 'Includes Tenant Farmers', 'Kharif & Rabi'],
    descriptionEn: 'State government input subsidy paid before Kharif sowing and Rabi harvest seasons.',
    descriptionTe: 'ఖరీఫ్ విత్తే ముందు మరియు రబీ పంట కాలంలో రాష్ట్ర ప్రభుత్వం అందించే పెట్టుబడి సాయం.',
    portalUrl: 'https://karshak.ap.gov.in',
    docs: ['Aadhaar Card', 'CCRC Agreement (for Tenant Farmers)', 'Pattadar Passbook']
  },
  {
    id: 'apmip-drip',
    nameEn: 'APMIP Micro-Irrigation Drip Subsidy',
    nameTe: 'APMIP సూక్ష్మ నీటి పారుదల డ్రిప్ సబ్సిడీ (90%)',
    sponsor: 'State & Central',
    benefitEn: 'Up to 90% Subsidy on Drip & Sprinkler Systems',
    benefitTe: 'డ్రిప్ & స్ప్రింక్లర్ సెట్లపై 90% వరకు ప్రభుత్వ రాయితీ',
    category: 'small_marginal',
    maxAcreage: 5.0,
    tags: ['90% Subsidy', 'Saves ₹55,000/Acre', 'Water Conservation'],
    descriptionEn: 'Massive subsidy for installing certified drip irrigation lines, disk filters, and fertigation tanks.',
    descriptionTe: 'డ్రిప్ పైపులు, ఫిల్టర్లు మరియు ఎరువుల ట్యాంకులపై ఎస్సీ/ఎస్టీలకు 90%, చిన్న రైతులకు 70-80% సబ్సిడీ.',
    portalUrl: 'https://apmip.ap.gov.in',
    docs: ['1B Adangal Copy', 'Aadhaar Card', 'Field GPS Coordinates', 'Water Source Verification']
  },
  {
    id: 'pmfby-insurance',
    nameEn: 'PMFBY Pradhan Mantri Fasal Bima Yojana',
    nameTe: 'ప్రధాన మంత్రి ఫసల్ బీమా యోజన (పంట బీమా)',
    sponsor: 'Central & State',
    benefitEn: 'Full compensation for drought, unseasonal rain & pest damage',
    benefitTe: 'కరువు, అకాల వర్షాలు, తుఫానులు & తెగుళ్ల వల్ల నష్టానికి పూర్తి పరిహారం',
    category: 'all',
    maxAcreage: 100,
    tags: ['Only 1.5% Premium', 'Zero Claim Fee', 'Crop Loss Protection'],
    descriptionEn: 'Comprehensive insurance coverage against natural disasters, cyclones, and widespread pest outbreaks.',
    descriptionTe: 'రైతు ప్రీమియం కేవలం 1.5-2% మాత్రమే, మిగతాది ప్రభుత్వమే చెల్లించి నష్టపరిహారం అందిస్తుంది.',
    portalUrl: 'https://pmfby.gov.in',
    docs: ['Sowing Certificate / VRO Adangal', 'Bank Account Details', 'Aadhaar Card']
  },
  {
    id: 'subsidized-seeds',
    nameEn: 'RSK Subsidized Seeds & Bio-Fertilizers',
    nameTe: 'రైతు సేవా కేంద్రం (RSK) రాయితీ విత్తనాలు',
    sponsor: 'AP State Govt',
    benefitEn: '50% Subsidy on certified crop seeds at village RSK',
    benefitTe: 'గ్రామ రైతు సేవా కేంద్రంలో 50% రాయితీతో ధృవీకరించిన విత్తనాలు',
    category: 'all',
    maxAcreage: 10.0,
    tags: ['Village RSK Delivery', '50% Off Seeds', 'Certified Germination'],
    descriptionEn: 'High-yielding certified seed distribution (Groundnut, Bengal Gram, Cotton, Paddy) via Village RSKs.',
    descriptionTe: 'గ్రామ పరిధిలోని రైతు సేవా కేంద్రాల్లో నేరుగా బయో-ఎరువులు మరియు సర్టిఫైడ్ విత్తనాల పంపిణీ.',
    portalUrl: 'https://apagrisnet.gov.in',
    docs: ['Aadhaar Biometric Verification at Village RSK', 'Adangal Sowing Entry']
  },
  {
    id: 'kcc-loan',
    nameEn: 'Kisan Credit Card (KCC) Crop Loan',
    nameTe: 'కిసాన్ క్రెడిట్ కార్డు (KCC) 4% వడ్డీ రుణం',
    sponsor: 'National Banking',
    benefitEn: 'Up to ₹3,00,000 Collateral-Free Loan at 4% Interest',
    benefitTe: '4% రాయితీ వడ్డీ రేటుతో ₹3 లక్షల వరకు సులభ వ్యవసాయ రుణం',
    category: 'all',
    maxAcreage: 100,
    tags: ['4% Subsidized Interest', 'Zero Prepayment Fee', 'Emergency Cash'],
    descriptionEn: 'Low-interest crop loan with 3% prompt repayment incentive for agricultural inputs and seasonal expenses.',
    descriptionTe: 'సకాలంలో తిరిగి చెల్లిస్తే కేవలం 4% వడ్డీకే లభించే పంట సాగు పెట్టుబడి రుణం.',
    portalUrl: 'https://www.myscheme.gov.in',
    docs: ['Pattadar Passbook', 'Aadhaar Card', 'No-Dues Certificate from local banks']
  },
  {
    id: 'pm-kusum-solar',
    nameEn: 'PM-KUSUM Solar Irrigation Pump Subsidy',
    nameTe: 'పీఎం కుసుమ్ సౌర వ్యవసాయ పంపుల సబ్సిడీ (90%)',
    sponsor: 'Central & State MNRE',
    benefitEn: 'Up to 90% Subsidy on 3HP – 7.5HP Solar Pumps',
    benefitTe: '3HP నుండి 7.5HP సోలార్ మోటార్ పంపులపై 90% వరకు రాయితీ',
    category: 'all',
    maxAcreage: 50,
    tags: ['90% Subsidy', 'Zero Electricity Bill', 'Daytime Irrigation'],
    descriptionEn: 'Replace costly diesel or grid pumps with high-efficiency standalone solar water pumping systems.',
    descriptionTe: 'డీజిల్ మరియు విద్యుత్ బిల్లుల భారం లేకుండా పగటిపూటే సమృద్ధిగా నీటి పారుదల అందించే సౌర విద్యుత్ పంపులు.',
    portalUrl: 'https://pmkusum.mnre.gov.in',
    docs: ['Aadhaar Card', 'Land Revenue 1B Record', 'Water Source / Borewell NOC', 'Bank Passbook']
  },
  {
    id: 'smam-machinery',
    nameEn: 'SMAM Agricultural Mechanization Subsidy',
    nameTe: 'రైతు వ్యవసాయ పనిముట్లు & యంత్రాల సబ్సిడీ (SMAM)',
    sponsor: 'Central & State Dept',
    benefitEn: '40% – 50% Subsidy on Tillers, Sprayers & Drones',
    benefitTe: 'పవర్ టిల్లర్లు, రొటవేటర్లు, బ్యాటరీ స్ప్రేయర్లు & డ్రోన్లపై 40-50% సబ్సిడీ',
    category: 'all',
    maxAcreage: 100,
    tags: ['40-50% Grant', 'Custom Hiring Centers', 'Drudgery Reduction'],
    descriptionEn: 'Financial assistance for purchasing power tillers, rotavators, weeders, tractor implements, and sprayers.',
    descriptionTe: 'రైతులు ఆధునిక వ్యవసాయ పరికరాలు మరియు డ్రోన్లను సగం ధరకే కొనుగోలు చేయడానికి అందించే ప్రభుత్వ రాయితీ.',
    portalUrl: 'https://agrimachinery.nic.in',
    docs: ['Pattadar Passbook', 'Aadhaar Card', 'Bank Account Details', 'Quotation from Authorized Dealer']
  },
  {
    id: 'pkvy-organic',
    nameEn: 'PKVY Paramparagat Krishi Vikas Yojana',
    nameTe: 'పరంపరాగత్ కృషి వికాస్ యోజన (సేంద్రీయ సాగు సాయం)',
    sponsor: 'Central Govt',
    benefitEn: '₹50,000 / Hectare Assistance for Organic Clusters',
    benefitTe: 'హెక్టారుకు ₹50,000 ఆర్థిక సాయం & ఉచిత సేంద్రీయ సర్టిఫికేషన్',
    category: 'all',
    maxAcreage: 20,
    tags: ['₹50,000 / ha', 'Free Organic Certification', 'Bio-Inputs Assistance'],
    descriptionEn: 'Direct assistance for organic farming certification, PGS India registration, and vermicompost input creation.',
    descriptionTe: 'రసాయన రహిత ప్రకృతి వ్యవసాయం చేసే రైతులకు ఉచిత సర్టిఫికేషన్, జీవామృతం & వర్మీకంపోస్ట్ తయారీకి ప్రోత్సాహకం.',
    portalUrl: 'https://pgsindia-ncof.gov.in',
    docs: ['Aadhaar Card', 'Village Cluster Member List', 'Land Passbook Copy']
  }
];

export default function GovernmentSchemeNavigator({ 
  farmName = "My Farm", 
  acreage = 2.0, 
  cropName = "Tomato",
  district = "Prakasam",
  village = "Pasupugallu",
  onClose 
}) {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';

  const [selectedFarmerCategory, setSelectedFarmerCategory] = useState('small_marginal'); // 'small_marginal', 'tenant', 'all'
  const [selectedScheme, setSelectedScheme] = useState(SCHEMES_DATABASE[2]);
  const [checkedDocs, setCheckedDocs] = useState({
    aadhaar: true,
    passbook: true,
    bank: true,
    ecrop: false
  });

  const toggleDoc = (k) => setCheckedDocs(prev => ({ ...prev, [k]: !prev[k] }));
  const docScore = Math.round((Object.values(checkedDocs).filter(Boolean).length / 4) * 100);
 // Default to APMIP Drip 90% Subsidy

  // Compute eligible schemes based on acreage & category
  const eligibleSchemes = useMemo(() => {
    return SCHEMES_DATABASE.filter(scheme => {
      if (scheme.category === 'small_marginal' && acreage > 5.0) return false;
      return true;
    });
  }, [acreage]);

  // Calculate total annual estimated government benefit
  const totalAnnualSupport = useMemo(() => {
    let cash = 19500; // PM-Kisan (6,000) + Rythu Bharosa (13,500)
    let dripSavings = acreage <= 5 ? Math.round(acreage * 45000) : 0;
    return { cash, dripSavings, total: cash + dripSavings };
  }, [acreage]);

  const handleShareWhatsApp = () => {
    const text = isTe
      ? `🏛️ *రైతు ప్రభుత్వ సంక్షేమ పథకాలు & సబ్సిడీల నివేదిక*\n\n` +
        `📍 *పొలం:* ${farmName} (${village})\n🌱 *పంట:* ${cropName} · విస్తీర్ణం: ${acreage} ఎకరాలు\n\n` +
        `💰 *మీరు అర్హత సాధించగల వార్షిక ప్రభుత్వ లబ్ధి:* సుమారు ₹${totalAnnualSupport.total.toLocaleString('en-IN')}\n\n` +
        `✅ *1. పీఎం కిసాన్ (PM-Kisan):* ఏడాదికి ₹6,000 నగదు జమ\n` +
        `✅ *2. వైఎస్సార్ రైతు భరోసా:* ఏడాదికి ₹13,500 పెట్టుబడి సాయం\n` +
        `✅ *3. APMIP డ్రిప్ ఇరిగేషన్ సబ్సిడీ:* 90% రాయితీ (సుమారు ₹${totalAnnualSupport.dripSavings.toLocaleString('en-IN')} ఆదా)\n` +
        `✅ *4. ఫసల్ బీమా యోజన:* ప్రకృతి వైపరీత్యాల నష్టానికి పూర్తి బీమా రక్షణ\n` +
        `✅ *5. కిసాన్ క్రెడిట్ కార్డు (KCC):* 4% వడ్డీతో ₹3 లక్షల పంట రుణం\n\n` +
        `_AgriShield AI స్మార్ట్ గవర్నమెంట్ స్కీమ్ నావిగేటర్._`
      : `🏛️ *AgriShield Government Agricultural Schemes & Subsidy Report*\n\n` +
        `📍 *Farm:* ${farmName} (${village})\n🌱 *Crop:* ${cropName} · Area: ${acreage} Acres\n\n` +
        `💰 *Total Estimated Eligible Benefits:* Approx ₹${totalAnnualSupport.total.toLocaleString('en-IN')} / year\n\n` +
        `✅ *1. PM-Kisan Samman Nidhi:* ₹6,000/year direct cash transfer\n` +
        `✅ *2. YSR Rythu Bharosa:* ₹13,500/year input assistance\n` +
        `✅ *3. APMIP Micro-Irrigation:* 90% Drip Subsidy (Approx ₹${totalAnnualSupport.dripSavings.toLocaleString('en-IN')} saved)\n` +
        `✅ *4. PMFBY Crop Insurance:* Comprehensive disaster damage protection\n` +
        `✅ *5. Kisan Credit Card (KCC):* 4% subsidized crop loan up to ₹3 Lakh\n\n` +
        `_Generated via AgriShield AI Agricultural Welfare Navigator._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="rounded-3xl bg-white dark:bg-[#060c14] border border-slate-200/90 dark:border-amber-500/25 p-4 sm:p-6 space-y-6 shadow-xl relative overflow-hidden text-slate-800 dark:text-slate-100">
      {/* Background Atmosphere Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 shrink-0">
            <Landmark className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                {isTe ? 'కేంద్ర & రాష్ట్ర ప్రభుత్వ సంక్షేమం' : 'Central & State Agri Schemes'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-white/50 font-mono">
                {district} District · {acreage} Acres
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
              {isTe ? 'ప్రభుత్వ పథకాలు & రాయితీల నావిగేటర్' : 'Government Scheme & Subsidy Navigator'}
            </h2>
          </div>
        </div>

        {/* Share Button */}
        <button
          onClick={handleShareWhatsApp}
          className="px-3.5 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 dark:bg-emerald-600/20 dark:hover:bg-emerald-600/30 border border-emerald-500/30 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer w-full sm:w-auto justify-center"
        >
          <Share2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{isTe ? 'వాట్సాప్ నివేదిక' : 'Share WhatsApp'}</span>
        </button>
      </div>

      {/* Total Financial Benefit Highlights */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-emerald-50 dark:from-amber-950/40 dark:via-amber-900/20 dark:to-emerald-950/40 border border-amber-200 dark:border-amber-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            {isTe ? 'మీ పొలానికి అర్హత గల వార్షిక ప్రభుత్వ లబ్ధి' : 'Total Eligible Annual Support for Your Farm'}
          </span>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            ₹{totalAnnualSupport.total.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-600 dark:text-white/60">{isTe ? '(ఆర్థిక సాయం + డ్రిప్ సబ్సిడీ ఆదా)' : '(Direct Cash + Drip Subsidy Value)'}</span>
          </p>
          <p className="text-xs text-slate-600 dark:text-white/70">
            {isTe 
              ? `పీఎం కిసాన్ (₹6,000) + రైతు భరోసా (₹13,500) + 90% డ్రిప్ సబ్సిడీ (₹${totalAnnualSupport.dripSavings.toLocaleString('en-IN')})`
              : `PM-Kisan (₹6,000) + Rythu Bharosa (₹13,500) + 90% Drip Savings (₹${totalAnnualSupport.dripSavings.toLocaleString('en-IN')})`}
          </p>
        </div>

        <div className="px-4 py-2.5 rounded-xl bg-white dark:bg-black/40 border border-amber-300 dark:border-amber-500/30 text-xs space-y-1 shrink-0 shadow-xs">
          <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {isTe ? 'ధ్రువీకరణ పత్రాలు సిద్ధం చేసుకోండి:' : 'Keep Key Documents Ready:'}
          </p>
          <p className="text-slate-500 dark:text-white/60">Aadhaar · 1B Pattadar Passbook · Bank IFSC</p>
        </div>
      </div>

            {/* Interactive Document Readiness & DBT Verification Tracker */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-cyan-500/10 border border-emerald-500/25 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-300 tracking-wider flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isTe ? 'ప్రభుత్వ సబ్సిడీ ధ్రువీకరణ పత్రాల సంసిద్ధత' : 'Govt Subsidy Document Readiness & DBT Status'}</span>
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 w-fit">
            {docScore}% {isTe ? 'సిద్ధంగా ఉంది' : 'Ready'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <button
            type="button"
            onClick={() => toggleDoc('aadhaar')}
            className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left cursor-pointer ${
              checkedDocs.aadhaar ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-500'
            }`}
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center text-xs ${checkedDocs.aadhaar ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
              {checkedDocs.aadhaar ? '✓' : ''}
            </span>
            <span className="font-bold text-[11px]">Aadhaar e-KYC Linked</span>
          </button>

          <button
            type="button"
            onClick={() => toggleDoc('passbook')}
            className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left cursor-pointer ${
              checkedDocs.passbook ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-500'
            }`}
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center text-xs ${checkedDocs.passbook ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
              {checkedDocs.passbook ? '✓' : ''}
            </span>
            <span className="font-bold text-[11px]">Pattadar Passbook / 1B</span>
          </button>

          <button
            type="button"
            onClick={() => toggleDoc('bank')}
            className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left cursor-pointer ${
              checkedDocs.bank ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-500'
            }`}
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center text-xs ${checkedDocs.bank ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
              {checkedDocs.bank ? '✓' : ''}
            </span>
            <span className="font-bold text-[11px]">NPCI Active Bank Account</span>
          </button>

          <button
            type="button"
            onClick={() => toggleDoc('ecrop')}
            className={`p-2.5 rounded-xl border flex items-center gap-2 transition-all text-left cursor-pointer ${
              checkedDocs.ecrop ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-900 dark:text-emerald-200' : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 text-slate-500'
            }`}
          >
            <span className={`w-4 h-4 rounded flex items-center justify-center text-xs ${checkedDocs.ecrop ? 'bg-emerald-600 text-white' : 'border border-slate-300'}`}>
              {checkedDocs.ecrop ? '✓' : ''}
            </span>
            <span className="font-bold text-[11px]">e-Crop (e-Panta) Sowing Entry</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Grid: Schemes List + Scheme Detail Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Schemes Directory */}
        <div className="lg:col-span-5 space-y-2.5">
          <span className="text-xs font-bold text-slate-600 dark:text-white/70 uppercase tracking-wider block">
            {isTe ? 'క్రియాశీల ప్రభుత్వ పథకాలు (6 పథకాలు)' : 'Available Welfare Schemes (6 Programs)'}
          </span>

          <div className="space-y-2">
            {eligibleSchemes.map(sch => {
              const isSelected = selectedScheme?.id === sch.id;
              return (
                <div
                  key={sch.id}
                  onClick={() => setSelectedScheme(sch)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-400 dark:border-amber-500/50 shadow-md text-slate-900 dark:text-white'
                      : 'bg-slate-50/70 dark:bg-white/[0.03] border-slate-200 dark:border-white/10 hover:border-amber-300 dark:hover:bg-white/[0.06] text-slate-700 dark:text-white/80'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-400/20 text-amber-800 dark:text-amber-300">
                        {sch.sponsor}
                      </span>
                      <h4 className="text-xs font-black truncate">{isTe ? sch.nameTe : sch.nameEn}</h4>
                    </div>
                    <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {isTe ? sch.benefitTe : sch.benefitEn}
                    </p>
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isSelected ? 'text-amber-600 dark:text-amber-400 translate-x-1' : 'text-slate-400 dark:text-white/30'}`} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Scheme Detail & Application Hub */}
        {selectedScheme && (
          <div className="lg:col-span-7 p-5 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-4 shadow-xs">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-white/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30">
                  {selectedScheme.sponsor}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  {isTe ? selectedScheme.nameTe : selectedScheme.nameEn}
                </h3>
              </div>
              <a
                href={selectedScheme.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <span>{isTe ? 'అధికారిక పోర్టల్' : 'Official Portal'}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Benefit Banner */}
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">
                {isTe ? 'రైతుకు లభించే మొత్తం ప్రయోజనం' : 'Direct Financial Benefit'}
              </span>
              <p className="text-lg font-black text-emerald-800 dark:text-emerald-300">
                {isTe ? selectedScheme.benefitTe : selectedScheme.benefitEn}
              </p>
              <p className="text-xs text-slate-600 dark:text-white/70">
                {isTe ? selectedScheme.descriptionTe : selectedScheme.descriptionEn}
              </p>
            </div>

            {/* Scheme Feature Highlights */}
            <div className="flex flex-wrap gap-1.5">
              {selectedScheme.tags.map((tag, idx) => (
                <span key={idx} className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/80 font-medium">
                  ✓ {tag}
                </span>
              ))}
            </div>

            {/* Required Documents Checklist */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-white/10">
              <span className="text-xs font-bold text-slate-800 dark:text-white/80 block">
                {isTe ? 'దరఖాస్తుకు అవసరమైన ధ్రువీకరణ పత్రాలు (Checklist):' : 'Mandatory Application Documents:'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedScheme.docs.map((doc, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 flex items-center gap-2 text-xs text-slate-800 dark:text-white/90">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{doc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* RSK Guidance Note */}
            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-500/20 text-xs text-sky-900 dark:text-sky-200 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                {isTe 
                  ? `మీ సమీపంలోని ${village} గ్రామ రైతు సేవా కేంద్రం (RSK) లేదా VRO వద్ద బయోమెట్రిక్ ద్వారా సులభంగా దరఖాస్తు చేసుకోవచ్చు.`
                  : `You can also apply with Aadhaar biometric at your local ${village} Rythu Seva Kendram (RSK).`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 4-Step Village RSK / RBK Claim Process */}
      <div className="p-4 rounded-2xl bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase text-emerald-800 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{isTe ? 'రైతు సేవా కేంద్రం (RSK) వద్ద లబ్ధి పొందే 4 దశల విధానం' : '4-Step Village RSK Application Process'}</span>
          </span>
          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            Village Level Direct Service
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-[11px] flex items-center justify-center">1</span>
              <span>{isTe ? 'ఇ-పంట నమోదు' : 'e-Crop Booking'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-white/70">
              {isTe ? 'గ్రామ వ్యవసాయ సహాయకుడి (VAA) ద్వారా మీ సర్వే నంబర్ల పరిధిలో పంట ఫోటో జియో-ట్యాగింగ్ చేయించాలి.' : 'Ensure VAA geo-tags your field photos and enters crop details into the official e-Panta portal.'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 font-black text-sky-600 dark:text-sky-400">
              <span className="w-5 h-5 rounded-full bg-sky-500/20 text-[11px] flex items-center justify-center">2</span>
              <span>{isTe ? 'ఆధార్ e-KYC' : 'Aadhaar e-KYC'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-white/70">
              {isTe ? 'RSK వద్ద బయోమెట్రిక్ వేలిముద్ర లేదా ఐరిస్ స్కాన్ ద్వారా e-KYC ధ్రువీకరణను పూర్తి చేయాలి.' : 'Complete biometric fingerprint or IRIS e-KYC verification at your village RSK centre.'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 font-black text-amber-600 dark:text-amber-400">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-[11px] flex items-center justify-center">3</span>
              <span>{isTe ? 'కౌలు రైతు CCRC' : 'Tenant CCRC Card'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-white/70">
              {isTe ? 'కౌలు రైతులు 11 నెలల పంట సాగు హక్కు పత్రం (CCRC) తీసుకొని రైతు భరోసాకు నమోదు చేసుకోవచ్చు.' : 'Tenant cultivators can obtain an 11-month CCRC agreement card from VRO for full subsidy benefits.'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 space-y-1">
            <div className="flex items-center gap-1.5 font-black text-teal-600 dark:text-teal-400">
              <span className="w-5 h-5 rounded-full bg-teal-500/20 text-[11px] flex items-center justify-center">4</span>
              <span>{isTe ? 'DBT ఖాతా జమ' : 'Direct Bank DBT'}</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-white/70">
              {isTe ? 'మీ ఆధార్ లింక్ అయిన బ్యాంక్ ఖాతాకు మధ్యవర్తులు లేకుండా నేరుగా నగదు లేదా రాయితీ చేరుతుంది.' : 'Zero intermediaries; subsidies and relief funds credit directly to your NPCI Aadhaar-seeded bank account.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

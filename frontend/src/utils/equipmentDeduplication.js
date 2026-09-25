/**
 * AgriShield Equipment & Bookings Master Deduplication Utility
 * Ensures 100% zero-duplicate integrity between Farmer Portal and Equipment Provider Portal.
 * Handles unified canonical fleet assets, multi-device synchronization, and semantic double-booking elimination.
 */

import { CURATED_FARM_PHOTOS } from '../services/photoService';

export const getEquipmentFallbackImage = (category, title = '') => {
  const t = String(title || '').toLowerCase();
  const c = String(category || '').toLowerCase();
  if (c === 'drone' || t.includes('drone') || t.includes('agras') || t.includes('spray')) {
    return CURATED_FARM_PHOTOS.drone || 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'irrigation' || c === 'pump' || t.includes('pump') || t.includes('solar') || t.includes('water')) {
    return CURATED_FARM_PHOTOS.solarPump || 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'harvester' || t.includes('harvester') || t.includes('cutter')) {
    return CURATED_FARM_PHOTOS.harvester || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80';
  }
  if (c === 'implement' || t.includes('rotavator') || t.includes('plough') || t.includes('tiller')) {
    return CURATED_FARM_PHOTOS.rotavator || 'https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('john deere')) {
    return CURATED_FARM_PHOTOS.tractor || 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80';
  }
  return CURATED_FARM_PHOTOS.tractorJohnDeere || CURATED_FARM_PHOTOS.tractorField || 'https://images.unsplash.com/photo-1594771804886-a933bb2d609b?auto=format&fit=crop&w=800&q=80';
};

export const CANONICAL_STARTER_FLEET = [
  {
    id: 'FL-001',
    title: 'John Deere 5050D Tractor',
    teluguTitle: 'జాన్ డీర్ 5050D 4WD ట్రాక్టర్',
    category: 'tractor',
    modelYear: '2023',
    horsepower: '50 HP',
    ratePerAcre: 900,
    hourlyRate: 900,
    ratePerHour: 900,
    dailyRate: 3600,
    available: true,
    availableToday: true,
    availableTime: '6:00 AM - 6:00 PM',
    implements: ['Rotavator', 'MB Plough', 'Cultivator'],
    implementsIncluded: ['Rotavator', 'MB Plough'],
    village: 'Pasupugallu',
    locationVillage: 'Pasupugallu',
    district: 'Prakasam',
    locationDistrict: 'Prakasam',
    mandal: 'Mundlamuru',
    state: 'Andhra Pradesh',
    phone: '9440182736',
    contactPhone: '9440182736',
    providerName: 'Agro Fleet Service (Pasupugallu)',
    ownerName: 'Agro Fleet Service (Pasupugallu)',
    operatorIncluded: true,
    fuelIncluded: true,
    rating: 4.9,
    bookingsCount: 42,
    distanceKm: 2.1,
    imageUrl: CURATED_FARM_PHOTOS.tractor || 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80',
    specs: '50 HP · 4WD · Power Steering · With Driver & Fuel Included'
  },
  {
    id: 'FL-002',
    title: 'DJI Agras T40 Agriculture Drone',
    teluguTitle: 'DJI ఆగ్రాస్ T40 వ్యవసాయ స్ప్రేయింగ్ డ్రోన్',
    category: 'drone',
    modelYear: '2024',
    horsepower: 'Dual Atomized Mist',
    ratePerAcre: 450,
    hourlyRate: 1800,
    ratePerHour: 1800,
    dailyRate: 7200,
    available: true,
    availableToday: true,
    availableTime: '5:30 AM - 6:30 PM',
    implements: ['Centrifugal Nozzles', 'Obstacle Radar'],
    implementsIncluded: ['40L Tank', 'Certified Pilot'],
    village: 'Mundlamuru',
    locationVillage: 'Mundlamuru',
    district: 'Prakasam',
    locationDistrict: 'Prakasam',
    mandal: 'Mundlamuru',
    state: 'Andhra Pradesh',
    phone: '9848012345',
    contactPhone: '9848012345',
    providerName: 'Kisan Drone Kendra',
    ownerName: 'Kisan Drone Kendra',
    operatorIncluded: true,
    fuelIncluded: true,
    rating: 4.8,
    bookingsCount: 89,
    distanceKm: 3.4,
    imageUrl: CURATED_FARM_PHOTOS.drone || 'https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=800&q=80',
    specs: '40L Tank · DGCA Certified Pilot Included · 5 Acres/hr Spraying'
  },
  {
    id: 'FL-003',
    title: 'Kirloskar 5HP Solar Water Pump',
    teluguTitle: 'కిర్లోస్కర్ 5HP సోలార్ వాటర్ పంప్',
    category: 'irrigation',
    modelYear: '2023',
    horsepower: '5 HP Solar DC',
    ratePerAcre: 350,
    hourlyRate: 350,
    ratePerHour: 350,
    dailyRate: 1800,
    available: true,
    availableToday: true,
    availableTime: '7:00 AM - 5:00 PM',
    implements: ['Solar Panels Trolley', 'High-Pressure Pipes'],
    implementsIncluded: ['Solar Panels Trolley', 'Delivery Pipe 200m'],
    village: 'Pasupugallu',
    locationVillage: 'Pasupugallu',
    district: 'Prakasam',
    locationDistrict: 'Prakasam',
    mandal: 'Mundlamuru',
    state: 'Andhra Pradesh',
    phone: '9440182736',
    contactPhone: '9440182736',
    providerName: 'Solar Agri Tech Hub',
    ownerName: 'Solar Agri Tech Hub',
    operatorIncluded: true,
    fuelIncluded: true,
    rating: 4.9,
    bookingsCount: 31,
    distanceKm: 1.5,
    imageUrl: CURATED_FARM_PHOTOS.solarPump || 'https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=800&q=80',
    specs: '5 HP · Solar Powered (Zero Fuel Cost) · 50,000 L/hr Discharge'
  },
  {
    id: 'FL-004',
    title: 'Mahindra 575 DI 45HP Tractor',
    teluguTitle: 'మహీంద్రా 575 DI 45HP ట్రాక్టర్',
    category: 'tractor',
    modelYear: '2023',
    horsepower: '45 HP',
    ratePerAcre: 800,
    hourlyRate: 800,
    ratePerHour: 800,
    dailyRate: 3200,
    available: true,
    availableToday: true,
    availableTime: '6:00 AM - 6:00 PM',
    implements: ['Rotavator', 'Plough', 'Cultivator'],
    implementsIncluded: ['Rotavator', 'Plough'],
    village: 'Pasupugallu',
    locationVillage: 'Pasupugallu',
    district: 'Prakasam',
    locationDistrict: 'Prakasam',
    mandal: 'Mundlamuru',
    state: 'Andhra Pradesh',
    phone: '9440182736',
    contactPhone: '9440182736',
    providerName: 'Agro Fleet Service (Pasupugallu)',
    ownerName: 'Agro Fleet Service (Pasupugallu)',
    operatorIncluded: true,
    fuelIncluded: true,
    rating: 5.0,
    bookingsCount: 64,
    distanceKm: 2.5,
    imageUrl: CURATED_FARM_PHOTOS.tractorJohnDeere || 'https://images.unsplash.com/photo-1594771804886-a933bb2d609b?auto=format&fit=crop&w=800&q=80',
    specs: '45 HP · Heavy Rotavator & MB Plough Included · Black Soil Ready'
  },
  {
    id: 'FL-005',
    title: 'Preet 987 Combined Harvester',
    teluguTitle: 'ప్రీత్ 987 కంబైన్డ్ హార్వెస్టర్',
    category: 'harvester',
    modelYear: '2023',
    horsepower: '101 HP',
    ratePerAcre: 2200,
    hourlyRate: 1800,
    ratePerHour: 1800,
    dailyRate: 9500,
    available: true,
    availableToday: false,
    availableTime: '7:00 AM - 6:00 PM',
    implements: ['Paddy Cutter Bar', 'Straw Reaper'],
    implementsIncluded: ['14-foot Cutter Bar'],
    village: 'Mundlamuru',
    locationVillage: 'Mundlamuru',
    district: 'Prakasam',
    locationDistrict: 'Prakasam',
    mandal: 'Mundlamuru',
    state: 'Andhra Pradesh',
    phone: '9848012345',
    contactPhone: '9848012345',
    providerName: 'Kisan Harvester Union',
    ownerName: 'Kisan Harvester Union',
    operatorIncluded: true,
    fuelIncluded: true,
    rating: 4.7,
    bookingsCount: 28,
    distanceKm: 4.8,
    imageUrl: CURATED_FARM_PHOTOS.harvester || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80',
    specs: '101 HP · Multi-Crop Paddy & Maize Harvester · Minimal Grain Loss'
  }
];

export const normalizeEquipmentTitle = (title) => {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Strict de-duplication of equipment items across local state, provider fleet, and remote catalog.
 * Guarantees zero duplicate machinery cards by comparing both normalized ID and normalized title.
 */
export const deduplicateEquipment = (items = []) => {
  if (!Array.isArray(items)) return [];
  const seenIds = new Set();
  const seenTitles = new Set();
  const result = [];

  for (const item of items) {
    if (!item) continue;
    const rawId = String(item.id || '').trim();
    // Filter legacy mock prefix noise
    if (rawId.startsWith('eq-tr-') || rawId.startsWith('eq-dr-') || rawId.startsWith('eq-ir-') || rawId.startsWith('eq-hv-')) {
      continue;
    }

    const titleNorm = normalizeEquipmentTitle(item.title);
    const idKey = rawId || `eq-${titleNorm}`;

    const idMatch = rawId && seenIds.has(rawId);
    const titleMatch = titleNorm && seenTitles.has(titleNorm);

    if (idMatch || titleMatch) {
      // Find existing index and merge properties (preserving latest availability status)
      const existingIdx = result.findIndex(ex => {
        if (rawId && String(ex.id) === rawId) return true;
        if (titleNorm && normalizeEquipmentTitle(ex.title) === titleNorm) return true;
        return false;
      });

      if (existingIdx !== -1) {
        const existing = result[existingIdx];
        result[existingIdx] = {
          ...existing,
          ...item,
          id: existing.id || item.id,
          available: item.available !== undefined ? item.available : existing.available,
          availableToday: item.availableToday !== undefined ? item.availableToday : existing.availableToday,
          implements: Array.isArray(item.implements) && item.implements.length > 0 ? item.implements : existing.implements,
          implementsIncluded: Array.isArray(item.implementsIncluded) && item.implementsIncluded.length > 0 ? item.implementsIncluded : existing.implementsIncluded
        };
      }
      continue;
    }

    if (rawId) seenIds.add(rawId);
    if (titleNorm) seenTitles.add(titleNorm);

    result.push({
      ...item,
      id: idKey,
      title: item.title || 'Farm Machinery',
      category: item.category || 'tractor',
      phone: item.phone || item.contactPhone || '9440182736',
      contactPhone: item.contactPhone || item.phone || '9440182736',
      providerName: item.providerName || item.ownerName || 'Local Machinery Provider',
      village: item.village || item.locationVillage || 'Pasupugallu',
      mandal: item.mandal || 'Mundlamuru',
      district: item.district || item.locationDistrict || 'Prakasam',
      ratePerAcre: Number(item.ratePerAcre) || Number(item.hourlyRate) || 800,
      ratePerHour: Number(item.hourlyRate) || Number(item.ratePerHour) || 800,
      implements: Array.isArray(item.implements) ? item.implements : Array.isArray(item.implementsIncluded) ? item.implementsIncluded : ['Rotavator', 'Plough'],
      implementsIncluded: Array.isArray(item.implementsIncluded) ? item.implementsIncluded : Array.isArray(item.implements) ? item.implements : ['Rotavator', 'Plough'],
      available: item.available !== false,
      availableToday: item.available !== false && item.availableToday !== false,
      operatorIncluded: item.operatorIncluded !== false,
      imageUrl: item.imageUrl || item.image || getEquipmentFallbackImage(item.category, item.title)
    });
  }

  return result;
};

/**
 * Strict de-duplication of booking orders across local state, provider ledger, and backend API.
 * Guarantees zero duplicate booking cards or inflated revenue numbers.
 */
export const deduplicateBookings = (bookings = [], deletedIds = new Set()) => {
  if (!Array.isArray(bookings)) return [];
  const seenIds = new Set();
  const seenFingerprints = new Set();
  const result = [];

  const delSet = deletedIds instanceof Set ? deletedIds : new Set(deletedIds || []);

  for (const b of bookings) {
    if (!b) continue;
    const rawId = String(b.id || b.bookingId || b._id || '').trim();
    if (!rawId && !b.title && !b.equipmentTitle) continue;

    // Filter test, mock, or user-deleted items
    if (rawId === 'BK-78210' || rawId.startsWith('BK-TEST-') || delSet.has(rawId)) {
      continue;
    }
    const cleanNumericId = rawId.replace(/^BK-/, '').trim();
    if (delSet.has(`BK-${cleanNumericId}`) || delSet.has(cleanNumericId)) {
      continue;
    }

    // Semantic fingerprint for duplicate submissions
    const titleNorm = String(b.equipmentTitle || b.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const dateNorm = String(b.serviceDate || b.date || b.bookingDate || '').trim();
    const slotNorm = String(b.timeSlot || b.slot || '').trim();
    const phoneNorm = String(b.farmerPhone || b.phone || b.contactPhone || '').replace(/[^0-9]/g, '').slice(-10);
    const acresNorm = String(b.acres || b.acreage || b.quantity || '').trim();
    const fingerprint = (titleNorm && dateNorm && phoneNorm)
      ? `${titleNorm}_${dateNorm}_${slotNorm}_${phoneNorm}_${acresNorm}`
      : null;

    const isIdSeen = (rawId && seenIds.has(rawId)) || (cleanNumericId && seenIds.has(`BK-${cleanNumericId}`));
    const isFingerprintSeen = fingerprint && seenFingerprints.has(fingerprint);

    if (isIdSeen || isFingerprintSeen) {
      const existingIdx = result.findIndex(ex => {
        const exId = String(ex.id || ex.bookingId || ex._id || '').trim();
        const exNumeric = exId.replace(/^BK-/, '').trim();
        if (rawId && (exId === rawId || exNumeric === cleanNumericId)) return true;
        if (fingerprint) {
          const exTitle = String(ex.equipmentTitle || ex.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const exDate = String(ex.serviceDate || ex.date || ex.bookingDate || '').trim();
          const exSlot = String(ex.timeSlot || ex.slot || '').trim();
          const exPhone = String(ex.farmerPhone || ex.phone || ex.contactPhone || '').replace(/[^0-9]/g, '').slice(-10);
          const exAcres = String(ex.acres || ex.acreage || ex.quantity || '').trim();
          if (`${exTitle}_${exDate}_${exSlot}_${exPhone}_${exAcres}` === fingerprint) return true;
        }
        return false;
      });

      if (existingIdx !== -1) {
        const existing = result[existingIdx];
        const statusPriority = { 'completed': 4, 'confirmed': 3, 'in-progress': 3, 'cancelled': 2, 'declined': 2, 'rejected': 2, 'pending': 1 };
        const curPri = statusPriority[String(existing.status).toLowerCase()] || 0;
        const newPri = statusPriority[String(b.status).toLowerCase()] || 0;
        result[existingIdx] = {
          ...existing,
          ...b,
          id: existing.id || b.id || `BK-${cleanNumericId || Math.floor(10000 + Math.random() * 90000)}`,
          bookingId: existing.bookingId || b.bookingId || existing.id,
          status: newPri >= curPri ? b.status : existing.status,
          phone: b.phone || b.farmerPhone || existing.phone || '9440182736',
          farmerPhone: b.farmerPhone || b.phone || existing.farmerPhone || '9440182736'
        };
      }
      continue;
    }

    if (rawId) {
      seenIds.add(rawId);
      if (cleanNumericId) {
        seenIds.add(`BK-${cleanNumericId}`);
        seenIds.add(cleanNumericId);
      }
    }
    if (fingerprint) seenFingerprints.add(fingerprint);

    result.push({
      ...b,
      id: rawId.startsWith('BK-') ? rawId : (cleanNumericId ? `BK-${cleanNumericId}` : `BK-${Math.floor(10000 + Math.random() * 90000)}`),
      bookingId: b.bookingId || rawId,
      phone: b.phone || b.farmerPhone || b.contactPhone || '9440182736',
      farmerPhone: b.farmerPhone || b.phone || b.contactPhone || '9440182736'
    });
  }

  return result;
};

window.KTData = (() => {
  const KEYS = {
    city: 'koshertravel_city',
    placesOverride: 'koshertravel_places_override',
    googleGeocodeKey: 'koshertravel_google_geocode_key'
  };

  const OSM_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  const PUBLIC_DISTANCE_LIMIT_KM = 25;
  const SUSPICIOUS_DISTANCE_KM = 50;

  async function fetchJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
    return response.json();
  }

  async function fetchCities() {
    return fetchJSON('data/cities.json');
  }

  async function fetchPlaces() {
    return fetchJSON('data/places.json');
  }

  async function getActivePlacesDataset() {
    const base = await fetchPlaces();
    const override = storage.get(KEYS.placesOverride, null);
    if (!Array.isArray(override)) return sanitizePlaces(base);
    return sanitizePlaces(override);
  }

  async function loadCityPlaces(city, options = {}) {
    const basePlaces = await getActivePlacesDataset();
    const cityBase = basePlaces.filter((place) => place.cityId === city.id);
    const osmPlaces = await fetchOsmPlaces(city, options.forceRefresh === true);
    const merged = mergePlaces(cityBase, osmPlaces);
    const checks = classifyPlacesForCity(merged, city);

    return {
      mergedPlaces: merged,
      publicPlaces: checks.publicPlaces,
      flaggedPlaces: checks.flaggedPlaces,
      unmappedPlaces: checks.unmappedPlaces,
      osmPlaces
    };
  }

  function classifyPlacesForCity(places, city) {
    const publicPlaces = [];
    const flaggedPlaces = [];
    const unmappedPlaces = [];

    places.forEach((place) => {
      const validation = validatePlace(place, city);
      if (validation.ok) {
        publicPlaces.push(place);
        return;
      }

      const flagged = { ...place, flagReason: validation.reason, distanceFromCityKm: validation.distanceKm || null };
      if (validation.reason === 'missing_coordinates') unmappedPlaces.push(flagged);
      else flaggedPlaces.push(flagged);
    });

    return { publicPlaces, flaggedPlaces, unmappedPlaces };
  }

  function validatePlace(place, city) {
    const lat = Number(place.lat);
    const lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, reason: 'missing_coordinates' };
    if (lat === 0 && lng === 0) return { ok: false, reason: 'zero_coordinates' };
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return { ok: false, reason: 'invalid_coordinates' };

    const [cityLat, cityLng] = city.center;
    const distanceKm = haversineDistanceKm(cityLat, cityLng, lat, lng);
    if (distanceKm > SUSPICIOUS_DISTANCE_KM) return { ok: false, reason: 'suspicious_far', distanceKm };
    if (distanceKm > PUBLIC_DISTANCE_LIMIT_KM) return { ok: false, reason: 'out_of_area', distanceKm };

    return { ok: true, distanceKm };
  }

  function mergePlaces(adminPlaces, osmPlaces) {
    const merged = [];
    const usedOsmIds = new Set();

    adminPlaces.forEach((place) => {
      const matched = findMatchingPlace(place, osmPlaces);
      if (matched) usedOsmIds.add(matched.osm_id);
      merged.push({ ...matched, ...place });
    });

    osmPlaces.forEach((place) => {
      if (usedOsmIds.has(place.osm_id)) return;
      if (merged.some((entry) => isNearDuplicate(entry, place))) return;
      merged.push(place);
    });

    return sanitizePlaces(merged);
  }

  function findMatchingPlace(place, list) {
    return list.find((candidate) => {
      if (place.osm_id && candidate.osm_id && place.osm_id === candidate.osm_id) return true;
      return isNearDuplicate(place, candidate);
    });
  }

  function isNearDuplicate(a, b) {
    const aName = (a.name || '').trim().toLowerCase();
    const bName = (b.name || '').trim().toLowerCase();
    if (!aName || !bName || aName !== bName) return false;
    if (!Number.isFinite(Number(a.lat)) || !Number.isFinite(Number(a.lng))) return false;
    if (!Number.isFinite(Number(b.lat)) || !Number.isFinite(Number(b.lng))) return false;
    return haversineDistanceKm(Number(a.lat), Number(a.lng), Number(b.lat), Number(b.lng)) <= 0.05;
  }

  async function fetchOsmPlaces(city, forceRefresh = false) {
    const cacheKey = `koshertravel_osm_cache_${city.id}`;
    const cached = storage.get(cacheKey, null);
    const now = Date.now();
    if (!forceRefresh && cached && Number.isFinite(cached.timestamp) && now - cached.timestamp < OSM_CACHE_TTL_MS) {
      return sanitizePlaces(cached.places || []);
    }

    const [lat, lng] = city.center;
    const radius = 20000;
    const query = `
[out:json][timeout:30];
(
  nwr["amenity"~"restaurant|cafe|fast_food"]["diet:kosher"="yes"](around:${radius},${lat},${lng});
  nwr["amenity"~"restaurant|cafe|fast_food"]["cuisine"="kosher"](around:${radius},${lat},${lng});
  nwr["amenity"~"restaurant|cafe|fast_food"]["kosher"="yes"](around:${radius},${lat},${lng});

  nwr["shop"~"supermarket|convenience|greengrocer|bakery"]["diet:kosher"="yes"](around:${radius},${lat},${lng});
  nwr["shop"~"supermarket|convenience|greengrocer|bakery"]["kosher"="yes"](around:${radius},${lat},${lng});

  nwr["amenity"="place_of_worship"]["religion"="jewish"]["name"~"(?i)chabad|lubavitch"](around:${radius},${lat},${lng});
  nwr["religion"="jewish"]["name"~"(?i)chabad|lubavitch"](around:${radius},${lat},${lng});
);
out center tags;`;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: query
      });
      if (!response.ok) throw new Error(`Overpass ${response.status}`);
      const data = await response.json();
      const mapped = mapOverpassToPlaces(data.elements || [], city.id);
      storage.set(cacheKey, { timestamp: now, places: mapped });
      return sanitizePlaces(mapped);
    } catch (_error) {
      return sanitizePlaces(cached?.places || []);
    }
  }

  function mapOverpassToPlaces(elements, cityId) {
    return elements
      .map((element) => {
        const tags = element.tags || {};
        const lat = Number(element.lat ?? element.center?.lat);
        const lng = Number(element.lon ?? element.center?.lon);
        const category = mapCategory(tags);
        if (!category) return null;
        const name = tags.name || 'Unnamed place';
        if (category === 'chabad' && !/chabad|lubavitch/i.test(name)) return null;
        return {
          id: `osm-${element.type}-${element.id}`,
          cityId,
          osm_id: `${element.type}/${element.id}`,
          source: 'osm',
          name,
          category,
          address: composeAddress(tags),
          phone: tags.phone || tags['contact:phone'] || '',
          website: tags.website || tags['contact:website'] || '',
          lat,
          lng,
          isVerified: false,
          isFeatured: false,
          featuredRank: null,
          notes: ''
        };
      })
      .filter(Boolean);
  }

  function mapCategory(tags) {
    const amenity = tags.amenity || '';
    const shop = tags.shop || '';
    if (/restaurant|cafe|fast_food/.test(amenity)) return 'restaurant';
    if (/supermarket|convenience|greengrocer|bakery/.test(shop)) return 'grocery';
    if ((tags.religion || '') === 'jewish' && /chabad|lubavitch/i.test(tags.name || '')) return 'chabad';
    return null;
  }

  function composeAddress(tags) {
    const street = tags['addr:street'] || '';
    const number = tags['addr:housenumber'] || '';
    const city = tags['addr:city'] || '';
    const postcode = tags['addr:postcode'] || '';
    const line1 = `${street} ${number}`.trim();
    const line2 = `${postcode} ${city}`.trim();
    const out = [line1, line2].filter(Boolean).join(', ');
    return out || 'Unknown address';
  }

  function sanitizePlaces(places) {
    return places
      .map((place) => ({
        ...place,
        lat: place.lat === '' || place.lat == null ? NaN : Number.parseFloat(place.lat),
        lng: place.lng === '' || place.lng == null ? NaN : Number.parseFloat(place.lng),
        featuredRank: place.featuredRank == null ? null : Number(place.featuredRank),
        website: window.KTUI.normalizeWebsite(place.website)
      }))
      .filter((place) => ['restaurant', 'grocery', 'chabad'].includes(place.category));
  }

  const storage = {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_err) {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
    remove(key) {
      localStorage.removeItem(key);
    }
  };

  function haversineDistanceKm(aLat, aLng, bLat, bLng) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function sortPlaces(places) {
    return [...places].sort((a, b) => {
      const aFeatured = a.isFeatured ? 0 : 1;
      const bFeatured = b.isFeatured ? 0 : 1;
      if (aFeatured !== bFeatured) return aFeatured - bFeatured;

      const aRank = Number.isFinite(a.featuredRank) ? a.featuredRank : Number.MAX_SAFE_INTEGER;
      const bRank = Number.isFinite(b.featuredRank) ? b.featuredRank : Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;

      const aVerified = a.isVerified ? 0 : 1;
      const bVerified = b.isVerified ? 0 : 1;
      if (aVerified !== bVerified) return aVerified - bVerified;

      return a.name.localeCompare(b.name);
    });
  }

  function getDirectionsUrl(place, origin) {
    const destLat = Number.parseFloat(place.lat);
    const destLng = Number.parseFloat(place.lng);
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return 'https://www.google.com/maps';
    const destination = `${destLat},${destLng}`;
    if (origin && Number.isFinite(origin.lat) && Number.isFinite(origin.lng)) {
      const originText = `${Number.parseFloat(origin.lat)},${Number.parseFloat(origin.lng)}`;
      return `https://www.google.com/maps/dir/?api=1&origin=${originText}&destination=${destination}&travelmode=walking`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
  }

  return {
    fetchCities,
    fetchPlaces,
    getActivePlacesDataset,
    loadCityPlaces,
    validatePlace,
    storage,
    KEYS,
    haversineDistanceKm,
    sortPlaces,
    getDirectionsUrl
  };
})();

window.KTData = (() => {
  const KEYS = {
    city: 'koshertravel_city',
    placesOverride: 'koshertravel_places_override'
  };

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

  function sanitizePlaces(places) {
    return places
      .map((place) => ({
        ...place,
        lat: Number.parseFloat(place.lat),
        lng: Number.parseFloat(place.lng),
        featuredRank: place.featuredRank == null ? null : Number(place.featuredRank),
        website: window.KTUI.normalizeWebsite(place.website)
      }))
      .filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));
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

  return { fetchCities, fetchPlaces, getActivePlacesDataset, storage, KEYS, haversineDistanceKm, sortPlaces, getDirectionsUrl };
})();

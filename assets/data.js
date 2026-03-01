window.KTData = (() => {
  const STORAGE_KEY = 'koshertravel_city';

  const CATEGORY_META = {
    chabad: { label: 'Chabad', color: '#355caa' },
    restaurant: { label: 'Restaurant', color: '#117a65' },
    grocery: { label: 'Grocery', color: '#b0681b' }
  };

  async function fetchJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to fetch ${path}`);
    return response.json();
  }

  function haversineDistanceKm(lat1, lon1, lat2, lon2) {
    const toRad = (n) => (n * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(distanceKm) {
    if (!Number.isFinite(distanceKm)) return '';
    return `${distanceKm.toFixed(2)} km`;
  }

  function isRealWebsite(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return false;
    if (/example\.com|example\s*domain/i.test(trimmed)) return false;
    try {
      const parsed = new URL(trimmed);
      return /^https?:$/.test(parsed.protocol);
    } catch {
      return false;
    }
  }

  function getDirectionsUrl(place, origin) {
    const destination = `${Number(place.lat)},${Number(place.lng)}`;
    const base = new URL('https://www.google.com/maps/dir/');
    base.searchParams.set('api', '1');
    base.searchParams.set('destination', destination);
    base.searchParams.set('travelmode', 'walking');
    if (origin?.lat && origin?.lng) {
      base.searchParams.set('origin', `${Number(origin.lat)},${Number(origin.lng)}`);
    }
    return base.toString();
  }

  function getOpenInGoogleMapsUrl(place) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${Number(place.lat)},${Number(place.lng)}`)}`;
  }

  return {
    CATEGORY_META,
    STORAGE_KEY,
    fetchCities: () => fetchJSON('data/cities.json'),
    fetchPlaces: () => fetchJSON('data/places.json'),
    haversineDistanceKm,
    formatDistance,
    isRealWebsite,
    getDirectionsUrl,
    getOpenInGoogleMapsUrl
  };
})();

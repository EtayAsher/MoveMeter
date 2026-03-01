window.KTData = (() => {
  const STORAGE_KEY = 'koshertravel_city';

  const CATEGORY_META = {
    chabad: { label: 'Chabad', color: '#355caa' },
    restaurant: { label: 'Restaurant', color: '#1f7a5a' },
    grocery: { label: 'Grocery', color: '#b0681b' }
  };

  const CERTIFICATION_META = {
    verified: { label: 'Verified', color: '#C6A85A' },
    reported: { label: 'Reported', color: '#7B8699' },
    needsCheck: { label: 'Needs Check', color: '#D9952B' }
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

  const formatDistance = (distanceKm) => (Number.isFinite(distanceKm) ? `${distanceKm.toFixed(2)} km` : '');

  function isRealWebsite(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const parsed = new URL(url.trim());
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
    if (origin?.lat && origin?.lng) base.searchParams.set('origin', `${Number(origin.lat)},${Number(origin.lng)}`);
    return base.toString();
  }

  return {
    CATEGORY_META,
    CERTIFICATION_META,
    STORAGE_KEY,
    fetchCities: () => fetchJSON('data/cities.json'),
    fetchPlaces: () => fetchJSON('data/places.json'),
    haversineDistanceKm,
    formatDistance,
    isRealWebsite,
    getDirectionsUrl
  };
})();

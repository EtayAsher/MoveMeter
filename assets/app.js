window.KT = (() => {
  async function fetchJSON(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return response.json();
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
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function sortPlaces(places) {
    return [...places].sort((a, b) => {
      const aFeatured = a.isFeatured ? 0 : 1;
      const bFeatured = b.isFeatured ? 0 : 1;
      if (aFeatured !== bFeatured) return aFeatured - bFeatured;

      const aRank = Number.isFinite(a.featuredRank) ? a.featuredRank : 999;
      const bRank = Number.isFinite(b.featuredRank) ? b.featuredRank : 999;
      if (aRank !== bRank) return aRank - bRank;

      const aVerified = a.isVerified ? 0 : 1;
      const bVerified = b.isVerified ? 0 : 1;
      if (aVerified !== bVerified) return aVerified - bVerified;

      return a.name.localeCompare(b.name);
    });
  }

  function getDirectionsUrl(place, origin) {
    const destination = `${place.lat},${place.lng}`;
    if (origin) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination}&travelmode=walking`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${destination}`;
  }

  return { fetchJSON, storage, haversineDistanceKm, sortPlaces, getDirectionsUrl };
})();

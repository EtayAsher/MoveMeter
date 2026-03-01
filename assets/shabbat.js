window.KTShabbat = (() => {
  const MIN_RADIUS = 0.8;
  const MAX_RADIUS = 2.5;
  let map;
  let markersLayer;
  let radiusCircle;
  let hotelMarker;
  let cities = [];
  let places = [];
  let selectedCityId = '';
  let radiusKm = 1.2;
  let hotel = null;

  async function init() {
    const citySelect = document.getElementById('shabbatCitySelect');
    const radiusRange = document.getElementById('radiusRange');
    const radiusLabel = document.getElementById('radiusLabel');

    cities = await KTData.fetchCities();
    places = await KTData.fetchPlaces();

    selectedCityId = localStorage.getItem(KTData.STORAGE_KEY) || cities[0]?.id || 'newyork';
    if (!cities.some((city) => city.id === selectedCityId)) selectedCityId = cities[0]?.id;

    citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}</option>`).join('');
    citySelect.value = selectedCityId;
    radiusRange.min = String(MIN_RADIUS);
    radiusRange.max = String(MAX_RADIUS);
    radiusRange.step = '0.1';
    radiusRange.value = String(radiusKm);
    radiusLabel.textContent = `${radiusKm.toFixed(1)} km`;

    citySelect.addEventListener('change', () => {
      selectedCityId = citySelect.value;
      localStorage.setItem(KTData.STORAGE_KEY, selectedCityId);
      resetHotel();
      render();
    });

    radiusRange.addEventListener('input', () => {
      radiusKm = Number(radiusRange.value);
      radiusLabel.textContent = `${radiusKm.toFixed(1)} km`;
      updateOverlay();
      render();
    });

    map = L.map('shabbatMap', { zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    map.on('click', (event) => {
      hotel = { lat: event.latlng.lat, lng: event.latlng.lng };
      setHotelMarker();
      updateOverlay();
      render();
    });

    render();
  }

  function resetHotel() {
    hotel = null;
    if (hotelMarker) { map.removeLayer(hotelMarker); hotelMarker = null; }
    if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
    document.getElementById('hotelStatus').textContent = 'Tap map to set your hotel location.';
  }

  function setHotelMarker() {
    if (hotelMarker) map.removeLayer(hotelMarker);
    hotelMarker = L.marker([hotel.lat, hotel.lng], { icon: hotelIcon() }).addTo(map);
    document.getElementById('hotelStatus').textContent = `Hotel set at ${hotel.lat.toFixed(5)}, ${hotel.lng.toFixed(5)}`;
  }

  function updateOverlay() {
    if (!hotel) return;
    if (radiusCircle) map.removeLayer(radiusCircle);
    radiusCircle = L.circle([hotel.lat, hotel.lng], { radius: radiusKm * 1000, color: '#C6A85A', fillColor: '#C6A85A', fillOpacity: 0.12, weight: 2 }).addTo(map);
  }

  function render() {
    const city = cities.find((entry) => entry.id === selectedCityId) || cities[0];
    map.setView(city.center, city.zoom);

    const cityPlaces = places.filter((place) => place.cityId === city.id && place.certificationLevel === 'verified');
    const walkable = hotel ? cityPlaces
      .map((place) => ({ ...place, distanceKm: KTData.haversineDistanceKm(hotel.lat, hotel.lng, place.lat, place.lng) }))
      .filter((place) => place.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm) : [];

    const wrap = document.getElementById('shabbatResults');
    const count = document.getElementById('walkableCount');
    if (!hotel) {
      count.textContent = 'Set a hotel location to begin';
      wrap.innerHTML = '<p class="empty">Select city, tap map to set your hotel, then adjust radius.</p>';
      markersLayer.clearLayers();
      return;
    }

    count.textContent = `${walkable.length} places within ${radiusKm.toFixed(1)} km`;
    wrap.innerHTML = walkable.length ? walkable.map((place) => {
      const meta = KTData.CATEGORY_META[place.category];
      const websiteButton = KTData.isRealWebsite(place.website) ? `<a class="btn btn-secondary" href="${place.website}" target="_blank" rel="noopener noreferrer">Website</a>` : '';
      return `<article class="card">
          <h3>${place.name}</h3>
          <p class="badges"><span class="badge" style="--badge:${meta.color}">${meta.label}</span></p>
          <p class="muted">${place.fullAddress}</p>
          <p class="distance">${KTData.formatDistance(place.distanceKm)}</p>
          <div class="actions">
            ${websiteButton}
            <a class="btn btn-primary" href="${KTData.getDirectionsUrl(place, hotel)}" target="_blank" rel="noopener noreferrer">Walking directions</a>
          </div>
        </article>`;
    }).join('') : '<p class="empty">No verified places in this radius. Increase radius up to 2.5 km.</p>';

    markersLayer.clearLayers();
    walkable.forEach((place) => {
      const meta = KTData.CATEGORY_META[place.category];
      L.marker([place.lat, place.lng], { icon: markerIcon(meta.color) }).addTo(markersLayer);
    });
  }

  function markerIcon(color) {
    return L.divIcon({ className: '', html: `<span class="pin" style="--pin:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  function hotelIcon() {
    return L.divIcon({ className: '', html: '<span class="hotel-pin"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  return { init };
})();

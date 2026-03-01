window.KTShabbat = (() => {
  const RADII = [0.8, 1.0, 1.2, 1.5, 2.0];
  let map;
  let markersLayer;
  let radiusCircle;
  let hotelMarker;
  let cities = [];
  let places = [];
  let selectedCityId = '';
  let radiusKm = 1.0;
  let hotel = null;

  async function init() {
    const citySelect = document.getElementById('shabbatCitySelect');
    const radiusButtons = document.getElementById('radiusButtons');

    cities = await KTData.fetchCities();
    places = await KTData.fetchPlaces();

    selectedCityId = localStorage.getItem(KTData.STORAGE_KEY) || cities[0]?.id || 'london';
    if (!cities.some((city) => city.id === selectedCityId)) selectedCityId = cities[0]?.id;

    citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}</option>`).join('');
    citySelect.value = selectedCityId;

    radiusButtons.innerHTML = RADII.map((value) => `<button class="chip${value === radiusKm ? ' active' : ''}" type="button" data-radius="${value}">${value.toFixed(1)} km</button>`).join('');

    citySelect.addEventListener('change', () => {
      selectedCityId = citySelect.value;
      localStorage.setItem(KTData.STORAGE_KEY, selectedCityId);
      resetHotel();
      render();
    });

    radiusButtons.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-radius]');
      if (!button) return;
      radiusKm = Number(button.dataset.radius);
      [...radiusButtons.querySelectorAll('button')].forEach((entry) => entry.classList.toggle('active', entry === button));
      updateOverlay();
      render();
    });

    map = L.map('shabbatMap', { zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    map.on('click', (event) => {
      hotel = { lat: Number(event.latlng.lat), lng: Number(event.latlng.lng) };
      document.getElementById('hotelStatus').textContent = 'Hotel set ✓';
      updateOverlay();
      render();
    });

    render();
  }

  function resetHotel() {
    hotel = null;
    document.getElementById('hotelStatus').textContent = 'Hotel not set yet';
    if (hotelMarker) map.removeLayer(hotelMarker);
    if (radiusCircle) map.removeLayer(radiusCircle);
  }

  function updateOverlay() {
    if (hotelMarker) map.removeLayer(hotelMarker);
    if (radiusCircle) map.removeLayer(radiusCircle);
    if (!hotel) return;

    hotelMarker = L.marker([hotel.lat, hotel.lng], { icon: hotelIcon() }).addTo(map);
    radiusCircle = L.circle([hotel.lat, hotel.lng], {
      radius: radiusKm * 1000,
      color: '#b48333',
      fillColor: '#f2dcb2',
      fillOpacity: 0.25,
      weight: 2
    }).addTo(map);
  }

  function render() {
    const city = cities.find((entry) => entry.id === selectedCityId) || cities[0];
    map.setView(city.center, city.zoom);

    const cityPlaces = places.filter((place) => place.cityId === city.id);
    const walkable = hotel
      ? cityPlaces
          .map((place) => ({ ...place, distanceKm: KTData.haversineDistanceKm(hotel.lat, hotel.lng, place.lat, place.lng) }))
          .filter((place) => place.distanceKm <= radiusKm)
          .sort((a, b) => a.distanceKm - b.distanceKm)
      : [];

    const wrap = document.getElementById('shabbatResults');
    const count = document.getElementById('walkableCount');
    count.textContent = hotel ? `${walkable.length} in radius` : 'Set a hotel to start';

    if (!hotel) {
      wrap.innerHTML = '<p class="empty">Tap map to set hotel location.</p>';
      markersLayer.clearLayers();
      return;
    }

    if (!walkable.length) {
      wrap.innerHTML = '<p class="empty">No places in this radius. Try increasing to 1.5 or 2.0 km.</p>';
    } else {
      wrap.innerHTML = walkable.map((place) => {
        const meta = KTData.CATEGORY_META[place.category] || KTData.CATEGORY_META.restaurant;
        const websiteButton = KTData.isRealWebsite(place.website)
          ? `<a class="btn btn-soft" href="${place.website}" target="_blank" rel="noopener noreferrer">Website</a>`
          : '';

        return `<article class="card">
          <h3>${place.name}</h3>
          <p><span class="badge" style="--badge:${meta.color}">${meta.label}</span></p>
          <p class="muted">${place.address}</p>
          <p class="distance">${KTData.formatDistance(place.distanceKm)}</p>
          <div class="actions">
            ${websiteButton}
            <a class="btn btn-primary" href="${KTData.getDirectionsUrl(place, hotel)}" target="_blank" rel="noopener noreferrer">Walking directions</a>
            <a class="btn btn-soft" href="${KTData.getOpenInGoogleMapsUrl(place)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
          </div>
        </article>`;
      }).join('');
    }

    markersLayer.clearLayers();
    walkable.forEach((place) => {
      const meta = KTData.CATEGORY_META[place.category] || KTData.CATEGORY_META.restaurant;
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

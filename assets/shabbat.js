window.KTShabbat = (() => {
  const CATEGORY_META = {
    restaurant: { label: 'Restaurant', icon: '🍽️', color: '#4869b8' },
    grocery: { label: 'Grocery', icon: '🛒', color: '#4f8b7a' },
    chabad: { label: 'Chabad', icon: '🕍', color: '#8d6bb5' }
  };
  const RADIUS_PRESETS = [0.8, 1.0, 1.2, 1.5, 2.0];

  async function initShabbat() {
    const citySelect = KTUI.qs('#shabbatCitySelect');
    const setOriginBtn = KTUI.qs('#setOriginBtn');
    const useCenterBtn = KTUI.qs('#useCenterBtn');
    const originStatus = KTUI.qs('#originStatus');
    const radiusWrap = KTUI.qs('#radiusPresetButtons');
    const results = KTUI.qs('#shabbatResults');
    const walkableCount = KTUI.qs('#walkableCount');

    let cities = [];
    let publicPlaces = [];
    let selectedCity = '';
    let radiusKm = 1.2;
    let origin = null;
    let pickingOrigin = false;
    let map;
    let markersLayer;
    let originMarker;
    let originCircle;

    cities = await KTData.fetchCities();
    selectedCity = restoreCity(cities);
    citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}, ${city.country}</option>`).join('');
    citySelect.value = selectedCity;

    radiusWrap.innerHTML = RADIUS_PRESETS.map((value) => `<button type="button" class="chip-button${value === radiusKm ? ' active' : ''}" data-radius="${value}">${value.toFixed(1)} km</button>`).join('');

    map = L.map('shabbatMap');
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    citySelect.addEventListener('change', async () => {
      selectedCity = citySelect.value;
      KTData.storage.set(KTData.KEYS.city, selectedCity);
      clearOrigin();
      await loadCityAndRender();
    });

    radiusWrap.addEventListener('click', (event) => {
      const button = event.target.closest('[data-radius]');
      if (!button) return;
      radiusKm = Number(button.dataset.radius);
      KTUI.qsa('[data-radius]', radiusWrap).forEach((entry) => entry.classList.toggle('active', entry === button));
      drawOriginOverlay();
      render();
    });

    setOriginBtn.addEventListener('click', () => {
      pickingOrigin = true;
      originStatus.textContent = 'Tap on the map to set hotel pin.';
    });

    useCenterBtn.addEventListener('click', () => {
      const center = map.getCenter();
      setOrigin({ lat: Number(center.lat), lng: Number(center.lng) });
    });

    map.on('click', (event) => {
      if (!pickingOrigin) return;
      setOrigin({ lat: Number(event.latlng.lat), lng: Number(event.latlng.lng) });
    });

    await loadCityAndRender();

    async function loadCityAndRender() {
      const city = getCity();
      map.setView(city.center, city.zoom);
      const loaded = await KTData.loadCityPlaces(city);
      publicPlaces = loaded.publicPlaces;
      render();
    }

    function setOrigin(value) {
      origin = { lat: Number(value.lat), lng: Number(value.lng) };
      pickingOrigin = false;
      setOriginBtn.textContent = 'Change Hotel Location';
      originStatus.textContent = `Hotel pin set ✓ (${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)})`;
      drawOriginOverlay();
      render();
    }

    function render() {
      if (!origin) {
        walkableCount.textContent = '0';
        results.innerHTML = '<p class="empty-state">Set your hotel location to see walkable options.</p>';
        markersLayer.clearLayers();
        return;
      }

      const list = KTData.sortPlaces(
        publicPlaces
          .map((place) => ({
            ...place,
            distanceKm: KTData.haversineDistanceKm(origin.lat, origin.lng, place.lat, place.lng)
          }))
          .filter((place) => Number.isFinite(place.distanceKm) && place.distanceKm <= radiusKm)
      );

      walkableCount.textContent = String(list.length);
      if (!list.length) {
        results.innerHTML = '<p class="empty-state">No places found in this radius. Try a larger radius or different hotel pin.</p>';
      } else {
        results.innerHTML = list.map((place) => {
          const meta = CATEGORY_META[place.category] || CATEGORY_META.restaurant;
          return `<article class="place-card shabbat-card">
            <h3>${place.name}</h3>
            <p class="muted">${meta.icon} ${meta.label}</p>
            <p class="muted">${place.address}</p>
            <p class="distance">${KTUI.formatDistance(place.distanceKm)}</p>
            <div class="card-actions">
              <a class="btn btn-primary" href="${KTData.getDirectionsUrl(place, origin)}" target="_blank" rel="noopener noreferrer">Walking Directions</a>
            </div>
          </article>`;
        }).join('');
      }

      renderMarkers(list);
    }

    function renderMarkers(list) {
      markersLayer.clearLayers();
      list.forEach((place) => {
        const meta = CATEGORY_META[place.category] || CATEGORY_META.restaurant;
        L.marker([place.lat, place.lng], { icon: markerIcon(meta.color, place.isFeatured) })
          .bindPopup(`<strong>${place.name}</strong><br>${KTUI.formatDistance(place.distanceKm)} walk`)
          .addTo(markersLayer);
      });
    }

    function drawOriginOverlay() {
      if (originMarker) map.removeLayer(originMarker);
      if (originCircle) map.removeLayer(originCircle);
      if (!origin) return;

      originMarker = L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({ className: '', html: '<span class="hotel-pin"></span>', iconSize: [24, 24], iconAnchor: [12, 12] })
      }).addTo(map);

      originCircle = L.circle([origin.lat, origin.lng], {
        radius: radiusKm * 1000,
        color: '#c9a460',
        weight: 1.8,
        fillColor: '#e6d2ad',
        fillOpacity: 0.2
      }).addTo(map);
      map.panTo([origin.lat, origin.lng]);
    }

    function clearOrigin() {
      origin = null;
      pickingOrigin = false;
      setOriginBtn.textContent = 'Set Hotel Location';
      originStatus.textContent = 'Hotel pin not set yet.';
      if (originMarker) map.removeLayer(originMarker);
      if (originCircle) map.removeLayer(originCircle);
    }

    function getCity() {
      return cities.find((entry) => entry.id === selectedCity) || cities[0];
    }
  }

  function restoreCity(cities) {
    const query = new URLSearchParams(window.location.search).get('city');
    const saved = KTData.storage.get(KTData.KEYS.city, '');
    const candidate = query || saved || cities[0]?.id;
    return cities.some((city) => city.id === candidate) ? candidate : cities[0]?.id;
  }

  function markerIcon(color, featured) {
    return L.divIcon({
      className: '',
      html: `<span class="map-pin${featured ? ' is-featured' : ''}" style="--pin:${color}"></span>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, -10]
    });
  }

  return { initShabbat };
})();

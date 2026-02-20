window.KTShabbat = (() => {
  const CATEGORY_META = {
    restaurant: { label: 'Kosher Restaurants', icon: '🍽️', color: '#4869b8' },
    grocery: { label: 'Kosher Groceries', icon: '🛒', color: '#4f8b7a' },
    chabad: { label: 'Chabad Houses', icon: '🕍', color: '#8d6bb5' }
  };
  const RADIUS_PRESETS = [0.5, 1.0, 1.2, 1.5, 2.0];

  async function initShabbat() {
    const citySelect = KTUI.qs('#shabbatCitySelect');
    const chipsWrap = KTUI.qs('#shabbatCategoryChips');
    const searchInput = KTUI.qs('#shabbatSearchInput');
    const featuredOnlyToggle = KTUI.qs('#shabbatFeaturedOnlyToggle');
    const verifiedOnlyToggle = KTUI.qs('#shabbatVerifiedOnlyToggle');
    const setOriginBtn = KTUI.qs('#setOriginBtn');
    const useCenterBtn = KTUI.qs('#useCenterBtn');
    const helperText = KTUI.qs('#originHelper');
    const radiusWrap = KTUI.qs('#radiusPresetButtons');
    const radiusValue = KTUI.qs('#radiusValue');
    const exportBtn = KTUI.qs('#exportShabbatBtn');
    const results = KTUI.qs('#shabbatResults');
    const summary = KTUI.qs('#shabbatSummary');

    let cities = [];
    let places = [];
    let selectedCity = '';
    let selectedCategories = new Set();
    let searchTerm = '';
    let radiusKm = 1.2;
    let origin = null;
    let pickingOrigin = false;
    let map;
    let markersLayer;
    let originMarker;
    let originCircle;
    let currentList = [];

    try {
      [cities, places] = await Promise.all([KTData.fetchCities(), KTData.getActivePlacesDataset()]);

      selectedCity = restoreCity(cities);
      citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}, ${city.country}</option>`).join('');
      citySelect.value = selectedCity;
      KTData.storage.set(KTData.KEYS.city, selectedCity);

      radiusWrap.innerHTML = RADIUS_PRESETS.map((value) => `<button type="button" class="chip-button${value === radiusKm ? ' active' : ''}" data-radius="${value}">${value.toFixed(1)} km</button>`).join('');
      chipsWrap.innerHTML = Object.entries(CATEGORY_META).map(([key, meta]) => `<button type="button" class="filter-chip" data-category="${key}"><span>${meta.icon}</span>${meta.label}</button>`).join('');

      map = L.map('shabbatMap');
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);

      citySelect.addEventListener('change', () => {
        selectedCity = citySelect.value;
        KTData.storage.set(KTData.KEYS.city, selectedCity);
        clearOrigin();
        render();
      });

      chipsWrap.addEventListener('click', (event) => {
        const chip = event.target.closest('.filter-chip');
        if (!chip) return;
        const { category } = chip.dataset;
        if (selectedCategories.has(category)) {
          selectedCategories.delete(category);
          chip.classList.remove('active');
        } else {
          selectedCategories.add(category);
          chip.classList.add('active');
        }
        render();
      });

      searchInput.addEventListener('input', KTUI.debounce(() => {
        searchTerm = searchInput.value.trim().toLowerCase();
        render();
      }, 160));
      featuredOnlyToggle.addEventListener('change', render);
      verifiedOnlyToggle.addEventListener('change', render);

      radiusWrap.addEventListener('click', (event) => {
        const button = event.target.closest('[data-radius]');
        if (!button) return;
        radiusKm = Number(button.dataset.radius);
        KTUI.qsa('[data-radius]', radiusWrap).forEach((entry) => entry.classList.toggle('active', entry === button));
        radiusValue.textContent = `${radiusKm.toFixed(1)} km`;
        drawOriginOverlay();
        render();
      });

      setOriginBtn.addEventListener('click', () => {
        pickingOrigin = true;
        helperText.classList.remove('hidden');
      });

      useCenterBtn.addEventListener('click', () => {
        const center = map.getCenter();
        setOrigin({ lat: center.lat, lng: center.lng });
      });

      map.on('click', (event) => {
        if (!pickingOrigin) return;
        setOrigin({ lat: event.latlng.lat, lng: event.latlng.lng });
      });

      results.addEventListener('click', async (event) => {
        const copyBtn = event.target.closest('[data-copy-address]');
        if (!copyBtn) return;
        try {
          await navigator.clipboard.writeText(copyBtn.dataset.copyAddress);
          KTUI.toast('Address copied.', 'success');
        } catch (_error) {
          KTUI.toast('Clipboard unavailable.', 'warning');
        }
      });

      exportBtn.addEventListener('click', async () => {
        if (!currentList.length) {
          KTUI.toast('No places to export yet.', 'warning');
          return;
        }
        const lines = currentList.map((place) => `- ${place.name} (${KTUI.categoryLabel(place.category)}) — ${KTUI.formatDistance(place.distanceKm)}`);
        const payload = [`Shabbat list for ${getCity().name}`, ...lines].join('\n');
        try {
          await navigator.clipboard.writeText(payload);
          KTUI.toast('Shabbat list copied to clipboard.', 'success');
        } catch (_error) {
          KTUI.toast('Clipboard unavailable in this browser.', 'warning');
        }
      });

      render();
    } catch (error) {
      console.error(error);
      results.innerHTML = '<p class="empty-state">Unable to load Shabbat planner data.</p>';
    }

    function setOrigin(value) {
      origin = value;
      pickingOrigin = false;
      helperText.classList.add('hidden');
      setOriginBtn.textContent = 'Change Hotel Location';
      drawOriginOverlay();
      render();
    }

    function render() {
      const city = getCity();
      map.setView(city.center, city.zoom);

      let list = places.filter((place) => place.cityId === city.id);
      if (selectedCategories.size) list = list.filter((place) => selectedCategories.has(place.category));
      if (verifiedOnlyToggle.checked) list = list.filter((place) => place.isVerified);
      if (searchTerm) list = list.filter((place) => (`${place.name} ${place.address}`).toLowerCase().includes(searchTerm));
      list = list.map((place) => ({
        ...place,
        distanceKm: origin ? KTData.haversineDistanceKm(origin.lat, origin.lng, place.lat, place.lng) : null
      }));
      if (origin) list = list.filter((place) => place.distanceKm != null && place.distanceKm <= radiusKm);
      list = featuredOnlyToggle.checked ? KTData.sortPlaces(list) : [...list].sort((a, b) => a.name.localeCompare(b.name));

      currentList = list;
      summary.textContent = origin
        ? `${list.length} walkable places within ${radiusKm.toFixed(1)} km`
        : 'Set your hotel location to see walkable options.';

      renderCards(list);
      requestAnimationFrame(() => renderMarkers(list));
    }

    function renderCards(list) {
      if (!origin) {
        results.innerHTML = '<p class="empty-state">Set your hotel location to see walkable options.</p>';
        return;
      }
      if (!list.length) {
        results.innerHTML = '<p class="empty-state">No places found in the selected walkable radius.</p>';
        return;
      }

      results.innerHTML = list.map((place) => {
        const meta = CATEGORY_META[place.category] || CATEGORY_META.restaurant;
        return `
        <article class="place-card shabbat-card">
          <div class="place-pill-row">
            ${place.isFeatured ? '<span class="pill featured">Featured</span>' : ''}
            ${place.isVerified ? '<span class="pill verified">✓ Verified</span>' : ''}
          </div>
          <h3>${place.name}</h3>
          <p class="muted">${place.address}</p>
          <p class="muted">${meta.icon} ${meta.label}</p>
          ${place.notes ? `<p class="muted note-line">${place.notes}</p>` : ''}
          <p class="distance">${KTUI.formatDistance(place.distanceKm)} walk</p>
          <div class="card-actions">
            <button class="btn btn-ghost" type="button" data-copy-address="${place.address.replace(/"/g, '&quot;')}">Copy address</button>
            <a class="btn btn-primary" href="${KTData.getDirectionsUrl(place, origin)}" target="_blank" rel="noopener noreferrer">Walking Directions</a>
          </div>
        </article>`;
      }).join('');
    }

    function renderMarkers(list) {
      markersLayer.clearLayers();
      list.forEach((place) => {
        const meta = CATEGORY_META[place.category] || CATEGORY_META.restaurant;
        const marker = L.marker([place.lat, place.lng], { icon: markerIcon(meta.color, place.isFeatured) });
        marker.bindPopup(`<strong>${place.name}</strong><br>${KTUI.formatDistance(place.distanceKm)} from hotel`);
        marker.addTo(markersLayer);
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
      helperText.classList.add('hidden');
      setOriginBtn.textContent = 'Set Hotel Location';
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

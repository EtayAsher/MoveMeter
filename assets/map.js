(async function initMapPage() {
  const categories = ['restaurant', 'grocery', 'chabad', 'mikveh'];
  const citySelect = document.getElementById('citySelect');
  const resultsList = document.getElementById('resultsList');
  const categoryChips = document.getElementById('categoryChips');
  const shabbatToggle = document.getElementById('shabbatToggle');
  const shabbatPanel = document.getElementById('shabbatPanel');
  const setOriginBtn = document.getElementById('setOriginBtn');
  const radiusSlider = document.getElementById('radiusSlider');
  const radiusValue = document.getElementById('radiusValue');
  const originHint = document.getElementById('originHint');
  const showResultsBtn = document.getElementById('showResultsBtn');
  const toggleResultsBtn = document.getElementById('toggleResultsBtn');
  const resultsPanel = document.getElementById('resultsPanel');

  let cities = [];
  let places = [];
  let selectedCity = 'london';
  let selectedCategories = new Set();
  let map;
  let markersLayer;
  let selectedCardId = null;
  let shabbatOn = false;
  let pickingOrigin = false;
  let origin = null;
  let originMarker = null;
  let originCircle = null;

  try {
    [cities] = await Promise.all([KT.fetchJSON('data/cities.json')]);
    const override = KT.storage.get('koshertravel_places_override', null);
    places = override || (await KT.fetchJSON('data/places.json'));

    const queryCity = new URLSearchParams(window.location.search).get('city');
    const storedCity = KT.storage.get('koshertravel_city', null);
    selectedCity = queryCity || storedCity || cities[0].id;
    if (!cities.some((c) => c.id === selectedCity)) selectedCity = cities[0].id;

    renderCitySelect();
    renderCategoryChips();
    initLeafletMap();
    attachEvents();
    showLoadingSkeleton();
    window.setTimeout(runPipeline, 220);
  } catch (error) {
    console.error(error);
    resultsList.innerHTML = `<p class="helper">Unable to load map data.</p>`;
  }

  function renderCitySelect() {
    citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}, ${city.country}</option>`).join('');
    citySelect.value = selectedCity;
  }

  function renderCategoryChips() {
    categoryChips.innerHTML = categories
      .map((category) => `<button class="chip" data-category="${category}">${category}</button>`)
      .join('');
  }

  function initLeafletMap() {
    const city = getActiveCity();
    map = L.map('map', { zoomControl: true }).setView(city.center, city.zoom);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);

    markersLayer = L.layerGroup().addTo(map);
  }

  function attachEvents() {
    citySelect.addEventListener('change', () => {
      selectedCity = citySelect.value;
      KT.storage.set('koshertravel_city', selectedCity);
      const city = getActiveCity();
      map.setView(city.center, city.zoom);
      runPipeline();
    });

    categoryChips.addEventListener('click', (event) => {
      const chip = event.target.closest('.chip');
      if (!chip) return;
      const category = chip.dataset.category;
      if (selectedCategories.has(category)) {
        selectedCategories.delete(category);
        chip.classList.remove('active');
      } else {
        selectedCategories.add(category);
        chip.classList.add('active');
      }
      runPipeline();
    });

    shabbatToggle.addEventListener('change', () => {
      shabbatOn = shabbatToggle.checked;
      shabbatPanel.classList.toggle('hidden', !shabbatOn);
      if (!shabbatOn) {
        pickingOrigin = false;
      }
      runPipeline();
    });

    setOriginBtn.addEventListener('click', () => {
      if (!shabbatOn) return;
      pickingOrigin = true;
      setOriginBtn.textContent = 'Click on map...';
    });

    radiusSlider.addEventListener('input', () => {
      radiusValue.textContent = `${Number(radiusSlider.value).toFixed(1)} km`;
      if (origin) renderOriginOverlay();
      runPipeline();
    });

    map.on('click', (event) => {
      if (!pickingOrigin) return;
      origin = { lat: event.latlng.lat, lng: event.latlng.lng };
      pickingOrigin = false;
      setOriginBtn.textContent = 'Set Shabbat Origin';
      renderOriginOverlay();
      runPipeline();
    });

    showResultsBtn.addEventListener('click', () => {
      resultsPanel.classList.remove('collapsed');
    });
    toggleResultsBtn.addEventListener('click', () => {
      resultsPanel.classList.add('collapsed');
    });
  }

  function showLoadingSkeleton() {
    resultsList.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  }

  function runPipeline() {
    const radius = Number(radiusSlider.value);
    radiusValue.textContent = `${radius.toFixed(1)} km`;

    let filtered = places.filter((p) => p.cityId === selectedCity);
    if (selectedCategories.size) {
      filtered = filtered.filter((p) => selectedCategories.has(p.category));
    }

    filtered = filtered.map((p) => {
      if (!origin) return { ...p, distanceKm: null };
      const distanceKm = KT.haversineDistanceKm(origin.lat, origin.lng, p.lat, p.lng);
      return { ...p, distanceKm };
    });

    if (shabbatOn && origin) {
      filtered = filtered.filter((p) => p.distanceKm <= radius);
      originHint.classList.add('hidden');
    } else if (shabbatOn && !origin) {
      originHint.classList.remove('hidden');
    } else {
      originHint.classList.add('hidden');
    }

    const sorted = KT.sortPlaces(filtered);
    renderList(sorted);
    renderMarkers(sorted);
  }

  function renderList(list) {
    if (!list.length) {
      resultsList.innerHTML = '<p class="helper">No places found for current filters.</p>';
      return;
    }

    resultsList.innerHTML = list
      .map((place) => {
        const distance = shabbatOn && origin && place.distanceKm != null
          ? `<p class="helper">${place.distanceKm.toFixed(1)} km walk</p>`
          : '';
        return `
        <article class="place-card ${place.id === selectedCardId ? 'selected' : ''}" data-id="${place.id}">
          <div class="place-header">
            <div>
              <h3>${place.name}</h3>
              <p class="place-meta">${place.address}</p>
            </div>
            <div class="badges">
              ${place.isVerified ? '<span class="badge verified">Verified</span>' : ''}
              ${place.isFeatured ? '<span class="badge featured">Featured</span>' : ''}
            </div>
          </div>
          <p class="place-meta">${place.category.toUpperCase()} • ${place.phone || 'No phone listed'}</p>
          ${distance}
          <div class="card-actions">
            <a class="btn btn-ghost compact" href="${place.website || '#'}" target="_blank" rel="noreferrer">Website</a>
            <a class="btn btn-secondary compact" href="${KT.getDirectionsUrl(place, origin)}" target="_blank" rel="noreferrer">Directions</a>
          </div>
        </article>`;
      })
      .join('');

    resultsList.querySelectorAll('.place-card').forEach((card) => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const place = list.find((p) => p.id === id);
        if (!place) return;
        selectedCardId = id;
        renderList(list);
        panToPlace(place);
      });
    });
  }

  function renderMarkers(list) {
    markersLayer.clearLayers();
    list.forEach((place) => {
      const marker = L.marker([place.lat, place.lng]);
      marker.bindPopup(`<strong>${place.name}</strong><br/>${place.address}`);
      marker.on('click', () => {
        selectedCardId = place.id;
        renderList(list);
      });
      marker.addTo(markersLayer);
    });
  }

  function panToPlace(place) {
    map.setView([place.lat, place.lng], Math.max(map.getZoom(), 14), { animate: true });
    markersLayer.eachLayer((layer) => {
      const latlng = layer.getLatLng();
      if (Math.abs(latlng.lat - place.lat) < 1e-7 && Math.abs(latlng.lng - place.lng) < 1e-7) {
        layer.openPopup();
      }
    });
  }

  function renderOriginOverlay() {
    if (originMarker) map.removeLayer(originMarker);
    if (originCircle) map.removeLayer(originCircle);
    if (!origin) return;

    originMarker = L.marker([origin.lat, origin.lng], {
      icon: L.divIcon({ className: '', html: '<div class="origin-dot"></div>', iconSize: [26, 26], iconAnchor: [13, 13] })
    }).addTo(map);

    originCircle = L.circle([origin.lat, origin.lng], {
      radius: Number(radiusSlider.value) * 1000,
      color: '#c9a227',
      fillColor: '#c9a227',
      fillOpacity: 0.14
    }).addTo(map);

    map.panTo([origin.lat, origin.lng]);
  }

  function getActiveCity() {
    return cities.find((city) => city.id === selectedCity) || cities[0];
  }
})();

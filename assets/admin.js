(async function initAdmin() {
  const PASSCODE = 'KT2026';
  const entered = window.prompt('Enter admin passcode');
  const adminApp = document.getElementById('adminApp');
  const denied = document.getElementById('adminDenied');

  if (entered !== PASSCODE) {
    denied.classList.remove('hidden');
    return;
  }
  adminApp.classList.remove('hidden');

  const citySelect = KTUI.qs('#adminCitySelect');
  const placesList = KTUI.qs('#adminPlacesList');
  const unmappedList = KTUI.qs('#unmappedList');
  const flaggedList = KTUI.qs('#flaggedList');
  const form = KTUI.qs('#placeForm');
  const formTitle = KTUI.qs('#formTitle');
  const clearFormBtn = KTUI.qs('#clearFormBtn');
  const exportJsonBtn = KTUI.qs('#exportJsonBtn');
  const importJsonInput = KTUI.qs('#importJsonInput');
  const resetOverrideBtn = KTUI.qs('#resetOverrideBtn');
  const refreshOsmBtn = KTUI.qs('#refreshOsmBtn');
  const geocodeResults = KTUI.qs('#geocodeResults');
  const findCoordinatesBtn = KTUI.qs('#findCoordinatesBtn');
  const googleGeocodeKey = KTUI.qs('#googleGeocodeKey');
  const saveKeyBtn = KTUI.qs('#saveKeyBtn');

  const fields = {
    id: KTUI.qs('#placeId'),
    name: KTUI.qs('#name'),
    category: KTUI.qs('#category'),
    address: KTUI.qs('#address'),
    phone: KTUI.qs('#phone'),
    website: KTUI.qs('#website'),
    source: KTUI.qs('#source'),
    lat: KTUI.qs('#lat'),
    lng: KTUI.qs('#lng'),
    isVerified: KTUI.qs('#isVerified'),
    isFeatured: KTUI.qs('#isFeatured'),
    featuredRank: KTUI.qs('#featuredRank')
  };

  let cities = await KTData.fetchCities();
  let places = await KTData.getActivePlacesDataset();
  let selectedCity = cities[0]?.id;
  let miniMap;
  let miniMarker;

  citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}, ${city.country}</option>`).join('');
  citySelect.value = selectedCity;
  googleGeocodeKey.value = KTData.storage.get(KTData.KEYS.googleGeocodeKey, '');

  initMiniMap();
  await renderAll();

  citySelect.addEventListener('change', async () => {
    selectedCity = citySelect.value;
    const city = cities.find((entry) => entry.id === selectedCity);
    miniMap.setView(city.center, city.zoom);
    await renderAll();
    clearForm();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const website = KTUI.normalizeWebsite(fields.website.value);
    const latVal = fields.lat.value === '' ? null : Number(fields.lat.value);
    const lngVal = fields.lng.value === '' ? null : Number(fields.lng.value);
    const payload = {
      id: fields.id.value || createId(selectedCity),
      cityId: selectedCity,
      name: fields.name.value.trim(),
      category: fields.category.value,
      address: fields.address.value.trim(),
      phone: fields.phone.value.trim(),
      website,
      source: fields.source.value.trim() || 'manual',
      lat: latVal,
      lng: lngVal,
      isVerified: fields.isVerified.checked,
      isFeatured: fields.isFeatured.checked,
      featuredRank: fields.featuredRank.value ? Number(fields.featuredRank.value) : null
    };

    const existingIndex = places.findIndex((place) => place.id === payload.id);
    if (existingIndex >= 0) places[existingIndex] = payload;
    else places.push(payload);

    persist();
    await renderAll();
    clearForm();
    KTUI.toast('Saved to local override.', 'success');
  });

  clearFormBtn.addEventListener('click', clearForm);

  exportJsonBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(places, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'places.override.json';
    link.click();
    URL.revokeObjectURL(url);
  });

  importJsonInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      window.alert('Imported file must contain a JSON array.');
      return;
    }
    places = parsed.map((place) => ({ ...place, website: KTUI.normalizeWebsite(place.website) }));
    persist();
    await renderAll();
    clearForm();
    KTUI.toast('Imported JSON and saved to override.', 'success');
    event.target.value = '';
  });

  resetOverrideBtn.addEventListener('click', async () => {
    KTData.storage.remove(KTData.KEYS.placesOverride);
    places = await KTData.fetchPlaces();
    places = places.map((place) => ({ ...place, website: KTUI.normalizeWebsite(place.website) }));
    await renderAll();
    clearForm();
    KTUI.toast('Override reset.', 'success');
  });

  refreshOsmBtn.addEventListener('click', async () => {
    const city = cities.find((entry) => entry.id === selectedCity);
    await KTData.loadCityPlaces(city, { forceRefresh: true });
    await renderAll();
    KTUI.toast('OSM cache refreshed for city.', 'success');
  });

  saveKeyBtn.addEventListener('click', () => {
    KTData.storage.set(KTData.KEYS.googleGeocodeKey, googleGeocodeKey.value.trim());
    KTUI.toast('Geocoding key saved locally.', 'success');
  });

  findCoordinatesBtn.addEventListener('click', async () => {
    const query = fields.address.value.trim();
    if (!query) {
      KTUI.toast('Enter an address first.', 'warning');
      return;
    }
    geocodeResults.innerHTML = '<p class="muted">Searching…</p>';
    const results = await geocodeAddress(query);
    if (!results.length) {
      geocodeResults.innerHTML = '<p class="empty-state">No geocoding matches found.</p>';
      return;
    }

    geocodeResults.innerHTML = results.map((item, index) => `
      <article class="admin-place-item">
        <div>
          <strong>${item.label}</strong>
          <p class="muted">${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</p>
        </div>
        <button class="btn btn-primary" type="button" data-use-geo="${index}">Use this</button>
      </article>
    `).join('');

    KTUI.qsa('[data-use-geo]', geocodeResults).forEach((button) => {
      button.addEventListener('click', () => {
        const picked = results[Number(button.dataset.useGeo)];
        applyCoordinates(picked.lat, picked.lng);
      });
    });
  });

  async function geocodeAddress(query) {
    const key = googleGeocodeKey.value.trim();
    if (key) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(key)}`;
        const response = await fetch(url);
        const json = await response.json();
        if (Array.isArray(json.results)) {
          return json.results.slice(0, 5).map((item) => ({
            label: item.formatted_address,
            lat: Number(item.geometry.location.lat),
            lng: Number(item.geometry.location.lng)
          }));
        }
      } catch (_error) {
        KTUI.toast('Google geocoding failed. Falling back to OSM.', 'warning');
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1100));
    const nominatim = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
    const response = await fetch(nominatim, {
      headers: { 'Accept-Language': 'en' }
    });
    const json = await response.json();
    return (json || []).map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon)
    }));
  }

  function applyCoordinates(lat, lng) {
    fields.lat.value = lat.toFixed(6);
    fields.lng.value = lng.toFixed(6);
    miniMap.setView([lat, lng], 15);
    if (miniMarker) miniMap.removeLayer(miniMarker);
    miniMarker = L.marker([lat, lng], { draggable: true }).addTo(miniMap);
    miniMarker.on('dragend', () => {
      const pos = miniMarker.getLatLng();
      fields.lat.value = pos.lat.toFixed(6);
      fields.lng.value = pos.lng.toFixed(6);
    });
  }

  function initMiniMap() {
    const city = cities.find((entry) => entry.id === selectedCity);
    miniMap = L.map('miniMap').setView(city.center, city.zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(miniMap);

    miniMap.on('click', (event) => applyCoordinates(event.latlng.lat, event.latlng.lng));
  }

  async function renderAll() {
    const city = cities.find((entry) => entry.id === selectedCity);
    const loaded = await KTData.loadCityPlaces(city);

    const cityOverrides = KTData.sortPlaces(places.filter((place) => place.cityId === selectedCity));
    renderList(placesList, cityOverrides, 'No mapped override places for this city.', false);
    renderList(unmappedList, loaded.unmappedPlaces, 'No unmapped places.', true);
    renderList(flaggedList, loaded.flaggedPlaces, 'No flagged items.', true);
  }

  function renderList(container, list, emptyText, showReason) {
    if (!list.length) {
      container.innerHTML = `<p class="empty-state">${emptyText}</p>`;
      return;
    }

    container.innerHTML = list.map((place) => `
      <article class="admin-place-item">
        <div>
          <strong>${place.name}</strong>
          <p class="muted">${KTUI.categoryLabel(place.category)} • ${place.address}</p>
          ${showReason && place.flagReason ? `<p class="muted">Flag: ${place.flagReason}</p>` : ''}
        </div>
        <div class="card-actions">
          <button class="btn btn-subtle" data-edit="${place.id}">Edit</button>
          <button class="btn btn-ghost" data-delete="${place.id}">Delete</button>
        </div>
      </article>`).join('');

    KTUI.qsa('[data-edit]', container).forEach((button) => {
      button.addEventListener('click', () => editPlace(button.dataset.edit));
    });

    KTUI.qsa('[data-delete]', container).forEach((button) => {
      button.addEventListener('click', () => deletePlace(button.dataset.delete));
    });
  }

  function editPlace(id) {
    const city = cities.find((entry) => entry.id === selectedCity);
    KTData.loadCityPlaces(city).then((loaded) => {
      const place = [...places, ...loaded.mergedPlaces].find((entry) => entry.id === id);
      if (!place) return;

      fields.id.value = place.id;
      fields.name.value = place.name || '';
      fields.category.value = place.category || 'restaurant';
      fields.address.value = place.address || '';
      fields.phone.value = place.phone || '';
      fields.website.value = place.website || '';
      fields.source.value = place.source || '';
      fields.lat.value = Number.isFinite(place.lat) ? place.lat : '';
      fields.lng.value = Number.isFinite(place.lng) ? place.lng : '';
      fields.isVerified.checked = Boolean(place.isVerified);
      fields.isFeatured.checked = Boolean(place.isFeatured);
      fields.featuredRank.value = place.featuredRank ?? '';
      formTitle.textContent = `Edit place: ${place.name}`;

      if (Number.isFinite(place.lat) && Number.isFinite(place.lng)) applyCoordinates(place.lat, place.lng);
    });
  }

  function deletePlace(id) {
    if (!window.confirm('Delete this override place?')) return;
    places = places.filter((place) => place.id !== id);
    persist();
    renderAll();
    clearForm();
  }

  function clearForm() {
    form.reset();
    fields.id.value = '';
    fields.source.value = 'manual';
    formTitle.textContent = 'Add / Edit place';
  }

  function persist() {
    KTData.storage.set(KTData.KEYS.placesOverride, places);
  }

  function createId(cityId) {
    const count = places.filter((place) => place.cityId === cityId).length + 1;
    return `${cityId.slice(0, 3)}-${String(count).padStart(3, '0')}`;
  }
})();

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

  const citySelect = document.getElementById('adminCitySelect');
  const placesList = document.getElementById('adminPlacesList');
  const form = document.getElementById('placeForm');
  const formTitle = document.getElementById('formTitle');
  const clearFormBtn = document.getElementById('clearFormBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const importJsonInput = document.getElementById('importJsonInput');
  const resetOverrideBtn = document.getElementById('resetOverrideBtn');

  const fields = {
    id: document.getElementById('placeId'),
    name: document.getElementById('name'),
    category: document.getElementById('category'),
    address: document.getElementById('address'),
    phone: document.getElementById('phone'),
    website: document.getElementById('website'),
    lat: document.getElementById('lat'),
    lng: document.getElementById('lng'),
    isVerified: document.getElementById('isVerified'),
    isFeatured: document.getElementById('isFeatured'),
    featuredRank: document.getElementById('featuredRank')
  };

  let cities = await KT.fetchJSON('data/cities.json');
  let places = KT.storage.get('koshertravel_places_override', null) || await KT.fetchJSON('data/places.json');
  let selectedCity = cities[0].id;
  let miniMap;
  let miniMarker;

  citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}, ${city.country}</option>`).join('');

  initMiniMap();
  renderPlacesList();

  citySelect.addEventListener('change', () => {
    selectedCity = citySelect.value;
    const city = cities.find((c) => c.id === selectedCity);
    miniMap.setView(city.center, city.zoom);
    renderPlacesList();
    clearForm();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const editingId = fields.id.value;
    const payload = {
      id: editingId || createId(selectedCity),
      cityId: selectedCity,
      name: fields.name.value.trim(),
      category: fields.category.value,
      address: fields.address.value.trim(),
      phone: fields.phone.value.trim(),
      website: fields.website.value.trim(),
      lat: Number(fields.lat.value),
      lng: Number(fields.lng.value),
      isVerified: fields.isVerified.checked,
      isFeatured: fields.isFeatured.checked,
      featuredRank: fields.featuredRank.value ? Number(fields.featuredRank.value) : null
    };

    const index = places.findIndex((p) => p.id === payload.id);
    if (index >= 0) {
      places[index] = payload;
    } else {
      places.push(payload);
    }

    persist();
    renderPlacesList();
    clearForm();
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
    places = parsed;
    persist();
    renderPlacesList();
    clearForm();
  });

  resetOverrideBtn.addEventListener('click', async () => {
    KT.storage.remove('koshertravel_places_override');
    places = await KT.fetchJSON('data/places.json');
    renderPlacesList();
    clearForm();
  });

  function initMiniMap() {
    const city = cities.find((c) => c.id === selectedCity);
    miniMap = L.map('miniMap').setView(city.center, city.zoom);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(miniMap);

    miniMap.on('click', (event) => {
      fields.lat.value = event.latlng.lat.toFixed(6);
      fields.lng.value = event.latlng.lng.toFixed(6);
      if (miniMarker) miniMap.removeLayer(miniMarker);
      miniMarker = L.marker(event.latlng).addTo(miniMap);
    });
  }

  function renderPlacesList() {
    const cityPlaces = places.filter((p) => p.cityId === selectedCity);

    if (!cityPlaces.length) {
      placesList.innerHTML = '<p class="helper">No places for this city yet.</p>';
      return;
    }

    placesList.innerHTML = cityPlaces
      .map((place) => `
        <article class="admin-place-item">
          <div>
            <strong>${place.name}</strong>
            <p class="helper">${place.category} • ${place.address}</p>
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary compact" data-edit="${place.id}">Edit</button>
            <button class="btn btn-ghost compact" data-delete="${place.id}">Delete</button>
          </div>
        </article>
      `)
      .join('');

    placesList.querySelectorAll('[data-edit]').forEach((button) => {
      button.addEventListener('click', () => editPlace(button.dataset.edit));
    });

    placesList.querySelectorAll('[data-delete]').forEach((button) => {
      button.addEventListener('click', () => deletePlace(button.dataset.delete));
    });
  }

  function editPlace(id) {
    const place = places.find((p) => p.id === id);
    if (!place) return;

    fields.id.value = place.id;
    fields.name.value = place.name;
    fields.category.value = place.category;
    fields.address.value = place.address;
    fields.phone.value = place.phone || '';
    fields.website.value = place.website || '';
    fields.lat.value = place.lat;
    fields.lng.value = place.lng;
    fields.isVerified.checked = Boolean(place.isVerified);
    fields.isFeatured.checked = Boolean(place.isFeatured);
    fields.featuredRank.value = place.featuredRank ?? '';
    formTitle.textContent = `Edit place: ${place.name}`;

    miniMap.setView([place.lat, place.lng], 14);
    if (miniMarker) miniMap.removeLayer(miniMarker);
    miniMarker = L.marker([place.lat, place.lng]).addTo(miniMap);
  }

  function deletePlace(id) {
    if (!window.confirm('Delete this place?')) return;
    places = places.filter((p) => p.id !== id);
    persist();
    renderPlacesList();
    clearForm();
  }

  function clearForm() {
    form.reset();
    fields.id.value = '';
    formTitle.textContent = 'Add new place';
  }

  function persist() {
    KT.storage.set('koshertravel_places_override', places);
  }

  function createId(cityId) {
    const sameCityCount = places.filter((p) => p.cityId === cityId).length + 1;
    return `${cityId.slice(0, 3)}-${String(sameCityCount).padStart(3, '0')}`;
  }
})();

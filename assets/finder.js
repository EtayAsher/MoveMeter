window.KTFinder = (() => {
  const CATEGORY_META = {
    restaurant: { label: 'Kosher Restaurants', icon: '🍽️', color: '#4869b8' },
    grocery: { label: 'Kosher Groceries', icon: '🛒', color: '#4f8b7a' },
    chabad: { label: 'Chabad Houses', icon: '🕍', color: '#8d6bb5' }
  };

  async function initFinder() {
    const citySelect = KTUI.qs('#citySelect');
    const chipsWrap = KTUI.qs('#categoryChips');
    const searchInput = KTUI.qs('#searchInput');
    const featuredOnlyToggle = KTUI.qs('#featuredOnlyToggle');
    const verifiedOnlyToggle = KTUI.qs('#verifiedOnlyToggle');
    const results = KTUI.qs('#resultsList');
    const resultCount = KTUI.qs('#resultCount');
    const shabbatBtn = KTUI.qs('#shabbatPlannerBtn');

    let cities = [];
    let places = [];
    let selectedCity = '';
    let selectedCategories = new Set();
    let searchTerm = '';
    let map;
    let markersLayer;

    try {
      [cities, places] = await Promise.all([KTData.fetchCities(), KTData.getActivePlacesDataset()]);
      selectedCity = restoreCity(cities);
      citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}, ${city.country}</option>`).join('');
      citySelect.value = selectedCity;
      renderChips();

      map = L.map('map', { zoomControl: true, attributionControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
      }).addTo(map);
      markersLayer = L.layerGroup().addTo(map);

      citySelect.addEventListener('change', () => {
        selectedCity = citySelect.value;
        KTData.storage.set(KTData.KEYS.city, selectedCity);
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

      shabbatBtn.addEventListener('click', () => {
        if (!selectedCity) {
          KTUI.toast('Choose a city first', 'warning');
          return;
        }
        window.location.href = `shabbat.html?city=${encodeURIComponent(selectedCity)}`;
      });

      render();
    } catch (error) {
      console.error(error);
      results.innerHTML = '<p class="empty-state">Unable to load finder data.</p>';
    }

    function render() {
      const city = cities.find((entry) => entry.id === selectedCity) || cities[0];
      if (!city) return;
      KTData.storage.set(KTData.KEYS.city, city.id);
      map.setView(city.center, city.zoom);

      let list = places.filter((place) => place.cityId === city.id);
      if (selectedCategories.size) list = list.filter((place) => selectedCategories.has(place.category));
      if (verifiedOnlyToggle.checked) list = list.filter((place) => place.isVerified);
      if (searchTerm) {
        list = list.filter((place) => (`${place.name} ${place.address}`).toLowerCase().includes(searchTerm));
      }
      list = featuredOnlyToggle.checked ? KTData.sortPlaces(list) : [...list].sort((a, b) => a.name.localeCompare(b.name));

      renderResults(list);
      requestAnimationFrame(() => renderMarkers(list));
      resultCount.textContent = `${list.length} places`;
    }

    function renderChips() {
      chipsWrap.innerHTML = Object.entries(CATEGORY_META)
        .map(([key, meta]) => `<button type="button" class="filter-chip" data-category="${key}"><span>${meta.icon}</span>${meta.label}</button>`)
        .join('');
    }

    function renderResults(list) {
      if (!list.length) {
        results.innerHTML = '<p class="empty-state">No places match your city and filters.</p>';
        return;
      }

      results.innerHTML = list.map((place) => cardTemplate(place)).join('');
    }

    function cardTemplate(place) {
      const meta = CATEGORY_META[place.category] || CATEGORY_META.restaurant;
      const hasWebsite = Boolean(place.website);
      return `
      <article class="place-card">
        <div class="place-pill-row">
          ${place.isFeatured ? '<span class="pill featured">Featured</span>' : ''}
          ${place.isVerified ? '<span class="pill verified">✓ Verified</span>' : ''}
        </div>
        <h3>${place.name}</h3>
        <p class="muted">${place.address}</p>
        <p class="muted">${meta.icon} ${meta.label}${place.phone ? ` • ${place.phone}` : ''}</p>
        ${place.notes ? `<p class="muted note-line">${place.notes}</p>` : ''}
        <div class="card-actions">
          ${hasWebsite ? `<a class="btn btn-subtle" href="${place.website}" target="_blank" rel="noopener noreferrer">Website</a>` : ''}
          <button class="btn btn-ghost" type="button" data-copy-address="${place.address.replace(/"/g, '&quot;')}">Copy address</button>
          <a class="btn btn-primary" href="${KTData.getDirectionsUrl(place)}" target="_blank" rel="noopener noreferrer">Walking Directions</a>
        </div>
      </article>`;
    }

    function renderMarkers(list) {
      markersLayer.clearLayers();
      list.forEach((place) => {
        const meta = CATEGORY_META[place.category] || CATEGORY_META.restaurant;
        const marker = L.marker([place.lat, place.lng], {
          icon: markerIcon(meta.color, place.isFeatured)
        });
        marker.bindPopup(`<strong>${place.name}</strong><br>${meta.label}<br>${place.address}`);
        marker.addTo(markersLayer);
      });
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

  return { initFinder };
})();

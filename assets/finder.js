window.KTFinder = (() => {
  const CATEGORIES = ['chabad', 'restaurant', 'grocery'];
  let map;
  let markersLayer;
  let cities = [];
  let places = [];
  let selectedCityId = '';
  let activeCategory = 'all';

  async function init() {
    const citySelect = document.getElementById('citySelect');
    const categoryFilters = document.getElementById('categoryFilters');

    cities = await KTData.fetchCities();
    places = await KTData.fetchPlaces();

    selectedCityId = localStorage.getItem(KTData.STORAGE_KEY) || cities[0]?.id || 'london';
    if (!cities.some((city) => city.id === selectedCityId)) selectedCityId = cities[0]?.id;

    citySelect.innerHTML = cities.map((city) => `<option value="${city.id}">${city.name}</option>`).join('');
    citySelect.value = selectedCityId;

    categoryFilters.innerHTML = [
      '<button type="button" class="chip active" data-category="all">All</button>',
      ...CATEGORIES.map((category) => `<button type="button" class="chip" data-category="${category}">${KTData.CATEGORY_META[category].label}</button>`)
    ].join('');

    citySelect.addEventListener('change', () => {
      selectedCityId = citySelect.value;
      localStorage.setItem(KTData.STORAGE_KEY, selectedCityId);
      render();
    });

    categoryFilters.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-category]');
      if (!button) return;
      activeCategory = button.dataset.category;
      [...categoryFilters.querySelectorAll('button')].forEach((entry) => entry.classList.toggle('active', entry === button));
      render();
    });

    map = L.map('map', { zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);

    render();
  }

  function render() {
    const city = cities.find((entry) => entry.id === selectedCityId) || cities[0];
    const resultsList = document.getElementById('resultsList');
    const resultCount = document.getElementById('resultCount');

    map.setView(city.center, city.zoom);

    const cityPlaces = places
      .filter((place) => place.cityId === city.id)
      .filter((place) => activeCategory === 'all' || place.category === activeCategory);

    resultCount.textContent = `${cityPlaces.length} places`;

    if (!cityPlaces.length) {
      resultsList.innerHTML = '<p class="empty">No verified places yet for this city.</p>';
      markersLayer.clearLayers();
      return;
    }

    resultsList.innerHTML = cityPlaces.map((place) => {
      const meta = KTData.CATEGORY_META[place.category] || KTData.CATEGORY_META.restaurant;
      const websiteButton = KTData.isRealWebsite(place.website)
        ? `<a class="btn btn-soft" href="${place.website}" target="_blank" rel="noopener noreferrer">Website</a>`
        : '';

      return `<article class="card">
        <h3>${place.name}</h3>
        <p><span class="badge" style="--badge:${meta.color}">${meta.label}</span></p>
        <p class="muted">${place.address}</p>
        <div class="actions">
          ${websiteButton}
          <a class="btn btn-primary" href="${KTData.getDirectionsUrl(place)}" target="_blank" rel="noopener noreferrer">Walking directions</a>
          <a class="btn btn-soft" href="${KTData.getOpenInGoogleMapsUrl(place)}" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
        </div>
      </article>`;
    }).join('');

    markersLayer.clearLayers();
    cityPlaces.forEach((place) => {
      const meta = KTData.CATEGORY_META[place.category] || KTData.CATEGORY_META.restaurant;
      L.marker([place.lat, place.lng], { icon: markerIcon(meta.color) })
        .bindPopup(`<strong>${place.name}</strong><br>${place.address}`)
        .addTo(markersLayer);
    });
  }

  function markerIcon(color) {
    return L.divIcon({
      className: '',
      html: `<span class="pin" style="--pin:${color}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  return { init };
})();

window.KTFinder = (() => {
  const CATEGORIES = ['chabad', 'restaurant', 'grocery'];
  let map;
  let markersLayer;
  let cities = [];
  let places = [];
  let selectedCityId = '';
  let activeCategory = 'all';
  let includeReported = false;

  async function init() {
    const citySelect = document.getElementById('citySelect');
    const categoryFilters = document.getElementById('categoryFilters');
    const reportedToggle = document.getElementById('reportedToggle');

    cities = await KTData.fetchCities();
    places = await KTData.fetchPlaces();

    selectedCityId = localStorage.getItem(KTData.STORAGE_KEY) || cities[0]?.id || 'newyork';
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

    reportedToggle.addEventListener('change', () => {
      includeReported = reportedToggle.checked;
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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '&copy; OpenStreetMap contributors &copy; CARTO' }).addTo(map);
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
      .filter((place) => includeReported ? ['verified', 'reported', 'needsCheck'].includes(place.certificationLevel) : place.certificationLevel === 'verified')
      .filter((place) => activeCategory === 'all' || place.category === activeCategory);

    resultCount.textContent = `${cityPlaces.length} places`;
    if (!cityPlaces.length) {
      resultsList.innerHTML = '<p class="empty">No places found for this filter.</p>';
      markersLayer.clearLayers();
      return;
    }

    resultsList.innerHTML = cityPlaces.map((place) => {
      const meta = KTData.CATEGORY_META[place.category];
      const cert = KTData.CERTIFICATION_META[place.certificationLevel] || KTData.CERTIFICATION_META.reported;
      const websiteButton = KTData.isRealWebsite(place.website) ? `<a class="btn btn-secondary" href="${place.website}" target="_blank" rel="noopener noreferrer">Website</a>` : '';
      return `<article class="card">
        <h3>${place.name}</h3>
        <p class="badges"><span class="badge" style="--badge:${meta.color}">${meta.label}</span><span class="badge cert" style="--badge:${cert.color}">${cert.label}</span></p>
        <p class="muted">${place.fullAddress}</p>
        <div class="actions">
          ${websiteButton}
          <a class="btn btn-primary" href="${KTData.getDirectionsUrl(place)}" target="_blank" rel="noopener noreferrer">Walking directions</a>
        </div>
      </article>`;
    }).join('');

    markersLayer.clearLayers();
    cityPlaces.forEach((place) => {
      const meta = KTData.CATEGORY_META[place.category];
      const cert = KTData.CERTIFICATION_META[place.certificationLevel] || KTData.CERTIFICATION_META.reported;
      L.marker([place.lat, place.lng], { icon: markerIcon(meta.color) })
        .bindPopup(`<strong>${place.name}</strong><br>${place.fullAddress}<br><small style="color:${cert.color}">${cert.label}</small>`)
        .addTo(markersLayer);
    });
  }

  function markerIcon(color) {
    return L.divIcon({ className: '', html: `<span class="pin" style="--pin:${color}"></span>`, iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  return { init };
})();

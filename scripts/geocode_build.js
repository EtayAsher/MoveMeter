#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SOURCES_PATH = path.join(ROOT, 'data', 'sources', 'places_sources.json');
const CITIES_PATH = path.join(ROOT, 'data', 'cities.json');
const OUTPUT_PATH = path.join(ROOT, 'data', 'places.json');
const FLAGGED_PATH = path.join(ROOT, 'data', 'flagged.json');
const UNMAPPED_PATH = path.join(ROOT, 'data', 'unmapped.json');

const REQUEST_DELAY_MS = 1200;
const MAX_DISTANCE_KM = 30;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (n) => (n * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'KosherTravel-Geocoder/2.0 (curated-dataset-build)' }
  });
  if (!response.ok) throw new Error(`Nominatim request failed (${response.status})`);
  const results = await response.json();
  return Array.isArray(results) ? results[0] : null;
}

async function main() {
  const [rawSources, rawCities] = await Promise.all([fs.readFile(SOURCES_PATH, 'utf8'), fs.readFile(CITIES_PATH, 'utf8')]);
  const sources = JSON.parse(rawSources);
  const cities = JSON.parse(rawCities);
  const cityById = new Map(cities.map((c) => [c.id, c]));

  const places = [];
  const flagged = [];
  const unmapped = [];

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    const city = cityById.get(source.cityId);
    if (!city) {
      flagged.push({ ...source, reason: `Unknown cityId: ${source.cityId}` });
      continue;
    }

    if (i > 0) await sleep(REQUEST_DELAY_MS);

    let result;
    try {
      result = await geocode(source.fullAddress);
    } catch (error) {
      unmapped.push({ ...source, reason: error.message });
      continue;
    }

    if (!result) {
      unmapped.push({ ...source, reason: 'No geocoding result returned' });
      continue;
    }

    const lat = Number(result.lat);
    const lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      unmapped.push({ ...source, reason: 'Invalid coordinates' });
      continue;
    }

    const [cityLat, cityLng] = city.center;
    const fromCenter = haversineKm(cityLat, cityLng, lat, lng);
    if (fromCenter > MAX_DISTANCE_KM) {
      flagged.push({ ...source, geocoded_lat: lat, geocoded_lng: lng, geocode_display_name: result.display_name || '', distance_from_city_center_km: Number(fromCenter.toFixed(3)), reason: `Distance from city center exceeds ${MAX_DISTANCE_KM}km` });
      continue;
    }

    places.push({
      id: source.id,
      cityId: source.cityId,
      category: source.category,
      name: source.name,
      fullAddress: source.fullAddress,
      website: source.website || '',
      lat,
      lng,
      certificationLevel: source.certificationLevel || 'reported'
    });
  }

  await Promise.all([
    fs.writeFile(OUTPUT_PATH, `${JSON.stringify(places, null, 2)}\n`),
    fs.writeFile(FLAGGED_PATH, `${JSON.stringify(flagged, null, 2)}\n`),
    fs.writeFile(UNMAPPED_PATH, `${JSON.stringify(unmapped, null, 2)}\n`)
  ]);

  console.log(`Geocoded: ${places.length}`);
  console.log(`Flagged: ${flagged.length}`);
  console.log(`Unmapped: ${unmapped.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

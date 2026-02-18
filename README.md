# KosherTravel — Static MVP

A fully static GitHub Pages MVP for finding kosher places with a premium dark map interface.

## What works

- City-based Finder + interactive Leaflet map.
- Category filters (restaurant, grocery, chabad, mikveh).
- Featured and Verified sorting/badges.
- Shabbat Mode with clickable origin, radius filtering, and walking distances.
- Directions links to Google Maps.
- Admin page (`admin.html`) with local passcode (`KT2026`) and in-browser add/edit/delete.
- Admin local override persisted to `localStorage` key `koshertravel_places_override`.
- JSON import/export workflow for static CMS operations.

## Data files

- `data/cities.json`: city metadata.
- `data/places.json`: curated realistic sample places by city.
- Last updated: 2026-02-18.

## Run locally

```bash
python3 -m http.server 8000
```

Then open:

- Home: `http://localhost:8000/index.html`
- Finder: `http://localhost:8000/map.html`
- Admin: `http://localhost:8000/admin.html`

## Deployment

No build step required. Works directly on GitHub Pages.

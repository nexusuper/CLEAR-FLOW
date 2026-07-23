import { useEffect, useRef, useState } from 'react';
import { STORE_LAT, STORE_LNG } from '@/lib/products';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Module-level so re-mounts (or a second instance) reuse one load, not one per mount.
let leafletPromise = null;
function loadLeaflet() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const existing = document.getElementById('leaflet-js');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.L));
      existing.addEventListener('error', () => reject(new Error('leaflet load failed')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = LEAFLET_JS;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error('leaflet load failed'));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// Optional delivery-pin map. value: {lat,lng}|null. onChange(null) clears.
// No react-leaflet — vanilla L.* only, no new dependency.
export default function LocationPicker({ value, onChange }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [query, setQuery] = useState('');
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Refs can't be written during render — keep the latest onChange for
  // callbacks/effects that fire later (drag, geolocation, search).
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  function emit(lat, lng) {
    onChangeRef.current({ lat: round6(lat), lng: round6(lng) });
  }

  function placeMarker(L, map, lat, lng) {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      return;
    }
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    marker.on('dragend', () => {
      const { lat: la, lng: ln } = marker.getLatLng();
      emit(la, ln);
    });
    markerRef.current = marker;
  }

  function recenterAndPlace(lat, lng) {
    const L = window.L;
    const map = mapRef.current;
    if (map && L) {
      map.setView([lat, lng], 16);
      placeMarker(L, map, lat, lng);
    }
    emit(lat, lng);
  }

  function clearPin() {
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    onChangeRef.current(null);
  }

  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then(() => { if (!cancelled) setReady(true); })
      .catch(() => { if (!cancelled) setLoadError('Map failed to load — pin search and GPS still work below.'); });
    return () => { cancelled = true; };
  }, []);

  // Init map once Leaflet is ready. Runs once (guarded by mapRef).
  useEffect(() => {
    if (!ready || !elRef.current || mapRef.current) return;
    const L = window.L;
    const start = value?.lat != null && value?.lng != null ? [value.lat, value.lng] : [STORE_LAT, STORE_LNG];
    const map = L.map(elRef.current).setView(start, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    mapRef.current = map;

    if (value?.lat != null && value?.lng != null) placeMarker(L, map, value.lat, value.lng);

    map.on('click', (e) => {
      placeMarker(L, map, e.latlng.lat, e.latlng.lng);
      emit(e.latlng.lat, e.latlng.lng);
    });

    return () => { map.remove(); mapRef.current = null; markerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Keep marker synced if parent clears/sets the pin from outside (e.g. Clear pin).
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;
    if (value?.lat != null && value?.lng != null) {
      placeMarker(L, map, value.lat, value.lng);
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);

  function useMyLocation() {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser.');
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        recenterAndPlace(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setGeoBusy(false);
        setGeoError(err.code === err.PERMISSION_DENIED ? 'Location permission denied.' : 'Could not get your location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function doSearch() {
    setSearchError('');
    const q = query.trim();
    if (!q) return;
    setSearchBusy(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
      const results = await res.json();
      if (!results.length) {
        setSearchError('No results found. Try a different search.');
        return;
      }
      recenterAndPlace(parseFloat(results[0].lat), parseFloat(results[0].lon));
    } catch {
      setSearchError('Search failed. Check your connection.');
    } finally {
      setSearchBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div ref={elRef} className="w-full rounded-2xl clay-inset overflow-hidden" style={{ height: 256 }} />
      {!ready && !loadError && <p className="text-xs text-clay-muted font-semibold">Loading map…</p>}
      {loadError && <p className="text-xs text-clay-danger">{loadError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={useMyLocation} disabled={geoBusy} className="clay-raised-sm rounded-full px-3 py-2 text-xs font-semibold text-clay-skydeep clay-pressable disabled:opacity-60">
          📍 {geoBusy ? 'Locating…' : 'Use my location'}
        </button>
        {value?.lat != null && (
          <button type="button" onClick={clearPin} className="text-xs font-semibold text-clay-danger hover:underline">Clear pin</button>
        )}
      </div>
      {geoError && <p className="text-clay-danger text-xs">{geoError}</p>}

      <div className="flex gap-2">
        <label htmlFor="location_search" className="sr-only">Search an address</label>
        <input
          id="location_search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } }}
          placeholder="Search an address…"
          className="clay-input flex-1 text-sm"
        />
        <button type="button" onClick={doSearch} disabled={searchBusy} className="clay-raised-sm rounded-full px-4 py-2 text-xs font-semibold text-clay-skydeep clay-pressable disabled:opacity-60 whitespace-nowrap">
          {searchBusy ? '…' : 'Search'}
        </button>
      </div>
      {searchError && <p className="text-clay-danger text-xs">{searchError}</p>}

      {value?.lat != null && value?.lng != null && (
        <p className="text-xs text-clay-muted font-semibold">Pinned: {value.lat}, {value.lng}</p>
      )}
    </div>
  );
}

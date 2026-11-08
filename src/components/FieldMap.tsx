import { useEffect, useMemo, useRef, useState } from "react";
import type { MapLayer, MapRecord } from "@/lib/demo-data";
import { FieldMapLegend, MAP_LAYER_COLORS as colors, TRACKER_MARKER_COLOR } from "./FieldMapLegend";

type FieldMapProps = {
  records: MapRecord[];
  activeLayers: Set<MapLayer>;
  onSelect: (record: MapRecord) => void;
  selectedId?: string;
  scope: "internal" | "sponsor" | "public";
};

type GoogleMapInstance = {
  setCenter: (position: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type WeatherSnapshot = {
  area: string;
  temperature: number | null;
  precipitationNextSixHours: number | null;
  windSpeed: number | null;
  weatherCode: number | null;
  updatedAt: string;
};

declare global {
  interface Window {
    mewsMapsReady?: () => void;
    gm_authFailure?: () => void;
    google?: { maps?: { Map: new (element: Element, options: object) => GoogleMapInstance; Marker: new (options: object) => { setMap: (map: GoogleMapInstance | null) => void; addListener: (name: string, handler: () => void) => void } } };
  }
}

const weatherPoints = [
  { area: "Miami-Dade weather cell", lat: 25.78, lng: -80.22 },
  { area: "Broward weather cell", lat: 26.12, lng: -80.16 },
  { area: "Miami Beach weather cell", lat: 25.79, lng: -80.13 },
  { area: "South Dade weather cell", lat: 25.47, lng: -80.48 },
];

function weatherDetail(snapshot: WeatherSnapshot) {
  const temperature = snapshot.temperature == null ? "temperature unavailable" : `${Math.round(snapshot.temperature)}°C`;
  const rain = snapshot.precipitationNextSixHours == null ? "rain outlook unavailable" : `${snapshot.precipitationNextSixHours.toFixed(1)} mm forecast / 6 h`;
  const wind = snapshot.windSpeed == null ? "wind unavailable" : `${Math.round(snapshot.windSpeed)} km/h wind`;
  return `Live planning context · ${temperature} · ${rain} · ${wind}`;
}

function weatherStatus(snapshot: WeatherSnapshot) {
  if ((snapshot.precipitationNextSixHours ?? 0) >= 8) return "Heavy rain / cover review";
  if ((snapshot.precipitationNextSixHours ?? 0) >= 2) return "Rain-cover review";
  if ((snapshot.temperature ?? 0) >= 32) return "Heat-shade review";
  return "Weather planning";
}

export function visibleRadiusMeters(record: MapRecord, scope: "internal" | "sponsor" | "public") {
  // Internal and sponsor users can see the same operational precision, but
  // only internal members receive feeder/contact information elsewhere in the
  // product. Public viewers are always rounded to at least 500 m.
  if (scope === "public") return Math.max(500, record.internalRadiusMeters * 2.4);
  return record.internalRadiusMeters;
}

function fallbackRadiusPixels(record: MapRecord, scope: "internal" | "sponsor" | "public") {
  const meters = visibleRadiusMeters(record, scope);
  return Math.min(145, Math.max(scope === "public" ? 38 : 13, meters / (scope === "public" ? 13 : 9)));
}

let mapsLoading: Promise<void> | null = null;
let mapsAuthFailed = false;
function loadGoogleMaps(key: string) {
  const maps = window.google?.maps as any;
  if (mapsAuthFailed) return Promise.reject(new Error("Map authorization failed"));
  if (typeof maps?.Map === "function" && typeof maps?.Marker === "function") return Promise.resolve();
  if (mapsLoading) return mapsLoading;
  if (typeof maps?.importLibrary === "function") {
    mapsLoading = Promise.all([maps.importLibrary("maps"), maps.importLibrary("marker")]).then(() => undefined);
    return mapsLoading;
  }
  mapsLoading = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Map loading timed out")), 15000);
    const fail = () => { clearTimeout(timeout); reject(new Error("Map script could not load")); };
    window.mewsMapsReady = () => { clearTimeout(timeout); resolve(); };
    window.gm_authFailure = () => { mapsAuthFailed = true; dispatchEvent(new Event("mews-map-auth-failed")); fail(); };
    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=mewsMapsReady`;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return mapsLoading;
}

export function FieldMap({ records, activeLayers, onSelect, selectedId, scope }: FieldMapProps) {
  const mapHost = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<GoogleMapInstance | null>(null);
  const overlays = useRef<{ setMap: (map: GoogleMapInstance | null) => void }[]>([]);
  const trackerFocused = useRef(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [mapsFailed, setMapsFailed] = useState(false);
  const [trackerTick, setTrackerTick] = useState(0);
  const [trackerRunning, setTrackerRunning] = useState(true);
  const [followTracker, setFollowTracker] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.reduceMotion === 'true');
  const [weather, setWeather] = useState<WeatherSnapshot[]>([]);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const weatherRecords = useMemo<MapRecord[]>(() => weather.map((snapshot, index) => ({
    id: `weather-${index}`,
    title: snapshot.area,
    area: snapshot.area,
    position: { lat: weatherPoints[index].lat, lng: weatherPoints[index].lng },
    layer: "weather",
    status: weatherStatus(snapshot),
    detail: weatherDetail(snapshot),
    locationSignal: "unconfirmed-report",
    confidence: .88,
    internalRadiusMeters: 16_000,
    observedAt: `Live source updated ${snapshot.updatedAt}`,
  })), [weather]);
  const visibleRecords = useMemo(() => [...records, ...weatherRecords].filter((record) => activeLayers.has(record.layer)), [records, weatherRecords, activeLayers]);
  const renderedRecords = useMemo(() => visibleRecords.map((record) => {
    const simulatedPosition = record.id === "live-scout" && scope !== "public" ? {
      lat: record.position.lat + Math.sin(trackerTick / 2) * .0022,
      lng: record.position.lng + Math.cos(trackerTick / 2) * .0028,
    } : record.position;
    return {
      ...record,
      position: scope === "public" ? { lat: Math.round(simulatedPosition.lat * 100) / 100, lng: Math.round(simulatedPosition.lng * 100) / 100 } : simulatedPosition,
      observedAt: record.id === "live-scout" ? `Simulated tracker · ${trackerRunning && !reducedMotion ? 'updates every 6 sec' : 'paused'}` : record.observedAt,
    };
  }), [trackerTick, visibleRecords, scope, trackerRunning, reducedMotion]);

  const hasTracker = renderedRecords.some(record => record.id === 'live-scout');

  useEffect(() => {
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReducedMotion(preference.matches || document.documentElement.dataset.reduceMotion==='true');
    const observer=new MutationObserver(update);
    observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});
    preference.addEventListener('change',update); update();
    return()=>{observer.disconnect();preference.removeEventListener('change',update);};
  },[]);

  useEffect(() => {
    if (!hasTracker || !trackerRunning || reducedMotion) return;
    const interval = window.setInterval(() => setTrackerTick((tick) => tick + 1), 6000);
    return () => window.clearInterval(interval);
  }, [hasTracker, trackerRunning, reducedMotion]);

  useEffect(() => {
    const tracker = records.find((record) => record.id === "live-scout");
    if (tracker && !trackerFocused.current) {
      trackerFocused.current = true;
      onSelect(tracker);
    }
  }, [onSelect, records]);

  useEffect(() => {
    let cancelled = false;
    async function loadWeather() {
      try {
        const results = await Promise.all(weatherPoints.map(async (point) => {
          const params = new URLSearchParams({ latitude: String(point.lat), longitude: String(point.lng), current: "temperature_2m,wind_speed_10m,weather_code", hourly: "precipitation", forecast_days: "1", timezone: "America/New_York" });
          const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) throw new Error("Weather source unavailable");
          const data = await response.json() as { current?: { temperature_2m?: number; wind_speed_10m?: number; weather_code?: number; time?: string }; hourly?: { time?: string[]; precipitation?: number[] } };
          const now = data.current?.time ?? new Date().toISOString();
          const start = Math.max(0, data.hourly?.time?.findIndex((time) => time >= now) ?? 0);
          const precipitation = data.hourly?.precipitation?.length && data.hourly.time?.length ? data.hourly.precipitation.slice(start, start + 6).reduce((sum, value) => sum + Number(value || 0), 0) : null;
          return { area: point.area, temperature: data.current?.temperature_2m ?? null, precipitationNextSixHours: precipitation, windSpeed: data.current?.wind_speed_10m ?? null, weatherCode: data.current?.weather_code ?? null, updatedAt: data.current?.time ?? "just now" };
        }));
        if (!cancelled) { setWeather(results); setWeatherFailed(false); }
      } catch {
        if (!cancelled) { setWeather([]); setWeatherFailed(true); }
      }
    }
    void loadWeather();
    const interval = window.setInterval(() => void loadWeather(), 15 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const authFailure = () => { if (!cancelled) { setMapsFailed(true); setGoogleReady(false); } };
    addEventListener("mews-map-auth-failed", authFailure);
    fetch("/api/config")
      .then((response) => response.ok && response.headers.get("content-type")?.includes("application/json") ? response.json() : {})
      .then((config: { googleMapsBrowserKey?: string | null }) => {
        if (!config.googleMapsBrowserKey || cancelled) return;
        return loadGoogleMaps(config.googleMapsBrowserKey).then(() => {
          if (!cancelled) setGoogleReady(true);
        });
      })
      .catch(() => { if (!cancelled) setMapsFailed(true); });
    return () => { cancelled = true; removeEventListener("mews-map-auth-failed", authFailure); };
  }, []);

  useEffect(() => {
    if (!googleReady || !mapHost.current || !window.google?.maps || mapInstance.current) return;
    const Maps = window.google.maps as any;
    try { mapInstance.current = new Maps.Map(mapHost.current, {
      center: { lat: 25.83, lng: -80.23 },
      zoom: 10,
      minZoom: 8,
      maxZoom: 18,
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      restriction: { latLngBounds: { north: 26.45, south: 25.1, east: -79.85, west: -80.9 }, strictBounds: false },
      styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }],
    }); } catch { setMapsFailed(true); setGoogleReady(false); return; }
    return () => {
      overlays.current.forEach((overlay) => overlay.setMap(null));
      overlays.current = [];
      mapInstance.current = null;
    };
  }, [googleReady]);

  useEffect(() => {
    const record = renderedRecords.find((item) => item.id === selectedId);
    if (!googleReady || !mapInstance.current || !record) return;
    mapInstance.current.setCenter(record.position);
    mapInstance.current.setZoom(record.locationSignal === "live-tag" ? 14 : 13);
    // Selection changes focus the existing map; tracker pings preserve the user's zoom.
  }, [googleReady, selectedId]);

  useEffect(() => {
    const tracker=renderedRecords.find(record=>record.id==='live-scout');
    if(googleReady&&followTracker&&tracker)mapInstance.current?.setCenter(tracker.position);
  },[followTracker,googleReady,renderedRecords]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !window.google?.maps) return;
    overlays.current.forEach((overlay) => overlay.setMap(null));
    const nextOverlays: { setMap: (map: GoogleMapInstance | null) => void }[] = [];
    renderedRecords.forEach((record) => {
      const Maps = window.google!.maps as any;
      const circle = new Maps.Circle({
        map,
        center: record.position,
        radius: visibleRadiusMeters(record, scope),
        fillColor: colors[record.layer],
        fillOpacity: scope === "public" ? .18 : .12,
        strokeColor: colors[record.layer],
        strokeOpacity: .72,
        strokeWeight: 1.25,
        clickable: false,
      });
      const marker = new Maps.Marker({
        map,
        position: record.position,
        title: scope === "public" && record.layer !== "weather" ? `${record.layer} activity area · synthetic demo` : record.id === "live-scout" ? "LIVE demo tracker · Skipper" : record.layer === "weather" ? `${record.title} · live weather planning` : `${record.title} · synthetic demo`,
        label: record.id === "live-scout" && scope !== "public" ? { text: "LIVE", color: "#123f54", fontWeight: "700", fontSize: "9px" } : undefined,
        icon: { path: 0, fillColor: record.id === "live-scout" ? TRACKER_MARKER_COLOR : colors[record.layer], fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: record.id === "live-scout" ? 14 : record.layer === "urgent" ? 9 : record.layer === "weather" ? 11 : 7 },
      });
      marker.addListener("click", () => onSelect(record));
      nextOverlays.push(circle, marker);
    });
    overlays.current = nextOverlays;
  }, [googleReady, onSelect, scope, renderedRecords]);

  return <><div className="field-map" aria-label="Interactive South Florida field map">
    <div className="field-map-actions">{googleReady && <button type="button" className="map-overview-button" onClick={() => { setFollowTracker(false); mapInstance.current?.setCenter({ lat: 25.83, lng: -80.23 }); mapInstance.current?.setZoom(10); }}>Show South Florida</button>}{hasTracker&&<><button type="button" className="map-overview-button" disabled={reducedMotion} aria-pressed={!trackerRunning||reducedMotion} onClick={()=>setTrackerRunning(value=>!value)}>{reducedMotion?'Tracker paused · reduced motion':trackerRunning?'Pause simulated tracker':'Resume simulated tracker'}</button>{googleReady&&<button type="button" className="map-overview-button" aria-pressed={followTracker} onClick={()=>setFollowTracker(value=>!value)}>{followTracker?'Stop following Skipper':'Follow Skipper'}</button>}</>}</div>
    <div ref={mapHost} className={googleReady ? "google-map active" : "google-map"} aria-hidden={!googleReady} />
    {!googleReady && <div className="map-fallback" role="group" aria-label="Synthetic South Florida map preview with approximate demo markers">
      <div className="fallback-water water-east" /><div className="fallback-water water-west" />
      <span className="fallback-label broward">BROWARD</span><span className="fallback-label miami">MIAMI-DADE</span><span className="fallback-label keys">SOUTH DADE</span>
      {renderedRecords.map((record) => <div key={record.id} className={record.id === "live-scout" ? "fallback-record tracker-ping" : "fallback-record"} style={{ left: `${((record.position.lng + 80.9) / 1.05) * 100}%`, top: `${((26.45 - record.position.lat) / 1.35) * 100}%` }}>
        <span className={`probability-ring ${record.layer}`} style={{ width: fallbackRadiusPixels(record, scope) * 2, height: fallbackRadiusPixels(record, scope) * 2, color: colors[record.layer] }} />
        <button className={`map-pin ${record.layer} ${selectedId === record.id ? "selected" : ""}`} style={{ backgroundColor: record.id === "live-scout" ? TRACKER_MARKER_COLOR : colors[record.layer] }} aria-label={`${record.title}, ${record.area}, synthetic demo`} onClick={() => onSelect(record)} />
      </div>)}
    </div>}
    <div className="map-provider-status">{googleReady ? `Google Maps · ${scope} search radii · ${renderedRecords.some((record) => record.id === "live-scout") ? "SIMULATED Skipper tracker" : "synthetic demo records"}${weather.length ? " · weather cells refreshed" : weatherFailed ? " · weather unavailable" : ""}` : mapsFailed ? "Map unavailable · showing local synthetic preview" : "Synthetic preview · Google Maps loading or unconfigured"}</div>
  </div><FieldMapLegend activeLayers={activeLayers} scope={scope} hasTracker={hasTracker}/></>;
}

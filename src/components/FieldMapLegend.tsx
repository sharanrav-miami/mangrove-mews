import type { MapLayer } from "@/lib/demo-data";
import "./FieldMapLegend.css";

/** Shared by the Google overlays, local preview, and their visible key. */
export const MAP_LAYER_COLORS: Record<MapLayer, string> = {
  colonies: "#2c7a5e",
  sightings: "#277da1",
  urgent: "#c7533f",
  hazards: "#a66a16",
  searches: "#7755ad",
  feeding: "#23785d",
  weather: "#287ba2",
};
export const TRACKER_MARKER_COLOR = "#43b8df";
const labels: Record<MapLayer, string> = {
  colonies: "Colony groups",
  sightings: "Cat observations",
  urgent: "Urgent care reviews",
  feeding: "Feeding visits",
  hazards: "Fictional hazards",
  searches: "Missing-cat search suggestions",
  weather: "Weather context · large circles",
};
const orderedLayers: MapLayer[] = ["colonies", "sightings", "urgent", "feeding", "hazards", "searches", "weather"];

export function FieldMapLegend({ activeLayers, scope, hasTracker }: { activeLayers: Set<MapLayer>; scope: "internal" | "sponsor" | "public"; hasTracker: boolean }) {
  const layers = orderedLayers.filter(layer => activeLayers.has(layer) && (layer !== "searches" || scope === "internal"));
  return <section className="field-map-legend" aria-labelledby="field-map-legend-title">
    <h3 id="field-map-legend-title">Map legend</h3>
    <ul>{layers.map(layer => <li key={layer}><span className="field-map-legend-dot" style={{ backgroundColor: MAP_LAYER_COLORS[layer] }} aria-hidden="true"/><span>{labels[layer]}</span></li>)}
      {hasTracker && scope !== "public" && <li><span className="field-map-legend-dot field-map-legend-tracker" style={{ backgroundColor: TRACKER_MARKER_COLOR, outlineColor: MAP_LAYER_COLORS.sightings }} aria-hidden="true"/><span>Skipper · simulated tracker</span></li>}
    </ul>
    {!layers.length && <p>Turn on a map layer to see its key.</p>}
    <p><span className="field-map-legend-radius" aria-hidden="true"/>A filled dot marks a record. Its shaded circle shows a planning area, not a measured probability. Select a dot for details.</p>
    <small>{scope === "public" ? "Public activity areas use a radius of at least 500 m." : "Team and sponsor radii vary with the displayed location context. Skipper is a fictional tag simulation."} {activeLayers.has("weather") && "Weather circles provide broad planning context."}</small>
  </section>;
}

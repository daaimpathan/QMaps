import type { VehicleRoute } from '../types';

// Kept in sync with api/main.py. These saturated inks stay distinct from
// OSM's land, road and water colors, even when an older API process is running.
const ROUTE_PALETTE = [
  '#2457D6', // cobalt
  '#D43F35', // vermilion
  '#7544C8', // violet
  '#007B78', // deep teal
  '#C02E68', // berry
  '#B45B00', // amber orange
  '#385A2B', // forest
  '#374151', // graphite
];

export const routeDisplayColorAt = (index: number) => ROUTE_PALETTE[Math.max(0, index) % ROUTE_PALETTE.length];

export const routeDisplayColor = (route: VehicleRoute, routes: VehicleRoute[]) => {
  const index = routes.findIndex((item) => item.route_id === route.route_id);
  return routeDisplayColorAt(index < 0 ? 0 : index);
};

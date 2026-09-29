'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import {
  NaviLocation,
  VehicleRoute,
  TrafficSegment,
} from '../types';
import { routeDisplayColor } from '../utils/routeColor';

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] as string));

const formatWindowTime = (minutesFromEight: number) => {
  const total = 8 * 60 + minutesFromEight;
  const hours = Math.floor(total / 60) % 24;
  const minutes = total % 60;
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

interface MapProps {
  depot: NaviLocation;
  deliveries: NaviLocation[];
  routes?: VehicleRoute[];
  trafficSegments?: TrafficSegment[];
  selectedVehicleId?: string; // If in driver mode or highlighting a single vehicle
  role: 'admin' | 'driver';
  completedStopNumbers?: number[]; // For driver mode
  onMapClick?: (lat: number, lng: number) => void;
  onRemoveDelivery?: (id: number) => void;
}

export const MapComponent: React.FC<MapProps> = ({
  depot,
  deliveries,
  routes = [],
  trafficSegments = [],
  selectedVehicleId,
  role,
  completedStopNumbers = [],
  onMapClick,
  onRemoveDelivery,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const visibleRoutes = selectedVehicleId
    ? routes.filter((route) => route.vehicle.id === selectedVehicleId)
    : routes;
  const driverFocusRoute = role === 'driver' ? visibleRoutes[0] : undefined;
  const driverFocusGeometry = driverFocusRoute?.road_geometry;
  const firstRoutePoint = driverFocusGeometry?.[0];
  const lastRoutePoint = driverFocusGeometry?.[driverFocusGeometry.length - 1];
  const routeFocusKey = driverFocusRoute && driverFocusGeometry && firstRoutePoint && lastRoutePoint
    ? `${driverFocusRoute.route_id}:${driverFocusGeometry.length}:${firstRoutePoint.join(',')}:${lastRoutePoint.join(',')}`
    : '';

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Center on Navi Mumbai (Turbhe / Vashi Hub)
      const map = L.map(mapContainerRef.current, {
        center: [19.0771, 73.0125],
        zoom: 12,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
      }).addTo(map);

      layersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Click handler for Admin to add stops
    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (role === 'admin' && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [role, onMapClick]);

  useEffect(() => {
    const geometry = driverFocusRoute?.road_geometry;
    const map = mapInstanceRef.current;
    if (!map || !geometry || geometry.length < 2) return;
    map.fitBounds(L.latLngBounds(geometry), { padding: [48, 48], maxZoom: 17 });
  }, [role, selectedVehicleId, routeFocusKey]);

  // Redraw layers whenever data changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layersGroupRef.current) return;

    const layersGroup = layersGroupRef.current;
    layersGroup.clearLayers();

    // 1. Draw road-following vehicle routes with a light casing so the colors
    // remain legible over OSM streets, parks, water and map labels.
    visibleRoutes.forEach((route) => {
      // Never draw a straight stop-to-stop approximation as a driving route.
      const latlngs = route.road_geometry;
      if (!latlngs || latlngs.length < 2) return;
      const routeColor = routeDisplayColor(route, routes);

      const routeWeight = selectedVehicleId ? 6.5 : 5.5;
      layersGroup.addLayer(L.polyline(latlngs, {
        color: '#fffdf7',
        weight: routeWeight + 5,
        opacity: 0.96,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }));

      const polyline = L.polyline(latlngs, {
        color: routeColor,
        weight: routeWeight,
        opacity: 0.98,
        lineCap: 'round',
        lineJoin: 'round',
      });

      polyline.bindTooltip(
        `<div class="p-1 font-sans">
          <div class="font-bold text-xs" style="color: ${routeColor}">${escapeHtml(route.vehicle.name)}</div>
          <div class="text-[11px] text-stone-700">Driver: ${escapeHtml(route.vehicle.driver_name)}</div>
          <div class="text-[11px] text-stone-600">Road distance: ${route.road_distance_km ?? route.total_distance_km} km | Drive: ${route.road_driving_time_min ?? route.total_travel_time_min} min</div>
          <div class="text-[10px] text-olive-600 font-semibold">Load: ${route.total_demand} / ${route.vehicle.capacity} kg (${route.capacity_usage_pct}%)</div>
        </div>`,
        { sticky: true }
      );

      layersGroup.addLayer(polyline);

      // Small direction chevrons make the active line read like a navigation route.
      const arrowStride = Math.max(8, Math.floor(latlngs.length / 5));
      for (let index = arrowStride; index < latlngs.length - 1; index += arrowStride) {
        const from = latlngs[index];
        const to = latlngs[index + 1];
        const east = (to[1] - from[1]) * Math.cos((from[0] * Math.PI) / 180);
        const north = to[0] - from[0];
        // The SVG chevron points east at 0°; convert a north-based bearing.
        const angle = (Math.atan2(east, north) * 180) / Math.PI - 90;
        const arrow = L.divIcon({
          className: 'route-direction-pin',
          html: `<div style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;transform:rotate(${angle}deg);filter:drop-shadow(0 1px 1px rgba(25,32,20,.5))"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 2 10 6-10 6 2-6-2-6Z" fill="${routeColor}" stroke="#fffdf7" stroke-width="1.8" stroke-linejoin="round"/></svg></div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });
        layersGroup.addLayer(L.marker(from, { icon: arrow, interactive: false, keyboard: false, zIndexOffset: 400 }));
      }
    });

    // 2. Draw traffic overlays above routes. Manual slowdowns get a bright,
    // dashed corridor, white casing and endpoint pins so the operator can spot
    // exactly which modeled leg they edited.
    trafficSegments.forEach((seg) => {
      const isManual = seg.segment_id.startsWith('manual-');
      const isIncident = seg.segment_id.startsWith('incident-');
      const color = isManual || isIncident
        ? '#c9362b'
        : seg.status === 'warning'
        ? '#c9362b'
        : seg.status === 'caution'
        ? '#d98512'
        : '#16805d';
      const weight = isIncident ? 8 : isManual ? 7 : 5;
      const tooltip = `<div class="p-1 font-sans">
        ${isIncident ? '<div class="mb-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-800">Modeled incident</div>' : isManual ? '<div class="mb-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-red-800">Admin-defined slowdown</div>' : ''}
        <div class="font-bold text-xs">${escapeHtml(seg.road_name)}</div>
        <div class="text-[11px] text-stone-600">${escapeHtml(seg.condition)} · ${seg.speed_kmh} km/h modeled</div>
        ${seg.delay_min > 0 ? `<div class="text-[10px] font-semibold text-red-700">+${seg.delay_min} min modeled delay</div>` : ''}
      </div>`;

      layersGroup.addLayer(L.polyline(seg.coords, {
        color: '#fffdf7',
        weight: weight + (isManual || isIncident ? 7 : 4),
        opacity: 0.96,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }));
      const trafficLine = L.polyline(seg.coords, {
        color,
        weight,
        opacity: 0.98,
        dashArray: isManual || isIncident ? '8 7' : seg.status !== 'clear' ? '5 6' : '2 7',
        lineCap: 'round',
        lineJoin: 'round',
      });
      trafficLine.bindTooltip(tooltip, { sticky: true });
      layersGroup.addLayer(trafficLine);

      if (isManual) {
        [seg.coords[0], seg.coords[seg.coords.length - 1]].forEach((point, endpointIndex) => {
          const endpoint = L.circleMarker(point, {
            radius: 6,
            color: '#fffdf7',
            weight: 3,
            fillColor: color,
            fillOpacity: 1,
          });
          endpoint.bindTooltip(`${endpointIndex === 0 ? 'Slowdown starts' : 'Slowdown ends'} · ${escapeHtml(seg.road_name)}`, { sticky: true });
          layersGroup.addLayer(endpoint);
        });
      }
      if (isIncident && seg.coords.length > 0) {
        const midpoint = seg.coords[Math.floor(seg.coords.length / 2)];
        const incidentIcon = L.divIcon({
          className: 'simulated-traffic-incident',
          html: '<div style="display:flex;width:28px;height:28px;align-items:center;justify-content:center;border:2px solid white;border-radius:9999px;background:#c9362b;color:white;font-weight:900;font-size:15px;box-shadow:0 2px 8px rgba(28,25,23,.35)">!</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const incidentMarker = L.marker(midpoint, { icon: incidentIcon, zIndexOffset: 900 });
        incidentMarker.bindTooltip(tooltip, { sticky: true });
        layersGroup.addLayer(incidentMarker);
      }
    });

    // 3. Draw Depot Marker
    const depotIconHtml = `
      <div class="relative flex items-center justify-center">
        <div class="w-10 h-10 rounded-2xl bg-olive-600 border-2 border-white shadow-xl flex items-center justify-center text-white font-bold text-xs">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <span class="absolute -bottom-5 whitespace-nowrap bg-stone-900/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow">
          DEPOT
        </span>
      </div>
    `;

    const depotIcon = L.divIcon({
      html: depotIconHtml,
      className: 'custom-depot-pin',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const depotMarker = L.marker([depot.lat, depot.lng], { icon: depotIcon });
    depotMarker.bindPopup(
      `<div class="p-2 font-sans">
        <div class="font-bold text-sm text-olive-700">${escapeHtml(depot.name)}</div>
        <div class="text-xs text-stone-600 mt-1">Central Logistics Dispatch Terminal</div>
        <div class="text-xs text-stone-500 mt-1">Operating Hours: 08:00 AM - 04:00 PM</div>
      </div>`
    );
    layersGroup.addLayer(depotMarker);

    // 4. Draw Delivery Markers
    // Determine which stops to show:
    // If in driver mode and selectedVehicleId is active, only show stops of that vehicle
    let stopsToShow = role === 'driver' ? [] : deliveries;
    if (selectedVehicleId && role === 'driver') {
      const activeRoute = routes.find((r) => r.vehicle.id === selectedVehicleId);
      if (activeRoute) {
        // filter deliveries in this route
        const routeCustIds = new Set(activeRoute.customer_ids);
        stopsToShow = deliveries.filter((d) => routeCustIds.has(d.id));
      }
    }

    stopsToShow.forEach((deliv) => {
      // Find route assignment if any
      let assignedRoute: VehicleRoute | undefined;
      let stopSeqNumber: number | undefined;

      for (const r of routes) {
        const foundStop = r.stops.find((s) => s.location_id === deliv.id);
        if (foundStop) {
          assignedRoute = r;
          stopSeqNumber = foundStop.stop_number;
          break;
        }
      }

      const isCompleted = stopSeqNumber ? completedStopNumbers.includes(stopSeqNumber) : false;
      const nextStopNumber = driverFocusRoute?.stops.find((stop) => stop.type === 'customer' && !completedStopNumbers.includes(stop.stop_number))?.stop_number;
      const isNextStop = role === 'driver' && stopSeqNumber !== undefined && stopSeqNumber === nextStopNumber;
      const pinColor = isCompleted ? '#596842' : isNextStop ? '#e5a52e' : assignedRoute ? routeDisplayColor(assignedRoute, routes) : '#63743d';
      const pinTextColor = isNextStop ? '#26301c' : '#ffffff';
      const safeShortName = escapeHtml(deliv.name.split(' ')[0]);

      const deliveryIconHtml = `
        <div class="relative flex items-center justify-center transition-transform hover:scale-110 ${isNextStop ? 'rounded-full ring-4 ring-amber-300/90' : ''}">
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center font-bold text-xs" style="background-color: ${pinColor};color:${pinTextColor}">
            ${isCompleted ? '✓' : stopSeqNumber ?? deliv.id}
          </div>
          <span class="absolute -bottom-4 whitespace-nowrap ${isNextStop ? 'bg-olive-950 text-white' : 'bg-white/95 text-stone-800'} border border-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-sm max-w-[90px] truncate">
            ${isNextStop ? 'NEXT' : safeShortName}
          </span>
        </div>
      `;

      const delivIcon = L.divIcon({
        html: deliveryIconHtml,
        className: 'custom-delivery-pin',
        iconSize: isNextStop ? [44, 44] : [32, 32],
        iconAnchor: isNextStop ? [22, 22] : [16, 16],
      });

      const marker = L.marker([deliv.lat, deliv.lng], { icon: delivIcon });

      const popupContent = `
        <div class="p-2 font-sans min-w-[180px]">
          <div class="font-bold text-sm text-stone-900">${escapeHtml(deliv.name)}</div>
          <div class="text-xs text-stone-600 mt-1">
            <span class="font-semibold text-stone-700">Demand:</span> ${deliv.demand} kg
          </div>
          <div class="text-xs text-stone-600">
            <span class="font-semibold text-stone-700">Window:</span> ${formatWindowTime(deliv.ready_time)} - ${formatWindowTime(deliv.due_date)}
          </div>
          <div class="text-xs text-stone-600">
            <span class="font-semibold text-stone-700">Service:</span> ${deliv.service_time} min
          </div>
          ${
            assignedRoute
              ? `<div class="mt-2 text-xs font-semibold px-2 py-0.5 rounded text-white" style="background-color: ${routeDisplayColor(assignedRoute, routes)}">
                  Assigned: ${escapeHtml(assignedRoute.vehicle.name)} (Stop #${stopSeqNumber})
                </div>`
              : `<div class="mt-2 text-[10px] text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Unassigned / Ready to optimize
                </div>`
          }
          ${
            role === 'admin' && onRemoveDelivery
              ? `<button id="del-btn-${deliv.id}" class="mt-2 text-xs text-rose-600 hover:text-rose-800 font-medium underline block">
                  Remove Stop
                </button>`
              : ''
          }
        </div>
      `;

      marker.bindPopup(popupContent);

        marker.on('popupopen', () => {
          const btn = document.getElementById(`del-btn-${deliv.id}`);
          if (btn && onRemoveDelivery) {
            btn.onclick = () => {
              onRemoveDelivery(deliv.id);
              marker.closePopup();
            };
          }
        });

      layersGroup.addLayer(marker);
    });
  }, [depot, deliveries, routes, trafficSegments, selectedVehicleId, role, completedStopNumbers, onRemoveDelivery]);

  return (
    <div className="relative w-full h-full min-h-[420px] bg-stone-100 rounded-2xl overflow-hidden border border-stone-200/80 shadow-sm">
      <div ref={mapContainerRef} className="w-full h-full min-h-[420px]" />

      {/* Floating Traffic & Map Legend */}
      <div className={`absolute z-[500] max-h-[min(68vh,520px)] max-w-[min(280px,calc(100%-24px))] overflow-y-auto rounded-xl border border-sand-300/90 bg-[#fbf9f2]/95 px-3 py-2.5 text-xs shadow-[0_8px_30px_-16px_rgba(32,40,23,.55)] backdrop-blur-md ${role === 'driver' ? 'driver-map-legend bottom-3 left-3 sm:bottom-4 sm:left-4' : 'right-3 top-3 sm:right-4 sm:top-4'}`}>
        <div className="mb-1.5 flex items-center justify-between gap-4 font-semibold text-stone-800">
          <span>Map key</span>
          <span className="text-[10px] font-medium text-stone-400">OSM · road geometry</span>
        </div>
        <div className="space-y-1 text-[11px] text-stone-600">
          {visibleRoutes.length > 0 && (
            <div className={`mb-1 flex items-center gap-1.5 font-semibold ${visibleRoutes.every((route) => route.street_routing_status === 'ready') ? 'text-olive-700' : 'text-rose-700'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${visibleRoutes.every((route) => route.street_routing_status === 'ready') ? 'bg-olive-500' : 'bg-rose-500'}`} />
              <span>{visibleRoutes.every((route) => route.street_routing_status === 'ready') ? 'Road-following directions active' : 'Street route unavailable'}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-md bg-olive-800" />
            <span>Turbhe Central Depot</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-olive-700 ring-2 ring-white" />
            <span>Delivery stop · numbered sequence</span>
          </div>
          {role === 'driver' && <div className="flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-full bg-amber-400 ring-2 ring-amber-200" /><span>Next stop</span></div>}
          {visibleRoutes.map((route) => (
            <div key={route.route_id} className="flex items-center gap-2">
              <span className="inline-block h-[5px] w-5 rounded-full border border-white shadow-sm" style={{ backgroundColor: routeDisplayColor(route, routes) }} />
              <span className="truncate">{route.vehicle.name}</span>
            </div>
          ))}
          {trafficSegments.some((segment) => segment.segment_id.startsWith('incident-')) && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-1.5 py-1 font-semibold text-red-800">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-red-700 text-[10px] text-white">!</span>
              <span>Simulated active incident · auto-reroute</span>
            </div>
          )}
          {trafficSegments.some((segment) => segment.segment_id.startsWith('manual-')) && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 px-1.5 py-1 text-red-800">
              <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-red-700" />
              <span>Manual slowdown · marked endpoints</span>
            </div>
          )}
          {trafficSegments.some((segment) => !segment.segment_id.startsWith('manual-') && segment.status === 'warning') && (
            <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-red-700" /><span>Modeled heavy congestion</span></div>
          )}
          {trafficSegments.some((segment) => !segment.segment_id.startsWith('manual-') && segment.status === 'caution') && (
            <div className="flex items-center gap-2"><span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-amber-600" /><span>Modeled slowdown</span></div>
          )}
        </div>

        {role === 'admin' && (
          <div className="mt-2 border-t border-sand-200 pt-2 text-[10px] font-medium leading-4 text-olive-700">
            Click the map to add a delivery stop. Traffic marks are modeled or admin-entered.
          </div>
        )}
      </div>
    </div>
  );
};

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Crosshair, Minus, Plus, RotateCcw, Truck, X } from 'lucide-react';
import { NaviLocation, OptimizationResult, TrafficSegment, VehicleRoute } from '../types';
import { routeDisplayColorAt } from '../utils/routeColor';

interface RouteAtlas3DProps {
  depot: NaviLocation;
  deliveries: NaviLocation[];
  result: OptimizationResult | null;
  isOptimizing: boolean;
  algorithmName: string;
  trafficSegments: TrafficSegment[];
  onRunOptimization: () => void;
}

interface Point {
  x: number;
  y: number;
}

type Selection =
  | { type: 'stop'; location: NaviLocation }
  | { type: 'vehicle'; route: VehicleRoute }
  | { type: 'road'; segment: TrafficSegment | null }
  | null;

const CITY_CENTER_X = 430;
const CITY_CENTER_Y = 250;
const CITY_HALF_WIDTH = 310;
const CITY_HALF_HEIGHT = 150;
const GRID = [0.11, 0.305, 0.5, 0.695, 0.89];
const BUILDING_SHADES = ['#78866c', '#8c987c', '#65765e', '#9ca68b', '#72816a'];

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function makeProjector(locations: NaviLocation[], result: OptimizationResult | null, segments: TrafficSegment[]) {
  const allCoordinates: Array<[number, number]> = locations.map((location) => [location.lat, location.lng]);
  result?.routes.forEach((route) => {
    route.road_geometry?.forEach((coordinate) => allCoordinates.push(coordinate));
    route.stops.forEach((stop) => allCoordinates.push([stop.lat, stop.lng]));
  });
  segments.forEach((segment) => segment.coords.forEach((coordinate) => allCoordinates.push(coordinate)));

  const bounds = allCoordinates.reduce((current, [lat, lng]) => ({
    minLat: Math.min(current.minLat, lat),
    maxLat: Math.max(current.maxLat, lat),
    minLng: Math.min(current.minLng, lng),
    maxLng: Math.max(current.maxLng, lng),
  }), {
    minLat: allCoordinates[0][0],
    maxLat: allCoordinates[0][0],
    minLng: allCoordinates[0][1],
    maxLng: allCoordinates[0][1],
  });
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.006);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.006);
  const latPad = latSpan * 0.13;
  const lngPad = lngSpan * 0.13;
  const minLat = bounds.minLat - latPad;
  const maxLat = bounds.maxLat + latPad;
  const minLng = bounds.minLng - lngPad;
  const maxLng = bounds.maxLng + lngPad;

  const projectUV = (u: number, v: number): Point => ({
    x: CITY_CENTER_X + (u - v) * CITY_HALF_WIDTH,
    y: CITY_CENTER_Y + (u + v - 1) * CITY_HALF_HEIGHT,
  });

  const project = (lat: number, lng: number): Point => {
    const u = Math.max(0, Math.min(1, (lng - minLng) / (maxLng - minLng)));
    const v = Math.max(0, Math.min(1, (maxLat - lat) / (maxLat - minLat)));
    return projectUV(u, v);
  };
  return { project, projectUV };
}

function pointPath(points: Point[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

function buildingPath(points: Point[], height = 0) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${(point.y - height).toFixed(1)}`).join(' ') + 'Z';
}

function routePoints(route: VehicleRoute, project: (lat: number, lng: number) => Point) {
  const hasRoadGeometry = Boolean(route.road_geometry && route.road_geometry.length > 1);
  const coordinates = hasRoadGeometry ? route.road_geometry! : route.stops.map((stop) => [stop.lat, stop.lng] as [number, number]);
  return { hasRoadGeometry, points: coordinates.map(([lat, lng]) => project(lat, lng)) };
}

function buildBuildings(project: (u: number, v: number) => Point) {
  const blocks: Array<{ key: string; points: Point[]; height: number; shade: string; centerY: number; park: boolean }> = [];
  for (let row = 0; row < GRID.length - 1; row += 1) {
    for (let column = 0; column < GRID.length - 1; column += 1) {
      const park = (row === 1 && column === 0) || (row === 2 && column === 3);
      const padU = (GRID[column + 1] - GRID[column]) * 0.13;
      const padV = (GRID[row + 1] - GRID[row]) * 0.13;
      const u0 = GRID[column] + padU;
      const u1 = GRID[column + 1] - padU;
      const v0 = GRID[row] + padV;
      const v1 = GRID[row + 1] - padV;
      const points = [
        project(u0, v0),
        project(u1, v0),
        project(u1, v1),
        project(u0, v1),
      ];
      const seed = (row * 7 + column * 11 + 3) % 13;
      blocks.push({
        key: `${row}-${column}`,
        points,
        height: park ? 0 : 15 + (seed % 5) * 7 + (seed > 8 ? 11 : 0),
        shade: BUILDING_SHADES[seed % BUILDING_SHADES.length],
        centerY: (points[1].y + points[2].y) / 2,
        park,
      });
    }
  }
  return blocks.sort((a, b) => a.centerY - b.centerY);
}

function candidateOrders(depot: NaviLocation, deliveries: NaviLocation[]) {
  const byName = [...deliveries].sort((a, b) => a.name.localeCompare(b.name));
  return [
    deliveries,
    [...deliveries].reverse(),
    [...deliveries].sort((a, b) => a.lng - b.lng),
    byName,
  ].filter((order, index, all) => order.length > 1 && all.findIndex((item) => item.map((stop) => stop.id).join(',') === order.map((stop) => stop.id).join(',')) === index)
    .map((order) => [depot, ...order, depot]);
}

function routeSequence(route: VehicleRoute) {
  return route.stops.map((stop) => stop.type === 'depot' ? 'Depot' : `Stop ${String(stop.stop_number).padStart(2, '0')}`).join('  →  ');
}

function stopWindow(location: NaviLocation) {
  const format = (minutes: number) => {
    const totalMinutes = 8 * 60 + minutes;
    const hours24 = Math.floor(totalMinutes / 60) % 24;
    const hours = hours24 % 12 || 12;
    const minutesPart = String(totalMinutes % 60).padStart(2, '0');
    return `${hours}:${minutesPart} ${hours24 >= 12 ? 'PM' : 'AM'}`;
  };
  return `${format(location.ready_time)} – ${format(location.due_date)}`;
}

const VanMarker: React.FC<{ title: string; onSelect?: () => void; interactive?: boolean }> = ({ title, onSelect, interactive }) => (
  <g
    role={interactive ? 'button' : undefined}
    tabIndex={interactive ? 0 : undefined}
    aria-label={interactive ? title : undefined}
    data-interactive={interactive ? 'true' : undefined}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (interactive && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        onSelect?.();
      }
    }}
    className="atlas-van-marker"
  >
    <ellipse cx="2" cy="8" rx="19" ry="6" fill="#101810" opacity=".42" />
    <path d="m-16-7 11-7 18 10-11 7Z" fill="#f1f0e5" stroke="#263522" strokeWidth="1" />
    <path d="m-16-7 18 10v11l-18-10Z" fill="#a6b77e" stroke="#263522" strokeWidth="1" />
    <path d="M2 3 13-4V7L2 14Z" fill="#657858" stroke="#263522" strokeWidth="1" />
    <path d="m4 1 6-4 4 2-6 4Z" fill="#c8d4b2" />
    <circle cx="-10" cy="5" r="3.2" fill="#1e271d" stroke="#ebe9db" strokeWidth="1" />
    <circle cx="7" cy="12" r="3.2" fill="#1e271d" stroke="#ebe9db" strokeWidth="1" />
    <title>{title}</title>
  </g>
);

export const RouteAtlas3D: React.FC<RouteAtlas3DProps> = ({
  depot,
  deliveries,
  result,
  isOptimizing,
  algorithmName,
  trafficSegments,
  onRunOptimization,
}) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<{ type: 'orbit'; x: number; y: number } | { type: 'pinch'; distance: number; zoom: number } | null>(null);
  const searchRef = useRef({ wasOptimizing: false, resultAtStart: result });
  const [camera, setCamera] = useState({ pitch: 0, yaw: -4 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [isConverging, setIsConverging] = useState(false);
  const locations = useMemo(() => [depot, ...deliveries], [depot, deliveries]);
  const routes = result?.routes ?? [];
  const { project, projectUV } = useMemo(() => makeProjector(locations, result, trafficSegments), [locations, result, trafficSegments]);
  const buildings = useMemo(() => buildBuildings(projectUV), [projectUV]);
  const orders = useMemo(() => candidateOrders(depot, deliveries), [depot, deliveries]);
  const selectedRoute = selection?.type === 'vehicle'
    ? routes.find((route) => route.route_id === selection.route.route_id) ?? routes[0]
    : routes[0];
  const previewOrder = useMemo(() => orders[0] ?? [depot, ...deliveries, depot], [orders, depot, deliveries]);
  const previewPoints = useMemo(() => previewOrder.map((location) => project(location.lat, location.lng)), [previewOrder, project]);
  const previewPath = useMemo(() => pointPath(previewPoints), [previewPoints]);
  const candidatePaths = useMemo(
    () => orders.map((order) => pointPath(order.map((location) => project(location.lat, location.lng)))),
    [orders, project],
  );
  const routeDrawings = useMemo(() => routes.map((route, index) => {
    const geometry = routePoints(route, project);
    return {
      route,
      index,
      points: geometry.points,
      path: pointPath(geometry.points),
      hasRoadGeometry: geometry.hasRoadGeometry,
      pathId: `atlas-route-${route.route_id.replace(/[^a-zA-Z0-9_-]/g, '-')}`,
    };
  }), [routes, project]);
  const trafficDrawings = useMemo(() => trafficSegments.map((segment) => ({
    segment,
    path: pointPath(segment.coords.map(([lat, lng]) => project(lat, lng))),
  })), [trafficSegments, project]);
  const deliveryMarkers = useMemo(() => deliveries.map((location, index) => ({
    location,
    index,
    point: project(location.lat, location.lng),
  })), [deliveries, project]);
  const shouldShowPreview = !routes.length;
  const showCandidatePaths = isOptimizing || isConverging;

  useEffect(() => {
    if (isOptimizing) {
      if (!searchRef.current.wasOptimizing) searchRef.current.resultAtStart = result;
      searchRef.current.wasOptimizing = true;
      setIsConverging(false);
      return;
    }
    if (!searchRef.current.wasOptimizing) return;
    searchRef.current.wasOptimizing = false;
    if (!result || result === searchRef.current.resultAtStart) return;
    setIsConverging(true);
    const timeout = window.setTimeout(() => setIsConverging(false), 1850);
    return () => window.clearTimeout(timeout);
  }, [isOptimizing, result]);

  const updateZoom = (delta: number) => setZoom((current) => Math.max(0.76, Math.min(1.32, Number((current + delta).toFixed(2)))));

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[data-interactive="true"]')) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (pointersRef.current.size === 1) {
      gestureRef.current = { type: 'orbit', x: event.clientX, y: event.clientY };
    } else if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      gestureRef.current = { type: 'pinch', distance: distance(first, second), zoom };
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    if (!gesture) return;
    if (gesture.type === 'pinch' && pointersRef.current.size >= 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const initialDistance = Math.max(1, gesture.distance);
      setZoom(Math.max(0.76, Math.min(1.32, gesture.zoom * (distance(first, second) / initialDistance))));
      return;
    }
    if (gesture.type === 'orbit') {
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      gestureRef.current = { type: 'orbit', x: event.clientX, y: event.clientY };
      setCamera((current) => ({
        yaw: Math.max(-24, Math.min(24, current.yaw + dx * 0.18)),
        pitch: Math.max(-12, Math.min(16, current.pitch - dy * 0.12)),
      }));
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size === 0) {
      gestureRef.current = null;
      setIsDragging(false);
    }
    else {
      const remaining = Array.from(pointersRef.current.values())[0];
      gestureRef.current = { type: 'orbit', x: remaining.x, y: remaining.y };
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateZoom(event.deltaY < 0 ? 0.06 : -0.06);
  };

  const resetCamera = () => {
    setCamera({ pitch: 0, yaw: -4 });
    setZoom(1);
  };

  const stopClick = (event: React.SyntheticEvent) => event.stopPropagation();
  const onRoadHitKeyDown = (event: React.KeyboardEvent<SVGPathElement>, segment: TrafficSegment | null) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelection({ type: 'road', segment });
    }
  };

  return (
    <div
      ref={stageRef}
      className="route-atlas-stage"
      role="group"
      aria-label="Interactive QMaps isometric city. Drag to orbit, scroll or pinch to zoom, and select a vehicle, stop, or road for details."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
    >
      <div className="route-atlas-glow" aria-hidden="true" />
      <div className="atlas-city-status" aria-live="polite">
        <span className={`atlas-status-light${isOptimizing ? ' is-searching' : ''}`} />
        <span>{isOptimizing ? `SEARCHING · ${algorithmName}` : result ? `OPTIMIZED · ${result.algorithm.name}` : 'CITY NETWORK · READY'}</span>
      </div>
      <div className="atlas-city-controls" data-interactive="true" aria-label="City camera controls">
        <button type="button" data-interactive="true" aria-label="Zoom in" title="Zoom in" onPointerDown={stopClick} onClick={() => updateZoom(0.1)}><Plus size={14} /></button>
        <button type="button" data-interactive="true" aria-label="Zoom out" title="Zoom out" onPointerDown={stopClick} onClick={() => updateZoom(-0.1)}><Minus size={14} /></button>
        <button type="button" data-interactive="true" aria-label="Reset camera" title="Reset camera" onPointerDown={stopClick} onClick={resetCamera}><RotateCcw size={13} /></button>
      </div>

      <div className={`route-atlas-object${isDragging ? ' is-dragging' : ''}`} style={{ '--atlas-tilt-x': `${camera.pitch}deg`, '--atlas-tilt-y': `${camera.yaw}deg`, '--atlas-camera-zoom': zoom } as React.CSSProperties}>
        <svg className="route-atlas-svg" viewBox="0 0 860 535" role="img" aria-labelledby="route-atlas-title route-atlas-description">
          <title id="route-atlas-title">QMaps interactive route city</title>
          <desc id="route-atlas-description">A low-poly isometric city using current QMaps delivery locations, road geometry, route assignments, and optimization results.</desc>
          <defs>
            <filter id="atlas-platform-shadow" x="-35%" y="-35%" width="170%" height="190%">
              <feDropShadow dx="0" dy="16" stdDeviation="15" floodColor="#11190f" floodOpacity=".42" />
            </filter>
            <filter id="atlas-route-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4.2" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <pattern id="atlas-surface-grid" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="skewY(-26)">
              <path d="M22 0H0V22" fill="none" stroke="#bbc6a8" strokeOpacity=".065" strokeWidth="1" />
            </pattern>
          </defs>

          <ellipse cx="430" cy="450" rx="345" ry="42" fill="#11170f" opacity=".28" />
          <g filter="url(#atlas-platform-shadow)">
            <path d="M430 399 120 249v25l310 154Z" fill="#151f17" />
            <path d="M430 399 740 249v25L430 428Z" fill="#202b20" />
            <path d="M120 249 430 98 740 249 430 399Z" fill="#263326" stroke="#869276" strokeOpacity=".3" strokeWidth="1.2" />
            <path d="M120 249 430 98 740 249 430 399Z" fill="url(#atlas-surface-grid)" />
          </g>

          {/* A real street-like lattice sits under the blocks and connects the mapped stops. */}
          <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="atlas-street-lattice">
            {GRID.map((u) => {
              const path = pointPath([projectUV(u, 0), projectUV(u, 1)]);
              return <g key={`u-${u}`}>
                <path d={path} stroke="#182219" strokeWidth="18" />
                <path d={path} stroke="#65705d" strokeOpacity=".72" strokeWidth="11" />
                <path d={path} stroke="#bdc5ad" strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="2 11" />
                <path d={path} className="atlas-road-hit" data-interactive="true" role="button" tabIndex={0} aria-label="Select a city road segment" onPointerDown={stopClick} onClick={(event) => { stopClick(event); setSelection({ type: 'road', segment: null }); }} onKeyDown={(event) => onRoadHitKeyDown(event, null)} />
              </g>;
            })}
            {GRID.map((v) => {
              const path = pointPath([projectUV(0, v), projectUV(1, v)]);
              return <g key={`v-${v}`}>
                <path d={path} stroke="#182219" strokeWidth="18" />
                <path d={path} stroke="#65705d" strokeOpacity=".72" strokeWidth="11" />
                <path d={path} stroke="#bdc5ad" strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="2 11" />
                <path d={path} className="atlas-road-hit" data-interactive="true" role="button" tabIndex={0} aria-label="Select a city road segment" onPointerDown={stopClick} onClick={(event) => { stopClick(event); setSelection({ type: 'road', segment: null }); }} onKeyDown={(event) => onRoadHitKeyDown(event, null)} />
              </g>;
            })}
          </g>

          {buildings.map((building) => {
            if (building.park) {
              return <g key={building.key}>
                <path d={buildingPath(building.points)} fill="#405742" stroke="#5a7154" strokeWidth="1" />
                <path d={`M${building.points[0].x} ${building.points[0].y - 1} L${building.points[1].x} ${building.points[1].y - 1} L${building.points[2].x} ${building.points[2].y - 1} L${building.points[3].x} ${building.points[3].y - 1}Z`} fill="#596f52" opacity=".7" />
                <circle cx={(building.points[0].x + building.points[2].x) / 2} cy={(building.points[0].y + building.points[2].y) / 2 - 4} r="4" fill="#b6c48f" opacity=".78" />
                <circle cx={(building.points[0].x + building.points[2].x) / 2 + 14} cy={(building.points[0].y + building.points[2].y) / 2 + 3} r="3" fill="#d28e72" opacity=".65" />
              </g>;
            }
            const [backLeft, backRight, frontRight, frontLeft] = building.points;
            const h = building.height;
            return <g key={building.key} className="atlas-building">
              <path d={`M${backRight.x} ${backRight.y - h} L${frontRight.x} ${frontRight.y - h} L${frontRight.x} ${frontRight.y} L${backRight.x} ${backRight.y}Z`} fill="#4b5d45" />
              <path d={`M${frontRight.x} ${frontRight.y - h} L${frontLeft.x} ${frontLeft.y - h} L${frontLeft.x} ${frontLeft.y} L${frontRight.x} ${frontRight.y}Z`} fill="#344331" />
              <path d={buildingPath(building.points, h)} fill={building.shade} stroke="#c0c7ad" strokeOpacity=".28" strokeWidth="1" />
              <path d={`M${backLeft.x + 8} ${backLeft.y - h - 4} L${backRight.x - 7} ${backRight.y - h - 4} L${frontRight.x - 7} ${frontRight.y - h - 4}`} fill="none" stroke="#e6e8d8" strokeOpacity=".3" strokeWidth="1.4" />
              {h > 33 && <path d={`M${frontRight.x - 9} ${frontRight.y - h + 13} l4-2 v5 l-4 2Z M${frontRight.x - 9} ${frontRight.y - h + 25} l4-2 v5 l-4 2Z`} fill="#d9dfca" opacity=".4" />}
            </g>;
          })}

          {/* Modeled traffic corridors are drawn from the real traffic segments supplied by QMaps. */}
          {trafficDrawings.map(({ segment, path: d }) => {
            const isWarning = segment.status === 'warning';
            return <g key={segment.segment_id}>
              <path d={d} fill="none" stroke={isWarning ? '#d28e72' : '#c6f36d'} strokeOpacity=".62" strokeWidth="7" strokeLinecap="round" className="atlas-traffic-line" />
              <path d={d} fill="none" stroke="#fff8e8" strokeOpacity=".52" strokeWidth="1" strokeDasharray="2 8" />
              <path d={d} fill="none" stroke="transparent" strokeWidth="19" className="atlas-road-hit" data-interactive="true" role="button" tabIndex={0} aria-label={`Traffic road: ${segment.road_name}`} onPointerDown={stopClick} onClick={(event) => { stopClick(event); setSelection({ type: 'road', segment }); }} onKeyDown={(event) => onRoadHitKeyDown(event, segment)} />
            </g>;
          })}

          {/* Candidate stop orders are an explicit visual preview; the backend result remains authoritative. */}
          {showCandidatePaths && candidatePaths.map((d, index) => {
            return <path key={`candidate-${index}`} id={`atlas-candidate-path-${index}`} d={d} fill="none" stroke={index % 2 ? '#d28e72' : '#c6f36d'} strokeOpacity={0.38 - index * 0.045} strokeWidth={index === 0 ? 3.5 : 2.2} strokeDasharray="5 9" strokeLinecap="round" className="atlas-candidate-path" style={{ animationDelay: `${index * -0.48}s`, opacity: isConverging ? 0.04 : 1 }} />;
          })}

          {routeDrawings.map(({ route, index, points, path: d, hasRoadGeometry, pathId }) => {
            const active = !isOptimizing && route.route_id === selectedRoute?.route_id;
            const pathClass = isOptimizing ? 'atlas-alternate-path' : active ? (hasRoadGeometry ? 'atlas-optimized-path' : 'atlas-sequence-path') : 'atlas-alternate-path';
            return <g key={route.route_id}>
              {active && <path d={d} fill="none" stroke="#c6f36d" strokeOpacity=".2" strokeWidth="15" strokeLinecap="round" filter="url(#atlas-route-glow)" />}
              <path id={pathId} d={d} pathLength={active ? 1000 : undefined} fill="none" stroke={active ? '#c6f36d' : routeDisplayColorAt(index)} strokeOpacity={active ? 0.98 : isOptimizing ? 0.18 : 0.42} strokeWidth={active ? 5.2 : 3.2} strokeLinecap="round" strokeLinejoin="round" className={pathClass} />
              {active && <path d={d} fill="none" stroke="#efffb7" strokeOpacity=".75" strokeWidth="1.25" strokeLinecap="round" strokeDasharray="2 22" className="atlas-route-indicator" />}
              <path d={d} fill="none" stroke="transparent" strokeWidth="18" className="atlas-road-hit" data-interactive="true" role="button" tabIndex={0} aria-label={`Show ${route.vehicle.name} route`} onPointerDown={stopClick} onClick={(event) => { stopClick(event); setSelection({ type: 'vehicle', route }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection({ type: 'vehicle', route }); } }} />
              {!isOptimizing && points.length > 1 ? <g key={`${route.route_id}-vehicle`} className="atlas-vehicle-motion" role="button" tabIndex={0} aria-label={`Select vehicle ${route.vehicle.name}`} data-interactive="true" onPointerDown={stopClick} onClick={(event) => { stopClick(event); setSelection({ type: 'vehicle', route }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection({ type: 'vehicle', route }); } }}>
                <animateMotion dur={`${Math.max(13, Math.min(30, route.total_travel_time_min / 2 || 18))}s`} repeatCount="indefinite"><mpath href={`#${pathId}`} /></animateMotion>
                <VanMarker title={`${route.vehicle.name} · ${route.total_distance_km} km · click for route details`} />
              </g> : null}
            </g>;
          })}

          {(shouldShowPreview || (isOptimizing && candidatePaths.length === 0)) && previewPoints.length > 1 && <g>
            <path id="atlas-preview-route" d={previewPath} fill="none" stroke="#172117" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d={previewPath} fill="none" stroke="#a4b67f" strokeOpacity=".7" strokeWidth="4" strokeDasharray="6 8" strokeLinecap="round" className="atlas-preview-path" />
          </g>}

          {deliveryMarkers.map(({ location, index, point }) => {
            const assignedStop = selectedRoute?.stops.find((stop) => stop.location_id === location.id && stop.type === 'customer');
            const stopNumber = assignedStop?.stop_number ?? index + 1;
            return <g key={location.id} transform={`translate(${point.x} ${point.y})`} className="atlas-stop-node" data-interactive="true" role="button" tabIndex={0} aria-label={`Show delivery stop ${stopNumber}: ${location.name}`} onPointerDown={stopClick} onClick={(event) => { stopClick(event); setSelection({ type: 'stop', location }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection({ type: 'stop', location }); } }}>
              <circle r="16" className="atlas-stop-pulse" />
              <circle r="9.5" fill="#223120" stroke="#f3f0e3" strokeWidth="2" />
              <circle r="6.5" fill="#c6f36d" />
              <text y="3" textAnchor="middle" fill="#1c291a" fontFamily="ui-monospace, monospace" fontSize="6.5" fontWeight="800">{String(stopNumber).padStart(2, '0')}</text>
              <title>{`Stop ${String(stopNumber).padStart(2, '0')} · ${location.name}`}</title>
            </g>;
          })}

          {(() => {
            const point = project(depot.lat, depot.lng);
            return <g transform={`translate(${point.x} ${point.y})`} className="atlas-depot-node" data-interactive="true" role="button" tabIndex={0} aria-label={`Show depot: ${depot.name}`} onPointerDown={stopClick} onClick={(event) => { stopClick(event); setSelection({ type: 'stop', location: depot }); }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection({ type: 'stop', location: depot }); } }}>
              <circle r="21" fill="#c6f36d" opacity=".13" />
              <circle r="13" fill="#c6f36d" stroke="#fff8df" strokeWidth="2.4" />
              <path d="M-6 4V-3l6-5 6 5v7H2V0h-4v4Z" fill="#24331e" />
              <title>{`Depot · ${depot.name}`}</title>
            </g>;
          })()}

          {(shouldShowPreview || isOptimizing) && previewPoints.length > 1 && <g className="atlas-preview-vehicle-motion" role="img" aria-label={isOptimizing ? 'Visual candidate vehicle following a preview sequence' : 'Illustrative delivery van following the schematic preview route'}>
            <animateMotion dur="20s" repeatCount="indefinite"><mpath href={isOptimizing && candidatePaths.length ? '#atlas-candidate-path-0' : '#atlas-preview-route'} /></animateMotion>
            <VanMarker title={isOptimizing ? 'Visual candidate sequence preview · backend result is pending' : 'Schematic preview vehicle · route is not optimized yet'} />
          </g>}

          <g className="atlas-city-map-labels" pointerEvents="none">
            <text x="427" y="77" textAnchor="middle">NAVI MUMBAI · STREET NETWORK</text>
            <text x="430" y="469" textAnchor="middle">QMAPS ROUTE OPERATIONS</text>
          </g>
        </svg>
      </div>

      <div className="atlas-scene-card" data-interactive="true" aria-live="polite">
        {isOptimizing ? (
          <>
            <div className="atlas-card-topline"><span className="atlas-search-icon"><Activity size={12} /></span><span>SEARCHING LIVE STOP SEQUENCES</span></div>
            <div className="atlas-card-title">{algorithmName} is routing the fleet</div>
            <div className="atlas-card-copy">Dashed paths and the marker preview candidate stop orders from current delivery data. Previous results are dimmed; updated route metrics appear when the backend responds.</div>
            <div className="atlas-card-foot"><span>INPUT</span><strong>{deliveries.length} stops · {result?.routes.length ?? 0} previous routes</strong></div>
          </>
        ) : selection?.type === 'stop' ? (
          <>
            <div className="atlas-card-topline"><span className="atlas-card-symbol"><Crosshair size={12} /></span><span>{selection.location.id === depot.id ? 'DEPOT / START POINT' : 'DELIVERY STOP'}</span><button type="button" data-interactive="true" aria-label="Close details" onPointerDown={stopClick} onClick={() => setSelection(null)}><X size={13} /></button></div>
            <div className="atlas-card-title">{selection.location.name}</div>
            <div className="atlas-card-copy">{selection.location.id === depot.id ? 'Fleet staging and return location' : `${selection.location.demand} kg package · ${selection.location.priority} priority`}</div>
            <div className="atlas-card-foot"><span>TIME WINDOW</span><strong>{stopWindow(selection.location)}</strong></div>
          </>
        ) : selection?.type === 'road' ? (
          <>
            <div className="atlas-card-topline"><span className="atlas-card-symbol"><Activity size={12} /></span><span>{selection.segment ? 'MODELED TRAFFIC SEGMENT' : 'CITY STREET NETWORK'}</span><button type="button" data-interactive="true" aria-label="Close details" onPointerDown={stopClick} onClick={() => setSelection(null)}><X size={13} /></button></div>
            <div className="atlas-card-title">{selection.segment?.road_name ?? 'Urban street connection'}</div>
            <div className="atlas-card-copy">{selection.segment?.description ?? 'This schematic road is available for route planning. No live traffic feed is connected.'}</div>
            {selection.segment && <div className="atlas-card-foot"><span>{selection.segment.condition.toUpperCase()}</span><strong>{selection.segment.speed_kmh} km/h · {selection.segment.delay_min} min delay</strong></div>}
          </>
        ) : selection?.type === 'vehicle' && selectedRoute ? (
          <>
            <div className="atlas-card-topline"><span className="atlas-card-symbol"><Truck size={12} /></span><span>OPTIMIZED VEHICLE ROUTE</span><button type="button" data-interactive="true" aria-label="Close details" onPointerDown={stopClick} onClick={() => setSelection(null)}><X size={13} /></button></div>
            <div className="atlas-card-title">{selectedRoute.vehicle.name}</div>
            <div className="atlas-card-copy atlas-route-sequence">{routeSequence(selectedRoute)}</div>
            <div className="atlas-card-metrics">
              <span><strong>{selectedRoute.total_distance_km}</strong><small>ROUTE KM</small></span>
              <span><strong>{Math.round(selectedRoute.total_travel_time_min)}</strong><small>TRAVEL MIN</small></span>
              <span><strong>{selectedRoute.capacity_usage_pct}%</strong><small>CAPACITY</small></span>
            </div>
            <div className="atlas-card-foot"><span>{selectedRoute.road_geometry?.length ? `${selectedRoute.stops.filter((stop) => stop.type === 'customer').length} STOPS` : 'STREET GEOMETRY PENDING'}</span><strong>{selectedRoute.vehicle.driver_name}</strong></div>
          </>
        ) : result && selectedRoute ? (
          <>
            <div className="atlas-card-topline"><span className="atlas-card-symbol"><Truck size={12} /></span><span>OPTIMIZER RESULT · {result.algorithm.name.toUpperCase()}</span></div>
            <div className="atlas-card-title">{selectedRoute.vehicle.name}</div>
            <div className="atlas-card-copy atlas-route-sequence">{routeSequence(selectedRoute)}</div>
            <div className="atlas-card-metrics">
              <span><strong>{result.stats.total_distance_km}</strong><small>FLEET KM</small></span>
              <span><strong>{Math.round(result.stats.total_travel_time_min)}</strong><small>TRAVEL MIN</small></span>
              <span><strong>{result.stats.vehicles_used}</strong><small>VEHICLES</small></span>
            </div>
            <div className="atlas-card-foot"><span>{selectedRoute.road_geometry?.length ? (result.stats.feasible ? 'FEASIBLE PLAN' : 'INFEASIBLE PLAN') : 'STOP ORDER · ROAD GEOMETRY PENDING'}</span><strong>{result.stats.time_window_compliance_pct}% WINDOWS</strong></div>
            <button type="button" className="atlas-run-button" data-interactive="true" onPointerDown={stopClick} onClick={onRunOptimization} disabled={isOptimizing}>
              <Activity size={13} /> Run optimization again
            </button>
          </>
        ) : (
          <>
            <div className="atlas-card-topline"><span className="atlas-card-symbol"><Crosshair size={12} /></span><span>SCHEMATIC ROUTE PREVIEW</span></div>
            <div className="atlas-card-title">City → stops → dispatch</div>
            <div className="atlas-card-copy">The moving van follows a preview through your current stops. Run the optimizer to replace it with real route geometry and measured results.</div>
            <div className="atlas-card-foot"><span>{deliveries.length} DELIVERY STOPS</span><strong>Optimization pending</strong></div>
            <button type="button" className="atlas-run-button" data-interactive="true" onPointerDown={stopClick} onClick={onRunOptimization} disabled={isOptimizing}>
              <Activity size={13} /> {isOptimizing ? 'Searching routes…' : 'Run optimization'}
            </button>
          </>
        )}
      </div>

      <div className="atlas-scene-legend"><span><i className="atlas-legend-route" />{result ? 'Backend route' : isOptimizing ? 'Candidate preview' : 'Preview only'}</span><span><i className="atlas-legend-node" />Delivery stop</span><span><i className="atlas-legend-depot" />Depot</span></div>
      <div className="atlas-orbit-hint">DRAG TO ORBIT <i /> SCROLL / PINCH TO ZOOM</div>
      {selectedRoute && routes.length > 1 && <div className="atlas-route-picker" data-interactive="true" aria-label="Select an optimized vehicle route">
        {routes.map((route, index) => <button key={route.route_id} type="button" data-interactive="true" aria-label={`Show ${route.vehicle.name}`} aria-pressed={route.route_id === selectedRoute.route_id} onPointerDown={stopClick} onClick={() => setSelection({ type: 'vehicle', route })}>
          <span style={{ background: routeDisplayColorAt(index) }} />{route.vehicle.id}
        </button>)}
      </div>}
    </div>
  );
};

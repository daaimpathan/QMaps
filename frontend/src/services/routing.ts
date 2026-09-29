import { OptimizationResult, RouteNavigationStep, RouteStop, VehicleRoute } from '../types';

// OSRM's default profile can assume speeds that are too high for city delivery
// driving. Keep its route geometry, but floor ETA at a realistic urban average.
const MODELED_CITY_SPEED_KMH = 25;

export interface RoadRouteStep {
  name?: string;
  ref?: string;
  distance_m: number;
  duration_min: number;
  maneuver: { type: string; modifier?: string };
}

export interface RoadRouteLeg {
  distance_km: number;
  duration_min: number;
  steps: RoadRouteStep[];
}

export interface RoadRoute {
  distance_km: number;
  duration_min: number;
  geometry: [number, number][];
  legs: RoadRouteLeg[];
}

type RoadRouteLoader = (stops: RouteStop[]) => Promise<RoadRoute>;

const routeCache = new Map<string, Promise<RoadRoute>>();
const failedRouteCache = new Map<string, { message: string; expiresAt: number }>();

function getRoadRoute(route: VehicleRoute, loadRoadRoute: RoadRouteLoader): Promise<RoadRoute> {
  const cacheKey = route.stops.map((stop) => `${stop.lng.toFixed(6)},${stop.lat.toFixed(6)}`).join(';');
  const cached = routeCache.get(cacheKey);
  if (cached) return cached;
  const recentFailure = failedRouteCache.get(cacheKey);
  if (recentFailure && recentFailure.expiresAt > Date.now()) {
    return Promise.reject(new Error(recentFailure.message));
  }
  failedRouteCache.delete(cacheKey);

  const request = (async () => {
    return loadRoadRoute(route.stops);
  })();

  routeCache.set(cacheKey, request);
  request.catch((error: unknown) => {
    routeCache.delete(cacheKey);
    failedRouteCache.set(cacheKey, {
      message: error instanceof Error ? error.message : 'Could not get road directions.',
      expiresAt: Date.now() + 60_000,
    });
  });
  return request;
}

function timeString(minutesFromEight: number): string {
  const total = 8 * 60 + Math.max(0, minutesFromEight);
  const hours = Math.floor(total / 60) % 24;
  const minutes = Math.round(total % 60);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

function instructionFor(step: RoadRouteStep, destination: RouteStop): string {
  const road = step.name?.trim() || step.ref?.trim();
  const modifier = step.maneuver.modifier?.replaceAll('_', ' ');
  const type = step.maneuver.type;
  if (type === 'depart') return `${modifier ? `Head ${modifier}` : 'Start driving'}${road ? ` on ${road}` : ''}`;
  if (type === 'arrive') return `Arrive at ${destination.name}`;
  if (type === 'roundabout' || type === 'rotary') return `Enter the roundabout${road ? ` onto ${road}` : ''}`;
  if (type === 'roundabout turn' || type === 'exit roundabout') return `Take the roundabout exit${road ? ` onto ${road}` : ''}`;

  const action = type === 'turn'
    ? `Turn ${modifier || 'ahead'}`
    : type === 'merge'
    ? `Merge ${modifier || 'ahead'}`
    : type === 'fork'
    ? `Keep ${modifier || 'straight'} at the fork`
    : type === 'on ramp'
    ? 'Take the ramp'
    : type === 'off ramp'
    ? 'Take the exit'
    : type === 'end of road'
    ? `At the end of the road, turn ${modifier || 'ahead'}`
    : type === 'continue'
    ? 'Continue'
    : modifier
    ? `Continue ${modifier}`
    : 'Continue';
  return `${action}${road ? ` onto ${road}` : ''}`;
}

function minutesAndSchedule(route: VehicleRoute, roadRoute: RoadRoute) {
  const stops = route.stops.map((stop) => ({ ...stop }));
  let clock = stops[0]?.ready_time ?? 0;
  let roadDrivingMinutes = 0;
  let serviceAndWaitingMinutes = 0;
  let compliantStops = 0;
  let customerCount = 0;
  let timeWindowsFeasible = true;

  for (let index = 0; index < roadRoute.legs.length; index += 1) {
    const roadLeg = roadRoute.legs[index];
    const from = stops[index];
    const to = stops[index + 1];
    if (!from || !to) continue;

    // Keep the backend's selected congestion scenario and manual corridor
    // multiplier while replacing straight-line minutes with road minutes.
    const modeledStraightLineMinutes = Math.max(0.01, to.leg_distance_km * 60 / MODELED_CITY_SPEED_KMH);
    const configuredTrafficMultiplier = Math.max(1, to.leg_time_min / modeledStraightLineMinutes);
    const legDistanceKm = roadLeg.distance_km;
    const urbanRoadMinutes = legDistanceKm * 60 / MODELED_CITY_SPEED_KMH;
    const legMinutes = Math.max(roadLeg.duration_min, urbanRoadMinutes) * configuredTrafficMultiplier;
    const closurePenalty = to.traffic_note?.toLowerCase().includes('closure') ?? false;
    const arrival = clock + legMinutes;
    roadDrivingMinutes += legMinutes;
    to.leg_distance_km = Number(legDistanceKm.toFixed(2));
    to.leg_time_min = Number(legMinutes.toFixed(1));
    to.traffic_note = closurePenalty
      ? 'Road closure penalty'
      : configuredTrafficMultiplier > 1.05
        ? `Modeled congestion (+${Math.round((configuredTrafficMultiplier - 1) * 100)}%)`
        : 'Normal traffic';

    if (to.type === 'customer') {
      const wait = Math.max(0, to.ready_time - arrival);
      const serviceStart = arrival + wait;
      const departure = serviceStart + to.service_time;
      to.arrival_time_min = Number(arrival.toFixed(1));
      to.arrival_time_str = timeString(arrival);
      to.departure_time_str = timeString(departure);
      to.status = arrival > to.due_date ? 'delayed' : arrival < to.ready_time ? 'early_wait' : 'on_time';
      if (serviceStart <= to.due_date) compliantStops += 1;
      else timeWindowsFeasible = false;
      customerCount += 1;
      serviceAndWaitingMinutes += wait + to.service_time;
      clock = departure;
    } else {
      to.arrival_time_min = Number(arrival.toFixed(1));
      to.arrival_time_str = timeString(arrival);
      to.departure_time_str = timeString(arrival);
      to.status = arrival <= to.due_date ? 'on_time' : 'delayed';
      if (arrival > to.due_date) timeWindowsFeasible = false;
      clock = arrival;
    }
  }

  const distanceKm = roadRoute.distance_km;
  const routeMinutes = roadDrivingMinutes + serviceAndWaitingMinutes;
  return {
    stops,
    distanceKm,
    roadDrivingMinutes,
    routeMinutes,
    compliantStops,
    customerCount,
    feasible: route.feasible && timeWindowsFeasible,
  };
}

async function routeOnStreets(
  route: VehicleRoute,
  loadRoadRoute: RoadRouteLoader,
): Promise<VehicleRoute> {
  if (route.street_routing_status === 'ready' && route.road_geometry?.length) return route;
  try {
    if (route.stops.length < 2) throw new Error('A route needs at least two stops to request street directions.');
    const roadRoute = await getRoadRoute(route, loadRoadRoute);
    const schedule = minutesAndSchedule(route, roadRoute);
    const navigationSteps: RouteNavigationStep[] = roadRoute.legs.flatMap((leg, legIndex) =>
      leg.steps.map((step, stepIndex) => ({
        leg_index: legIndex,
        step_index: stepIndex,
        instruction: instructionFor(step, route.stops[legIndex + 1] ?? route.stops[route.stops.length - 1]),
        road_name: step.name?.trim() || step.ref?.trim() || 'Unnamed street',
        maneuver_type: step.maneuver.type,
        distance_m: Math.round(step.distance_m),
        duration_min: Number(step.duration_min.toFixed(1)),
      }))
    );

    return {
      ...route,
      stops: schedule.stops,
      total_distance_km: Number(schedule.distanceKm.toFixed(2)),
      total_travel_time_min: Number(schedule.routeMinutes.toFixed(1)),
      feasible: schedule.feasible,
      road_distance_km: Number(schedule.distanceKm.toFixed(2)),
      road_driving_time_min: Number(schedule.roadDrivingMinutes.toFixed(1)),
      road_geometry: roadRoute.geometry,
      navigation_steps: navigationSteps,
      street_routing_status: 'ready',
      street_routing_error: undefined,
    };
  } catch (error) {
    return {
      ...route,
      road_geometry: [],
      navigation_steps: [],
      street_routing_status: 'unavailable',
      street_routing_error: error instanceof Error ? error.message : 'Could not get road directions.',
    };
  }
}

export async function attachStreetRoutes(
  result: OptimizationResult,
  loadRoadRoute: RoadRouteLoader,
): Promise<OptimizationResult> {
  const routes = await Promise.all(result.routes.map((route) => routeOnStreets(route, loadRoadRoute)));
  const allRoutesMapped = routes.every((route) => route.street_routing_status === 'ready');
  const totalDistance = allRoutesMapped
    ? routes.reduce((total, route) => total + (route.road_distance_km ?? route.total_distance_km), 0)
    : result.stats.total_distance_km;
  const totalTravelTime = allRoutesMapped
    ? routes.reduce((total, route) => total + route.total_travel_time_min, 0)
    : result.stats.total_travel_time_min;
  const totalCustomers = routes.flatMap((route) => route.stops).filter((stop) => stop.type === 'customer');
  const compliantCustomers = totalCustomers.filter((stop) => stop.status !== 'delayed').length;

  return {
    ...result,
    distance_model: allRoutesMapped ? 'OSM street-network route distance (OSRM)' : result.distance_model,
    travel_time_model: allRoutesMapped ? 'OSM street duration with a 25 km/h urban-speed floor, modeled congestion, service, and waiting' : result.travel_time_model,
    routes,
    stats: {
      ...result.stats,
      total_distance_km: Number(totalDistance.toFixed(2)),
      total_travel_time_min: Number(totalTravelTime.toFixed(1)),
      time_window_compliance_pct: totalCustomers.length
        ? Number(((compliantCustomers / totalCustomers.length) * 100).toFixed(1))
        : result.stats.time_window_compliance_pct,
      feasible: result.stats.feasible && allRoutesMapped && routes.every((route) => route.feasible),
    },
  };
}

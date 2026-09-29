'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Navbar } from '../components/Navbar';
import { AdminPanel } from '../components/AdminPanel';
import { DriverPanel } from '../components/DriverPanel';
import { HomeLanding, AppSection } from '../components/HomeLanding';
import { BenchmarkDashboard } from '../components/BenchmarkDashboard';
import { apiService } from '../services/api';
import {
  NaviLocation,
  NaviVehicle,
  OptimizationResult,
  TrafficSegment,
  TrafficAdjustment,
  AlgorithmInfo,
  TrafficIncident,
  TrafficIncidentCorridor,
  TrafficIncidentComparison,
} from '../types';

// Dynamic import of Leaflet Map to ensure SSR compatibility
const MapComponent = dynamic(
  () => import('../components/Map').then((mod) => mod.MapComponent),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full min-h-[420px] bg-stone-100 rounded-2xl flex items-center justify-center text-stone-400 text-xs">
        Loading OpenStreetMap tiles...
      </div>
    ),
  }
);

const DriverNavigationPhone = dynamic(
  () => import('../components/DriverNavigationPhone').then((mod) => mod.DriverNavigationPhone),
  { ssr: false },
);

// Fallback initial data in case backend is starting
const DEFAULT_DEPOT: NaviLocation = {
  id: 0,
  name: 'Turbhe Central Logistics Hub (MIDC)',
  lat: 19.0771,
  lng: 73.0125,
  demand: 0,
  ready_time: 0,
  due_date: 480,
  service_time: 0,
  priority: 'normal',
};

const DEFAULT_DELIVERIES: NaviLocation[] = [
  { id: 1, name: 'Vashi Sector 17 Commercial Hub', lat: 19.0750, lng: 72.9980, demand: 14, ready_time: 30, due_date: 180, service_time: 15, priority: 'normal' },
  { id: 2, name: 'APMC Fruit & Veg Market Vashi', lat: 19.0710, lng: 73.0070, demand: 22, ready_time: 15, due_date: 150, service_time: 20, priority: 'normal' },
  { id: 3, name: 'Sanpada Railway Station Complex', lat: 19.0620, lng: 73.0130, demand: 12, ready_time: 45, due_date: 240, service_time: 10, priority: 'normal' },
  { id: 4, name: 'Juinagar Industrial Estate', lat: 19.0530, lng: 73.0190, demand: 18, ready_time: 60, due_date: 300, service_time: 15, priority: 'normal' },
  { id: 5, name: 'Nerul DY Patil Sports Complex', lat: 19.0330, lng: 73.0197, demand: 25, ready_time: 90, due_date: 360, service_time: 20, priority: 'normal' },
  { id: 6, name: 'Seawoods Grand Central Mall', lat: 19.0210, lng: 73.0180, demand: 16, ready_time: 120, due_date: 420, service_time: 15, priority: 'normal' },
  { id: 7, name: 'CBD Belapur Konkan Bhavan', lat: 19.0180, lng: 73.0400, demand: 20, ready_time: 60, due_date: 360, service_time: 15, priority: 'normal' },
  { id: 8, name: 'Kopar Khairane Sector 14', lat: 19.0980, lng: 73.0150, demand: 15, ready_time: 30, due_date: 240, service_time: 10, priority: 'normal' },
  { id: 9, name: 'Mahape Millennium Business Park', lat: 19.1110, lng: 73.0250, demand: 28, ready_time: 60, due_date: 300, service_time: 20, priority: 'normal' },
  { id: 10, name: 'Ghansoli Reliance Corporate Park', lat: 19.1230, lng: 73.0110, demand: 18, ready_time: 90, due_date: 360, service_time: 15, priority: 'normal' },
  { id: 11, name: 'Airoli Mindspace Tech Campus', lat: 19.1550, lng: 72.9980, demand: 22, ready_time: 120, due_date: 420, service_time: 20, priority: 'normal' },
  { id: 12, name: 'Turbhe MIDC Electronics Zone', lat: 19.0880, lng: 73.0300, demand: 16, ready_time: 15, due_date: 200, service_time: 15, priority: 'normal' },
];

const DEFAULT_VEHICLES: NaviVehicle[] = [
  { id: 'V1', name: 'Navi Express Van 01', driver_name: 'Rajesh Kumar', driver_phone: '+91 98201 12345', capacity: 65 },
  { id: 'V2', name: 'Navi Express Van 02', driver_name: 'Amit Sharma', driver_phone: '+91 98202 23456', capacity: 65 },
  { id: 'V3', name: 'Navi Express Van 03', driver_name: 'Rahul Patil', driver_phone: '+91 98203 34567', capacity: 65 },
  { id: 'V4', name: 'Navi Express Van 04', driver_name: 'Sunil Shinde', driver_phone: '+91 98204 45678', capacity: 65 },
];

const DEFAULT_ALGORITHMS: AlgorithmInfo[] = [
  { id: 'astar', name: 'A*', description: 'Classical shortest path baseline' },
  { id: 'pso', name: 'PSO', description: 'Particle Swarm Optimization' },
  { id: 'qpso', name: 'QPSO', description: 'Quantum-behaved PSO (Sun et al. 2004)' },
  { id: 'aco', name: 'ACO', description: 'Ant Colony Optimization' },
  { id: 'qaco', name: 'QACO', description: 'Quantum-inspired ACO (Wang & Yu 2008)' },
  { id: 'qa_qpso', name: 'QA-QPSO', description: 'Hybrid QACO + QPSO (Primary Innovation)' },
];

const routeUsesIncidentLink = (
  result: OptimizationResult,
  fromLocationId: number,
  toLocationId: number,
  alreadyDeliveredIds: number[],
) => result.routes.some((route) => route.stops.some((stop, index) => {
  const nextStop = route.stops[index + 1];
  if (!nextStop) return false;
  if (alreadyDeliveredIds.includes(stop.location_id) || alreadyDeliveredIds.includes(nextStop.location_id)) return false;
  return (stop.location_id === fromLocationId && nextStop.location_id === toLocationId)
    || (stop.location_id === toLocationId && nextStop.location_id === fromLocationId);
}));

export default function Home() {
  const [currentSection, setCurrentSection] = useState<AppSection>('home');
  const role: 'admin' | 'driver' = currentSection === 'driver' ? 'driver' : 'admin';
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  // VRP Problem Data
  const [depot, setDepot] = useState<NaviLocation>(DEFAULT_DEPOT);
  const [deliveries, setDeliveries] = useState<NaviLocation[]>(DEFAULT_DELIVERIES);
  const [vehicles, setVehicles] = useState<NaviVehicle[]>(DEFAULT_VEHICLES);
  const [trafficSegments, setTrafficSegments] = useState<TrafficSegment[]>([]);
  const [trafficAdjustments, setTrafficAdjustments] = useState<TrafficAdjustment[]>([]);
  const [activeIncident, setActiveIncident] = useState<TrafficIncident | null>(null);
  const [incidentTimeline, setIncidentTimeline] = useState<TrafficIncident[]>([]);
  const [incidentComparison, setIncidentComparison] = useState<TrafficIncidentComparison | null>(null);
  const [incidentSecondsRemaining, setIncidentSecondsRemaining] = useState(0);
  const [algorithms, setAlgorithms] = useState<AlgorithmInfo[]>(DEFAULT_ALGORITHMS);

  // Optimization State
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>('qa_qpso');
  const [trafficScenario, setTrafficScenario] = useState<string>('normal');
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationResult | null>(null);
  const [driverDispatchResult, setDriverDispatchResult] = useState<OptimizationResult | null>(null);

  // Dispatch & Driver State
  const [selectedDriverVehicleId, setSelectedDriverVehicleId] = useState<string>('V1');
  const [completedStops, setCompletedStops] = useState<number[]>([]);
  const [driverProgress, setDriverProgress] = useState<Record<string, number[]>>({});
  const [completedLocationIds, setCompletedLocationIds] = useState<number[]>([]);
  const [isDispatching, setIsDispatching] = useState<boolean>(false);
  const [hasDispatched, setHasDispatched] = useState<boolean>(false);

  const runTrafficOptimization = useCallback(async (
    adjustments: TrafficAdjustment[],
    updateActiveDispatch: boolean,
  ): Promise<OptimizationResult> => {
    setIsOptimizing(true);
    const shouldUpdateDispatch = updateActiveDispatch && Boolean(driverDispatchResult);
    let preserveDeliveredIds: number[] = [];
    try {
      let optimizationDepot = depot;
      let optimizationVehicles = vehicles;
      let activeDispatchDeliveries: NaviLocation[] = [];
      if (shouldUpdateDispatch) {
        const deliveredIds = new Set(completedLocationIds);
        const activeDeliveryById = new Map<number, NaviLocation>();
        driverDispatchResult?.routes.forEach((route) => {
          const routeProgress = new Set(driverProgress[route.vehicle.driver_name] ?? []);
          if (route.vehicle.id === selectedDriverVehicleId) {
            completedStops.forEach((stopNumber) => routeProgress.add(stopNumber));
          }
          route.stops.forEach((stop) => {
            if (stop.type === 'customer') {
              activeDeliveryById.set(stop.location_id, {
                id: stop.location_id,
                name: stop.name,
                lat: stop.lat,
                lng: stop.lng,
                demand: stop.demand,
                ready_time: stop.ready_time,
                due_date: stop.due_date,
                service_time: stop.service_time,
                priority: stop.priority ?? 'normal',
              });
              if (routeProgress.has(stop.stop_number)) deliveredIds.add(stop.location_id);
            }
          });
        });
        preserveDeliveredIds = Array.from(deliveredIds);
        if (activeDeliveryById.size > 0) activeDispatchDeliveries = Array.from(activeDeliveryById.values());
        const depotStop = driverDispatchResult?.routes.flatMap((route) => route.stops)
          .find((stop) => stop.type === 'depot' && stop.stop_number === 0);
        if (depotStop) {
          optimizationDepot = {
            id: depotStop.location_id,
            name: depotStop.name.replace(/ \(Return\)$/, ''),
            lat: depotStop.lat,
            lng: depotStop.lng,
            demand: 0,
            ready_time: depotStop.ready_time,
            due_date: depotStop.due_date,
            service_time: depotStop.service_time,
            priority: depotStop.priority ?? 'normal',
          };
        }
        const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
        driverDispatchResult?.routes.forEach((route) => vehiclesById.set(route.vehicle.id, route.vehicle));
        optimizationVehicles = Array.from(vehiclesById.values());
      }

      const deliverySource = shouldUpdateDispatch && activeDispatchDeliveries.length > 0
        ? activeDispatchDeliveries
        : deliveries;
      const remainingDeliveries = shouldUpdateDispatch
        ? deliverySource.filter((delivery) => !preserveDeliveredIds.includes(delivery.id))
        : deliveries;
      if (shouldUpdateDispatch && remainingDeliveries.length === 0) {
        throw new Error('All assigned deliveries are already complete. There is no remaining route to re-optimize.');
      }

      const result = await apiService.optimize({
        algorithm: selectedAlgorithm,
        depot: optimizationDepot,
        deliveries: remainingDeliveries,
        vehicles: optimizationVehicles,
        traffic_scenario: trafficScenario,
        traffic_adjustments: adjustments,
      });

      if (shouldUpdateDispatch) {
        setIsDispatching(true);
        try {
          await apiService.dispatchRoutes(result, 'Automatic traffic incident reroute', preserveDeliveredIds);
        } finally {
          setIsDispatching(false);
        }
        setDriverDispatchResult(result);
        setDriverProgress({});
        setCompletedLocationIds(preserveDeliveredIds);
        setDepot(optimizationDepot);
        setVehicles(optimizationVehicles);
        setDeliveries(remainingDeliveries);
        setHasDispatched(true);
      } else {
        setHasDispatched(false);
      }
      setOptimizationResult(result);
      setCompletedStops([]);
      setIsBackendConnected(true);
      return result;
    } finally {
      setIsOptimizing(false);
    }
  }, [
    completedLocationIds,
    completedStops,
    deliveries,
    depot,
    driverDispatchResult,
    driverProgress,
    selectedAlgorithm,
    selectedDriverVehicleId,
    trafficScenario,
    vehicles,
  ]);

  // Fetch initial data from backend
  useEffect(() => {
    async function loadData() {
      try {
        const [preset, algos, traffic, dispatchRes] = await Promise.allSettled([
          apiService.getPreset(),
          apiService.getAlgorithms(),
          apiService.getTraffic(),
          apiService.getDispatch(),
        ]);

        if (preset.status === 'fulfilled') {
          setDepot(preset.value.depot);
          setDeliveries(preset.value.deliveries);
          setVehicles(preset.value.vehicles);
          setTrafficSegments(preset.value.traffic_segments);
          setIsBackendConnected(true);
        }

        if (algos.status === 'fulfilled') {
          setAlgorithms(algos.value);
        }

        if (traffic.status === 'fulfilled') {
          setTrafficSegments(traffic.value.segments);
        }

        if (dispatchRes.status === 'fulfilled' && dispatchRes.value.dispatched && dispatchRes.value.data) {
          const dispatchedResult = dispatchRes.value.data;
          setOptimizationResult(dispatchedResult);
          setDriverDispatchResult(dispatchedResult);
          setHasDispatched(true);
          setDriverProgress(dispatchRes.value.driver_progress ?? {});
          setCompletedLocationIds(dispatchRes.value.completed_location_ids ?? []);
          const savedStops = new Map<number, NaviLocation>();
          dispatchedResult.routes.forEach((route) => route.stops.forEach((stop) => {
            if (stop.type === 'customer') {
              savedStops.set(stop.location_id, {
                id: stop.location_id,
                name: stop.name,
                lat: stop.lat,
                lng: stop.lng,
                demand: stop.demand,
                ready_time: stop.ready_time,
                due_date: stop.due_date,
                service_time: stop.service_time,
                priority: stop.priority ?? 'normal',
              });
            }
          }));
          if (savedStops.size > 0) setDeliveries(Array.from(savedStops.values()));
          const savedDepot = dispatchedResult.routes.flatMap((route) => route.stops)
            .find((stop) => stop.type === 'depot' && stop.stop_number === 0);
          if (savedDepot) {
            setDepot({
              id: savedDepot.location_id,
              name: savedDepot.name.replace(/ \(Return\)$/, ''),
              lat: savedDepot.lat,
              lng: savedDepot.lng,
              demand: 0,
              ready_time: savedDepot.ready_time,
              due_date: savedDepot.due_date,
              service_time: savedDepot.service_time,
              priority: savedDepot.priority ?? 'normal',
            });
          }
          const savedVehicles = new Map((preset.status === 'fulfilled' ? preset.value.vehicles : DEFAULT_VEHICLES)
            .map((vehicle) => [vehicle.id, vehicle]));
          dispatchedResult.routes.forEach((route) => savedVehicles.set(route.vehicle.id, route.vehicle));
          setVehicles(Array.from(savedVehicles.values()));
          if (!dispatchRes.value.data.routes.some((route) => route.vehicle.id === selectedDriverVehicleId)) {
            setSelectedDriverVehicleId(dispatchRes.value.data.routes[0]?.vehicle.id || '');
          }
          const driverRoute = dispatchRes.value.data.routes.find(
            (route) => route.vehicle.id === selectedDriverVehicleId
          );
          setCompletedStops(
            driverRoute
              ? dispatchRes.value.driver_progress?.[driverRoute.vehicle.driver_name] || []
              : []
          );
          const activeAdjustment = dispatchedResult.traffic_adjustments?.find((adjustment) => (
            adjustment.incident_id && adjustment.incident_type && adjustment.incident_expires_at
            && Date.parse(adjustment.incident_expires_at) > Date.now()
          ));
          if (activeAdjustment?.incident_id && activeAdjustment.incident_type && activeAdjustment.incident_expires_at) {
            const knownLocations = preset.status === 'fulfilled'
              ? [preset.value.depot, ...preset.value.deliveries]
              : [DEFAULT_DEPOT, ...DEFAULT_DELIVERIES];
            const routeStops = dispatchedResult.routes.flatMap((route) => route.stops);
            const fromName = knownLocations.find((location) => location.id === activeAdjustment.from_location_id)?.name
              ?? routeStops.find((stop) => stop.location_id === activeAdjustment.from_location_id)?.name;
            const toName = knownLocations.find((location) => location.id === activeAdjustment.to_location_id)?.name
              ?? routeStops.find((stop) => stop.location_id === activeAdjustment.to_location_id)?.name;
            if (fromName && toName && (activeAdjustment.coords?.length ?? 0) >= 2) {
              const incident: TrafficIncident = {
                id: activeAdjustment.incident_id,
                type: activeAdjustment.incident_type,
                from_location_id: activeAdjustment.from_location_id,
                to_location_id: activeAdjustment.to_location_id,
                from_name: fromName,
                to_name: toName,
                severity_percent: activeAdjustment.delay_percent,
                duration_seconds: activeAdjustment.incident_duration_seconds ?? 90,
                started_at: activeAdjustment.incident_started_at ?? new Date().toISOString(),
                expires_at: activeAdjustment.incident_expires_at,
                coords: activeAdjustment.coords ?? [],
                status: 'active',
              };
              setActiveIncident(incident);
              setIncidentTimeline([incident]);
            }
          }
        }
      } catch (err) {
        console.warn('Backend initial connection failed', err);
        setIsBackendConnected(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    const refreshDispatch = async () => {
      try {
        const dispatch = await apiService.getDispatch();
        setIsBackendConnected(true);
        if (!dispatch.dispatched || !dispatch.data) {
          setDriverDispatchResult(null);
          setCompletedStops([]);
          setDriverProgress({});
          setCompletedLocationIds([]);
          return;
        }
        setDriverDispatchResult(dispatch.data);
        setDriverProgress(dispatch.driver_progress ?? {});
        setCompletedLocationIds(dispatch.completed_location_ids ?? []);
        if (!dispatch.data.routes.some((route) => route.vehicle.id === selectedDriverVehicleId)) {
          setSelectedDriverVehicleId(dispatch.data.routes[0]?.vehicle.id || '');
        }
        const driverRoute = dispatch.data.routes.find(
          (route) => route.vehicle.id === selectedDriverVehicleId
        );
        setCompletedStops(
          driverRoute
            ? dispatch.driver_progress?.[driverRoute.vehicle.driver_name] || []
            : []
        );
      } catch {
        setIsBackendConnected(false);
      }
    };

    refreshDispatch();
    const interval = window.setInterval(refreshDispatch, 10000);
    return () => window.clearInterval(interval);
  }, [selectedDriverVehicleId]);

  // Handler: Run Optimization via Backend
  const handleOptimize = async () => {
    try {
      await runTrafficOptimization(trafficAdjustments, false);
    } catch (err) {
      console.error('Optimization failed:', err);
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      alert(detail || (err instanceof Error ? err.message : 'Optimization failed. Check the backend connection and request settings.'));
    }
  };

  const handleTriggerIncident = async (incident: TrafficIncident) => {
    const beforeResult = hasDispatched ? (driverDispatchResult ?? optimizationResult) : optimizationResult;
    setActiveIncident(incident);
    setIncidentComparison(null);
    setIncidentTimeline((previous) => [incident, ...previous.filter((item) => item.id !== incident.id)].slice(0, 5));
    const adjustment: TrafficAdjustment = {
      id: incident.id,
      incident_id: incident.id,
      incident_type: incident.type,
      from_location_id: incident.from_location_id,
      to_location_id: incident.to_location_id,
      delay_percent: incident.severity_percent,
      closed: incident.type === 'road_closure',
      coords: incident.coords,
      incident_started_at: incident.started_at,
      incident_expires_at: incident.expires_at,
      incident_duration_seconds: incident.duration_seconds,
    };
    const incidentPair = [incident.from_location_id, incident.to_location_id].sort((a, b) => a - b).join(':');
    const otherAdjustments = trafficAdjustments.filter((existing) => (
      [existing.from_location_id, existing.to_location_id].sort((a, b) => a - b).join(':') !== incidentPair
    ));
    try {
      const afterResult = await runTrafficOptimization([...otherAdjustments, adjustment], Boolean(hasDispatched && driverDispatchResult));
      if (beforeResult) {
        const beforeByVehicle = new Map(beforeResult.routes.map((route) => [
          route.vehicle.id,
          route.customer_ids.join(','),
        ]));
        const afterByVehicle = new Map(afterResult.routes.map((route) => [
          route.vehicle.id,
          route.customer_ids.join(','),
        ]));
        const vehicleIds = new Set([
          ...Array.from(beforeByVehicle.keys()),
          ...Array.from(afterByVehicle.keys()),
        ]);
        const changedRoutes = Array.from(vehicleIds).filter((vehicleId) => (
          beforeByVehicle.get(vehicleId) !== afterByVehicle.get(vehicleId)
        )).length;

        setIncidentComparison({
          incident_id: incident.id,
          incident_type: incident.type,
          from_name: incident.from_name,
          to_name: incident.to_name,
          severity_percent: incident.severity_percent,
          algorithm_name: afterResult.algorithm.name,
          before_distance_km: beforeResult.stats.total_distance_km,
          after_distance_km: afterResult.stats.total_distance_km,
          before_travel_time_min: beforeResult.stats.total_travel_time_min,
          after_travel_time_min: afterResult.stats.total_travel_time_min,
          before_time_window_compliance_pct: beforeResult.stats.time_window_compliance_pct,
          after_time_window_compliance_pct: afterResult.stats.time_window_compliance_pct,
          before_uses_incident_link: routeUsesIncidentLink(
            beforeResult,
            incident.from_location_id,
            incident.to_location_id,
            completedLocationIds,
          ),
          after_uses_incident_link: routeUsesIncidentLink(
            afterResult,
            incident.from_location_id,
            incident.to_location_id,
            completedLocationIds,
          ),
          optimizer_seconds: afterResult.stats.computation_time_seconds,
          changed_routes: changedRoutes,
          total_routes: Math.max(beforeResult.routes.length, afterResult.routes.length),
        });
      }
    } catch (err) {
      console.error('Incident re-optimization failed:', err);
      setIncidentComparison(null);
      setActiveIncident((current) => current?.id === incident.id ? null : current);
      setIncidentTimeline((previous) => previous.map((item) => item.id === incident.id
        ? { ...item, status: 'failed', cleared_at: new Date().toISOString() }
        : item));
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      alert(detail || (err instanceof Error ? err.message : 'Incident route re-optimization failed. The previous route is still active.'));
    }
  };

  const handleClearIncident = useCallback(async () => {
    if (!activeIncident) return;
    const incidentId = activeIncident.id;
    setActiveIncident(null);
    setIncidentTimeline((previous) => previous.map((item) => item.id === incidentId
      ? { ...item, status: 'cleared', cleared_at: new Date().toISOString() }
      : item));
    try {
      await runTrafficOptimization(trafficAdjustments, Boolean(hasDispatched && driverDispatchResult));
    } catch (err) {
      console.error('Incident expiry re-optimization failed:', err);
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      alert(detail || (err instanceof Error ? err.message : 'Could not restore the route after the incident expired. The last dispatched route remains active.'));
    }
  }, [activeIncident, driverDispatchResult, hasDispatched, runTrafficOptimization, trafficAdjustments]);

  useEffect(() => {
    if (!activeIncident) {
      setIncidentSecondsRemaining(0);
      return;
    }

    let expiryHandled = false;
    const updateCountdown = () => {
      const secondsLeft = Math.max(0, Math.ceil((Date.parse(activeIncident.expires_at) - Date.now()) / 1000));
      setIncidentSecondsRemaining(secondsLeft);
      if (secondsLeft === 0 && !expiryHandled) {
        expiryHandled = true;
        if (role === 'admin') void handleClearIncident();
        else {
          setActiveIncident((current) => current?.id === activeIncident.id ? null : current);
          setIncidentTimeline((previous) => previous.map((item) => item.id === activeIncident.id
            ? { ...item, status: 'cleared', cleared_at: new Date().toISOString() }
            : item));
        }
      }
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [activeIncident, handleClearIncident, role]);

  // Handler: Dispatch routes to drivers
  const handleDispatch = async () => {
    if (!optimizationResult) return;
    setIsDispatching(true);
    try {
      await apiService.dispatchRoutes(optimizationResult, 'Admin Dispatcher');
      setDriverDispatchResult(optimizationResult);
      setHasDispatched(true);
      setCompletedStops([]);
      setDriverProgress({});
      setCompletedLocationIds([]);
    } catch (err) {
      console.error('Dispatch failed:', err);
      alert('Dispatch failed. Drivers will not receive these routes until the backend confirms dispatch.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Handler: Driver marks stop as complete
  const handleCompleteStop = async (stopNumber: number) => {
    if (completedStops.includes(stopNumber)) return;
    const newCompleted = [...completedStops, stopNumber];
    setCompletedStops(newCompleted);

    // Sync with backend if available
    try {
      const activeRoute = driverDispatchResult?.routes.find((r) => r.vehicle.id === selectedDriverVehicleId);
      if (activeRoute) {
        setDriverProgress((previous) => ({
          ...previous,
          [activeRoute.vehicle.driver_name]: Array.from(new Set([...(previous[activeRoute.vehicle.driver_name] ?? []), stopNumber])),
        }));
        const completedLocation = activeRoute.stops.find((stop) => stop.stop_number === stopNumber && stop.type === 'customer');
        if (completedLocation) {
          setCompletedLocationIds((previous) => Array.from(new Set([...previous, completedLocation.location_id])));
        }
        await apiService.completeStop(activeRoute.vehicle.driver_name, stopNumber);
      }
    } catch (err) {
      // Ignore background sync error
    }
  };

  // Handler: Map click adds delivery point
  const handleMapClick = (lat: number, lng: number) => {
    const nextId = deliveries.length > 0 ? Math.max(...deliveries.map((d) => d.id)) + 1 : 1;
    const newStop: NaviLocation = {
      id: nextId,
      name: `Navi Mumbai Stop #${nextId}`,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      demand: 15,
      ready_time: 30,
      due_date: 300,
      service_time: 15,
      priority: 'normal',
    };
    setOptimizationResult(null);
    setHasDispatched(false);
    setDeliveries((prev) => [...prev, newStop]);
  };

  const handleAddDelivery = (delivery: NaviLocation) => {
    setOptimizationResult(null);
    setHasDispatched(false);
    setDeliveries((prev) => [...prev, delivery]);
  };

  // Handler: Remove delivery
  const handleRemoveDelivery = (id: number) => {
    setDeliveries((prev) => prev.filter((d) => d.id !== id));
    setTrafficAdjustments((prev) => prev.filter(
      (adjustment) => adjustment.from_location_id !== id && adjustment.to_location_id !== id
    ));
    setOptimizationResult(null);
    setHasDispatched(false);
  };

  const handleUpdateDelivery = (updatedDelivery: NaviLocation) => {
    if (
      !updatedDelivery.name.trim() ||
      !Number.isFinite(updatedDelivery.lat) || updatedDelivery.lat < 18.95 || updatedDelivery.lat > 19.22 ||
      !Number.isFinite(updatedDelivery.lng) || updatedDelivery.lng < 72.85 || updatedDelivery.lng > 73.15 ||
      !Number.isFinite(updatedDelivery.demand) || updatedDelivery.demand <= 0 ||
      !Number.isFinite(updatedDelivery.ready_time) || updatedDelivery.ready_time < 0 ||
      !Number.isFinite(updatedDelivery.due_date) || updatedDelivery.due_date < 0 || updatedDelivery.due_date > 720 ||
      updatedDelivery.ready_time > updatedDelivery.due_date ||
      !Number.isFinite(updatedDelivery.service_time) || updatedDelivery.service_time < 0 || updatedDelivery.service_time > 720
    ) return;

    const incidentTouchesDelivery = activeIncident && (
      activeIncident.from_location_id === updatedDelivery.id || activeIncident.to_location_id === updatedDelivery.id
    );
    if (incidentTouchesDelivery && activeIncident) {
      setActiveIncident(null);
      setIncidentTimeline((previous) => previous.map((incident) => incident.id === activeIncident.id
        ? { ...incident, status: 'cleared', cleared_at: new Date().toISOString() }
        : incident));
    }
    setDeliveries((previous) => previous.map((delivery) => (
      delivery.id === updatedDelivery.id
        ? { ...updatedDelivery, name: updatedDelivery.name.trim() }
        : delivery
    )));
    setOptimizationResult(null);
    setIncidentComparison(null);
    setHasDispatched(false);
  };

  const handleUpdateDepot = (updatedDepot: NaviLocation) => {
    if (
      !updatedDepot.name.trim() ||
      !Number.isFinite(updatedDepot.lat) || updatedDepot.lat < 18.95 || updatedDepot.lat > 19.22 ||
      !Number.isFinite(updatedDepot.lng) || updatedDepot.lng < 72.85 || updatedDepot.lng > 73.15 ||
      !Number.isFinite(updatedDepot.ready_time) || updatedDepot.ready_time < 0 ||
      !Number.isFinite(updatedDepot.due_date) || updatedDepot.due_date < 0 || updatedDepot.due_date > 720 ||
      updatedDepot.ready_time > updatedDepot.due_date
    ) return;

    if (activeIncident) {
      setActiveIncident(null);
      setIncidentTimeline((previous) => previous.map((incident) => incident.id === activeIncident.id
        ? { ...incident, status: 'cleared', cleared_at: new Date().toISOString() }
        : incident));
    }
    setDepot({ ...updatedDepot, name: updatedDepot.name.trim() });
    setOptimizationResult(null);
    setIncidentComparison(null);
    setHasDispatched(false);
  };

  const handleAddTrafficAdjustment = (adjustment: TrafficAdjustment) => {
    const pair = [adjustment.from_location_id, adjustment.to_location_id].sort((a, b) => a - b).join(':');
    setTrafficAdjustments((prev) => [
      ...prev.filter((existing) => [existing.from_location_id, existing.to_location_id].sort((a, b) => a - b).join(':') !== pair),
      adjustment,
    ]);
    setOptimizationResult(null);
    setHasDispatched(false);
  };

  const handleRemoveTrafficAdjustment = (id: string) => {
    setTrafficAdjustments((prev) => prev.filter((adjustment) => adjustment.id !== id));
    setOptimizationResult(null);
    setHasDispatched(false);
  };

  const handleSelectTrafficScenario = (scenario: string) => {
    setTrafficScenario(scenario);
    setOptimizationResult(null);
    setHasDispatched(false);
  };

  // Handler: Add vehicle
  const handleAddVehicle = () => {
    const nextIdx = vehicles.length + 1;
    const newVehicle: NaviVehicle = {
      id: `V${nextIdx}`,
      name: `Navi Express Van 0${nextIdx}`,
      driver_name: `Driver 0${nextIdx} - Navi Fleet`,
      driver_phone: `+91 9820${nextIdx} 00000`,
      capacity: vehicles[0]?.capacity || 65,
    };
    setVehicles((prev) => [...prev, newVehicle]);
    setOptimizationResult(null);
    setHasDispatched(false);
  };

  // Handler: Update fleet capacity
  const handleUpdateVehicleCapacity = (capacity: number) => {
    setVehicles((prev) =>
      prev.map((v) => ({
        ...v,
        capacity,
      }))
    );
    setOptimizationResult(null);
    setHasDispatched(false);
  };

  // Handler: Remove vehicle
  const handleRemoveVehicle = (id: string) => {
    if (vehicles.length <= 1) return;
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    setOptimizationResult(null);
    setHasDispatched(false);
  };

  // Handler: Reset preset
  const handleResetPreset = async () => {
    try {
      const preset = await apiService.getPreset();
      setDepot(preset.depot);
      setDeliveries(preset.deliveries);
      setVehicles(preset.vehicles);
      setTrafficSegments(preset.traffic_segments);
    } catch {
      setDepot(DEFAULT_DEPOT);
      setDeliveries(DEFAULT_DELIVERIES);
      setVehicles(DEFAULT_VEHICLES);
      setTrafficSegments([]);
    }
    setTrafficAdjustments([]);
    setTrafficScenario('normal');
    setOptimizationResult(null);
    setActiveIncident(null);
    setIncidentComparison(null);
    setIncidentTimeline([]);
    setHasDispatched(false);
  };

  const selectedDriverRoute = driverDispatchResult?.routes.find(
    (route) => route.vehicle.id === selectedDriverVehicleId
  );
  const mapDepot: NaviLocation = role === 'driver' && selectedDriverRoute
    ? (() => {
        const stop = selectedDriverRoute.stops.find((routeStop) => routeStop.type === 'depot');
        return stop ? {
          id: stop.location_id,
          name: stop.name.replace(/ \(Return\)$/, ''),
          lat: stop.lat,
          lng: stop.lng,
          demand: 0,
          ready_time: stop.ready_time,
          due_date: stop.due_date,
          service_time: stop.service_time,
          priority: stop.priority ?? 'normal',
        } : depot;
      })()
    : depot;
  const mapDeliveries: NaviLocation[] = role === 'driver'
    ? (selectedDriverRoute?.stops.filter((stop) => stop.type === 'customer').map((stop) => ({
        id: stop.location_id,
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        demand: stop.demand,
        ready_time: stop.ready_time,
        due_date: stop.due_date,
        service_time: stop.service_time,
        priority: stop.priority ?? 'normal',
      })) ?? [])
    : deliveries;

  const incidentCorridors = useMemo<TrafficIncidentCorridor[]>(() => {
    const activeRoutesResult = role === 'driver' || hasDispatched ? driverDispatchResult : null;
    const routes = activeRoutesResult
      ? activeRoutesResult.routes
      : optimizationResult?.routes ?? [];
    const validLocationIds = new Set(activeRoutesResult
      ? activeRoutesResult.routes.flatMap((route) => route.stops.map((stop) => stop.location_id))
      : [depot.id, ...deliveries.map((delivery) => delivery.id)]);
    const deliveredIds = new Set(completedLocationIds);
    if (activeRoutesResult) {
      activeRoutesResult.routes.forEach((route) => {
        const completedForRoute = new Set(driverProgress[route.vehicle.driver_name] ?? []);
        if (route.vehicle.id === selectedDriverVehicleId) completedStops.forEach((number) => completedForRoute.add(number));
        route.stops.forEach((stop) => {
          if (stop.type === 'customer' && completedForRoute.has(stop.stop_number)) deliveredIds.add(stop.location_id);
        });
      });
    }
    return routes.flatMap((route) => {
      const geometry = route.road_geometry;
      if (!geometry || geometry.length < 2) return [];
      const nearestGeometryIndex = (lat: number, lng: number) => {
        let nearest = 0;
        let nearestDistance = Number.POSITIVE_INFINITY;
        geometry.forEach(([routeLat, routeLng], index) => {
          const distance = ((routeLat - lat) * 110.9) ** 2 + ((routeLng - lng) * 104.9) ** 2;
          if (distance < nearestDistance) {
            nearest = index;
            nearestDistance = distance;
          }
        });
        return nearest;
      };
      const legs: TrafficIncidentCorridor[] = [];
      for (let index = 0; index < route.stops.length - 1; index += 1) {
        const from = route.stops[index];
        const to = route.stops[index + 1];
        if (from.location_id === to.location_id) continue;
        if (!validLocationIds.has(from.location_id) || !validLocationIds.has(to.location_id)) continue;
        if (deliveredIds.has(from.location_id) || deliveredIds.has(to.location_id)) continue;
        const fromIndex = nearestGeometryIndex(from.lat, from.lng);
        const toIndex = nearestGeometryIndex(to.lat, to.lng);
        const low = Math.min(fromIndex, toIndex);
        const high = Math.max(fromIndex, toIndex);
        const legGeometry = geometry.slice(low, high + 1);
        if (legGeometry.length < 2) continue;
        const followsGeometryOrder = fromIndex <= toIndex;
        legs.push({
          id: `${route.route_id}:${index}`,
          label: `${route.vehicle.name}: ${from.name} → ${to.name}`,
          from_location_id: from.location_id,
          to_location_id: to.location_id,
          from_name: from.name,
          to_name: to.name,
          coords: followsGeometryOrder ? legGeometry : [...legGeometry].reverse(),
        });
      }
      return legs;
    });
  }, [completedLocationIds, completedStops, deliveries, depot.id, driverDispatchResult, driverProgress, hasDispatched, optimizationResult, role, selectedDriverVehicleId]);

  const visibleTrafficSegments = useMemo(() => {
    const dispatchedAdjustments = role === 'driver'
      ? driverDispatchResult?.traffic_adjustments ?? []
      : [];
    const eventAdjustment: TrafficAdjustment[] = activeIncident ? [{
      id: activeIncident.id,
      incident_id: activeIncident.id,
      incident_type: activeIncident.type,
      from_location_id: activeIncident.from_location_id,
      to_location_id: activeIncident.to_location_id,
      delay_percent: activeIncident.severity_percent,
      closed: activeIncident.type === 'road_closure',
      coords: activeIncident.coords,
      incident_started_at: activeIncident.started_at,
      incident_expires_at: activeIncident.expires_at,
      incident_duration_seconds: activeIncident.duration_seconds,
    }] : [];
    const incidentPair = activeIncident
      ? [activeIncident.from_location_id, activeIncident.to_location_id].sort((a, b) => a - b).join(':')
      : null;
    const visibleManualAdjustments = incidentPair
      ? trafficAdjustments.filter((adjustment) => (
          [adjustment.from_location_id, adjustment.to_location_id].sort((a, b) => a - b).join(':') !== incidentPair
        ))
      : trafficAdjustments;
    const activeAdjustments = role === 'driver'
      ? dispatchedAdjustments
      : [...visibleManualAdjustments, ...eventAdjustment];
    const incidentSegments: TrafficSegment[] = activeAdjustments
      .filter((adjustment) => adjustment.incident_id && (adjustment.coords?.length ?? 0) >= 2)
      .map((adjustment) => {
        const isClosure = Boolean(adjustment.closed);
        const typeLabel = adjustment.incident_type === 'road_closure'
          ? 'Simulated road closure'
          : adjustment.incident_type === 'accident'
            ? 'Simulated accident'
            : 'Simulated congestion';
        const from = [depot, ...deliveries].find((location) => location.id === adjustment.from_location_id)?.name ?? 'Road segment';
        const to = [depot, ...deliveries].find((location) => location.id === adjustment.to_location_id)?.name ?? 'Road segment';
        return {
          segment_id: `incident-${adjustment.incident_id}`,
          road_name: `${from} → ${to}`,
          condition: typeLabel,
          status: 'warning',
          speed_kmh: isClosure ? 0 : Math.max(1, Math.round(30 / (1 + adjustment.delay_percent / 100))),
          delay_min: isClosure ? 0 : Math.round((adjustment.delay_percent / 100) * 5),
          coords: adjustment.coords ?? [],
          description: `${typeLabel}. Optimizer applies a ${isClosure ? 'prohibitively high closure penalty' : `${adjustment.delay_percent}% modeled delay`} and automatically recalculates the route. Demo event; no live feed is connected.`,
        };
      });
    const points = role === 'driver' && selectedDriverRoute
      ? selectedDriverRoute.stops
      : [depot, ...deliveries];
    const pointById = new Map(points.map((point) => [
      'location_id' in point ? point.location_id : point.id,
      point,
    ]));
    const routeLegs = new Set<string>();
    if (role === 'driver' && selectedDriverRoute) {
      selectedDriverRoute.stops.slice(1).forEach((stop, index) => {
        const previous = selectedDriverRoute.stops[index];
        routeLegs.add([previous.location_id, stop.location_id].sort((a, b) => a - b).join(':'));
      });
    }
    const manualSegments = activeAdjustments.filter((adjustment) => !adjustment.incident_id).flatMap((adjustment) => {
      const from = pointById.get(adjustment.from_location_id);
      const to = pointById.get(adjustment.to_location_id);
      if (!from || !to) return [];
      const legKey = [adjustment.from_location_id, adjustment.to_location_id].sort((a, b) => a - b).join(':');
      if (role === 'driver' && !routeLegs.has(legKey)) return [];
      const fromLat = from.lat;
      const fromLng = from.lng;
      const toLat = to.lat;
      const toLng = to.lng;
      const distanceKm = Math.hypot((toLat - fromLat) * 110.9, (toLng - fromLng) * 104.9);
      const delay = adjustment.delay_percent;
      const fromName = from.name;
      const toName = to.name;
      let segmentCoords: [number, number][] = [[fromLat, fromLng], [toLat, toLng]];
      const candidateRoutes = role === 'driver'
        ? (selectedDriverRoute ? [selectedDriverRoute] : [])
        : optimizationResult?.routes ?? [];
      for (const route of candidateRoutes) {
        const geometry = route.road_geometry;
        if (!geometry || geometry.length < 2) continue;
        for (let index = 0; index < route.stops.length - 1; index += 1) {
          const first = route.stops[index];
          const second = route.stops[index + 1];
          const isForwardLeg = first.location_id === adjustment.from_location_id && second.location_id === adjustment.to_location_id;
          const isReverseLeg = first.location_id === adjustment.to_location_id && second.location_id === adjustment.from_location_id;
          if (!isForwardLeg && !isReverseLeg) continue;
          const closestGeometryIndex = (lat: number, lng: number) => {
            let closestIndex = 0;
            let closestDistance = Number.POSITIVE_INFINITY;
            geometry.forEach(([routeLat, routeLng], geometryIndex) => {
              const distance = ((routeLat - lat) * 110.9) ** 2 + ((routeLng - lng) * 104.9) ** 2;
              if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = geometryIndex;
              }
            });
            return closestIndex;
          };
          const firstIndex = closestGeometryIndex(first.lat, first.lng);
          const secondIndex = closestGeometryIndex(second.lat, second.lng);
          const low = Math.min(firstIndex, secondIndex);
          const high = Math.max(firstIndex, secondIndex);
          const legGeometry = geometry.slice(low, high + 1);
          if (legGeometry.length >= 2) {
            const followsAdjustmentDirection = isForwardLeg === (firstIndex <= secondIndex);
            segmentCoords = followsAdjustmentDirection ? legGeometry : [...legGeometry].reverse();
          }
          break;
        }
        if (segmentCoords.length > 2) break;
      }
      return [{
        segment_id: `manual-${adjustment.id}`,
        road_name: `${fromName} → ${toName}`,
        condition: `Manual slowdown +${delay}%`,
        status: delay >= 75 ? 'warning' as const : 'caution' as const,
        speed_kmh: Math.max(1, Math.round(30 / (1 + delay / 100))),
        delay_min: Math.round((distanceKm / 30) * 60 * delay / 100),
        coords: segmentCoords,
        description: `Admin-defined slowdown. Optimizer applies +${delay}% travel time to this corridor. The map follows the optimized road leg when available.`,
      }];
    });
    return [...trafficSegments, ...manualSegments, ...incidentSegments];
  }, [trafficSegments, trafficAdjustments, activeIncident, role, driverDispatchResult, selectedDriverRoute, depot, deliveries, optimizationResult]);

  return (
    <div className="min-h-screen flex flex-col bg-sand-100">
      {/* Navbar Header */}
      <Navbar
        currentSection={currentSection}
        onNavigate={setCurrentSection}
        isBackendConnected={isBackendConnected}
        onRefreshData={handleResetPreset}
      />

      {currentSection === 'home' ? (
        <HomeLanding
          algorithms={algorithms}
          backendConnected={isBackendConnected}
          depot={depot}
          deliveries={deliveries}
          result={hasDispatched ? (driverDispatchResult ?? optimizationResult) : (optimizationResult ?? driverDispatchResult)}
          isOptimizing={isOptimizing}
          algorithmName={algorithms.find((algorithm) => algorithm.id === selectedAlgorithm)?.name ?? selectedAlgorithm}
          trafficSegments={visibleTrafficSegments}
          onRunOptimization={handleOptimize}
          onNavigate={setCurrentSection}
        />
      ) : currentSection === 'benchmarks' ? (
        <BenchmarkDashboard />
      ) : (
      /* Admin and driver workspaces */
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col lg:flex-row gap-4">
        {/* Left Side: Role Specific Control Deck */}
        <section className="w-full lg:w-[450px] shrink-0 h-[650px] lg:h-[calc(100vh-6.5rem)]">
          {role === 'admin' ? (
            <AdminPanel
              algorithms={algorithms}
              selectedAlgorithm={selectedAlgorithm}
              onSelectAlgorithm={(algorithm) => {
                setSelectedAlgorithm(algorithm);
                setOptimizationResult(null);
                setHasDispatched(false);
              }}
              trafficScenario={trafficScenario}
              onSelectTrafficScenario={handleSelectTrafficScenario}
              depot={depot}
              onUpdateDepot={handleUpdateDepot}
              deliveries={deliveries}
              onAddDelivery={handleAddDelivery}
              onRemoveDelivery={handleRemoveDelivery}
              onUpdateDelivery={handleUpdateDelivery}
              trafficAdjustments={trafficAdjustments}
              onAddTrafficAdjustment={handleAddTrafficAdjustment}
              onRemoveTrafficAdjustment={handleRemoveTrafficAdjustment}
              incidentCorridors={incidentCorridors}
              activeIncident={activeIncident}
              incidentTimeline={incidentTimeline}
              incidentComparison={incidentComparison}
              incidentSecondsRemaining={incidentSecondsRemaining}
              onTriggerIncident={handleTriggerIncident}
              onClearIncident={handleClearIncident}
              vehicles={vehicles}
              onAddVehicle={handleAddVehicle}
              onUpdateVehicleCapacity={handleUpdateVehicleCapacity}
              onRemoveVehicle={handleRemoveVehicle}
              onOptimize={handleOptimize}
              isOptimizing={isOptimizing}
              optimizationResult={optimizationResult}
              onDispatch={handleDispatch}
              isDispatching={isDispatching}
              hasDispatched={hasDispatched}
            />
          ) : (
            <DriverPanel
              routes={driverDispatchResult?.routes || []}
              selectedVehicleId={selectedDriverVehicleId}
              onSelectVehicleId={setSelectedDriverVehicleId}
              completedStops={completedStops}
              onCompleteStop={handleCompleteStop}
              trafficAlerts={driverDispatchResult?.traffic_alerts || []}
            />
          )}
        </section>

        {/* Right Side: Interactive OpenStreetMap */}
        <section className="relative flex-1 h-[500px] lg:h-[calc(100vh-6.5rem)]">
          <MapComponent
            depot={mapDepot}
            deliveries={mapDeliveries}
            routes={role === 'driver' ? driverDispatchResult?.routes || [] : optimizationResult?.routes || []}
            trafficSegments={visibleTrafficSegments}
            selectedVehicleId={role === 'driver' ? selectedDriverVehicleId : undefined}
            role={role}
            completedStopNumbers={completedStops}
            onMapClick={handleMapClick}
            onRemoveDelivery={handleRemoveDelivery}
          />
          {role === 'driver' && (
            <DriverNavigationPhone
              route={selectedDriverRoute ?? null}
              completedStops={completedStops}
              onCompleteStop={handleCompleteStop}
            />
          )}
        </section>
      </main>
      )}
    </div>
  );
}

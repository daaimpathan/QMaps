'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  NaviLocation,
  NaviVehicle,
  OptimizationResult,
  AlgorithmInfo,
  TrafficAdjustment,
  TrafficIncident,
  TrafficIncidentCorridor,
  TrafficIncidentComparison,
  TrafficIncidentType,
  DeliveryPriority,
} from '../types';
import {
  Sparkles,
  Play,
  Send,
  Plus,
  Trash2,
  Clock,
  Package,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Truck,
  TrendingDown,
  Info,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import { routeDisplayColorAt } from '../utils/routeColor';

interface DeliveryEditDraft {
  name: string;
  lat: string;
  lng: string;
  demand: string;
  readyTime: string;
  dueTime: string;
  serviceTime: string;
  priority: DeliveryPriority;
}

interface AdminPanelProps {
  algorithms: AlgorithmInfo[];
  selectedAlgorithm: string;
  onSelectAlgorithm: (algoId: string) => void;
  trafficScenario: string;
  onSelectTrafficScenario: (scenario: string) => void;
  depot: NaviLocation;
  onUpdateDepot: (depot: NaviLocation) => void;
  deliveries: NaviLocation[];
  onAddDelivery: (delivery: NaviLocation) => void;
  onRemoveDelivery: (id: number) => void;
  onUpdateDelivery: (delivery: NaviLocation) => void;
  trafficAdjustments: TrafficAdjustment[];
  onAddTrafficAdjustment: (adjustment: TrafficAdjustment) => void;
  onRemoveTrafficAdjustment: (id: string) => void;
  incidentCorridors: TrafficIncidentCorridor[];
  activeIncident: TrafficIncident | null;
  incidentTimeline: TrafficIncident[];
  incidentComparison: TrafficIncidentComparison | null;
  incidentSecondsRemaining: number;
  onTriggerIncident: (incident: TrafficIncident) => void;
  onClearIncident: () => void;
  vehicles: NaviVehicle[];
  onAddVehicle: () => void;
  onUpdateVehicleCapacity: (capacity: number) => void;
  onRemoveVehicle: (id: string) => void;
  onOptimize: () => void;
  isOptimizing: boolean;
  optimizationResult: OptimizationResult | null;
  onDispatch: () => void;
  isDispatching: boolean;
  hasDispatched: boolean;
}

const rerouteExplanation = (comparison: TrafficIncidentComparison) => {
  const incidentLabel = comparison.incident_type === 'road_closure'
    ? 'modeled road closure'
    : `modeled ${comparison.incident_type} (+${comparison.severity_percent}% delay)`;
  const link = `${comparison.from_name} ↔ ${comparison.to_name}`;
  let routeFinding: string;

  if (comparison.before_uses_incident_link && !comparison.after_uses_incident_link) {
    routeFinding = `The new stop sequence avoids the affected link ${link}.`;
  } else if (comparison.before_uses_incident_link && comparison.after_uses_incident_link) {
    routeFinding = `The new stop sequence still uses ${link}; it did not avoid this affected link.`;
  } else if (!comparison.before_uses_incident_link && comparison.after_uses_incident_link) {
    routeFinding = `The new stop sequence now uses ${link}, which was not used before the incident.`;
  } else {
    routeFinding = `The affected link ${link} was not used before or after; changes came from re-optimizing the route plan.`;
  }

  const distanceDelta = comparison.after_distance_km - comparison.before_distance_km;
  const timeDelta = comparison.after_travel_time_min - comparison.before_travel_time_min;
  const distanceImpact = Math.abs(distanceDelta) < 0.05
    ? 'distance stayed about the same'
    : `distance ${distanceDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(distanceDelta).toFixed(1)} km`;
  const timeImpact = Math.abs(timeDelta) < 0.05
    ? 'modeled travel time stayed about the same'
    : `modeled travel time ${timeDelta > 0 ? 'increased' : 'decreased'} by ${Math.abs(timeDelta).toFixed(1)} min`;
  const beforeCompliance = comparison.before_time_window_compliance_pct;
  const afterCompliance = comparison.after_time_window_compliance_pct;
  const complianceImpact = Math.abs(afterCompliance - beforeCompliance) < 0.05
    ? `Time-window compliance remained ${afterCompliance.toFixed(1)}%.`
    : `Time-window compliance changed from ${beforeCompliance.toFixed(1)}% to ${afterCompliance.toFixed(1)}%.`;

  return `${routeFinding} The ${incidentLabel} was applied to this modeled stop-to-stop link. Overall, ${distanceImpact} and ${timeImpact}. ${complianceImpact}`;
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  algorithms,
  selectedAlgorithm,
  onSelectAlgorithm,
  trafficScenario,
  onSelectTrafficScenario,
  depot,
  onUpdateDepot,
  deliveries,
  onAddDelivery,
  onRemoveDelivery,
  onUpdateDelivery,
  trafficAdjustments,
  onAddTrafficAdjustment,
  onRemoveTrafficAdjustment,
  incidentCorridors,
  activeIncident,
  incidentTimeline,
  incidentComparison,
  incidentSecondsRemaining,
  onTriggerIncident,
  onClearIncident,
  vehicles,
  onAddVehicle,
  onUpdateVehicleCapacity,
  onRemoveVehicle,
  onOptimize,
  isOptimizing,
  optimizationResult,
  onDispatch,
  isDispatching,
  hasDispatched,
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'results' | 'deliveries'>('config');
  const [newLocName, setNewLocName] = useState('');
  const [newLocDemand, setNewLocDemand] = useState(15);
  const [newLocReady, setNewLocReady] = useState(30);
  const [newLocDue, setNewLocDue] = useState(240);
  const [newLocPriority, setNewLocPriority] = useState<DeliveryPriority>('normal');
  const [newLocLat, setNewLocLat] = useState(19.0771);
  const [newLocLng, setNewLocLng] = useState(73.0125);
  const [trafficFromId, setTrafficFromId] = useState(depot.id);
  const [trafficToId, setTrafficToId] = useState(deliveries[0]?.id ?? 1);
  const [trafficDelayPercent, setTrafficDelayPercent] = useState(40);
  const [incidentType, setIncidentType] = useState<TrafficIncidentType>('accident');
  const [incidentSeverity, setIncidentSeverity] = useState(120);
  const [incidentDuration, setIncidentDuration] = useState(90);
  const [incidentCorridorId, setIncidentCorridorId] = useState('');
  const [dataUseAcknowledged, setDataUseAcknowledged] = useState(false);
  const [editingDeliveryId, setEditingDeliveryId] = useState<number | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState<DeliveryEditDraft | null>(null);
  const [deliveryEditError, setDeliveryEditError] = useState('');
  const [isEditingDepot, setIsEditingDepot] = useState(false);
  const [depotDraft, setDepotDraft] = useState<DeliveryEditDraft | null>(null);
  const [depotEditError, setDepotEditError] = useState('');

  useEffect(() => {
    setDataUseAcknowledged(false);
  }, [deliveries, vehicles, trafficAdjustments, selectedAlgorithm]);

  const minutesToClock = (minutesFromEight: number) => {
    const total = 8 * 60 + minutesFromEight;
    const hours = Math.floor(total / 60) % 24;
    const minutes = total % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const clockToMinutes = (clock: string) => {
    const [hours, minutes] = clock.split(':').map(Number);
    return hours * 60 + minutes - 8 * 60;
  };

  const formatDelta = (value: number, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;

  const beginDeliveryEdit = (delivery: NaviLocation) => {
    setEditingDeliveryId(delivery.id);
    setDeliveryDraft({
      name: delivery.name,
      lat: String(delivery.lat),
      lng: String(delivery.lng),
      demand: String(delivery.demand),
      readyTime: minutesToClock(delivery.ready_time),
      dueTime: minutesToClock(delivery.due_date),
      serviceTime: String(delivery.service_time),
      priority: delivery.priority ?? 'normal',
    });
    setDeliveryEditError('');
  };

  const cancelDeliveryEdit = () => {
    setEditingDeliveryId(null);
    setDeliveryDraft(null);
    setDeliveryEditError('');
  };

  const saveDeliveryEdit = (event: React.FormEvent, delivery: NaviLocation) => {
    event.preventDefault();
    if (!deliveryDraft) return;

    const name = deliveryDraft.name.trim();
    const lat = Number(deliveryDraft.lat);
    const lng = Number(deliveryDraft.lng);
    const demand = Number(deliveryDraft.demand);
    const readyTime = clockToMinutes(deliveryDraft.readyTime);
    const dueTime = clockToMinutes(deliveryDraft.dueTime);
    const serviceTime = Number(deliveryDraft.serviceTime);

    if (!name) return setDeliveryEditError('Enter a location name.');
    if (!Number.isFinite(lat) || lat < 18.95 || lat > 19.22) {
      return setDeliveryEditError('Latitude must be between 18.95 and 19.22 for the Navi Mumbai service area.');
    }
    if (!Number.isFinite(lng) || lng < 72.85 || lng > 73.15) {
      return setDeliveryEditError('Longitude must be between 72.85 and 73.15 for the Navi Mumbai service area.');
    }
    if (!Number.isFinite(demand) || demand <= 0) return setDeliveryEditError('Demand must be greater than 0 kg.');
    if (!Number.isFinite(readyTime) || !Number.isFinite(dueTime) || readyTime < 0 || dueTime > 720 || readyTime > dueTime) {
      return setDeliveryEditError('Set a valid delivery window between 08:00 and 20:00.');
    }
    if (!Number.isFinite(serviceTime) || serviceTime < 0 || serviceTime > 720) {
      return setDeliveryEditError('Service time must be between 0 and 720 minutes.');
    }

    onUpdateDelivery({
      ...delivery,
      name,
      lat,
      lng,
      demand,
      ready_time: readyTime,
      due_date: dueTime,
      service_time: serviceTime,
      priority: deliveryDraft.priority,
    });
    cancelDeliveryEdit();
  };

  const beginDepotEdit = () => {
    setIsEditingDepot(true);
    setDepotDraft({
      name: depot.name,
      lat: String(depot.lat),
      lng: String(depot.lng),
      demand: '0',
      readyTime: minutesToClock(depot.ready_time),
      dueTime: minutesToClock(depot.due_date),
      serviceTime: '0',
      priority: 'normal',
    });
    setDepotEditError('');
  };

  const cancelDepotEdit = () => {
    setIsEditingDepot(false);
    setDepotDraft(null);
    setDepotEditError('');
  };

  const saveDepotEdit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!depotDraft) return;

    const name = depotDraft.name.trim();
    const lat = Number(depotDraft.lat);
    const lng = Number(depotDraft.lng);
    const readyTime = clockToMinutes(depotDraft.readyTime);
    const dueTime = clockToMinutes(depotDraft.dueTime);
    if (!name) return setDepotEditError('Enter a depot name.');
    if (!Number.isFinite(lat) || lat < 18.95 || lat > 19.22) {
      return setDepotEditError('Latitude must be between 18.95 and 19.22 for the Navi Mumbai service area.');
    }
    if (!Number.isFinite(lng) || lng < 72.85 || lng > 73.15) {
      return setDepotEditError('Longitude must be between 72.85 and 73.15 for the Navi Mumbai service area.');
    }
    if (!Number.isFinite(readyTime) || !Number.isFinite(dueTime) || readyTime < 0 || dueTime > 720 || readyTime > dueTime) {
      return setDepotEditError('Set a valid depot operating window between 08:00 and 20:00.');
    }

    onUpdateDepot({ ...depot, name, lat, lng, ready_time: readyTime, due_date: dueTime });
    cancelDepotEdit();
  };

  const handleManualAddStop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim() || newLocReady > newLocDue) return;

    const nextId = deliveries.length > 0 ? Math.max(...deliveries.map((d) => d.id)) + 1 : 1;

    const newStop: NaviLocation = {
      id: nextId,
      name: newLocName,
      lat: Number(newLocLat),
      lng: Number(newLocLng),
      demand: Number(newLocDemand),
      ready_time: Number(newLocReady),
      due_date: Number(newLocDue),
      service_time: 15,
      priority: newLocPriority,
    };

    onAddDelivery(newStop);
    setNewLocName('');
  };

  const currentVehicleCapacity = vehicles.length > 0 ? vehicles[0].capacity : 65;
  const streetRoutingReady = Boolean(
    optimizationResult?.routes.length && optimizationResult.routes.every((route) => route.street_routing_status === 'ready')
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
      {/* Panel Navigation Tabs */}
      <div className="flex items-center border-b border-stone-200 bg-stone-50/70 p-2 gap-1">
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'config'
              ? 'bg-white text-olive-600 shadow-xs border border-stone-200'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          <span>Setup & Fleet</span>
        </button>

        <button
          onClick={() => setActiveTab('deliveries')}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'deliveries'
              ? 'bg-white text-olive-600 shadow-xs border border-stone-200'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Package className="h-3.5 w-3.5" />
          <span>Stops ({deliveries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          disabled={!optimizationResult}
          className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === 'results'
              ? 'bg-white text-olive-600 shadow-xs border border-stone-200'
              : optimizationResult
              ? 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
              : 'text-stone-300 cursor-not-allowed'
          }`}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          <span>Results {optimizationResult ? '✓' : ''}</span>
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: CONFIGURATION & FLEET */}
        {activeTab === 'config' && (
          <div className="space-y-5">
            {/* Algorithm Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center space-x-1">
                  <Sparkles className="h-3.5 w-3.5 text-olive-600" />
                  <span>Optimization Algorithm</span>
                </label>
                <span className="text-[10px] text-stone-400 font-medium">Research VRP Engine</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {algorithms.map((algo) => {
                  const isSelected = selectedAlgorithm === algo.id;
                  const isQuantum = ['qpso', 'qaco', 'qa_qpso'].includes(algo.id);
                  const isHybrid = algo.id === 'qa_qpso';

                  return (
                    <button
                      key={algo.id}
                      type="button"
                      onClick={() => onSelectAlgorithm(algo.id)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition-all relative ${
                        isSelected
                          ? 'border-olive-600 bg-olive-50/70 text-olive-950 font-semibold ring-1 ring-olive-600 shadow-xs'
                          : 'border-stone-200 hover:border-stone-300 bg-stone-50/50 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-stone-900">{algo.name}</span>
                        {isHybrid ? (
                          <span className="text-[9px] bg-gradient-to-r from-olive-500 to-olive-500 text-white font-bold px-1.5 py-0.5 rounded-full">
                            Hybrid ★
                          </span>
                        ) : isQuantum ? (
                          <span className="text-[9px] bg-olive-100 text-olive-800 font-semibold px-1.5 py-0.5 rounded-full border border-olive-300">
                            Quantum
                          </span>
                        ) : (
                          <span className="text-[9px] bg-stone-100 text-stone-600 font-medium px-1.5 py-0.5 rounded-full">
                            Classical
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-500 line-clamp-1">{algo.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Traffic Scenario */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center space-x-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span>Navi Mumbai Traffic Simulation</span>
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'normal', name: 'Normal Traffic', desc: 'Typical suburban flow' },
                  { id: 'rush_hour', name: 'Rush Hour Congestion', desc: '+45% delay on Mahape/TBR' },
                  { id: 'road_closure', name: 'Road Closure Detour', desc: 'APMC market road blocked' },
                  { id: 'accident', name: 'Accident Collision', desc: 'Sanpada junction bottleneck' },
                ].map((scen) => (
                  <button
                    key={scen.id}
                    onClick={() => onSelectTrafficScenario(scen.id)}
                    className={`p-2 rounded-xl text-left border text-xs transition-all ${
                      trafficScenario === scen.id
                        ? 'border-amber-500 bg-amber-50/60 font-semibold text-amber-950 ring-1 ring-amber-500'
                        : 'border-stone-200 hover:border-stone-300 bg-white text-stone-700'
                    }`}
                  >
                    <div className="font-semibold text-stone-900">{scen.name}</div>
                    <div className="text-[10px] text-stone-500">{scen.desc}</div>
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/60 space-y-2">
                <div>
                  <div className="text-xs font-semibold text-stone-900">Manual corridor slowdown</div>
                  <p className="text-[10px] text-stone-600">Adds a travel-time increase to the selected link and factors it into routing.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[10px] text-stone-600">From
                    <select
                      value={String(deliveries.some((d) => d.id === trafficFromId) || depot.id === trafficFromId ? trafficFromId : depot.id)}
                      onChange={(e) => setTrafficFromId(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-lg border border-stone-300 bg-white text-stone-800"
                    >
                      {[depot, ...deliveries].map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                  </label>
                  <label className="text-[10px] text-stone-600">To
                    <select
                      value={String((trafficFromId === depot.id || deliveries.some((d) => d.id === trafficFromId)) && trafficToId !== trafficFromId && (trafficToId === depot.id || deliveries.some((d) => d.id === trafficToId)) ? trafficToId : ([depot, ...deliveries].find((location) => location.id !== trafficFromId)?.id ?? depot.id))}
                      onChange={(e) => setTrafficToId(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-lg border border-stone-300 bg-white text-stone-800"
                    >
                      {[depot, ...deliveries].filter((location) => location.id !== trafficFromId).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex-1 text-[10px] text-stone-600">Extra travel time (%)
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={trafficDelayPercent}
                      onChange={(e) => setTrafficDelayPercent(Number(e.target.value))}
                      className="mt-0.5 w-full px-2 py-1.5 text-[11px] rounded-lg border border-stone-300 bg-white text-stone-800"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={[depot, ...deliveries].length < 2 || trafficDelayPercent < 1 || trafficDelayPercent > 300}
                    onClick={() => {
                      const locations = [depot, ...deliveries];
                      const fromId = locations.some((location) => location.id === trafficFromId) ? trafficFromId : depot.id;
                      const toId = locations.some((location) => location.id === trafficToId && location.id !== fromId)
                        ? trafficToId
                        : locations.find((location) => location.id !== fromId)?.id;
                      if (toId === undefined) return;
                      onAddTrafficAdjustment({
                        id: `corridor-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        from_location_id: fromId,
                        to_location_id: toId,
                        delay_percent: trafficDelayPercent,
                      });
                    }}
                    className="px-3 py-1.5 text-[11px] rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50"
                  >Add</button>
                </div>
                {trafficAdjustments.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-amber-200">
                    {trafficAdjustments.map((adjustment) => {
                      const from = [depot, ...deliveries].find((location) => location.id === adjustment.from_location_id)?.name ?? 'Removed stop';
                      const to = [depot, ...deliveries].find((location) => location.id === adjustment.to_location_id)?.name ?? 'Removed stop';
                      return (
                        <div key={adjustment.id} className="flex items-center justify-between gap-2 text-[10px] text-amber-950">
                          <span className="truncate">{from} → {to}: <b>+{adjustment.delay_percent}%</b></span>
                          <button type="button" onClick={() => onRemoveTrafficAdjustment(adjustment.id)} aria-label="Remove manual slowdown" className="shrink-0 text-amber-800 hover:text-rose-700"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Live Incident Replay */}
            <div className="space-y-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-stone-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                    <span>Incident Response Simulator</span>
                  </label>
                  <p className="mt-1 text-[10px] leading-4 text-stone-600">
                    Demo event. Re-optimizes planned stops; live traffic and van GPS feeds are not connected.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-rose-700">Simulation</span>
              </div>

              {activeIncident ? (
                <div className="rounded-lg border border-rose-200 bg-white p-2.5 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold text-rose-800">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-rose-600" />
                      {activeIncident.type === 'road_closure' ? 'Road closure' : activeIncident.type === 'accident' ? 'Accident' : 'Heavy congestion'} active
                    </span>
                    <span className="font-semibold tabular-nums text-stone-600">{Math.floor(incidentSecondsRemaining / 60)}:{String(incidentSecondsRemaining % 60).padStart(2, '0')} left</span>
                  </div>
                  <div className="mt-1 truncate text-stone-700">{activeIncident.from_name} → {activeIncident.to_name}</div>
                  <button type="button" disabled={isOptimizing || isDispatching} onClick={onClearIncident} className="mt-2 w-full rounded-md border border-stone-200 px-2 py-1.5 text-[10px] font-semibold text-stone-700 hover:bg-stone-50 disabled:cursor-wait disabled:opacity-50">
                    {isOptimizing || isDispatching ? 'Updating driver routes…' : 'End incident and recalculate now'}
                  </button>
                </div>
              ) : (
                <>
                  {incidentCorridors.length > 0 ? (
                    <>
                      <label className="block text-[10px] text-stone-600">Affected road segment
                        <select
                          value={incidentCorridors.some((corridor) => corridor.id === incidentCorridorId) ? incidentCorridorId : incidentCorridors[0].id}
                          onChange={(event) => setIncidentCorridorId(event.target.value)}
                          className="mt-0.5 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px] text-stone-800"
                        >
                          {incidentCorridors.map((corridor) => <option key={corridor.id} value={corridor.id}>{corridor.label}</option>)}
                        </select>
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] text-stone-600">Incident
                          <select value={incidentType} onChange={(event) => setIncidentType(event.target.value as TrafficIncidentType)} className="mt-0.5 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px] text-stone-800">
                            <option value="accident">Accident</option>
                            <option value="congestion">Heavy congestion</option>
                            <option value="road_closure">Road closure</option>
                          </select>
                        </label>
                        <label className="text-[10px] text-stone-600">Duration
                          <select value={incidentDuration} onChange={(event) => setIncidentDuration(Number(event.target.value))} className="mt-0.5 w-full rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px] text-stone-800">
                            <option value={60}>1 minute</option>
                            <option value={90}>90 seconds</option>
                            <option value={180}>3 minutes</option>
                          </select>
                        </label>
                      </div>
                      {incidentType !== 'road_closure' && (
                        <label className="block text-[10px] text-stone-600">Modeled delay: {incidentSeverity}%
                          <input type="range" min="40" max="250" step="10" value={incidentSeverity} onChange={(event) => setIncidentSeverity(Number(event.target.value))} className="mt-1 h-1.5 w-full cursor-pointer accent-rose-600" />
                        </label>
                      )}
                      <button
                        type="button"
                        disabled={isOptimizing || isDispatching || Boolean(activeIncident)}
                        onClick={() => {
                          const corridor = incidentCorridors.find((item) => item.id === incidentCorridorId) ?? incidentCorridors[0];
                          if (!corridor) return;
                          const now = new Date();
                          const incidentId = `incident-${Date.now()}`;
                          onTriggerIncident({
                            id: incidentId,
                            type: incidentType,
                            from_location_id: corridor.from_location_id,
                            to_location_id: corridor.to_location_id,
                            from_name: corridor.from_name,
                            to_name: corridor.to_name,
                            severity_percent: incidentType === 'road_closure' ? 300 : incidentSeverity,
                            duration_seconds: incidentDuration,
                            started_at: now.toISOString(),
                            expires_at: new Date(now.getTime() + incidentDuration * 1000).toISOString(),
                            coords: corridor.coords,
                            status: 'active',
                          });
                        }}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isOptimizing || isDispatching ? <Clock className="h-3.5 w-3.5 animate-pulse" /> : <Play className="h-3.5 w-3.5" />}
                        {isOptimizing || isDispatching ? 'Re-optimizing routes…' : 'Trigger incident & reroute'}
                      </button>
                    </>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-white p-2 text-[10px] leading-4 text-amber-800">
                      Optimize routes first. The simulator uses a real road segment from the route to place the incident accurately.
                    </p>
                  )}
                </>
              )}

              {incidentComparison && (
                <div className="rounded-lg border border-olive-200 bg-white p-2.5 text-[10px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold uppercase tracking-wide text-olive-900">Reroute explanation</span>
                    <span className="truncate text-stone-500">{incidentComparison.algorithm_name}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-stone-50 p-2">
                      <div className="text-stone-500">Total distance</div>
                      <div className="mt-0.5 font-semibold text-stone-900">
                        {incidentComparison.before_distance_km.toFixed(1)} → {incidentComparison.after_distance_km.toFixed(1)} km
                      </div>
                      <div className={`mt-0.5 font-semibold ${incidentComparison.after_distance_km > incidentComparison.before_distance_km ? 'text-rose-700' : 'text-olive-700'}`}>
                        {formatDelta(incidentComparison.after_distance_km - incidentComparison.before_distance_km)} km vs prior route
                      </div>
                    </div>
                    <div className="rounded-md bg-stone-50 p-2">
                      <div className="text-stone-500">Modeled travel time</div>
                      <div className="mt-0.5 font-semibold text-stone-900">
                        {Math.round(incidentComparison.before_travel_time_min)} → {Math.round(incidentComparison.after_travel_time_min)} min
                      </div>
                      <div className={`mt-0.5 font-semibold ${incidentComparison.after_travel_time_min > incidentComparison.before_travel_time_min ? 'text-rose-700' : 'text-olive-700'}`}>
                        {formatDelta(incidentComparison.after_travel_time_min - incidentComparison.before_travel_time_min)} min vs prior route
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-stone-600">
                    <span>{incidentComparison.changed_routes}/{incidentComparison.total_routes} stop sequences changed</span>
                    <span>Optimizer: {incidentComparison.optimizer_seconds.toFixed(2)} s</span>
                  </div>
                  <div className="mt-2 rounded-md border border-olive-100 bg-olive-50/60 p-2 text-[10px] leading-4 text-stone-700">
                    {rerouteExplanation(incidentComparison)}
                  </div>
                  <div className="mt-1 text-[9px] text-stone-500">Comparison uses the route immediately before this event. Incident impact is modeled; no live traffic feed is connected.</div>
                </div>
              )}

              {incidentTimeline.length > 0 && (
                <div className="space-y-1 border-t border-rose-200 pt-2">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-stone-500">Incident timeline</div>
                  {incidentTimeline.slice(0, 3).map((incident) => (
                    <div key={incident.id} className="flex items-center justify-between gap-2 text-[10px] text-stone-700">
                      <span className="truncate">{incident.type === 'road_closure' ? 'Closure' : incident.type === 'accident' ? 'Accident' : 'Congestion'} · {incident.from_name} → {incident.to_name}</span>
                      <span className={`shrink-0 font-semibold ${incident.status === 'active' ? 'text-rose-700' : incident.status === 'failed' ? 'text-amber-700' : 'text-olive-700'}`}>
                        {incident.status === 'active' ? 'Active' : incident.status === 'failed' ? 'Failed' : 'Cleared'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vehicle Fleet & Capacity Controls */}
            <div className="space-y-3 pt-2 border-t border-stone-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center space-x-1">
                  <Truck className="h-3.5 w-3.5 text-olive-600" />
                  <span>Fleet Fleet Vehicles ({vehicles.length})</span>
                </label>
                <button
                  onClick={onAddVehicle}
                  className="flex items-center space-x-1 text-xs text-olive-600 hover:text-olive-800 font-semibold bg-olive-50 px-2 py-1 rounded-md"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Van</span>
                </button>
              </div>

              {/* Uniform Vehicle Capacity Slider */}
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-stone-700">
                  <span>Vehicle Payload Capacity</span>
                  <span className="font-bold text-olive-600 text-sm">{currentVehicleCapacity} kg</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="120"
                  step="5"
                  value={currentVehicleCapacity}
                  onChange={(e) => onUpdateVehicleCapacity(Number(e.target.value))}
                  className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-olive-600"
                />
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>30 kg (Small)</span>
                  <span>65 kg (Standard)</span>
                  <span>120 kg (Heavy)</span>
                </div>
              </div>

              {/* Vehicles List */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {vehicles.map((v, i) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-white text-xs shadow-xs"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 rounded-lg bg-olive-100 text-olive-700 font-bold flex items-center justify-center text-[10px]">
                        V{i + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-stone-800">{v.name}</div>
                        <div className="text-[11px] text-stone-500">Driver: {v.driver_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium text-[10px]">
                        Max: {v.capacity} kg
                      </span>
                      {vehicles.length > 1 && (
                        <button
                          onClick={() => onRemoveVehicle(v.id)}
                          className="text-stone-400 hover:text-rose-600 transition p-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DELIVERIES LIST & ADD FORM */}
        {activeTab === 'deliveries' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                  Delivery Locations ({deliveries.length})
                </h4>
                <p className="text-[11px] text-stone-500">
                  Select a map point or enter its coordinates
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-olive-200 bg-olive-50/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-900">
                    <Layers className="h-3.5 w-3.5 text-olive-700" />
                    <span>Starting depot</span>
                  </div>
                  <div className="mt-1 truncate text-[11px] text-stone-700">{depot.name}</div>
                  <div className="mt-0.5 text-[10px] text-stone-500">
                    {depot.lat.toFixed(5)}, {depot.lng.toFixed(5)} · Operating {minutesToClock(depot.ready_time)}–{minutesToClock(depot.due_date)}
                  </div>
                </div>
                {!isEditingDepot && (
                  <button
                    type="button"
                    onClick={beginDepotEdit}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-stone-200 bg-white px-2 py-1 text-[10px] font-semibold text-stone-700 transition hover:border-olive-400 hover:bg-olive-50 hover:text-olive-800"
                  >
                    <Pencil className="h-3 w-3" /> Edit depot
                  </button>
                )}
              </div>

              {isEditingDepot && depotDraft && (
                <form onSubmit={saveDepotEdit} className="mt-3 space-y-2 border-t border-olive-200 pt-3">
                  <label className="block text-[10px] font-medium text-stone-600">Depot name
                    <input
                      required
                      value={depotDraft.name}
                      onChange={(event) => setDepotDraft((draft) => draft ? { ...draft, name: event.target.value } : draft)}
                      className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-medium text-stone-600">Latitude
                      <input
                        required type="number" step="0.00001" min="18.95" max="19.22"
                        value={depotDraft.lat}
                        onChange={(event) => setDepotDraft((draft) => draft ? { ...draft, lat: event.target.value } : draft)}
                        className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                      />
                    </label>
                    <label className="text-[10px] font-medium text-stone-600">Longitude
                      <input
                        required type="number" step="0.00001" min="72.85" max="73.15"
                        value={depotDraft.lng}
                        onChange={(event) => setDepotDraft((draft) => draft ? { ...draft, lng: event.target.value } : draft)}
                        className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] font-medium text-stone-600">Opens
                      <input
                        required type="time" min="08:00" max={depotDraft.dueTime || '20:00'}
                        value={depotDraft.readyTime}
                        onChange={(event) => setDepotDraft((draft) => draft ? { ...draft, readyTime: event.target.value } : draft)}
                        className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                      />
                    </label>
                    <label className="text-[10px] font-medium text-stone-600">Closes
                      <input
                        required type="time" min={depotDraft.readyTime || '08:00'} max="20:00"
                        value={depotDraft.dueTime}
                        onChange={(event) => setDepotDraft((draft) => draft ? { ...draft, dueTime: event.target.value } : draft)}
                        className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                      />
                    </label>
                  </div>
                  {depotEditError && <p role="alert" className="text-[10px] font-medium text-rose-700">{depotEditError}</p>}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" onClick={cancelDepotEdit} className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-50">
                      <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                    <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-lg bg-olive-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-olive-800">
                      <Save className="h-3.5 w-3.5" /> Save changes
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Quick Add Stop Form */}
            <form onSubmit={handleManualAddStop} className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5">
              <div className="font-semibold text-xs text-stone-800 flex items-center space-x-1">
                <Plus className="h-3.5 w-3.5 text-olive-600" />
                <span>Add Navi Mumbai Stop</span>
              </div>
              <input
                type="text"
                placeholder="Location Name (e.g. Inorbit Mall Vashi)"
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 focus:outline-none focus:ring-1 focus:ring-olive-500 bg-white"
                required
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-stone-500 block mb-0.5">Latitude</label>
                  <input type="number" step="0.00001" value={newLocLat} onChange={(e) => setNewLocLat(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-300 bg-white" required />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-0.5">Longitude</label>
                  <input type="number" step="0.00001" value={newLocLng} onChange={(e) => setNewLocLng(Number(e.target.value))} className="w-full px-2 py-1.5 text-xs rounded-lg border border-stone-300 bg-white" required />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-stone-500 block mb-0.5">Demand (kg)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newLocDemand}
                    onChange={(e) => setNewLocDemand(Number(e.target.value))}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-0.5">Ready from</label>
                  <input
                    type="time"
                    min="08:00"
                    max="20:00"
                    required
                    value={minutesToClock(newLocReady)}
                    onChange={(e) => setNewLocReady(clockToMinutes(e.target.value))}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-stone-300 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-stone-500 block mb-0.5">Due by</label>
                  <input
                    type="time"
                    min={minutesToClock(newLocReady)}
                    max="20:00"
                    required
                    value={minutesToClock(newLocDue)}
                    onChange={(e) => setNewLocDue(clockToMinutes(e.target.value))}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-stone-300 bg-white"
                  />
                </div>
              </div>
              <label className="block text-[10px] text-stone-500">Delivery priority
                <select
                  value={newLocPriority}
                  onChange={(event) => setNewLocPriority(event.target.value as DeliveryPriority)}
                  className="mt-0.5 w-full px-2 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-stone-800"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <p className="text-[10px] text-stone-500">Priority softly favors earlier service during optimization; time windows and vehicle capacity stay binding.</p>
              <button
                type="submit"
                className="w-full py-1.5 bg-olive-600 hover:bg-olive-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
              >
                Add Delivery Stop
              </button>
            </form>

            {/* Stops List */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {deliveries.map((loc) => {
                const isEditing = editingDeliveryId === loc.id && deliveryDraft !== null;
                return (
                  <div key={loc.id} className="rounded-xl border border-stone-200 bg-white p-2.5 text-xs transition hover:border-stone-300">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-stone-900">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone-100 text-[10px] font-bold text-stone-600">
                            {loc.id}
                          </span>
                          <span className="truncate">{loc.name}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-stone-500">
                          <span>Demand: <b className="text-stone-700">{loc.demand} kg</b></span>
                          <span>Service: <b className="text-stone-700">{loc.service_time} min</b></span>
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />
                            <b className="text-stone-700">{minutesToClock(loc.ready_time)}–{minutesToClock(loc.due_date)}</b>
                          </span>
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)} · {(loc.priority ?? 'normal').toUpperCase()} priority
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => beginDeliveryEdit(loc)}
                            aria-label={`Edit ${loc.name}`}
                            className="inline-flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-[10px] font-semibold text-stone-700 transition hover:border-olive-400 hover:bg-olive-50 hover:text-olive-800"
                          >
                            <Pencil className="h-3 w-3" /> Edit
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (editingDeliveryId === loc.id) cancelDeliveryEdit();
                            onRemoveDelivery(loc.id);
                          }}
                          className="rounded-md p-1 text-stone-400 transition hover:bg-rose-50 hover:text-rose-600"
                          title="Remove location"
                          aria-label={`Remove ${loc.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {isEditing && deliveryDraft && (
                      <form onSubmit={(event) => saveDeliveryEdit(event, loc)} className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                        <label className="block text-[10px] font-medium text-stone-600">Location name
                          <input
                            required
                            value={deliveryDraft.name}
                            onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, name: event.target.value } : draft)}
                            className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] font-medium text-stone-600">Latitude
                            <input
                              required type="number" step="0.00001" min="18.95" max="19.22"
                              value={deliveryDraft.lat}
                              onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, lat: event.target.value } : draft)}
                              className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                            />
                          </label>
                          <label className="text-[10px] font-medium text-stone-600">Longitude
                            <input
                              required type="number" step="0.00001" min="72.85" max="73.15"
                              value={deliveryDraft.lng}
                              onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, lng: event.target.value } : draft)}
                              className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] font-medium text-stone-600">Demand (kg)
                            <input
                              required type="number" min="0.1" step="0.1"
                              value={deliveryDraft.demand}
                              onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, demand: event.target.value } : draft)}
                              className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                            />
                          </label>
                          <label className="text-[10px] font-medium text-stone-600">Service time (min)
                            <input
                              required type="number" min="0" max="720" step="1"
                              value={deliveryDraft.serviceTime}
                              onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, serviceTime: event.target.value } : draft)}
                              className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="text-[10px] font-medium text-stone-600">Window opens
                            <input
                              required type="time" min="08:00" max={deliveryDraft.dueTime || '20:00'}
                              value={deliveryDraft.readyTime}
                              onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, readyTime: event.target.value } : draft)}
                              className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                            />
                          </label>
                          <label className="text-[10px] font-medium text-stone-600">Window closes
                            <input
                              required type="time" min={deliveryDraft.readyTime || '08:00'} max="20:00"
                              value={deliveryDraft.dueTime}
                              onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, dueTime: event.target.value } : draft)}
                              className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                            />
                          </label>
                        </div>
                        <label className="block text-[10px] font-medium text-stone-600">Delivery priority
                          <select
                            value={deliveryDraft.priority}
                            onChange={(event) => setDeliveryDraft((draft) => draft ? { ...draft, priority: event.target.value as DeliveryPriority } : draft)}
                            className="mt-0.5 w-full rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs text-stone-800"
                          >
                            <option value="low">Low</option>
                            <option value="normal">Normal</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </label>
                        {deliveryEditError && <p role="alert" className="text-[10px] font-medium text-rose-700">{deliveryEditError}</p>}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button type="button" onClick={cancelDeliveryEdit} className="inline-flex items-center justify-center gap-1 rounded-lg border border-stone-300 px-2 py-1.5 text-[11px] font-semibold text-stone-700 hover:bg-stone-50">
                            <X className="h-3.5 w-3.5" /> Cancel
                          </button>
                          <button type="submit" className="inline-flex items-center justify-center gap-1 rounded-lg bg-olive-700 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-olive-800">
                            <Save className="h-3.5 w-3.5" /> Save changes
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: OPTIMIZATION RESULTS */}
        {activeTab === 'results' && optimizationResult && (
          <div className="space-y-4">
            <div className="p-3 bg-gradient-to-br from-olive-50 to-olive-50 rounded-xl border border-olive-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-olive-950 uppercase tracking-wider">
                  Algorithm Performance
                </span>
                <span className="text-[10px] font-semibold bg-olive-100 text-olive-800 px-2 py-0.5 rounded-full">
                  {optimizationResult.stats.feasible ? '100% Feasible' : 'Infeasible'}
                </span>
              </div>
              <div className="text-sm font-extrabold text-olive-900">
                {optimizationResult.algorithm.name}
              </div>
              <div className="text-[11px] text-stone-600 mt-0.5">
                Computed in {optimizationResult.stats.computation_time_seconds}s across{' '}
                {optimizationResult.stats.iterations_to_best} iterations
              </div>
            </div>

            {/* KPI Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl border border-stone-200 bg-white">
                <div className="text-[10px] font-bold text-stone-400 uppercase">Estimated Distance</div>
                <div className="text-lg font-black text-stone-900 mt-0.5">
                  {optimizationResult.stats.total_distance_km} <span className="text-xs font-medium text-stone-500">km</span>
                </div>
                <div className="text-[10px] text-stone-500">All vehicle routes combined</div>
              </div>

              <div className="p-3 rounded-xl border border-stone-200 bg-white">
                <div className="text-[10px] font-bold text-stone-400 uppercase">Est. Travel Time</div>
                <div className="text-lg font-black text-stone-900 mt-0.5">
                  {Math.round(optimizationResult.stats.total_travel_time_min)}{' '}
                  <span className="text-xs font-medium text-stone-500">min</span>
                </div>
                <div className="text-[10px] text-stone-500">Model estimate; includes service & wait time</div>
              </div>

              <div className="p-3 rounded-xl border border-stone-200 bg-white">
                <div className="text-[10px] font-bold text-stone-400 uppercase">Fleet Deployed</div>
                <div className="text-lg font-black text-stone-900 mt-0.5">
                  {optimizationResult.stats.vehicles_used}{' '}
                  <span className="text-xs font-medium text-stone-500">vans</span>
                </div>
                <div className="text-[10px] text-stone-500">Prins split optimal capacity</div>
              </div>

              <div className="p-3 rounded-xl border border-stone-200 bg-white">
                <div className="text-[10px] font-bold text-stone-400 uppercase">TW Compliance</div>
                <div className="text-lg font-black text-olive-600 mt-0.5">
                  {optimizationResult.stats.time_window_compliance_pct}%
                </div>
                <div className="text-[10px] text-stone-500">Stops within customer windows</div>
              </div>
            </div>

            {/* Traffic Alerts on Route */}
            {optimizationResult.traffic_alerts.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <span>Traffic Incidents Factored</span>
                </div>
                {optimizationResult.traffic_alerts.map((alert, idx) => (
                  <p key={idx} className="text-[11px] text-amber-800">
                    • {alert}
                  </p>
                ))}
              </div>
            )}

            {!streetRoutingReady && (
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-[11px] text-rose-800">
                <div className="font-bold">Street directions could not be loaded</div>
                <p className="mt-1">
                  {optimizationResult.routes.find((route) => route.street_routing_error)?.street_routing_error || 'Check the configured OSRM routing service and generate the route again.'}
                </p>
              </div>
            )}

            {/* Vehicle Routes Breakdown */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                Assigned Route Breakdown
              </div>
              <div className="space-y-2">
                {optimizationResult.routes.map((route, i) => (
                  <div
                    key={route.route_id}
                    className="p-2.5 rounded-xl border border-stone-200 bg-white text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: routeDisplayColorAt(i) }}
                        />
                        <span className="font-bold text-stone-900">{route.vehicle.name}</span>
                      </div>
                      <span className="text-[11px] font-medium text-stone-500">
                        {route.vehicle.driver_name}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 text-[11px] text-stone-600 pt-1 border-t border-stone-100">
                      <div>Stops: <b className="text-stone-800">{route.stops.length - 2}</b></div>
                      <div>Dist: <b className="text-stone-800">{route.total_distance_km} km</b></div>
                      <div>Load: <b className="text-stone-800">{route.capacity_usage_pct}%</b></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatch to Drivers Action */}
            <div className="pt-2">
              <button
                id="dispatch-routes-btn"
                onClick={onDispatch}
                disabled={isDispatching || !optimizationResult.stats.feasible || !streetRoutingReady}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-2 shadow-sm ${
                  !optimizationResult.stats.feasible || !streetRoutingReady
                    ? 'bg-stone-300 text-stone-600 cursor-not-allowed'
                    : hasDispatched
                    ? 'bg-olive-600 hover:bg-olive-700 text-white'
                    : 'bg-olive-600 hover:bg-olive-700 text-white'
                }`}
              >
                {isDispatching ? (
                  <span>Transmitting to Drivers...</span>
                ) : hasDispatched ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Dispatched to Drivers! (Click to Re-send)</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Assign & Dispatch Routes to Drivers</span>
                  </>
                )}
              </button>
              {!optimizationResult.stats.feasible && streetRoutingReady && (
                <p className="mt-2 text-center text-[11px] text-rose-700">
                  This plan is infeasible and cannot be dispatched. Adjust the fleet or delivery constraints and generate a new plan.
                </p>
              )}
              {!streetRoutingReady && (
                <p className="mt-2 text-center text-[11px] text-rose-700">
                  Dispatch is disabled until the route follows mapped streets.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Action Bar at Bottom */}
      <div className="p-4 bg-stone-50/90 border-t border-stone-200">
        <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-sand-300 bg-sand-50 px-3 py-2.5 text-[10px] leading-4 text-stone-600">
          <input
            id="dispatch-data-ack"
            type="checkbox"
            checked={dataUseAcknowledged}
            onChange={(event) => setDataUseAcknowledged(event.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-olive-700"
          />
          <p><label htmlFor="dispatch-data-ack" className="cursor-pointer">I’m authorized to use these delivery and driver details for this dispatch. I understand route coordinates go to the configured mapping/routing service.</label> <Link href="/privacy" className="font-semibold text-olive-800 underline underline-offset-2">Privacy details</Link></p>
        </div>
        <button
          id="generate-routes-btn"
          onClick={() => {
            onOptimize();
            setActiveTab('results');
          }}
          disabled={isOptimizing || deliveries.length === 0 || !dataUseAcknowledged}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-olive-600 to-olive-700 hover:from-olive-500 hover:to-olive-600 text-white font-bold text-sm shadow-md shadow-olive-600/25 flex items-center justify-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isOptimizing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Optimizing Routes via {selectedAlgorithm.toUpperCase()}...</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-white" />
              <span>Generate Best Routes ({deliveries.length} Stops)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

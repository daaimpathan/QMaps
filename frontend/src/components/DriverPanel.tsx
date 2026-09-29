'use client';

import React from 'react';
import {
  VehicleRoute,
  RouteStop,
} from '../types';
import {
  Truck,
  MapPin,
  Clock,
  Package,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Check,
  User,
  Phone,
} from 'lucide-react';
import { routeDisplayColorAt } from '../utils/routeColor';

interface DriverPanelProps {
  routes: VehicleRoute[];
  selectedVehicleId: string;
  onSelectVehicleId: (id: string) => void;
  completedStops: number[];
  onCompleteStop: (stopNumber: number) => void;
  trafficAlerts?: string[];
}

export const DriverPanel: React.FC<DriverPanelProps> = ({
  routes,
  selectedVehicleId,
  onSelectVehicleId,
  completedStops,
  onCompleteStop,
  trafficAlerts = [],
}) => {
  // Find current driver's assigned route
  const currentRoute = routes.find((r) => r.vehicle.id === selectedVehicleId) || null;

  // If no routes are dispatched
  if (!currentRoute) {
    return (
      <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200/80 shadow-sm p-6 items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center">
          <Truck className="h-8 w-8" />
        </div>
        <div className="max-w-xs space-y-1">
          <h3 className="font-bold text-stone-900 text-base">No Assigned Route Yet</h3>
          <p className="text-xs text-stone-500">
            Routes have not been dispatched by the Admin dispatcher. Switch to Admin tab to optimize and dispatch routes.
          </p>
        </div>
      </div>
    );
  }

  const currentRouteColor = routeDisplayColorAt(routes.findIndex((route) => route.route_id === currentRoute.route_id));

  // Delivery stops excluding depot start & end
  const deliveryStops = currentRoute.stops.filter((s) => s.type === 'customer');
  const remainingStops = deliveryStops.filter((s) => !completedStops.includes(s.stop_number));
  const nextStop = remainingStops[0] || null;
  const nextLegIndex = nextStop ? nextStop.stop_number - 1 : -1;
  const nextLegGuidance = currentRoute.navigation_steps
    ?.filter((step) => step.leg_index === nextLegIndex && step.maneuver_type !== 'arrive')
    .slice(0, 3) ?? [];

  // Calculate current vehicle load
  const totalDeliveredWeight = deliveryStops
    .filter((s) => completedStops.includes(s.stop_number))
    .reduce((acc, s) => acc + s.demand, 0);

  const initialLoad = currentRoute.total_demand;
  const currentRemainingLoad = Math.max(0, initialLoad - totalDeliveredWeight);
  const capacityPct = Math.round((currentRemainingLoad / currentRoute.vehicle.capacity) * 100);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
      {/* Driver Header & Switcher */}
      <div className="p-4 border-b border-stone-200 bg-stone-50/80 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            Driver Console
          </span>
          <span className="flex items-center space-x-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-olive-100 text-olive-800">
            <span className="w-2 h-2 rounded-full bg-olive-500 animate-pulse" />
            <span>On Duty</span>
          </span>
        </div>

        {/* Driver / Vehicle Selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-stone-600 block">Select Active Driver</label>
          <select
            id="driver-select"
            value={currentRoute.vehicle.id}
            onChange={(e) => onSelectVehicleId(e.target.value)}
            className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-stone-300 bg-white text-stone-800 focus:outline-none focus:ring-2 focus:ring-olive-500"
          >
            {routes.map((r) => (
              <option key={r.vehicle.id} value={r.vehicle.id}>
                {r.vehicle.driver_name} — {r.vehicle.name} ({r.stops.length - 2} stops)
              </option>
            ))}
          </select>
        </div>

        {/* Driver Contact & Vehicle Info Card */}
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200 text-xs">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-olive-100 text-olive-700 flex items-center justify-center font-bold">
              <User className="h-4 w-4" />
            </div>
            <div>
              <div className="font-bold text-stone-800">{currentRoute.vehicle.driver_name}</div>
              <div className="text-[10px] text-stone-500 flex items-center space-x-1">
                <Phone className="h-2.5 w-2.5" />
                <span>{currentRoute.vehicle.driver_phone}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ backgroundColor: currentRouteColor }}
            >
              {currentRoute.vehicle.id}
            </span>
            <div className="text-[10px] text-stone-500 mt-0.5">
              {remainingStops.length} of {deliveryStops.length} remaining
            </div>
          </div>
        </div>

        {/* Capacity / Load Status Bar */}
        <div className="space-y-1 bg-white p-2.5 rounded-xl border border-stone-200">
          <div className="flex justify-between text-xs">
            <span className="text-stone-600 font-medium">Vehicle Payload Load</span>
            <span className="font-bold text-stone-900">
              {currentRemainingLoad} / {currentRoute.vehicle.capacity} kg ({capacityPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, capacityPct)}%`,
                backgroundColor: currentRouteColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Traffic Alert Banner for Driver */}
        {trafficAlerts.length > 0 && (
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center space-x-1.5 text-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>Navi Mumbai Route Traffic Advisory</span>
            </div>
            {trafficAlerts.map((a, i) => (
              <p key={i} className="text-[11px] text-amber-800">
                • {a}
              </p>
            ))}
          </div>
        )}

        {/* NEXT STOP HERO CARD */}
        {nextStop ? (
          <div className="p-4 bg-gradient-to-br from-olive-500 to-olive-600 rounded-2xl text-white shadow-md space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold tracking-wider uppercase text-olive-100 flex items-center space-x-1">
                <Navigation className="h-3.5 w-3.5" />
                <span>Next Stop (#{nextStop.stop_number})</span>
                {nextStop.priority && nextStop.priority !== 'normal' && (
                  <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[9px] tracking-normal">{nextStop.priority.toUpperCase()}</span>
                )}
              </span>
              <span className="bg-white/20 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                ETA {nextStop.arrival_time_str}
              </span>
            </div>

            <div>
              <h3 className="text-base font-extrabold text-white leading-snug">
                {nextStop.name}
              </h3>
              <p className="text-xs text-olive-100 mt-0.5">Navi Mumbai Delivery Node</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-white/10 backdrop-blur-xs p-2.5 rounded-xl border border-white/15">
              <div>
                <span className="text-[10px] text-olive-200 block">Package Load</span>
                <span className="font-bold text-sm">{nextStop.demand} kg</span>
              </div>
              <div>
                <span className="text-[10px] text-olive-200 block">Time Window</span>
                <span className="font-bold text-xs">{nextStop.ready_time_str} - {nextStop.due_date_str}</span>
              </div>
            </div>

            <button
              id={`complete-stop-${nextStop.stop_number}`}
              onClick={() => onCompleteStop(nextStop.stop_number)}
              className="w-full py-2.5 bg-white text-olive-700 hover:bg-stone-50 font-bold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-1.5"
            >
              <Check className="h-4 w-4 stroke-[3]" />
              <span>Confirm Delivery Complete</span>
            </button>
          </div>
        ) : (
          <div className="p-4 bg-olive-50 border border-olive-200 rounded-2xl text-center space-y-2">
            <CheckCircle className="h-8 w-8 text-olive-600 mx-auto" />
            <h4 className="font-bold text-sm text-olive-900">All Deliveries Complete!</h4>
            <p className="text-xs text-olive-700">
              Return route to Turbhe Central Depot is active. Safe driving!
            </p>
          </div>
        )}

        {nextStop && nextLegGuidance.length > 0 && (
          <div className="p-3 rounded-xl border border-olive-200 bg-olive-50/70 space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-olive-900">
              <Navigation className="h-3.5 w-3.5" /> Street directions to next stop
            </div>
            {nextLegGuidance.map((step) => (
              <div key={`${step.leg_index}-${step.step_index}`} className="flex items-start justify-between gap-3 text-xs">
                <span className="font-semibold text-stone-800">{step.instruction}</span>
                <span className="shrink-0 text-[10px] text-stone-500">
                  {step.distance_m >= 1000 ? `${(step.distance_m / 1000).toFixed(1)} km` : `${step.distance_m} m`}
                </span>
              </div>
            ))}
          </div>
        )}

        {currentRoute.street_routing_status === 'unavailable' && (
          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-[11px] text-rose-800">
            Street directions are unavailable. Ask dispatch to retry routing before starting this route.
          </div>
        )}

        {/* DELIVERY MANIFEST / SEQUENCE LIST */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">
              Assigned Delivery Sequence
            </span>
            <span className="text-[11px] text-stone-500">
              {currentRoute.road_distance_km ?? currentRoute.total_distance_km} km road distance
            </span>
          </div>

          <div className="space-y-2">
            {currentRoute.stops.map((stop) => {
              const isCompleted = completedStops.includes(stop.stop_number);
              const isDepot = stop.type === 'depot';
              const isCurrent = nextStop?.stop_number === stop.stop_number;

              return (
                <div
                  key={`${stop.stop_number}-${stop.location_id}`}
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    isCompleted
                      ? 'bg-stone-50 border-stone-200 text-stone-400 opacity-75'
                      : isCurrent
                      ? 'bg-olive-50/60 border-olive-300 ring-1 ring-olive-400 text-stone-900 shadow-xs'
                      : 'bg-white border-stone-200 text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <span
                        className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center ${
                          isCompleted
                            ? 'bg-olive-500 text-white'
                            : isDepot
                            ? 'bg-olive-600 text-white'
                            : isCurrent
                            ? 'bg-olive-600 text-white'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {isCompleted ? '✓' : isDepot ? '★' : stop.stop_number}
                      </span>
                      <div>
                        <div className={`font-semibold ${isCompleted ? 'line-through text-stone-400' : 'text-stone-900'}`}>
                          {stop.name}
                        </div>
                        <div className="text-[10px] text-stone-500 flex items-center space-x-2 mt-0.5">
                          <span>ETA: <b className="text-stone-700">{stop.arrival_time_str}</b></span>
                          {!isDepot && <span>• Demand: <b className="text-stone-700">{stop.demand} kg</b></span>}
                          {!isDepot && stop.priority && stop.priority !== 'normal' && <span>• {stop.priority.toUpperCase()} priority</span>}
                        </div>
                      </div>
                    </div>

                    {!isDepot && (
                      <div>
                        {isCompleted ? (
                          <span className="text-[10px] text-olive-600 font-semibold px-2 py-0.5 rounded bg-olive-50">
                            Delivered
                          </span>
                        ) : (
                          <button
                            onClick={() => onCompleteStop(stop.stop_number)}
                            className="text-[11px] font-semibold text-olive-600 hover:text-olive-800 bg-olive-50 hover:bg-olive-100 px-2 py-1 rounded-md transition"
                          >
                            Mark Done
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

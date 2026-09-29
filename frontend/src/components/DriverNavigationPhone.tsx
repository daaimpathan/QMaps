'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  AlertTriangle,
  ArrowUp,
  ArrowUpRight,
  BatteryFull,
  Check,
  Clock3,
  CornerDownRight,
  CornerUpLeft,
  CornerUpRight,
  MapPin,
  MoreVertical,
  Navigation2,
  Signal,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { VehicleRoute, RouteStop } from '../types';

interface DriverNavigationPhoneProps {
  route: VehicleRoute | null;
  completedStops: number[];
  onCompleteStop: (stopNumber: number) => void;
}

const formatDistance = (distanceKm: number) => (
  distanceKm >= 1
    ? `${distanceKm.toFixed(1)} km`
    : `${Math.max(0, Math.round(distanceKm * 1000))} m`
);

const findClosestGeometryIndex = (
  geometry: [number, number][],
  stop: RouteStop,
) => {
  let closestIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;
  geometry.forEach(([lat, lng], index) => {
    const distance = ((lat - stop.lat) * 110.9) ** 2 + ((lng - stop.lng) * 104.9) ** 2;
    if (distance < closestDistance) {
      closestIndex = index;
      closestDistance = distance;
    }
  });
  return closestIndex;
};

const maneuverIcon = (type: string) => {
  if (type.includes('left')) return CornerUpLeft;
  if (type.includes('right') || type.includes('turn')) return CornerUpRight;
  if (type.includes('merge') || type.includes('ramp')) return CornerDownRight;
  if (type.includes('roundabout')) return ArrowUpRight;
  return ArrowUp;
};

export const DriverNavigationPhone: React.FC<DriverNavigationPhoneProps> = ({
  route,
  completedStops,
  onCompleteStop,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const { nextStop, fromStop, nextInstruction } = useMemo(() => {
    if (!route) {
      return {
        nextStop: null,
        fromStop: null,
        nextInstruction: null,
      };
    }

    const nextDeliveryIndex = route.stops.findIndex(
      (stop) => stop.type === 'customer' && !completedStops.includes(stop.stop_number),
    );
    const returnDepotIndex = route.stops.reduce(
      (lastDepotIndex, stop, index) => stop.type === 'depot' && index > 0 ? index : lastDepotIndex,
      -1,
    );
    const stopIndex = nextDeliveryIndex >= 0 ? nextDeliveryIndex : returnDepotIndex;
    const next = stopIndex >= 0 ? route.stops[stopIndex] : null;
    const previous = stopIndex > 0 ? route.stops[stopIndex - 1] : route.stops[0] ?? null;
    const steps = next
      ? route.navigation_steps?.filter(
          (step) => step.leg_index === next.stop_number - 1 && step.maneuver_type !== 'arrive',
        ) ?? []
      : [];

    return {
      nextStop: next,
      fromStop: previous,
      nextInstruction: steps[0] ?? null,
    };
  }, [route, completedStops]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [19.0771, 73.0125],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    layersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (mapRef.current === map) {
        mapRef.current = null;
        layersRef.current = null;
      }
      map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers || !map.getContainer().isConnected) return;

    layers.clearLayers();

    const geometry = route?.road_geometry;
    if (!route || !nextStop || !fromStop) {
      if (route?.stops[0]) map.setView([route.stops[0].lat, route.stops[0].lng], 15);
      return;
    }

    if (geometry && geometry.length > 1) {
      const fromIndex = findClosestGeometryIndex(geometry, fromStop);
      const toIndex = findClosestGeometryIndex(geometry, nextStop);
      const low = Math.min(fromIndex, toIndex);
      const high = Math.max(fromIndex, toIndex);
      const activeLeg = geometry.slice(low, high + 1);
      const orientedLeg = fromIndex <= toIndex ? activeLeg : [...activeLeg].reverse();

      layers.addLayer(L.polyline(geometry, {
        color: '#93c5fd',
        weight: 4,
        opacity: 0.68,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }));

      if (orientedLeg.length > 1) {
        layers.addLayer(L.polyline(orientedLeg, {
          color: '#4285f4',
          weight: 7,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }));
        map.fitBounds(L.latLngBounds(orientedLeg), { padding: [38, 38], maxZoom: 16 });
      }
    } else {
      const straightLeg: L.LatLngExpression[] = [
        [fromStop.lat, fromStop.lng],
        [nextStop.lat, nextStop.lng],
      ];
      layers.addLayer(L.polyline(straightLeg, {
        color: '#4285f4',
        weight: 7,
        opacity: 1,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: '8 8',
        interactive: false,
      }));
      map.fitBounds(L.latLngBounds(straightLeg), { padding: [38, 38], maxZoom: 16 });
    }

    const driverIcon = L.divIcon({
      className: 'driver-location-pin',
      html: '<div class="driver-location-dot"><span></span></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    layers.addLayer(L.marker([fromStop.lat, fromStop.lng], {
      icon: driverIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 500,
    }));

    const destinationIcon = L.divIcon({
      className: 'driver-destination-pin',
      html: '<div class="driver-destination-marker"><span></span></div>',
      iconSize: [34, 42],
      iconAnchor: [17, 38],
    });
    layers.addLayer(L.marker([nextStop.lat, nextStop.lng], {
      icon: destinationIcon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 600,
    }));

  }, [route, nextStop, fromStop, completedStops]);

  useEffect(() => () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (utteranceRef.current) {
      utteranceRef.current.onend = null;
      utteranceRef.current.onerror = null;
    }
    window.speechSynthesis.cancel();
  }, []);

  const instruction = nextInstruction?.instruction ?? (
    nextStop ? `Head to ${nextStop.name}` : route ? 'Route complete' : 'Waiting for dispatch'
  );
  const ManeuverIcon = maneuverIcon(nextInstruction?.maneuver_type ?? 'straight');
  const minutesToNext = nextStop?.leg_time_min ?? nextInstruction?.duration_min ?? 0;
  const distanceToNext = nextStop?.leg_distance_km ?? (
    nextInstruction ? nextInstruction.distance_m / 1000 : 0
  );
  const remainingCount = route
    ? route.stops.filter((stop) => stop.type === 'customer' && !completedStops.includes(stop.stop_number)).length
    : 0;
  const voiceGuidanceAvailable = typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && 'SpeechSynthesisUtterance' in window;

  const handleVoiceGuidance = () => {
    if (!voiceGuidanceAvailable) return;
    const synthesis = window.speechSynthesis;
    if (isSpeaking || synthesis.speaking) {
      synthesis.cancel();
      utteranceRef.current = null;
      setIsSpeaking(false);
      return;
    }

    const upcomingDistance = nextInstruction
      ? formatDistance(nextInstruction.distance_m / 1000)
      : formatDistance(distanceToNext);
    const destination = nextStop?.type === 'customer'
      ? `Then continue to ${nextStop.name}.`
      : 'Continue to the dispatch depot.';
    const utterance = new SpeechSynthesisUtterance(`${instruction}. In ${upcomingDistance}. ${destination}`);
    utterance.lang = 'en-IN';
    utterance.rate = 0.95;
    const voices = synthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.toLowerCase() === 'en-in')
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('en-'))
      ?? null;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utteranceRef.current = utterance;
    setIsSpeaking(true);
    synthesis.speak(utterance);
  };

  return (
    <div className="driver-phone-shell" aria-label="Driver mobile navigation preview">
      <div className="driver-phone-screen">
        <div className="driver-phone-statusbar">
          <span>9:41</span>
          <div className="driver-phone-status-icons" aria-hidden="true">
            <Signal className="h-3 w-3" />
            <Wifi className="h-3 w-3" />
            <BatteryFull className="h-4 w-4" />
          </div>
        </div>

        <div className="driver-phone-guidance">
          <div className="driver-phone-guidance-icon">
            <ManeuverIcon className="h-9 w-9" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="driver-phone-guidance-instruction">{instruction}</p>
            <p className="driver-phone-guidance-road">
              {nextInstruction?.road_name || (nextStop ? 'Follow the highlighted route' : route ? 'Route complete' : 'Driver route appears here')}
            </p>
          </div>
          <div className="driver-phone-guidance-distance">
            {nextInstruction ? formatDistance(nextInstruction.distance_m / 1000) : formatDistance(distanceToNext)}
          </div>
        </div>

        <div className="driver-phone-map-wrap">
          <div ref={mapContainerRef} className="driver-phone-map" />
          <button type="button" className="driver-phone-map-action" aria-label="Map layers">
            <MoreVertical className="h-4 w-4" />
          </button>
          <div className="driver-phone-map-label">
            <Navigation2 className="h-3 w-3 fill-current" />
            <span>{route ? `DRIVER POV · ${route.vehicle.id}` : 'DRIVER POV'}</span>
          </div>
          <a
            className="driver-phone-map-attribution"
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            © OpenStreetMap
          </a>
        </div>

        <div className="driver-phone-arrival-card">
          {route && nextStop?.type === 'customer' ? (
            <>
              <div className="driver-phone-arrival-topline">
                <span className="driver-phone-arrival-time">{nextStop.arrival_time_str}</span>
                <span className="driver-phone-arrival-remaining">{remainingCount} stops left</span>
              </div>
              <div className="driver-phone-arrival-metrics">
                <span><Clock3 className="h-3.5 w-3.5" /> {Math.max(1, Math.round(minutesToNext))} min</span>
                <span>{formatDistance(distanceToNext)}</span>
                {nextStop.traffic_note && nextStop.traffic_note !== 'Normal traffic' && (
                  <span className="driver-phone-traffic"><AlertTriangle className="h-3.5 w-3.5" /> Traffic</span>
                )}
              </div>
              <div className="driver-phone-destination-row">
                <MapPin className="h-4 w-4 shrink-0 text-blue-600" />
                <div className="min-w-0 flex-1">
                  <p className="driver-phone-destination-name">{nextStop.name}</p>
                  <p className="driver-phone-destination-caption">Next delivery · Stop {nextStop.stop_number}</p>
                </div>
                <button
                  type="button"
                  className={`driver-phone-volume${isSpeaking ? ' driver-phone-volume-active' : ''}`}
                  aria-label={isSpeaking ? 'Stop voice guidance' : 'Play voice guidance'}
                  aria-pressed={isSpeaking}
                  disabled={!voiceGuidanceAvailable}
                  title={voiceGuidanceAvailable ? 'Play spoken directions' : 'Voice guidance is unavailable in this browser'}
                  onClick={handleVoiceGuidance}
                >
                  {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                className="driver-phone-delivered"
                onClick={() => onCompleteStop(nextStop.stop_number)}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
                Mark delivered
              </button>
            </>
          ) : route && nextStop?.type === 'depot' ? (
            <div className="driver-phone-complete">
              <Navigation2 className="h-5 w-5 text-blue-600" />
              <div className="min-w-0">
                <p className="driver-phone-destination-name">Return to the depot</p>
                <p className="driver-phone-destination-caption">
                  ETA {nextStop.arrival_time_str} · {Math.max(1, Math.round(minutesToNext))} min · {formatDistance(distanceToNext)}
                </p>
              </div>
            </div>
          ) : route ? (
            <div className="driver-phone-complete">
              <div className="driver-phone-complete-icon"><Check className="h-5 w-5" /></div>
              <div>
                <p className="driver-phone-destination-name">All deliveries complete</p>
                <p className="driver-phone-destination-caption">Return to the dispatch depot</p>
              </div>
            </div>
          ) : (
            <div className="driver-phone-awaiting">
              <Navigation2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="driver-phone-destination-name">Waiting for dispatch</p>
                <p className="driver-phone-destination-caption">A route will appear here</p>
              </div>
            </div>
          )}
        </div>

        <div className="driver-phone-bottom-bar"><span /></div>
      </div>
    </div>
  );
};

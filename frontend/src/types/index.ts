export interface NaviLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  demand: number;
  ready_time: number;  // min from 08:00 AM
  due_date: number;    // min from 08:00 AM
  service_time: number; // min
  priority: DeliveryPriority;
}

export type DeliveryPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NaviVehicle {
  id: string;
  name: string;
  driver_name: string;
  driver_phone: string;
  capacity: number;
}

export interface TrafficAdjustment {
  id: string;
  from_location_id: number;
  to_location_id: number;
  delay_percent: number;
  closed?: boolean;
  incident_type?: TrafficIncidentType;
  incident_id?: string;
  coords?: [number, number][];
  incident_started_at?: string;
  incident_expires_at?: string;
  incident_duration_seconds?: number;
}

export type TrafficIncidentType = 'accident' | 'congestion' | 'road_closure';

export interface TrafficIncidentCorridor {
  id: string;
  label: string;
  from_location_id: number;
  to_location_id: number;
  from_name: string;
  to_name: string;
  coords: [number, number][];
}

export interface TrafficIncident {
  id: string;
  type: TrafficIncidentType;
  from_location_id: number;
  to_location_id: number;
  from_name: string;
  to_name: string;
  severity_percent: number;
  duration_seconds: number;
  started_at: string;
  expires_at: string;
  coords: [number, number][];
  status: 'active' | 'cleared' | 'failed';
  cleared_at?: string;
}

export interface TrafficIncidentComparison {
  incident_id: string;
  incident_type: TrafficIncidentType;
  from_name: string;
  to_name: string;
  severity_percent: number;
  algorithm_name: string;
  before_distance_km: number;
  after_distance_km: number;
  before_travel_time_min: number;
  after_travel_time_min: number;
  before_time_window_compliance_pct: number;
  after_time_window_compliance_pct: number;
  before_uses_incident_link: boolean;
  after_uses_incident_link: boolean;
  optimizer_seconds: number;
  changed_routes: number;
  total_routes: number;
}

export interface RouteStop {
  stop_number: number;
  location_id: number;
  name: string;
  lat: number;
  lng: number;
  type: 'depot' | 'customer';
  demand: number;
  current_load: number;
  capacity: number;
  capacity_usage_pct: number;
  arrival_time_min: number;
  arrival_time_str: string;
  departure_time_str: string;
  ready_time_str: string;
  due_date_str: string;
  ready_time: number;
  due_date: number;
  service_time: number;
  priority?: DeliveryPriority;
  status: 'depot_start' | 'on_time' | 'early_wait' | 'delayed';
  leg_distance_km: number;
  leg_time_min: number;
  traffic_note: string;
}

export interface VehicleRoute {
  route_id: string;
  vehicle: NaviVehicle;
  color: string;
  total_distance_km: number;
  total_travel_time_min: number;
  total_demand: number;
  capacity_usage_pct: number;
  stops: RouteStop[];
  customer_ids: number[];
  feasible: boolean;
  road_geometry?: [number, number][];
  road_distance_km?: number;
  road_driving_time_min?: number;
  street_routing_status?: 'ready' | 'unavailable';
  street_routing_error?: string;
  navigation_steps?: RouteNavigationStep[];
}

export interface RouteNavigationStep {
  leg_index: number;
  step_index: number;
  instruction: string;
  road_name: string;
  maneuver_type: string;
  distance_m: number;
  duration_min: number;
}

export interface OptimizationStats {
  total_distance_km: number;
  total_travel_time_min: number;
  vehicles_used: number;
  total_deliveries: number;
  total_demand_delivered: number;
  time_window_compliance_pct: number;
  feasible: boolean;
  computation_time_seconds: number;
  iterations_to_best: number;
}

export interface OptimizationResult {
  status: string;
  distance_model?: string;
  travel_time_model?: string;
  algorithm: {
    id: string;
    name: string;
    description: string;
  };
  stats: OptimizationStats;
  convergence: number[];
  routes: VehicleRoute[];
  traffic_alerts: string[];
  traffic_scenario: string;
  traffic_adjustments?: TrafficAdjustment[];
}

export interface TrafficSegment {
  segment_id: string;
  road_name: string;
  condition: string;
  status: 'warning' | 'clear' | 'caution';
  speed_kmh: number;
  delay_min: number;
  coords: [number, number][];
  description: string;
}

export interface AlgorithmInfo {
  id: string;
  name: string;
  description: string;
}

export interface BenchmarkSummaryItem {
  instance: string;
  algorithm: string;
  mean_cost: number;
  best_cost: number;
  worst_cost: number;
  n_runs: number;
}

export interface WilcoxonResult {
  statistic: number;
  p_value: number;
  significant: boolean;
  mean_1: number;
  mean_2: number;
  cohens_d: number;
  better: string;
  effect_size_interpretation: string;
  n_samples: number;
  n_nonzero_pairs?: number;
  mean_difference?: number;
  mean_difference_pct?: number;
  median_difference?: number;
  wins_1?: number;
  wins_2?: number;
  ties?: number;
}

export interface FriedmanResult {
  statistic: number;
  p_value: number;
  significant: boolean;
  n_samples: number;
  n_algorithms: number;
  algorithms: string[];
}

export interface NormalityResult {
  statistic: number;
  p_value: number;
  normal: boolean;
  n_samples: number;
}

export interface BenchmarkStatistics {
  source_csv: string | null;
  total_runs: number;
  wilcoxon: Record<string, Record<string, WilcoxonResult>>;
  friedman: Record<string, FriedmanResult>;
  normality: Record<string, Record<string, NormalityResult>>;
  nemenyi: Record<string, { algorithms: string[]; p_values: Record<string, Record<string, number>> }>;
}

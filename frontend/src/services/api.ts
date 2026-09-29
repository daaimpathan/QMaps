import axios from 'axios';
import {
  AlgorithmInfo,
  NaviLocation,
  NaviVehicle,
  OptimizationResult,
  TrafficSegment,
  TrafficAdjustment,
  BenchmarkSummaryItem,
  BenchmarkStatistics,
  RouteStop,
} from '../types';
import { attachStreetRoutes, RoadRoute } from './routing';

// Keep browser requests same-origin; Next.js proxies /api/* to FastAPI.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function requestRoadRoute(stops: RouteStop[]): Promise<RoadRoute> {
  try {
    const res = await client.post<RoadRoute>('/navi-mumbai/road-route', {
      points: stops.map(({ name, lat, lng }) => ({ name, lat, lng })),
    }, { timeout: 20000 });
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'string') throw new Error(detail);
      if (error.code === 'ECONNABORTED') throw new Error('Street routing timed out. Check the backend road-router connection.');
      if (!error.response) throw new Error('Cannot reach the backend street router. Check that the API is running.');
    }
    throw error;
  }
}

export const apiService = {
  async getAlgorithms(): Promise<AlgorithmInfo[]> {
    const res = await client.get<AlgorithmInfo[]>('/algorithms');
    return res.data;
  },

  async getPreset(): Promise<{
    depot: NaviLocation;
    deliveries: NaviLocation[];
    vehicles: NaviVehicle[];
    traffic_segments: TrafficSegment[];
  }> {
    const res = await client.get('/navi-mumbai/preset');
    return res.data;
  },

  async getTraffic(): Promise<{
    timestamp: string;
    area: string;
    segments: TrafficSegment[];
    active_alerts_count: number;
  }> {
    const res = await client.get('/navi-mumbai/traffic');
    return res.data;
  },

  async optimize(params: {
    algorithm: string;
    depot: NaviLocation;
    deliveries: NaviLocation[];
    vehicles: NaviVehicle[];
    max_iter?: number;
    time_limit?: number;
    seed?: number;
    traffic_scenario?: string;
    traffic_adjustments?: TrafficAdjustment[];
  }): Promise<OptimizationResult> {
    let res;
    try {
      res = await client.post<OptimizationResult>('/navi-mumbai/optimize', {
        algorithm: params.algorithm,
        depot: params.depot,
        deliveries: params.deliveries,
        vehicles: params.vehicles,
        max_iter: params.max_iter ?? 120,
        time_limit: params.time_limit ?? 4.0,
        seed: params.seed ?? 42,
        traffic_scenario: params.traffic_scenario ?? 'normal',
        traffic_adjustments: params.traffic_adjustments ?? [],
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string') throw new Error(detail);
        if (!error.response) {
          throw new Error(`Cannot reach the optimization API at ${API_BASE}. Confirm the backend is running on port 8000. (${error.message})`);
        }
      }
      throw error;
    }
    return attachStreetRoutes(res.data, requestRoadRoute);
  },

  async dispatchRoutes(
    result: OptimizationResult,
    dispatchedBy = 'Admin',
    completedLocationIds: number[] = [],
  ): Promise<any> {
    const res = await client.post('/navi-mumbai/dispatch', {
      optimization_result: result,
      dispatched_by: dispatchedBy,
      completed_location_ids: completedLocationIds,
    });
    return res.data;
  },

  async getDispatch(): Promise<{
    dispatched: boolean;
    dispatched_at?: string;
    dispatched_by?: string;
    data?: OptimizationResult;
    driver_progress?: Record<string, number[]>;
    completed_location_ids?: number[];
  }> {
    const res = await client.get('/navi-mumbai/dispatch');
    if (res.data.dispatched && res.data.data) {
      return { ...res.data, data: await attachStreetRoutes(res.data.data, requestRoadRoute) };
    }
    return res.data;
  },

  async completeStop(driverName: string, stopNumber: number): Promise<any> {
    const res = await client.post('/navi-mumbai/driver/complete-stop', {
      driver_name: driverName,
      stop_number: stopNumber,
    });
    return res.data;
  },

  async getBenchmarkResults(): Promise<{ results: BenchmarkSummaryItem[] }> {
    const res = await client.get('/benchmark/results');
    return res.data;
  },

  async getBenchmarkStatistics(): Promise<BenchmarkStatistics> {
    const res = await client.get<BenchmarkStatistics>('/benchmark/statistics');
    return res.data;
  },
};

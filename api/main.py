"""FastAPI backend for QMaps optimization engine.

Provides REST endpoints for:
- Running optimizations
- Listing algorithms and instances
- Fetching results
- Algorithm comparison

Does NOT duplicate algorithm logic—calls the existing Python implementation.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal, Tuple
from pathlib import Path
import uuid
import json
import os
import asyncio
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen
from datetime import datetime

# Import the optimization engine
import sys
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from vrp_loader import load_instance, VRPInstance
from algorithms import AStar, PSO, QPSO, ACO, QACO, QA_QPSO
from analysis.paired_stats import wilcoxon_signed_rank
import numpy as np

app = FastAPI(title="QMaps API", version="1.0.0")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("QMAPS_ALLOWED_ORIGINS", "http://localhost:3000").split(","),
    # Next.js may pick another free port when 3000 is occupied (e.g. 3001).
    # Permit loopback origins in development; deployments should set explicit origins.
    allow_origin_regex=os.getenv(
        "QMAPS_ALLOWED_ORIGIN_REGEX",
        r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    ),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory results store (in production: use Redis/DB)
results_store: Dict[str, Dict[str, Any]] = {}

# Algorithm registry
ALGORITHMS = {
    "astar": {"name": "A*", "class": AStar, "description": "Classical shortest path"},
    "pso": {"name": "PSO", "class": PSO, "description": "Particle Swarm Optimization"},
    "qpso": {"name": "QPSO", "class": QPSO, "description": "Quantum-behaved PSO"},
    "aco": {"name": "ACO", "class": ACO, "description": "Ant Colony Optimization"},
    "qaco": {"name": "QACO", "class": QACO, "description": "Quantum-inspired ACO"},
    "qa_qpso": {"name": "QA-QPSO", "class": QA_QPSO, "description": "Hybrid QACO+QPSO"},
}

# Instance registry
INSTANCES = {
    "RC101": {"file": "RC101.csv", "customers": [25, 50, 100], "type": "random"},
    "RC201": {"file": "RC201.csv", "customers": [25, 50, 100], "type": "random"},
    "C101": {"file": "C101.csv", "customers": [25, 50, 100], "type": "clustered"},
}

# Request/Response models
class OptimizationRequest(BaseModel):
    algorithm: str = Field(..., description="Algorithm ID (e.g., 'qa_qpso')")
    instance: str = Field(..., description="Instance name (e.g., 'RC101')")
    n_customers: int = Field(25, ge=10, le=100, description="Number of customers")
    max_iter: int = Field(300, ge=10, le=1000, description="Max iterations")
    time_limit: float = Field(5.0, ge=1.0, le=30.0, description="Time limit (seconds)")
    seed: int = Field(0, ge=0, description="Random seed")


class OptimizationResponse(BaseModel):
    job_id: str
    status: str  # "pending", "running", "completed", "failed"
    message: str


class ResultResponse(BaseModel):
    job_id: str
    status: str
    algorithm: str
    instance: str
    cost: Optional[float] = None
    routes: Optional[List[List[int]]] = None
    convergence: Optional[List[float]] = None
    time: Optional[float] = None
    feasible: Optional[bool] = None
    error: Optional[str] = None


class AlgorithmInfo(BaseModel):
    id: str
    name: str
    description: str


class InstanceInfo(BaseModel):
    id: str
    file: str
    available_sizes: List[int]
    type: str


# Endpoints
@app.get("/")
async def root():
    return {
        "service": "QMaps Optimization API",
        "version": "1.0.0",
        "endpoints": {
            "algorithms": "/algorithms",
            "instances": "/instances",
            "optimize": "/optimize",
            "results": "/results/{job_id}",
            "benchmark": "/benchmark/results",
        }
    }


@app.get("/algorithms", response_model=List[AlgorithmInfo])
async def list_algorithms():
    """List all available optimization algorithms."""
    return [
        AlgorithmInfo(id=algo_id, name=meta["name"], description=meta["description"])
        for algo_id, meta in ALGORITHMS.items()
    ]


@app.get("/instances", response_model=List[InstanceInfo])
async def list_instances():
    """List all available VRP instances."""
    return [
        InstanceInfo(
            id=inst_id,
            file=meta["file"],
            available_sizes=meta["customers"],
            type=meta["type"]
        )
        for inst_id, meta in INSTANCES.items()
    ]


def run_optimization_task(job_id: str, request: OptimizationRequest):
    """Background task to run optimization."""
    try:
        results_store[job_id]["status"] = "running"

        # Load instance
        inst_path = ROOT / "data" / "instances" / INSTANCES[request.instance]["file"]
        inst = load_instance(str(inst_path), n_customers=request.n_customers)

        # Get algorithm class
        algo_class = ALGORITHMS[request.algorithm]["class"]

        # Run optimization
        optimizer = algo_class(
            inst,
            max_iter=request.max_iter,
            time_limit=request.time_limit,
            seed=request.seed,
        )

        result = optimizer.optimize()

        # Store results
        results_store[job_id].update({
            "status": "completed",
            "cost": float(result["cost"]),
            "routes": result["routes"],
            "convergence": [float(c) for c in result["convergence"]],
            "time": float(result["time"]),
            "feasible": bool(result["feasible"]),
            "completed_at": datetime.utcnow().isoformat(),
        })

    except Exception as e:
        results_store[job_id].update({
            "status": "failed",
            "error": str(e),
            "completed_at": datetime.utcnow().isoformat(),
        })


@app.post("/optimize", response_model=OptimizationResponse)
async def optimize(request: OptimizationRequest, background_tasks: BackgroundTasks):
    """Submit an optimization job."""

    # Validate algorithm
    if request.algorithm not in ALGORITHMS:
        raise HTTPException(status_code=400, detail=f"Unknown algorithm: {request.algorithm}")

    # Validate instance
    if request.instance not in INSTANCES:
        raise HTTPException(status_code=400, detail=f"Unknown instance: {request.instance}")

    # Validate n_customers
    if request.n_customers not in INSTANCES[request.instance]["customers"]:
        raise HTTPException(
            status_code=400,
            detail=f"n_customers must be one of {INSTANCES[request.instance]['customers']}"
        )

    # Create job
    job_id = str(uuid.uuid4())
    results_store[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "algorithm": request.algorithm,
        "instance": request.instance,
        "n_customers": request.n_customers,
        "created_at": datetime.utcnow().isoformat(),
    }

    # Start background task
    background_tasks.add_task(run_optimization_task, job_id, request)

    return OptimizationResponse(
        job_id=job_id,
        status="pending",
        message="Optimization job submitted"
    )


@app.get("/results/{job_id}", response_model=ResultResponse)
async def get_results(job_id: str):
    """Get optimization results by job ID."""

    if job_id not in results_store:
        raise HTTPException(status_code=404, detail="Job not found")

    job_data = results_store[job_id]

    return ResultResponse(**job_data)


@app.get("/benchmark/results")
async def get_benchmark_results():
    """Get the latest benchmark results summary."""

    benchmark_file = ROOT / "results" / "benchmark_full_20260925_160246.csv"

    if not benchmark_file.exists():
        raise HTTPException(status_code=404, detail="Benchmark results not found")

    # Load and summarize benchmark data
    import csv
    from collections import defaultdict

    data = defaultdict(lambda: defaultdict(list))

    with open(benchmark_file) as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['feasible'] == 'True':
                key = (row['instance'], row['algorithm'])
                data[key]['costs'].append(float(row['cost']))

    summary = []
    for (instance, algorithm), values in data.items():
        costs = values['costs']
        summary.append({
            "instance": instance,
            "algorithm": algorithm,
            "mean_cost": sum(costs) / len(costs),
            "best_cost": min(costs),
            "worst_cost": max(costs),
            "n_runs": len(costs),
        })

    return {"results": summary}


@app.get("/benchmark/statistics")
async def get_benchmark_statistics():
    """Serve the benchmark test outputs already computed by the analysis scripts."""
    results_dir = ROOT / "results"
    benchmark_file = results_dir / "benchmark_full_20260925_160246.csv"

    def read_json(filename: str):
        path = results_dir / filename
        if not path.exists():
            return {}
        with path.open(encoding="utf-8") as source:
            return json.load(source)

    total_runs = 0
    baseline_runs = {}
    if benchmark_file.exists():
        import csv
        with benchmark_file.open(newline="", encoding="utf-8") as source:
            for row in csv.DictReader(source):
                total_runs += 1
                if row.get("feasible") != "True":
                    continue
                key = (row["instance"], row["algorithm"])
                baseline_runs.setdefault(key, {})[int(row["run"])] = float(row["cost"])

    # Recalculate the QPSO/PSO comparison from the same run-level CSV used by
    # /benchmark/results. The previously saved JSON was generated from another
    # CSV, which could make the table means and p-values disagree.
    wilcoxon = read_json("wilcoxon_tests.json")
    for instance_name in ("RC101", "RC201", "C101"):
        old_qpso = baseline_runs.get((instance_name, "QPSO"), {})
        old_pso = baseline_runs.get((instance_name, "PSO"), {})
        common_runs = sorted(set(old_qpso) & set(old_pso))
        before = wilcoxon_signed_rank(
            [old_qpso[run] for run in common_runs],
            [old_pso[run] for run in common_runs],
            "QPSO",
            "PSO",
        )
        instance_tests = wilcoxon.setdefault(instance_name, {})
        if before is not None:
            instance_tests["QPSO_vs_PSO"] = before
        else:
            # Do not leave a saved result from another CSV looking like a
            # paired comparison for the currently displayed benchmark data.
            instance_tests.pop("QPSO_vs_PSO", None)

    return {
        "source_csv": benchmark_file.name if benchmark_file.exists() else None,
        "total_runs": total_runs,
        "wilcoxon": wilcoxon,
        "friedman": read_json("friedman_test.json"),
        "normality": read_json("normality_tests.json"),
        "nemenyi": read_json("nemenyi_test.json"),
    }


# =====================================================================
# Navi Mumbai Delivery Route Optimization Endpoints
# =====================================================================

ROUTE_COLORS = [
    "#2457D6",  # Cobalt blue
    "#D43F35",  # Vermilion
    "#7544C8",  # Violet
    "#007B78",  # Deep teal
    "#C02E68",  # Berry
    "#B45B00",  # Amber orange
    "#385A2B",  # Forest green
    "#374151",  # Graphite
]

NAVI_CITY_SPEED_KMH = 25.0

class NaviLocation(BaseModel):
    id: int
    name: str
    lat: float = Field(..., ge=18.95, le=19.22, description="Latitude within the Navi Mumbai service zone")
    lng: float = Field(..., ge=72.85, le=73.15, description="Longitude within the Navi Mumbai service zone")
    demand: float = Field(10.0, ge=0)
    ready_time: float = Field(0.0, ge=0, le=720)    # min from 08:00 AM
    due_date: float = Field(480.0, ge=0, le=720)    # min from 08:00 AM
    service_time: float = Field(15.0, ge=0, le=720) # min
    priority: Literal["low", "normal", "high", "urgent"] = "normal"

class RoadRoutePoint(BaseModel):
    name: str = ""
    lat: float = Field(..., ge=18.95, le=19.22)
    lng: float = Field(..., ge=72.85, le=73.15)

class RoadRouteRequest(BaseModel):
    points: List[RoadRoutePoint]

class NaviVehicle(BaseModel):
    id: str = "V1"
    name: str = "Fleet Van 01"
    driver_name: str = "Rajesh Kumar"
    driver_phone: str = "+91 98201 12345"
    capacity: float = Field(60.0, gt=0)

class NaviTrafficAdjustment(BaseModel):
    id: str
    from_location_id: int
    to_location_id: int
    delay_percent: float = Field(..., ge=1, le=300)
    closed: bool = False
    incident_type: Optional[Literal["accident", "congestion", "road_closure"]] = None
    incident_id: Optional[str] = None
    coords: Optional[List[Tuple[float, float]]] = None
    incident_started_at: Optional[str] = None
    incident_expires_at: Optional[str] = None
    incident_duration_seconds: Optional[int] = None

class NaviOptimizeRequest(BaseModel):
    algorithm: str = "qa_qpso"
    depot: NaviLocation
    deliveries: List[NaviLocation]
    vehicles: List[NaviVehicle]
    max_iter: int = 120
    time_limit: float = 4.0
    seed: int = 42
    traffic_scenario: str = "normal"  # normal, rush_hour, road_closure, accident
    traffic_adjustments: List[NaviTrafficAdjustment] = Field(default_factory=list)

def format_time_min(minutes_from_8am: float) -> str:
    total_min = int(8 * 60 + minutes_from_8am)
    h = (total_min // 60) % 24
    m = total_min % 60
    suffix = "AM" if h < 12 else "PM"
    h12 = h if 1 <= h <= 12 else (h - 12 if h > 12 else 12)
    return f"{h12:02d}:{m:02d} {suffix}"

NAVI_MUMBAI_PRESET_DEPOT = NaviLocation(
    id=0,
    name="Turbhe Central Logistics Hub (MIDC)",
    lat=19.0771,
    lng=73.0125,
    demand=0.0,
    ready_time=0.0,
    due_date=480.0,
    service_time=0.0,
)

NAVI_MUMBAI_PRESET_DELIVERIES = [
    NaviLocation(id=1, name="Vashi Sector 17 Commercial Hub", lat=19.0750, lng=72.9980, demand=14.0, ready_time=30.0, due_date=180.0, service_time=15.0),
    NaviLocation(id=2, name="APMC Fruit & Veg Market Vashi", lat=19.0710, lng=73.0070, demand=22.0, ready_time=15.0, due_date=150.0, service_time=20.0),
    NaviLocation(id=3, name="Sanpada Railway Station Complex", lat=19.0620, lng=73.0130, demand=12.0, ready_time=45.0, due_date=240.0, service_time=10.0),
    NaviLocation(id=4, name="Juinagar Industrial Estate", lat=19.0530, lng=73.0190, demand=18.0, ready_time=60.0, due_date=300.0, service_time=15.0),
    NaviLocation(id=5, name="Nerul DY Patil Sports Complex", lat=19.0330, lng=73.0197, demand=25.0, ready_time=90.0, due_date=360.0, service_time=20.0),
    NaviLocation(id=6, name="Seawoods Grand Central Mall", lat=19.0210, lng=73.0180, demand=16.0, ready_time=120.0, due_date=420.0, service_time=15.0),
    NaviLocation(id=7, name="CBD Belapur Konkan Bhavan", lat=19.0180, lng=73.0400, demand=20.0, ready_time=60.0, due_date=360.0, service_time=15.0),
    NaviLocation(id=8, name="Kopar Khairane Sector 14", lat=19.0980, lng=73.0150, demand=15.0, ready_time=30.0, due_date=240.0, service_time=10.0),
    NaviLocation(id=9, name="Mahape Millennium Business Park", lat=19.1110, lng=73.0250, demand=28.0, ready_time=60.0, due_date=300.0, service_time=20.0),
    NaviLocation(id=10, name="Ghansoli Reliance Corporate Park", lat=19.1230, lng=73.0110, demand=18.0, ready_time=90.0, due_date=360.0, service_time=15.0),
    NaviLocation(id=11, name="Airoli Mindspace Tech Campus", lat=19.1550, lng=72.9980, demand=22.0, ready_time=120.0, due_date=420.0, service_time=20.0),
    NaviLocation(id=12, name="Turbhe MIDC Electronics Zone", lat=19.0880, lng=73.0300, demand=16.0, ready_time=15.0, due_date=200.0, service_time=15.0),
]

NAVI_MUMBAI_PRESET_VEHICLES = [
    NaviVehicle(id="V1", name="Navi Express Van 01", driver_name="Rajesh Kumar", driver_phone="+91 98201 12345", capacity=65.0),
    NaviVehicle(id="V2", name="Navi Express Van 02", driver_name="Amit Sharma", driver_phone="+91 98202 23456", capacity=65.0),
    NaviVehicle(id="V3", name="Navi Express Van 03", driver_name="Rahul Patil", driver_phone="+91 98203 34567", capacity=65.0),
    NaviVehicle(id="V4", name="Navi Express Van 04", driver_name="Sunil Shinde", driver_phone="+91 98204 45678", capacity=65.0),
]

NAVI_MUMBAI_TRAFFIC_SEGMENTS = [
    {
        "segment_id": "TBR-01",
        "road_name": "Thane-Belapur Road (Mahape - Turbhe)",
        "condition": "Heavy Congestion",
        "status": "warning",
        "speed_kmh": 16,
        "delay_min": 14,
        "coords": [[19.1110, 73.0250], [19.0880, 73.0300], [19.0771, 73.0125]],
        "description": "Peak office & industrial transit corridor between MBP Mahape and Turbhe Naka."
    },
    {
        "segment_id": "PBR-01",
        "road_name": "Palm Beach Road (Vashi - Nerul - Belapur)",
        "condition": "Smooth Flow",
        "status": "clear",
        "speed_kmh": 50,
        "delay_min": 0,
        "coords": [[19.0750, 72.9980], [19.0620, 73.0130], [19.0330, 73.0197], [19.0180, 73.0400]],
        "description": "Optimal flow along scenic Palm Beach coastal expressway."
    },
    {
        "segment_id": "SPH-01",
        "road_name": "Sion-Panvel Highway (Sanpada - Nerul)",
        "condition": "Moderate Slowdown",
        "status": "caution",
        "speed_kmh": 26,
        "delay_min": 7,
        "coords": [[19.0620, 73.0130], [19.0530, 73.0190], [19.0330, 73.0197]],
        "description": "Ongoing flyover resurfacing near Sanpada junction causing lane narrowing."
    },
    {
        "segment_id": "APMC-01",
        "road_name": "APMC Grain & Vegetable Wholesale Market Corridor",
        "condition": "High Truck Volume",
        "status": "warning",
        "speed_kmh": 14,
        "delay_min": 12,
        "coords": [[19.0750, 72.9980], [19.0710, 73.0070], [19.0771, 73.0125]],
        "description": "Heavy transport container queues for APMC wholesale loading yards."
    }
]

@app.get("/navi-mumbai/preset")
async def get_navi_mumbai_preset():
    """Returns the default preconfigured Navi Mumbai delivery cluster and fleet."""
    return {
        "depot": NAVI_MUMBAI_PRESET_DEPOT,
        "deliveries": NAVI_MUMBAI_PRESET_DELIVERIES,
        "vehicles": NAVI_MUMBAI_PRESET_VEHICLES,
        "traffic_segments": NAVI_MUMBAI_TRAFFIC_SEGMENTS,
    }

@app.get("/navi-mumbai/traffic")
async def get_navi_mumbai_traffic():
    """Returns active traffic alerts and corridor speeds in Navi Mumbai."""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "area": "Navi Mumbai (Vashi - Turbhe - Nerul - Belapur - Mahape)",
        "segments": NAVI_MUMBAI_TRAFFIC_SEGMENTS,
        "active_alerts_count": len([s for s in NAVI_MUMBAI_TRAFFIC_SEGMENTS if s["status"] != "clear"])
    }

@app.post("/navi-mumbai/road-route")
async def get_navi_mumbai_road_route(request: RoadRouteRequest):
    """Return OSM street geometry and turn steps for an already-optimized stop order."""
    if len(request.points) < 2:
        raise HTTPException(status_code=400, detail="At least two route points are required")

    base_url = os.getenv("QMAPS_OSRM_BASE_URL", "https://router.project-osrm.org").rstrip("/")
    coordinates = ";".join(f"{point.lng:.6f},{point.lat:.6f}" for point in request.points)
    query = urlencode({"overview": "full", "geometries": "geojson", "steps": "true"})
    upstream_url = f"{base_url}/route/v1/driving/{coordinates}?{query}"

    def fetch_route():
        upstream_request = UrlRequest(
            upstream_url,
            headers={"Accept": "application/json", "User-Agent": "QMaps/1.0 (Navi Mumbai route planner)"},
        )
        with urlopen(upstream_request, timeout=12) as response:
            return json.loads(response.read().decode("utf-8"))

    try:
        data = await asyncio.to_thread(fetch_route)
    except HTTPError as error:
        raise HTTPException(status_code=502, detail=f"Street router returned HTTP {error.code}") from error
    except (URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise HTTPException(
            status_code=502,
            detail="Street routing is unavailable. Configure QMAPS_OSRM_BASE_URL with a reachable OSRM-compatible service.",
        ) from error

    if data.get("code") != "Ok" or not data.get("routes"):
        message = data.get("message") or "The road network could not connect every stop."
        raise HTTPException(status_code=502, detail=f"Street router: {message}")

    selected_route = data["routes"][0]
    route_legs = selected_route.get("legs", [])
    if len(route_legs) != len(request.points) - 1:
        raise HTTPException(status_code=502, detail="Street router returned an incomplete route")

    return {
        "distance_km": float(selected_route.get("distance", 0)) / 1000.0,
        "duration_min": float(selected_route.get("duration", 0)) / 60.0,
        "geometry": [
            [float(latitude), float(longitude)]
            for longitude, latitude in selected_route["geometry"]["coordinates"]
        ],
        "legs": [
            {
                "distance_km": float(leg.get("distance", 0)) / 1000.0,
                "duration_min": float(leg.get("duration", 0)) / 60.0,
                "steps": [
                    {
                        "name": step.get("name", ""),
                        "ref": step.get("ref", ""),
                        "distance_m": float(step.get("distance", 0)),
                        "duration_min": float(step.get("duration", 0)) / 60.0,
                        "maneuver": {
                            "type": (step.get("maneuver") or {}).get("type", "continue"),
                            "modifier": (step.get("maneuver") or {}).get("modifier"),
                        },
                    }
                    for step in leg.get("steps", [])
                ],
            }
            for leg in route_legs
        ],
    }

@app.post("/navi-mumbai/optimize")
async def optimize_navi_mumbai(request: NaviOptimizeRequest):
    """Run real quantum-inspired or classical VRP optimization for Navi Mumbai."""
    if request.algorithm not in ALGORITHMS:
        raise HTTPException(status_code=400, detail=f"Unknown algorithm: {request.algorithm}")

    if not request.deliveries:
        raise HTTPException(status_code=400, detail="At least 1 delivery location is required")

    if not request.vehicles:
        raise HTTPException(status_code=400, detail="At least 1 vehicle is required")
    if len({vehicle.capacity for vehicle in request.vehicles}) != 1:
        raise HTTPException(
            status_code=400,
            detail="The current VRP engine supports one shared capacity across the fleet. Set all vehicle capacities equally.",
        )
    if len({location.id for location in request.deliveries}) != len(request.deliveries):
        raise HTTPException(status_code=400, detail="Delivery location IDs must be unique")
    if request.depot.id in {location.id for location in request.deliveries}:
        raise HTTPException(status_code=400, detail="Depot and delivery location IDs must be unique")
    if any(location.demand <= 0 for location in request.deliveries):
        raise HTTPException(status_code=400, detail="Delivery demand must be greater than zero")
    if any(location.ready_time > location.due_date for location in request.deliveries):
        raise HTTPException(status_code=400, detail="Each delivery ready time must be before its due time")

    # Combine depot (0) and deliveries (1..N)
    all_locations = [request.depot] + request.deliveries
    n_cust = len(request.deliveries)

    # Conversion factor from lat/lng to kilometers in Navi Mumbai (~19.07 N)
    LAT_KM = 110.9
    LNG_KM = 104.9

    coords = np.array([[loc.lat * LAT_KM, loc.lng * LNG_KM] for loc in all_locations])
    demand = np.array([0.0] + [loc.demand for loc in request.deliveries])
    ready = np.array([request.depot.ready_time] + [loc.ready_time for loc in request.deliveries])
    due = np.array([request.depot.due_date] + [loc.due_date for loc in request.deliveries])
    service = np.array([0.0] + [loc.service_time for loc in request.deliveries])

    capacity = request.vehicles[0].capacity

    # Build VRPInstance
    inst = VRPInstance(
        name="NaviMumbai_VRP",
        coords=coords,
        demand=demand,
        ready=ready,
        due=due,
        service=service,
        capacity=capacity
    )
    inst.max_vehicles = len(request.vehicles)
    # Admin-selected priorities are soft optimization preferences: earlier
    # service for important stops has a modest cost bonus. Time windows and
    # vehicle capacity remain the hard feasibility constraints. Solomon
    # benchmark instances have no priority_weights attribute, so their scores
    # and saved statistics are unchanged.
    priority_weights = {"low": 0.5, "normal": 1.0, "high": 2.0, "urgent": 4.0}
    inst.priority_weights = np.array(
        [0.0] + [priority_weights[loc.priority] for loc in request.deliveries],
        dtype=float,
    )
    inst.priority_arrival_cost = 0.5
    # Preserve physical distance for reporting. The optimizer's distance cost
    # receives congestion multipliers while feasibility/ETA use a conservative
    # urban speed baseline. Street routing later applies the same floor to road
    # distance so a fast generic router profile cannot understate delivery ETA.
    inst.physical_dist = inst.dist.copy()
    inst.travel_time = inst.dist * (60.0 / NAVI_CITY_SPEED_KMH)

    # Apply dynamic traffic condition if requested
    traffic_alerts = []
    if request.traffic_scenario == "rush_hour":
        # Congest edges to Mahape/Turbhe (northern commercial cluster)
        for i, loc1 in enumerate(all_locations):
            for j, loc2 in enumerate(all_locations):
                if i != j and (loc1.lat > 19.09 or loc2.lat > 19.09):
                    inst.dist[i, j] *= 1.45
                    inst.travel_time[i, j] *= 1.45
        traffic_alerts.append("Rush Hour Active: +45% travel delay across Mahape/Ghansoli/Airoli corridor")
    elif request.traffic_scenario == "road_closure":
        # Block edge between depot and delivery 1 or 2
        if n_cust >= 2:
            inst.dist[0, 2] = 999.0
            inst.dist[2, 0] = 999.0
            inst.travel_time[0, 2] = float("inf")
            inst.travel_time[2, 0] = float("inf")
            traffic_alerts.append("Emergency Road Closure: Direct APMC corridor blocked. Rerouting via Palm Beach Road.")
    elif request.traffic_scenario == "accident":
        if n_cust >= 3:
            inst.dist[3, 4] = inst.dist[3, 4] * 2.2
            inst.dist[4, 3] = inst.dist[4, 3] * 2.2
            inst.travel_time[3, 4] *= 2.2
            inst.travel_time[4, 3] *= 2.2
            traffic_alerts.append("Incident Reported: Major collision near Sanpada-Juinagar. +120% delay on that link.")

    location_index = {location.id: index for index, location in enumerate(all_locations)}
    adjusted_pairs = set()
    for adjustment in request.traffic_adjustments:
        from_id = adjustment.from_location_id
        to_id = adjustment.to_location_id
        if from_id not in location_index or to_id not in location_index:
            raise HTTPException(status_code=400, detail="Manual traffic corridors must use existing depot or delivery locations")
        if from_id == to_id:
            raise HTTPException(status_code=400, detail="A manual traffic corridor must connect two different locations")
        pair = tuple(sorted((from_id, to_id)))
        if pair in adjusted_pairs:
            raise HTTPException(status_code=400, detail="Only one manual slowdown can be set for each corridor")
        adjusted_pairs.add(pair)

        start_index = location_index[from_id]
        end_index = location_index[to_id]
        if adjustment.closed:
            # Keep a finite, prohibitively expensive edge so optimizers can
            # still return a valid plan if this is the only feasible link.
            inst.dist[start_index, end_index] = 999.0
            inst.dist[end_index, start_index] = 999.0
            inst.travel_time[start_index, end_index] = 1998.0
            inst.travel_time[end_index, start_index] = 1998.0
        else:
            multiplier = 1.0 + adjustment.delay_percent / 100.0
            inst.dist[start_index, end_index] *= multiplier
            inst.dist[end_index, start_index] *= multiplier
            inst.travel_time[start_index, end_index] *= multiplier
            inst.travel_time[end_index, start_index] *= multiplier
        start_name = all_locations[start_index].name
        end_name = all_locations[end_index].name
        if adjustment.incident_type:
            incident_name = {
                "accident": "simulated accident",
                "congestion": "simulated congestion",
                "road_closure": "simulated road closure",
            }[adjustment.incident_type]
            impact = "high closure penalty applied" if adjustment.closed else f"+{adjustment.delay_percent:g}% modeled travel time"
            traffic_alerts.append(f"{incident_name.title()} on {start_name} → {end_name}: {impact}. Routes re-optimized.")
        else:
            traffic_alerts.append(
                f"Manual congestion: {start_name} → {end_name}, +{adjustment.delay_percent:g}% modeled travel time."
            )

    # Get algorithm class and run real optimization
    algo_meta = ALGORITHMS[request.algorithm]
    algo_class = algo_meta["class"]

    optimizer = algo_class(
        inst,
        max_iter=request.max_iter,
        time_limit=request.time_limit,
        seed=request.seed
    )

    result = optimizer.optimize()

    if not result["feasible"] or not result["routes"]:
        raise HTTPException(
            status_code=422,
            detail=(
                f"No feasible plan fits {len(request.vehicles)} vehicles and the current time windows. "
                "Add vehicles, reduce delivery demand, or widen the time windows."
            ),
        )

    # Process routes for vehicles and drivers
    raw_routes = result["routes"] if result["routes"] else []
    fleet = request.vehicles
    if len(raw_routes) > len(fleet):
        raise HTTPException(
            status_code=422,
            detail=f"This plan needs {len(raw_routes)} vehicles, but only {len(fleet)} are available. Add vehicles or reduce demand.",
        )

    # Build vehicle route responses
    processed_routes = []
    total_distance_km = 0.0
    total_travel_time_min = 0.0
    total_delivered_demand = 0.0
    compliant_stops = 0
    total_stops = 0

    for r_idx, customer_ids in enumerate(raw_routes):
        vehicle = fleet[r_idx]
        color = ROUTE_COLORS[r_idx % len(ROUTE_COLORS)]

        # Route load
        route_demand = sum(demand[cid] for cid in customer_ids)
        total_delivered_demand += route_demand

        # Build stops sequence
        stops = []
        cur_time = 0.0  # 08:00 AM
        cur_node = 0    # depot
        remaining_load = route_demand
        route_dist = 0.0
        route_time = 0.0

        # Stop 0: Depot Start
        stops.append({
            "stop_number": 0,
            "location_id": 0,
            "name": request.depot.name,
            "lat": request.depot.lat,
            "lng": request.depot.lng,
            "type": "depot",
            "demand": 0.0,
            "current_load": remaining_load,
            "capacity": vehicle.capacity,
            "capacity_usage_pct": round((remaining_load / vehicle.capacity) * 100, 1),
            "arrival_time_min": 0.0,
            "arrival_time_str": format_time_min(0.0),
            "departure_time_str": format_time_min(0.0),
            "ready_time_str": format_time_min(request.depot.ready_time),
            "due_date_str": format_time_min(request.depot.due_date),
            "ready_time": request.depot.ready_time,
            "due_date": request.depot.due_date,
            "service_time": request.depot.service_time,
            "status": "depot_start",
            "leg_distance_km": 0.0,
            "leg_time_min": 0.0,
            "traffic_note": "Depot departure"
        })

        for stop_seq, cid in enumerate(customer_ids, start=1):
            loc = request.deliveries[cid - 1]
            leg_dist = float(inst.physical_dist[cur_node, cid])
            leg_min = float(inst.travel_time[cur_node, cid])
            arrival_min = cur_time + leg_min
            
            # Check time windows
            wait_min = max(0.0, loc.ready_time - arrival_min)
            service_start = arrival_min + wait_min
            departure_min = service_start + loc.service_time

            status = "on_time"
            if arrival_min > loc.due_date:
                status = "delayed"
            elif arrival_min < loc.ready_time:
                status = "early_wait"
            if service_start <= loc.due_date:
                compliant_stops += 1
            total_stops += 1

            remaining_load -= loc.demand
            route_dist += leg_dist
            route_time += leg_min + loc.service_time + wait_min
            baseline_leg_min = max(0.01, leg_dist * 60.0 / NAVI_CITY_SPEED_KMH)
            modeled_traffic_factor = leg_min / baseline_leg_min
            if leg_min >= 1000:
                traffic_note = "Road closure penalty"
            elif modeled_traffic_factor > 1.05:
                delay_percent = round((modeled_traffic_factor - 1) * 100)
                traffic_note = f"Modeled congestion (+{delay_percent}%)"
            else:
                traffic_note = "Normal traffic"

            stops.append({
                "stop_number": stop_seq,
                "location_id": loc.id,
                "name": loc.name,
                "lat": loc.lat,
                "lng": loc.lng,
                "type": "customer",
                "demand": loc.demand,
                "current_load": max(0.0, remaining_load),
                "capacity": vehicle.capacity,
                "capacity_usage_pct": round((max(0.0, remaining_load) / vehicle.capacity) * 100, 1),
                "arrival_time_min": round(arrival_min, 1),
                "arrival_time_str": format_time_min(arrival_min),
                "departure_time_str": format_time_min(departure_min),
                "ready_time_str": format_time_min(loc.ready_time),
                "due_date_str": format_time_min(loc.due_date),
                "ready_time": loc.ready_time,
                "due_date": loc.due_date,
                "service_time": loc.service_time,
                "priority": loc.priority,
                "status": status,
                "leg_distance_km": round(leg_dist, 2),
                "leg_time_min": round(leg_min, 1),
                "traffic_note": traffic_note,
            })

            cur_time = departure_min
            cur_node = cid

        # Return to depot
        return_dist = float(inst.physical_dist[cur_node, 0])
        return_time = float(inst.travel_time[cur_node, 0])
        final_arrival = cur_time + return_time
        route_dist += return_dist
        route_time += return_time

        stops.append({
            "stop_number": len(customer_ids) + 1,
            "location_id": 0,
            "name": f"{request.depot.name} (Return)",
            "lat": request.depot.lat,
            "lng": request.depot.lng,
            "type": "depot",
            "demand": 0.0,
            "current_load": 0.0,
            "capacity": vehicle.capacity,
            "capacity_usage_pct": 0.0,
            "arrival_time_min": round(final_arrival, 1),
            "arrival_time_str": format_time_min(final_arrival),
            "departure_time_str": format_time_min(final_arrival),
            "ready_time_str": format_time_min(request.depot.ready_time),
            "due_date_str": format_time_min(request.depot.due_date),
            "ready_time": request.depot.ready_time,
            "due_date": request.depot.due_date,
            "service_time": request.depot.service_time,
            "status": "on_time" if final_arrival <= request.depot.due_date else "delayed",
            "leg_distance_km": round(return_dist, 2),
            "leg_time_min": round(return_time, 1),
            "traffic_note": "Return to base"
        })

        total_distance_km += route_dist
        total_travel_time_min += route_time

        processed_routes.append({
            "route_id": f"route-{r_idx + 1}",
            "vehicle": vehicle,
            "color": color,
            "total_distance_km": round(route_dist, 2),
            "total_travel_time_min": round(route_time, 1),
            "total_demand": round(route_demand, 1),
            "capacity_usage_pct": round((route_demand / vehicle.capacity) * 100, 1),
            "stops": stops,
            "customer_ids": [request.deliveries[cid - 1].id for cid in customer_ids],
            # Convert NumPy's bool_ to a native bool for FastAPI/JSON.
            "feasible": bool(route_demand <= vehicle.capacity),
        })

    compliance_pct = round((compliant_stops / max(1, total_stops)) * 100, 1)

    return {
        "status": "success",
        "distance_model": "straight_line_coordinate_distance",
        "travel_time_model": f"{NAVI_CITY_SPEED_KMH:g} km/h city baseline with scenario/manual congestion, delivery service, and time-window waits",
        "algorithm": {
            "id": request.algorithm,
            "name": algo_meta["name"],
            "description": algo_meta["description"],
        },
        "stats": {
            "total_distance_km": round(total_distance_km, 2),
            "total_travel_time_min": round(total_travel_time_min, 1),
            "vehicles_used": len(processed_routes),
            "total_deliveries": n_cust,
            "total_demand_delivered": round(total_delivered_demand, 1),
            "time_window_compliance_pct": compliance_pct,
            "feasible": bool(result["feasible"]),
            "computation_time_seconds": round(float(result["time"]), 3),
            "iterations_to_best": int(result["iterations_to_best"]),
        },
        # Optimizers use NumPy values internally. Convert them at the API
        # boundary so FastAPI's JSON encoder only receives native scalars.
        "convergence": [float(value) for value in result["convergence"]],
        "routes": processed_routes,
        "traffic_alerts": traffic_alerts,
        "traffic_scenario": request.traffic_scenario,
        "traffic_adjustments": [adjustment.model_dump() for adjustment in request.traffic_adjustments],
    }


# In-memory dispatch and driver tracking
active_dispatch_store: Dict[str, Any] = {}

class DispatchSaveRequest(BaseModel):
    optimization_result: Dict[str, Any]
    dispatched_by: str = "Admin"
    completed_location_ids: List[int] = Field(default_factory=list)

@app.post("/navi-mumbai/dispatch")
async def save_dispatch(request: DispatchSaveRequest):
    global active_dispatch_store
    active_dispatch_store = {
        "dispatched_at": datetime.utcnow().isoformat(),
        "dispatched_by": request.dispatched_by,
        "data": request.optimization_result,
        "driver_progress": {},
        "completed_location_ids": request.completed_location_ids,
    }
    return {"status": "dispatched", "message": "Routes successfully dispatched to drivers"}

@app.get("/navi-mumbai/dispatch")
async def get_dispatch():
    if not active_dispatch_store:
        return {"dispatched": False, "data": None}
    return {"dispatched": True, **active_dispatch_store}

class CompleteStopRequest(BaseModel):
    driver_name: str
    stop_number: int

@app.post("/navi-mumbai/driver/complete-stop")
async def complete_driver_stop(req: CompleteStopRequest):
    if not active_dispatch_store:
        raise HTTPException(status_code=400, detail="No active dispatch found")
    progress = active_dispatch_store.setdefault("driver_progress", {})
    driver_stops = progress.setdefault(req.driver_name, [])
    if req.stop_number not in driver_stops:
        driver_stops.append(req.stop_number)
    route = next(
        (route for route in active_dispatch_store.get("data", {}).get("routes", [])
         if route.get("vehicle", {}).get("driver_name") == req.driver_name),
        None,
    )
    completed_location_ids = active_dispatch_store.setdefault("completed_location_ids", [])
    if route:
        stop = next(
            (stop for stop in route.get("stops", [])
             if stop.get("stop_number") == req.stop_number and stop.get("type") == "customer"),
            None,
        )
        if stop and stop.get("location_id") not in completed_location_ids:
            completed_location_ids.append(stop["location_id"])
    return {
        "status": "success",
        "completed_stops": driver_stops,
        "completed_location_ids": completed_location_ids,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

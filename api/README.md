# QMaps API - Quick Start Guide

## Start the API Server

### Option 1: Direct
```bash
cd C:/Users/daaim/OneDrive/Desktop/QMaps
python api/main.py
```

### Option 2: Using start script
```bash
cd C:/Users/daaim/OneDrive/Desktop/QMaps/api
bash start.sh
```

The API will start on **http://localhost:8000**

## API Documentation

Once running, visit:
- **Interactive docs:** http://localhost:8000/docs
- **Root:** http://localhost:8000/

## Available Endpoints

### GET /algorithms
List all available optimization algorithms.

```bash
curl http://localhost:8000/algorithms
```

### GET /instances
List all available VRP instances.

```bash
curl http://localhost:8000/instances
```

### POST /optimize
Submit an optimization job.

```bash
curl -X POST http://localhost:8000/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "algorithm": "qa_qpso",
    "instance": "RC101",
    "n_customers": 25,
    "max_iter": 300,
    "time_limit": 5.0,
    "seed": 0
  }'
```

Response:
```json
{
  "job_id": "uuid-here",
  "status": "pending",
  "message": "Optimization job submitted"
}
```

### GET /results/{job_id}
Get optimization results.

```bash
curl http://localhost:8000/results/{job_id}
```

Response (when completed):
```json
{
  "job_id": "uuid-here",
  "status": "completed",
  "algorithm": "qa_qpso",
  "instance": "RC101",
  "cost": 557.29,
  "routes": [[1, 2, 3], [4, 5, 6]],
  "convergence": [900.5, 850.2, ...],
  "time": 3.15,
  "feasible": true
}
```

### GET /benchmark/results
Get summary of the 540-run benchmark.

```bash
curl http://localhost:8000/benchmark/results
```

## Testing the API

### Python Example
```python
import requests
import time

# Submit job
response = requests.post("http://localhost:8000/optimize", json={
    "algorithm": "qa_qpso",
    "instance": "RC101",
    "n_customers": 25,
    "max_iter": 100,
    "time_limit": 3.0,
    "seed": 0
})

job_id = response.json()["job_id"]
print(f"Job ID: {job_id}")

# Poll for results
while True:
    result = requests.get(f"http://localhost:8000/results/{job_id}").json()
    if result["status"] == "completed":
        print(f"Final cost: {result['cost']}")
        break
    elif result["status"] == "failed":
        print(f"Error: {result.get('error')}")
        break
    time.sleep(1)
```

### JavaScript/Fetch Example
```javascript
// Submit job
const response = await fetch('http://localhost:8000/optimize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    algorithm: 'qa_qpso',
    instance: 'RC101',
    n_customers: 25,
    max_iter: 100,
    time_limit: 3.0,
    seed: 0
  })
});

const { job_id } = await response.json();

// Poll for results
const checkResults = async () => {
  const res = await fetch(`http://localhost:8000/results/${job_id}`);
  const data = await res.json();
  
  if (data.status === 'completed') {
    console.log('Cost:', data.cost);
    console.log('Routes:', data.routes);
  } else if (data.status === 'pending' || data.status === 'running') {
    setTimeout(checkResults, 1000);
  }
};

checkResults();
```

## CORS

CORS is enabled for all origins in development. For production, update the `allow_origins` in `api/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],
    ...
)
```

## Dependencies

Already installed:
- fastapi
- uvicorn
- pydantic

## Troubleshooting

### Port already in use
If port 8000 is taken, edit `api/main.py` line 252:
```python
uvicorn.run(app, host="0.0.0.0", port=8001)  # Change to 8001
```

### Import errors
Make sure you're running from the QMaps root directory:
```bash
cd C:/Users/daaim/OneDrive/Desktop/QMaps
python api/main.py
```

## Production Deployment

For production, use:
```bash
uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

Or with gunicorn:
```bash
gunicorn api.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

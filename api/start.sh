#!/bin/bash
# Start the QMaps API server

cd "$(dirname "$0")/.."

echo "Starting QMaps API server..."
echo "API will be available at: http://localhost:8000"
echo "API docs (Swagger): http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"
echo ""

python api/main.py

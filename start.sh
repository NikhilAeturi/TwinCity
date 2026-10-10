#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "=========================================================="
echo "  RoboTwin: Physics-Based Humanoid Robotics Simulator    "
echo "  Real World In, Humanoid Robot Out                      "
echo "=========================================================="

# Activate virtual environment
if [ -d ".venv" ]; then
    source .venv/bin/activate
else
    echo "Virtual environment not found. Run python3 -m venv .venv and pip install -r backend/requirements.txt"
    exit 1
fi

echo ">> Starting FastAPI MuJoCo Physics Backend on http://127.0.0.1:8000..."
./.venv/bin/uvicorn backend.app:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

echo ">> Starting Vite 3D Web Dashboard on http://127.0.0.1:5173..."
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" SIGINT SIGTERM

echo ">> RoboTwin Simulator is LIVE!"
echo ">> Access the Dashboard: http://127.0.0.1:5173"
echo ">> Backend REST & WebSockets: http://127.0.0.1:8000"
echo ">> Press Ctrl+C to stop all services."

wait

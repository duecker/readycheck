#!/bin/bash
# ReadyCheck dev startup script
# Usage: bash dev.sh

echo "Starting ReadyCheck dev environment..."

# Check dependencies
if ! command -v node &> /dev/null; then echo "Node.js required. Install from nodejs.org"; exit 1; fi
if ! command -v psql &> /dev/null; then echo "PostgreSQL required. Install and ensure it's running."; fi

# Install if needed
echo "Checking frontend dependencies..."
cd frontend && [ ! -d node_modules ] && npm install
echo "Checking backend dependencies..."
cd ../backend && [ ! -d node_modules ] && npm install
cd ..

echo ""
echo "Starting backend on port 3001..."
cd backend && npm run dev &
BACKEND_PID=$!

sleep 2

echo "Starting frontend on port 5173..."
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "ReadyCheck is running:"
echo "  Landing page:  http://localhost:5173/"
echo "  Agent check:   http://localhost:5173/check?demo=1"
echo "  Register:      http://localhost:5173/register"
echo ""
echo "Press Ctrl+C to stop both servers."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" INT
wait

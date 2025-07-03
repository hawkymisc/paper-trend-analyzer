#!/bin/bash

# バックエンドの起動
echo "Starting backend server..."
cd backend
source venv/bin/activate
nohup uvicorn app.main:app --reload --port 8000 > backend_log.txt 2>&1 &
BACKEND_PID=$!
echo "Backend server started with PID: $BACKEND_PID. Log: backend/backend_log.txt"
cd ..

# フロントエンドの起動
echo "Starting frontend server..."
cd frontend
nohup npm start > frontend_log.txt 2>&1 &
FRONTEND_PID=$!
echo "Frontend server started with PID: $FRONTEND_PID. Log: frontend/frontend_log.txt"
cd ..

echo "Development servers started."
echo "To stop them, run: kill $BACKEND_PID $FRONTEND_PID"
echo "Or use 'killall uvicorn' and 'killall node' (use with caution)."

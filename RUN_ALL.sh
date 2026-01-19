#!/bin/bash

echo "========================================"
echo "DARTS APP - TELJES INDÍTÁS"
echo "========================================"
echo ""

# Backend indítása háttérben
echo "1. Backend indítása..."
cd dart-detection-backend
python3 main.py > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "   Backend PID: $BACKEND_PID"
echo "   Log: backend.log"
echo ""

# Várunk 3 másodpercet
sleep 3

# Ellenőrizzük hogy él-e
if ps -p $BACKEND_PID > /dev/null; then
   echo "✅ Backend fut!"
else
   echo "❌ Backend hiba! Nézd meg: backend.log"
   exit 1
fi

echo ""
echo "2. Frontend indítása..."
echo ""
echo "========================================"
echo "APP: http://localhost:5173"
echo "Backend: http://localhost:8000/health"
echo "========================================"
echo ""
echo "LEÁLLÍTÁS: Nyomj CTRL+C, aztán:"
echo "  kill $BACKEND_PID"
echo ""

# Frontend indítása
npm run dev

# Cleanup
kill $BACKEND_PID 2>/dev/null

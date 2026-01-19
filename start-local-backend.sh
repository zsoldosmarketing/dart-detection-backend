#!/bin/bash

echo "========================================="
echo "DART DETECTION BACKEND - LOKALIS FUTATAS"
echo "========================================="
echo ""

cd dart-detection-backend

if [ ! -d "venv" ]; then
    echo "Python venv letrehozasa..."
    python3 -m venv venv
fi

echo "Venv aktiválása..."
source venv/bin/activate

echo "Fuggosegek telepitese..."
pip install -q -r requirements.txt

echo ""
echo "========================================="
echo "BACKEND INDUL: http://localhost:8000"
echo "========================================="
echo ""
echo "FONTOS: Allitsd at a .env fajlban:"
echo "  VITE_DART_DETECTION_API_URL=http://localhost:8000"
echo ""
echo "Majd masik terminalban:"
echo "  npm run dev"
echo ""
echo "========================================="
echo ""

python main.py

#!/bin/bash

echo "=========================================="
echo "DART DETECTION BACKEND DIAGNOSTICS"
echo "=========================================="
echo ""

echo "1. Checking .env configuration..."
if [ -f .env ]; then
    API_URL=$(grep VITE_DART_DETECTION_API_URL .env | cut -d '=' -f2)
    echo "   API URL: $API_URL"
else
    echo "   ❌ .env file not found!"
    exit 1
fi

echo ""
echo "2. Checking local backend..."
LOCAL_RESPONSE=$(curl -s -m 5 http://localhost:8000/health 2>&1)
if [ $? -eq 0 ]; then
    echo "   ✅ Local backend is RUNNING!"
    echo "   Response: $LOCAL_RESPONSE"
else
    echo "   ❌ Local backend is NOT running"
    echo "   Run: ./start-local-backend.sh"
fi

echo ""
echo "3. Checking Render backend..."
echo "   (This may take 60+ seconds if backend is sleeping...)"
RENDER_RESPONSE=$(curl -s -m 70 https://dart-detection-backend.onrender.com/health 2>&1)
if [ $? -eq 0 ]; then
    echo "   ✅ Render backend is AWAKE!"
    echo "   Response: $RENDER_RESPONSE"
else
    echo "   ⏱️ Render backend is SLEEPING or TIMEOUT"
    echo "   Try again in 60 seconds, or use local backend"
fi

echo ""
echo "4. Checking Python dependencies..."
if command -v python3 &> /dev/null; then
    echo "   ✅ Python3 is installed"
    if [ -f dart-detection-backend/requirements.txt ]; then
        echo "   ✅ requirements.txt found"
    else
        echo "   ❌ requirements.txt not found!"
    fi
else
    echo "   ❌ Python3 is NOT installed!"
fi

echo ""
echo "=========================================="
echo "RECOMMENDATION:"
echo "=========================================="

if [[ "$LOCAL_RESPONSE" == *"healthy"* ]]; then
    echo "✅ Use LOCAL backend (already running)"
    echo "   Your .env is configured: $API_URL"
elif [[ "$API_URL" == "http://localhost:8000" ]]; then
    echo "⚠️ .env is configured for LOCAL, but backend not running"
    echo "   Run: ./start-local-backend.sh"
elif [[ "$RENDER_RESPONSE" == *"healthy"* ]]; then
    echo "⚠️ Render backend is awake, but SLOW (cold start)"
    echo "   Consider using LOCAL backend for better performance"
else
    echo "❌ NO backend is available!"
    echo "   SOLUTION: ./start-local-backend.sh"
fi

echo ""

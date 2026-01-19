#!/bin/bash

echo "╔════════════════════════════════════════╗"
echo "║   DART DETECTION - STATUS CHECK        ║"
echo "╚════════════════════════════════════════╝"
echo ""

SUCCESS=0
WARNINGS=0
ERRORS=0

echo "📦 DEPLOYMENT PACKAGE"
echo "────────────────────────────────────────"
if [ -d "GITHUB_DEPLOY_PACKAGE" ]; then
    echo "✅ GITHUB_DEPLOY_PACKAGE mappa létezik"
    ((SUCCESS++))

    if [ -f "GITHUB_DEPLOY_PACKAGE/advanced_calibration.py" ]; then
        echo "✅ advanced_calibration.py megvan"
        ((SUCCESS++))
    else
        echo "❌ advanced_calibration.py HIÁNYZIK!"
        ((ERRORS++))
    fi

    if [ -f "GITHUB_DEPLOY_PACKAGE/DEPLOY_NOW.md" ]; then
        echo "✅ DEPLOY_NOW.md megvan"
        ((SUCCESS++))
    else
        echo "⚠️  DEPLOY_NOW.md hiányzik"
        ((WARNINGS++))
    fi

    if [ -f "GITHUB_DEPLOY_PACKAGE/SETUP_GUIDE.md" ]; then
        echo "✅ SETUP_GUIDE.md megvan"
        ((SUCCESS++))
    else
        echo "⚠️  SETUP_GUIDE.md hiányzik"
        ((WARNINGS++))
    fi
else
    echo "❌ GITHUB_DEPLOY_PACKAGE mappa HIÁNYZIK!"
    ((ERRORS++))
fi

echo ""
echo "⚙️  FRONTEND KONFIGURÁCIÓ"
echo "────────────────────────────────────────"

if [ -f ".env" ]; then
    echo "✅ .env fájl létezik"
    ((SUCCESS++))

    API_URL=$(grep VITE_DART_DETECTION_API_URL .env | cut -d '=' -f2)
    if [[ "$API_URL" == "https://dart-detection-backend.onrender.com" ]]; then
        echo "✅ API URL: $API_URL (Render)"
        ((SUCCESS++))
    elif [[ "$API_URL" == "http://localhost:8000" ]]; then
        echo "⚠️  API URL: $API_URL (Lokális)"
        echo "   💡 Deploy után állítsd át Render URL-re!"
        ((WARNINGS++))
    else
        echo "❌ API URL rossz: $API_URL"
        ((ERRORS++))
    fi
else
    echo "❌ .env fájl HIÁNYZIK!"
    ((ERRORS++))
fi

if [ -f "src/lib/dartDetectionApi.ts" ]; then
    echo "✅ dartDetectionApi.ts megvan"
    ((SUCCESS++))

    TIMEOUT=$(grep -A 5 "detectDartAdvanced" src/lib/dartDetectionApi.ts | grep "AbortSignal.timeout" | grep -o "[0-9]*")
    if [ "$TIMEOUT" -ge "30000" ]; then
        echo "✅ Detection timeout: ${TIMEOUT}ms"
        ((SUCCESS++))
    else
        echo "⚠️  Detection timeout: ${TIMEOUT}ms (kicsi lehet!)"
        ((WARNINGS++))
    fi
else
    echo "❌ dartDetectionApi.ts HIÁNYZIK!"
    ((ERRORS++))
fi

echo ""
echo "🏗️  BUILD"
echo "────────────────────────────────────────"

if [ -d "dist" ]; then
    echo "✅ dist/ mappa létezik"
    ((SUCCESS++))

    if [ -f "dist/index.html" ]; then
        echo "✅ Build sikeres"
        ((SUCCESS++))
    else
        echo "⚠️  Build lehet hogy nem friss"
        ((WARNINGS++))
    fi
else
    echo "⚠️  Nincs build - futtasd: npm run build"
    ((WARNINGS++))
fi

if [ -f "package.json" ]; then
    echo "✅ package.json megvan"
    ((SUCCESS++))
else
    echo "❌ package.json HIÁNYZIK!"
    ((ERRORS++))
fi

echo ""
echo "🌐 BACKEND KAPCSOLAT"
echo "────────────────────────────────────────"

if [ -f ".env" ]; then
    API_URL=$(grep VITE_DART_DETECTION_API_URL .env | cut -d '=' -f2)

    echo "   Ellenőrzés: $API_URL/health"
    echo "   (Ez eltarthat 60 másodpercig ha Render alszik...)"

    RESPONSE=$(curl -s -m 70 "$API_URL/health" 2>&1)

    if [[ "$RESPONSE" == *"healthy"* ]]; then
        echo "✅ Backend ELÉRHETŐ és MŰKÖDIK!"
        ((SUCCESS++))
    elif [[ "$RESPONSE" == *"Connection refused"* ]] || [[ "$RESPONSE" == *"Failed to connect"* ]]; then
        if [[ "$API_URL" == "http://localhost:8000" ]]; then
            echo "⚠️  Lokális backend NEM FUT"
            echo "   💡 Indítsd el: ./start-local-backend.sh"
            ((WARNINGS++))
        else
            echo "❌ Backend NEM ELÉRHETŐ!"
            ((ERRORS++))
        fi
    else
        echo "⏱️  Backend ALSZIK vagy TIMEOUT"
        echo "   💡 Ébreszd fel: curl $API_URL/health"
        echo "   💡 Várj 60 másodpercet!"
        ((WARNINGS++))
    fi
fi

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   ÖSSZESÍTÉS                           ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "✅ Sikeres: $SUCCESS"
echo "⚠️  Figyelmeztetések: $WARNINGS"
echo "❌ Hibák: $ERRORS"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo "🎉 MINDEN TÖKÉLETES!"
    echo ""
    echo "Következő lépések:"
    echo "  1. Deploy a GitHub-ra (GITHUB_DEPLOY_PACKAGE/DEPLOY_NOW.md)"
    echo "  2. Várj 5 percet"
    echo "  3. Ébreszd fel: curl https://dart-detection-backend.onrender.com/health"
    echo "  4. Futtasd: npm run dev"
    echo ""
elif [ $ERRORS -eq 0 ]; then
    echo "⚠️  VAN PÁR FIGYELMEZTETÉS"
    echo ""
    echo "Nézd meg a fenti üzeneteket!"
    echo "De alapvetően MŰKÖDŐKÉPES! 👍"
    echo ""
elif [ $ERRORS -le 2 ]; then
    echo "⚠️  VAN PÁR HIBA, DE JAVÍTHATÓ"
    echo ""
    echo "Nézd meg a fenti üzeneteket!"
    echo "Dokumentáció: FINAL_STATUS.md"
    echo ""
else
    echo "❌ SOK HIBA VAN!"
    echo ""
    echo "Nézd meg: FINAL_STATUS.md"
    echo "Vagy: GITHUB_DEPLOY_PACKAGE/SETUP_GUIDE.md"
    echo ""
fi

echo "📖 Részletes útmutatók:"
echo "   • FINAL_STATUS.md - Teljes státusz"
echo "   • GITHUB_DEPLOY_PACKAGE/DEPLOY_NOW.md - Gyors deploy"
echo "   • GITHUB_DEPLOY_PACKAGE/SETUP_GUIDE.md - Teljes guide"
echo ""

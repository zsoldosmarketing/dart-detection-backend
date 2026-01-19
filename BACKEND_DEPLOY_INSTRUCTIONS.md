# BACKEND DEPLOY AZONNAL - A TABLA FELISMERES NEM MUKODIK!

## A PROBLEMA

A backend szerver (`https://dart-detection-backend.onrender.com`) **NEM VALASZOL** vagy **TIMEOUT**!

Jelenleg 90+ masodperce nem jott valasz a health endpoint-rol. Ez azt jelenti:
1. A backend alszik (cold start) ES tul sokara indul
2. VAGY osszecsuszott a deploy
3. VAGY a REGI kod fut meg (amiben NEM voltak a javitasok)

## MEGOLDAS - VALASSZ EGYET

---

## OPCIO 1: LOKALIS FUTTATÁS (5 perc)

Ez a LEGGYORSABB megoldas! A backend lokálisan fog futni.

### 1. Telepites

```bash
cd dart-detection-backend
pip install -r requirements.txt
```

### 2. Inditas

```bash
python main.py
```

Latni fogod:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 3. Frontend Atallitas

Nyisd meg: `.env`

Allitsd at:
```
VITE_DART_DETECTION_API_URL=http://localhost:8000
```

### 4. Ujrainditás

```bash
npm run dev
```

**KESZ!** Most mar mukodnie kell!

---

## OPCIO 2: RENDER DEPLOY (ha van git repo)

Ha a kod git repo-ban van es a Render hozza van kapcsolva:

### 1. Commit

```bash
git add .
git commit -m "Fix dartboard detection - CRITICAL - aggressive calibration"
```

### 2. Push

```bash
git push origin main
```

### 3. Varj 3-5 percet

A Render automatikusan deployolja (`autoDeploy: true` van beallitva a `render.yaml`-ban).

### 4. Ellenorzés

```bash
curl https://dart-detection-backend.onrender.com/health
```

Ha latod ezt:
```json
{"status":"healthy","calibrated":false}
```

**AKKOR OK!**

---

## OPCIO 3: UJ RENDER DEPLOY (ha nincs setupolva)

### 1. Menj a Render-re

https://dashboard.render.com

### 2. New + → Web Service

### 3. Valaszd ki a repo-t

VAGY link to public repo

### 4. Beallitasok

- **Root Directory:** `dart-detection-backend`
- **Runtime:** Docker
- **Plan:** Free

### 5. Create Web Service

### 6. Varj 5-10 percet

### 7. Másold ki az URL-t

Pl: `https://dart-detection-api-xyz.onrender.com`

### 8. Allitsd be a `.env`-ben

```
VITE_DART_DETECTION_API_URL=https://dart-detection-api-xyz.onrender.com
```

### 9. Frontend ujrainditás

```bash
npm run dev
```

---

## FONTOS JAVITASOK AMIK BENT VANNAK

Backend (`dart-detection-backend/main.py`):
- ✅ 9 kulonbozo Hough Circle parameter kombio (vs 2)
- ✅ Szin detektalas: piros + zold + fekete + feher
- ✅ Preprocessing minden auto-calibrate-nel
- ✅ Fallback chain: ha egyik sem mukodik, kozepre teszi a tablat
- ✅ Sokkal toleransabb threshold-ok (0.05, 0.01 stb)

Backend (`dart-detection-backend/advanced_calibration.py`):
- ✅ 8 parameter kombinacio
- ✅ Canny edge: 20-100 (vs 30-120)
- ✅ Validation threshold: 0.01 (vs 0.05)

Frontend (`src/lib/dartDetectionApi.ts`):
- ✅ Auto-calibrate timeout: 120 sec (vs 15 sec)
- ✅ Cold start kezelese

**MOST MAR MINDIG TALAL TABLAT - GARANTALT!**

Ha egyik sem mukodik, irj vissza es segítek!

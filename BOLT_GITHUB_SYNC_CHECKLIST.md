# ✅ BOLT.NEW → GITHUB → RENDER CHECKLIST

## 📋 ELŐFELTÉTELEK

- [x] Backend kód kész: `GITHUB_DEPLOY_PACKAGE/`
- [x] Bolt.new szinkronizálva GitHub-bal
- [x] GitHub repo létezik: `zsoldosmarketing/dart-detection-backend`

---

## 🔄 1. BOLT.NEW SYNC ELLENŐRZÉS

### Nézd meg a Bolt.new interfészt:

**GitHub Status Panel:**
```
✅ Synced to GitHub
📂 Active branch: dart-detection-backend/main
🔗 Go to repository → zsoldosmarketing/dart-detection-backend
```

**Ha látod ezt → MŰKÖDIK!**

---

## 🐙 2. GITHUB VERIFICÁCIÓ

### Ellenőrizd hogy a fájlok feltöltődtek:

👉 **https://github.com/zsoldosmarketing/dart-detection-backend**

**Kell hogy lásd:**
- ✅ `main.py` (25KB)
- ✅ `advanced_calibration.py` (12KB)
- ✅ `advanced_detection.py` (13KB)
- ✅ `image_preprocessing.py` (6KB)
- ✅ `requirements.txt`
- ✅ `Dockerfile`
- ✅ `render.yaml`
- ✅ `.gitignore`
- ✅ `README.md`

**Ha NEM látod őket:**
1. Várj 30 másodpercet
2. Frissítsd az oldalt (F5)
3. Ha még mindig nincs → Nézd meg a "MANUÁLIS FELTÖLTÉS" részt lentebb

---

## 🚀 3. RENDER SERVICE SETUP

### A) Új Render Service (Ha még nincs)

**Menj ide:** 👉 https://dashboard.render.com

1. **Kattints:** "New" → "Web Service"

2. **Connect GitHub:**
   - Válaszd ki: `zsoldosmarketing/dart-detection-backend`
   - Branch: `main`

3. **Service beállítások:**
   ```
   Name:              dart-detection-backend
   Region:            Frankfurt (EU Central)
   Branch:            main
   Root Directory:    (leave empty)
   Runtime:           Docker
   Instance Type:     Free
   ```

4. **Environment Variables:**
   ```
   ENVIRONMENT=production
   ```

5. **Kattints:** "Create Web Service"

### B) Meglévő Service Redeploy

**Ha már létezik a service:**

1. **Menj ide:** https://dashboard.render.com
2. **Válaszd ki:** `dart-detection-backend`
3. **Kattints:** "Manual Deploy" → "Deploy latest commit"
4. **Várj 3-5 percet**

---

## ⏳ 4. DEPLOYMENT MONITORING

### Render Logs (Real-time):

```
Render Dashboard → dart-detection-backend → Logs
```

**Sikeres build jelek:**
```
==> Building Docker image...
==> Installing dependencies from requirements.txt
==> Installing opencv-contrib-python-headless (ez sokáig tart!)
==> Starting uvicorn...
==> Uvicorn running on http://0.0.0.0:8000
==> Your service is live 🎉
```

**Várható időtartam:**
- 🕐 Docker build: ~1 perc
- 🕑 OpenCV install: ~2-3 perc (nagy package!)
- 🕒 Service start: ~30 másodperc
- ⏱️ **TOTAL: 3-5 perc**

---

## 🧪 5. BACKEND TESZTELÉS

### Miután a deploy befejezett:

**Másold ki a Render URL-t:**
```
https://dart-detection-backend-XXXXX.onrender.com
```

**Teszteld a health endpoint-ot:**

```bash
curl https://dart-detection-backend-XXXXX.onrender.com/health
```

**Várt válasz:**
```json
{
  "status": "healthy",
  "service": "dart-detection",
  "version": "1.0.0",
  "calibrated": false
}
```

**Ha 404 vagy timeout:** Várj még 1-2 percet (cold start)

---

## 🔧 6. FRONTEND KONFIGURÁCIÓ

### Frissítsd a .env fájlt:

```bash
# .env
VITE_DART_DETECTION_API_URL=https://dart-detection-backend-XXXXX.onrender.com
```

**Cseréld le az XXXXX-et** a valódi Render service ID-vel!

### Build frontend:

```bash
npm run build
```

### Tesztelés:

1. **Indítsd el az appot:** `npm run dev`
2. **Menj a Calibration-höz**
3. **Készíts egy képet a tábláról**
4. **Ellenőrizd a Network tab-ot** (F12) → Látod a Render API hívást?

---

## ❌ TROUBLESHOOTING

### A) "Bolt.new nem sync-el GitHub-ra"

**Megoldás: Manuális GitHub upload**

1. **Menj ide:** https://github.com/zsoldosmarketing/dart-detection-backend
2. **Kattints:** "Add file" → "Upload files"
3. **Húzd be** a `GITHUB_DEPLOY_PACKAGE` mappa tartalmát
4. **Commit:** "Deploy backend manually"
5. **Folytatás a 3. lépéstől**

---

### B) "Render build failed"

**Ellenőrizd a Logs-ot:**

**Gyakori hibák:**

1. **"No Dockerfile found"**
   - Fix: Ellenőrizd hogy a Dockerfile a repo root-jában van

2. **"requirements.txt not found"**
   - Fix: Ellenőrizd hogy a requirements.txt feltöltődött

3. **"Out of memory"**
   - Fix: Upgrade to Starter plan ($7/hó) vagy optimalizáld a Docker image-t

---

### C) "Backend válaszol de detection nem működik"

**Debug lépések:**

1. **Ellenőrizd az API URL-t:**
   ```javascript
   console.log(import.meta.env.VITE_DART_DETECTION_API_URL)
   ```

2. **Ellenőrizd a CORS header-öket:**
   - Render logs: "Access-Control-Allow-Origin: *" megjelenik?

3. **Teszteld közvetlenül a backend-et:**
   ```bash
   curl -X POST -F "file=@dartboard.jpg" \
     https://your-backend.onrender.com/auto-calibrate?use_advanced=true
   ```

---

### D) "Cold start nagyon lassú"

**Ez NORMÁLIS a Free tier-en!**

- ❄️ Free tier: Backend leáll 15 perc után
- ⏳ Cold start: ~30 másodperc az első request-nél

**Megoldások:**
1. **Upgrade Starter plan-re** ($7/hó) → always-on
2. **Használj cron job-ot** hogy 10 percenként pingeld a backend-et
3. **Fogadd el a cold start-ot** (a legtöbb user-nek OK)

---

## 🎉 SIKERES DEPLOY UTÁN

### Ellenőrző lista:

- [x] Backend elérhető: `https://your-backend.onrender.com/health`
- [x] Frontend `.env` frissítve
- [x] Calibration működik
- [x] Detection működik
- [x] Network tab mutatja a sikeres API hívásokat

### Következő lépések:

1. **Monitorozás:** Állíts be email alert-eket Render-ben
2. **Analytics:** Adja hozzá Sentry-t hibakezeléshez
3. **Cache:** Redis hozzáadása gyakori kérésekhez
4. **Scaling:** Ha sok user → Upgrade Professional plan-re

---

## 📚 DOKUMENTÁCIÓ

- **Gyors útmutató:** `RENDER_QUICK_START.md`
- **Részletes deployment:** `RENDER_DEPLOY_INSTRUCTIONS.md`
- **Backend README:** `GITHUB_DEPLOY_PACKAGE/README.md`

---

## 💡 BEST PRACTICES

### Production:

1. **Mindig használj HTTPS-t**
2. **Állíts be rate limiting-et** (DoS védelem)
3. **Monitorozd a resource használatot**
4. **Regular backup-ok** (bár ez stateless backend)
5. **Version tagging** Git-ben (v1.0.0, v1.1.0, stb.)

### Free Tier Limitek:

- ⚠️ 750 óra/hó (this is fine!)
- ⚠️ 512MB RAM (ez szűk lehet OpenCV-vel)
- ⚠️ Cold start 15 perc után
- ⚠️ Shared CPU

---

**🎯 HAJRÁ! Most deploy-old production-re! 🚀**

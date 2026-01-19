# 🚀 RENDER DEPLOYMENT - LÉPÉSRŐL LÉPÉSRE

## ✅ ELŐFELTÉTELEK

- GitHub repo létezik: `zsoldosmarketing/dart-detection-backend`
- Bolt.new szinkronizálva van GitHub-bal (lásd képernyőképen: "Synced to GitHub")

---

## 📤 1. LÉPÉS: FÁJLOK FELTÖLTÉSE GITHUB-RA

### A) Bolt.new automatikus sync (JELENLEG AKTÍV)

A Bolt.new **AUTOMATIKUSAN** szinkronizálja a következő mappát:
```
GITHUB_DEPLOY_PACKAGE/
├── main.py
├── advanced_calibration.py
├── advanced_detection.py
├── image_preprocessing.py
├── requirements.txt
├── Dockerfile
├── render.yaml
├── .gitignore
└── README.md
```

**Ellenőrzés:**
1. Nyisd meg: https://github.com/zsoldosmarketing/dart-detection-backend
2. Ellenőrizd hogy a fájlok feltöltődtek
3. Ha nem látod őket, várd 30 másodpercet és frissítsd az oldalt

---

### B) ALTERNATÍVA: Manuális GitHub upload

Ha a Bolt.new sync nem működik:

1. **Menj ide:** https://github.com/zsoldosmarketing/dart-detection-backend
2. **Kattints:** "Add file" → "Upload files"
3. **Húzd be** a `GITHUB_DEPLOY_PACKAGE` mappa tartalmát
4. **Commit:** "Deploy dart detection backend"
5. **Push** a main branch-re

---

## 🎯 2. LÉPÉS: RENDER SERVICE LÉTREHOZÁSA

### Menj a Render Dashboard-ra:
👉 **https://dashboard.render.com**

### Új Web Service:

1. **Kattints:** "New" → "Web Service"

2. **Connect GitHub repo:**
   - Repository: `zsoldosmarketing/dart-detection-backend`
   - Branch: `main`

3. **Service beállítások:**
   ```
   Name:              dart-detection-backend
   Region:            Frankfurt (EU Central)
   Branch:            main
   Root Directory:    (hagyd üresen)
   Runtime:           Docker
   Instance Type:     Free
   ```

4. **Environment Variables:**
   ```
   ENVIRONMENT=production
   ```

5. **Kattints:** "Create Web Service"

---

## ⚡ 3. LÉPÉS: DEPLOYMENT VÁRÁS

### Build folyamat:
- ⏱️ **Időtartam:** ~3-5 perc
- 📦 Docker image build
- 📚 Python dependencies install (OpenCV, FastAPI, stb.)
- 🚀 Service indítás

### Deploy státusz ellenőrzés:
```
Render Dashboard → dart-detection-backend → Logs
```

**Sikeres deploy jelzők:**
```
✅ Building Docker image...
✅ Installing dependencies...
✅ Starting uvicorn...
✅ Application startup complete
✅ Deployed successfully
```

---

## 🔗 4. LÉPÉS: BACKEND URL FRISSÍTÉSE

### Miután a deploy sikeres:

1. **Másold ki** a Render service URL-t:
   ```
   https://dart-detection-backend-XXXXX.onrender.com
   ```

2. **Frissítsd** a frontend `.env` fájlban:
   ```bash
   VITE_VISION_BACKEND_URL=https://dart-detection-backend-XXXXX.onrender.com
   ```

3. **Build frontend:**
   ```bash
   npm run build
   ```

---

## 🧪 5. LÉPÉS: TESZTELÉS

### Backend health check:
```bash
curl https://dart-detection-backend-XXXXX.onrender.com/health
```

**Várt válasz:**
```json
{
  "status": "ok",
  "service": "dart-detection",
  "version": "1.0.0"
}
```

### Kalibráció tesztelés:
1. Nyisd meg az appot
2. Menj a "Vision Detection" beállításokhoz
3. Készíts egy kalibrációs képet
4. Ellenőrizd hogy a backend válaszol

---

## ❌ HIBAELHÁRÍTÁS

### "Application failed to respond"
- **Ok:** Backend még indul (cold start)
- **Megoldás:** Várj 30 másodpercet és próbáld újra

### "Build failed"
- **Ellenőrizd:** requirements.txt helyes
- **Ellenőrizd:** Dockerfile syntax
- **Nézd meg:** Render logs részletes hibáért

### "Out of memory"
- **Ok:** Free tier csak 512MB RAM
- **Megoldás:** Upgrade-elj Starter plan-re ($7/hó)

---

## 💰 KÖLTSÉGEK

### Free Tier:
- ✅ 750 óra/hó INGYEN
- ⚠️ Cold start: ~30 másodperc
- ⚠️ Leáll 15 perc inaktivitás után

### Starter Plan ($7/hó):
- ✅ Always-on
- ✅ Nincs cold start
- ✅ Több memória

---

## 🎉 SIKERES DEPLOY UTÁN

### Frontend konfiguráció:
```typescript
// src/lib/dartDetectionApi.ts már konfigurálva van!
const BACKEND_URL = import.meta.env.VITE_VISION_BACKEND_URL;
```

### Használat:
1. Készíts kalibrációs képet
2. Backend feldolgozza
3. Élvezd az automatikus dart detekciót!

---

## 📞 SUPPORT

**Render dokumentáció:**
https://render.com/docs

**Render status:**
https://status.render.com

---

## ✨ TOVÁBBI OPTIMALIZÁLÁS

### Production upgrades:
1. **Redis cache** hozzáadása (feldolgozott képek cache-elése)
2. **CDN** használata (gyorsabb képfeltöltés)
3. **Load balancer** (több instance)
4. **Monitoring** (Sentry, DataDog)

---

**HAJRÁ! 🎯 A backend production-ready!**

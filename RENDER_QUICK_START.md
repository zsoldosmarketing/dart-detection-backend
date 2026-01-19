# 🚀 RENDER DEPLOY - GYORS START

## 1️⃣ GITHUB SYNC (AUTOMATIKUS)

Bolt.new **AUTOMATIKUSAN** feltölti a `GITHUB_DEPLOY_PACKAGE` mappát!

**Ellenőrzés:**
👉 https://github.com/zsoldosmarketing/dart-detection-backend

Várd meg amíg a fájlok megjelennek (10-30 mp).

---

## 2️⃣ RENDER SERVICE LÉTREHOZÁS

**Menj ide:** 👉 https://dashboard.render.com

### Új Web Service:

```
New → Web Service → Connect GitHub

Repository:        zsoldosmarketing/dart-detection-backend
Branch:            main
Name:              dart-detection-backend
Region:            Frankfurt (EU Central)
Runtime:           Docker
Instance Type:     Free
```

**Kattints:** "Create Web Service"

---

## 3️⃣ DEPLOY VÁRÁS (~3-5 perc)

Render Dashboard → Logs

```
✅ Building...
✅ Installing dependencies...
✅ Starting uvicorn...
✅ Deploy successful!
```

---

## 4️⃣ URL BEÁLLÍTÁS

1. **Másold ki** a Render URL-t:
   ```
   https://dart-detection-backend-XXXXX.onrender.com
   ```

2. **Frissítsd** a `.env` fájlt:
   ```
   VITE_DART_DETECTION_API_URL=https://dart-detection-backend-XXXXX.onrender.com
   ```

3. **Build frontend:**
   ```bash
   npm run build
   ```

---

## ✅ KÉSZ!

**Teszt:**
```bash
curl https://dart-detection-backend-XXXXX.onrender.com/health
```

**Használat:**
1. Nyisd meg az appot
2. Vision Detection → Calibration
3. Készíts képet
4. Backend dolgozik!

---

**📖 Részletes útmutató:** `RENDER_DEPLOY_INSTRUCTIONS.md`

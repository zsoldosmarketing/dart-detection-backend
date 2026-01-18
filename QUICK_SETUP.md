# Gyors Beállítás - Automatikus Dart Felismerés

## TL;DR - 5 Perc Setup

### 1. Deploy Backend (Render.com)

**Egyszerű lépések:**

1. Nyisd meg: [render.com](https://render.com) → Jelentkezz be GitHub-bal
2. **New** → **Web Service**
3. Válaszd ki a repót
4. **Beállítások:**
   - Root Directory: `dart-detection-backend`
   - Runtime: `Docker` (auto-detect)
   - Plan: `Free`
5. **Create Web Service**
6. **Várj 5-10 percet** amíg deploy-ol
7. **Másold ki az URL-t**: `https://dart-detection-api-xxxx.onrender.com`

### 2. Állítsd be az API URL-t

**A projekt `.env` fájljában:**

```bash
VITE_DART_DETECTION_API_URL=https://dart-detection-api-xxxx.onrender.com
```

**Vagy ha publikálod az alkalmazást (Vercel/Netlify):**

Environment Variable:
- Name: `VITE_DART_DETECTION_API_URL`
- Value: `https://dart-detection-api-xxxx.onrender.com`

### 3. Build & Deploy Frontend

```bash
npm run build
```

Az alkalmazás most automatikusan használni fogja az API-t!

## Használat

### Kamera Detekció Bekapcsolása

Az alkalmazás **alapból NEM használ kamerát** - ez opcionális funkció!

**Ha be akarod kapcsolni:**

1. Játék közben válaszd a **"Kamera"** input módot
2. Engedélyezd a kamera hozzáférést
3. **Automatikus kalibráció:**
   - Kattints a "Kalibráció" gombra
   - Készíts egy képet a dart táblájáról
   - Az API automatikusan felismeri és kalibrálja
4. **Referencia kép:**
   - Készíts képet az üres tábláról
   - Ez javítja a detekciós pontosságot
5. **Dart dobás után:**
   - Készíts képet
   - Az API felismeri a dartot
   - Erősítsd meg vagy javítsd

### Normál Használat (Kamera nélkül)

**Az alkalmazás alapból a következő input módokat kínálja:**

- **Dartboard** - Vizuális dart tábla kattintással
- **Numberpad** - Számpad gyors bevitelhez
- **Voice** - Hangfelismerés (opcionális)
- **Text** - Szöveges bevitel

A **kamera detekció teljesen opcionális!**

## Free Tier Info (Render)

**Tudnivalók:**
- ✅ **Ingyenes** 750 óra/hónap
- ⏰ **15 perc után alvó mód** - első kérés lassú (~30 mp)
- 💾 **512 MB RAM**
- ⚡ **Shared CPU**

**Ha zavaro az alvó mód:**
- Upgrade Starter plan-re ($7/hó)
- Vagy használj uptime monitor-t (pl. UptimeRobot)

## Ellenőrzés

**API Health Check:**
```bash
curl https://dart-detection-api-xxxx.onrender.com/health
```

**Válasz:**
```json
{"status": "healthy", "calibrated": false}
```

## Hibaelhárítás

### "Connection failed"
- ✅ Ellenőrizd az API URL-t (.env fájl)
- ✅ Próbálj meg curl-el tesztelni
- ✅ Ha Free plan: várj 30 mp (alvó mód)

### "Calibration failed"
- ✅ Jobb megvilágítás
- ✅ Tábla teljesen látható legyen
- ✅ Kamera min. 720p

### "Detection inaccurate"
- ✅ Stabil kamera pozíció
- ✅ Jó fényviszonyok
- ✅ Referencia kép beállítása

## Teljes Dokumentáció

Részletes útmutató: [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

Backend dokumentáció: [dart-detection-backend/README.md](./dart-detection-backend/README.md)

# Deployment Guide - Dart Detection Backend

## Automatikus Dart Felismerés Beállítása

Az alkalmazás automatikus kamera alapú dart felismeréssel is működhet. Ez opcionális funkció!

### 1. Deploy Python Backend (Render.com)

#### A. Render Account & Repository

1. Regisztrálj/jelentkezz be a [Render.com](https://render.com)-ra
2. Kapcsold össze a GitHub repódat Render-rel

#### B. Backend Deployment

1. **Create New Web Service** a Render Dashboard-on
2. Válaszd ki a GitHub repódat
3. **Beállítások:**
   - **Name**: `dart-detection-api` (vagy bármilyen név)
   - **Region**: Frankfurt (EU) vagy legközelebbi
   - **Branch**: `main` (vagy dart-detection-backend/main)
   - **Root Directory**: `dart-detection-backend`
   - **Runtime**: `Docker`
   - **Plan**: `Free` (vagy magasabb teljesítményhez Starter/Pro)

4. **Advanced Settings:**
   - **Health Check Path**: `/health`
   - Nincs szükség environment variable-ekre

5. Kattints **Create Web Service**-re

6. Várj amíg a deployment befejeződik (5-10 perc)

7. **Mentsd el az API URL-t!** Valami ilyesmi lesz:
   ```
   https://dart-detection-api-xxxx.onrender.com
   ```

### 2. Frontend Konfiguráció

#### A. Helyi Fejlesztéshez (.env fájl)

Nyisd meg a `.env` fájlt és add hozzá az API URL-t:

```bash
VITE_DART_DETECTION_API_URL=https://dart-detection-api-xxxx.onrender.com
```

#### B. Production Deploy-hoz (Bolt.new / Vercel / Netlify)

Ha a frontendet publikálod, add hozzá ezt az environment variable-t:

**Environment Variable:**
- **Name**: `VITE_DART_DETECTION_API_URL`
- **Value**: `https://dart-detection-api-xxxx.onrender.com`

### 3. Verifikálás

#### Tesztelés Lokálisan:

```bash
npm run build
npm run preview
```

Menj a beállításokba és:
1. Engedélyezd a "Kamera Detekció" opciót
2. Az alkalmazás automatikusan csatlakozni fog az API-hoz
3. Kalibráld a kamerát egy dart tábla képével

#### API Health Check:

```bash
curl https://dart-detection-api-xxxx.onrender.com/health
```

Válasz:
```json
{
  "status": "healthy",
  "calibrated": false
}
```

### 4. Használat az Alkalmazásban

#### Bekapcsolás:

1. Menj a **Beállítások** menübe
2. Találd meg a **"Kamera Detekció"** kapcsolót
3. Kapcsold BE ha használni szeretnéd

#### Kalibráció:

1. A játékban válaszd a "Kamera" input módot
2. Indítsd el a kamerát
3. Kattints a "Kalibráció" gombra
4. Készíts egy képet a dart táblájáról
5. Az automatikus kalibráció lefut (multi-method)
6. Ellenőrizd hogy a középpont és sugár jó-e

#### Dart Detekció:

1. Készíts egy referencia képet (üres tábla)
2. Dobj egy dartot
3. Készíts képet
4. Az API automatikusan felismeri a dartot
5. Erősítsd meg vagy javítsd a detektálást

### 5. Free Tier Limitációk (Render.com)

**Free Plan korlátok:**
- **750 óra/hó** (elegendő 24/7 működéshez)
- **Alvó mód**: 15 perc inaktivitás után
  - Első kérés lassú lesz (~30 másodperc)
  - Utána gyors működés
- **RAM**: 512 MB
- **CPU**: Shared

**Megoldás az alvó módra:**
- Használj egy uptime monitoring szolgáltatást (pl. UptimeRobot)
- Pingeld az API-t 10 percenként
- Vagy válassz Paid plan-t ($7/hó) ami sosem alszik

### 6. Performance Tippek

**Optimális Render Plan:**
- **Free**: Hobbi használatra, teszteléshez
- **Starter ($7/mo)**: Személyes használatra, nincs alvó mód
- **Standard ($25/mo)**: Csapatos használatra, több RAM

**API Response Times:**
- Health check: ~50-100ms
- Kalibráció: ~2-5 másodperc
- Dart detekció: ~300-500ms

### 7. Hibaelhárítás

#### "Nem tudok csatlakozni az API-hoz"

1. Ellenőrizd hogy az API URL helyes-e (.env fájl)
2. Nézd meg hogy az API él-e: `curl API_URL/health`
3. Ellenőrizd a böngésző konzolt (F12)
4. Ha Free plan-on vagy, lehet hogy az API alszik - várj 30 mp-et

#### "Kalibráció sikertelen"

1. Győződj meg hogy a kép jó megvilágítású
2. A dart tábla legyen teljesen látható
3. Próbálj jobb fényt/kontrasztot
4. Nézd meg a backend logokat Render Dashboard-on

#### "Dart detekció pontatlan"

1. Javítsd a megvilágítást
2. Használj jobb kamerát (min 720p)
3. Rögzítsd a kamerát stabilan
4. Kalibráld újra a táblát
5. Állíts be reference képet (üres tábla)

### 8. Alternatíva: Helyi Backend (Offline)

Ha nincs Render vagy offline használatra:

```bash
cd dart-detection-backend
pip install -r requirements.txt
python main.py
```

API elérhető: `http://localhost:8000`

Állítsd be a `.env`-ben:
```bash
VITE_DART_DETECTION_API_URL=http://localhost:8000
```

## További Információk

- **Backend README**: `dart-detection-backend/README.md`
- **API Documentation**: `API_URL/docs` (FastAPI Swagger UI)
- **Render Docs**: https://render.com/docs

## Support

Ha bármi probléma van:
1. Nézd meg a Render logs-ot
2. Ellenőrizd a böngésző Network tab-ot (F12)
3. Teszteld az API-t közvetlenül `curl`-el vagy Postman-nel

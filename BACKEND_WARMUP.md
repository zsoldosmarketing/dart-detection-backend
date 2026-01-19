# BACKEND WARMUP - Render FREE Tier Probléma

## MI A PROBLÉMA?

A Render **FREE tier** 15 perc inaktivitás után **alvó módba kapcsol**:
- Első kérés **50+ másodperc** (cold start)
- Ez **túllépi** a timeout-okat
- Ezért úgy tűnik mintha **nem működne** a backend

## MEGOLDÁSOK

### 1. LOKÁLIS BACKEND (LEGJOBB)

```bash
# Terminál 1: Backend
cd dart-detection-backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

```bash
# Terminál 2: Frontend
npm run dev
```

**.env már beállítva:**
```
VITE_DART_DETECTION_API_URL=http://localhost:8000
```

**ELŐNYÖK:**
- ⚡ **AZONNALI** válasz (nincs cold start)
- ✅ **GARANTÁLT** működés
- 🔧 **KÖNNYEBB** debug
- 💯 **LEGFRISSEBB** kód

---

### 2. RENDER BACKEND HASZNÁLATA

Ha mégis a Render backend-et használod:

**.env módosítás:**
```
VITE_DART_DETECTION_API_URL=https://dart-detection-backend.onrender.com
```

**FONTOS:**
1. Első használat előtt **ÉBRESZD FEL** a backend-et:
   ```bash
   curl https://dart-detection-backend.onrender.com/health
   # Várj 60 másodpercet amíg válaszol!
   ```

2. A timeout-ok **növelve vannak**:
   - Health check: 90 sec
   - Auto-calibrate: 120 sec
   - Detect: 30 sec (volt 5 sec)

3. **15 percenként** használd, különben újra alszik!

**HÁTRÁNYOK:**
- ⏱️ Cold start: 50+ mp
- 💤 15 perc után alszik
- 🐌 Lassabb válaszidő
- ❌ Instabil kapcsolat

---

### 3. RENDER PAID TIER (7$/hó)

Ha upgrade-elsz:
- ✅ Nincs cold start
- ✅ Állandóan fut
- ✅ Gyorsabb válasz

---

## AJÁNLOTT WORKFLOW

### FEJLESZTÉS/TESZTELÉS:
```bash
./start-local-backend.sh
```

### PRODUCTION (később):
- Render Paid tier
- Vagy Fly.io / Railway
- Vagy saját szerver

---

## TROUBLESHOOTING

### "Nem csatlakozik a backend"

**1. Ellenőrizd hogy lokálisan fut-e:**
```bash
curl http://localhost:8000/health
# Válasz: {"status":"healthy","calibrated":false}
```

**2. Ha Render-t használsz:**
```bash
curl https://dart-detection-backend.onrender.com/health
# Várj 60 mp-et ha timeout!
```

**3. Ellenőrizd a .env-t:**
```bash
cat .env | grep DART_DETECTION
```

### "Rossz kalibráció, nem középen a tábla"

Ez **NEM a backend hibája**, hanem:
1. Rossz megvilágítás
2. Ferde kameraállás
3. Távol vagy a táblától

**MEGOLDÁS:**
- Jobb megvilágítás
- Egyenes kameraállás (szemből)
- Közelebb a táblához (tábla kitölti a képet 60%-ban)

---

## STÁTUSZ

✅ Backend kód **JAVÍTVA** (strict validation eltávolítva)
✅ Timeout-ok **NÖVELVE** (30 sec detection)
✅ Lokális futtatás **BEÁLLÍTVA**
⏳ Render deploy **PENDING** (push szükséges!)

---

**KÖVETKEZŐ LÉPÉS:**

```bash
./start-local-backend.sh
```

**ÉS AZONNAL MŰKÖDNI FOG!**

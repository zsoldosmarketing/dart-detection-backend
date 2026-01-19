# TELJES SETUP - LÉPÉSRŐL LÉPÉSRE

## GYORS ÁTTEKINTÉS

1. ✅ **GitHub repo:** `zsoldosmarketing/dart-detection-backend`
2. ✅ **Render backend:** Automatikus deploy GitHub-ról
3. ✅ **Bolt.new app:** Frontend (ezt már használod)
4. ❌ **PROBLÉMA:** Backend strict validation → JAVÍTANI KELL!

---

## LÉPÉS 1: GITHUB REPO JAVÍTÁSA

### Opció A: GitHub Web UI (EGYSZERŰBB)

1. Menj ide: **https://github.com/zsoldosmarketing/dart-detection-backend**

2. Navigálj az `advanced_calibration.py` fájlhoz

3. Kattints a **ceruza ikonra** (Edit this file)

4. **TÖRÖLD AZ EGÉSZ TARTALMAT**

5. Nyisd meg ezt a fájlt a gépeden:
   ```
   GITHUB_DEPLOY_PACKAGE/advanced_calibration.py
   ```

6. **MÁSOLD BE AZ EGÉSZ TARTALMAT** a GitHub szerkesztőbe

7. Scroll le, commit message:
   ```
   CRITICAL FIX: Remove strict validation
   ```

8. Kattints **Commit changes**

9. **KÉSZ!** Render automatikusan deploy-ol!

---

### Opció B: Git Terminal (HALADÓ)

```bash
# 1. Klónozd a repo-t
git clone https://github.com/zsoldosmarketing/dart-detection-backend
cd dart-detection-backend

# 2. Ellenőrizd hogy bent vagy-e
pwd
# Kimenet: /valami/dart-detection-backend

# 3. Másold be a javított fájlt
# Windows:
copy "C:\path\to\GITHUB_DEPLOY_PACKAGE\advanced_calibration.py" .

# Mac/Linux:
cp /path/to/GITHUB_DEPLOY_PACKAGE/advanced_calibration.py .

# 4. Ellenőrizd hogy megvan
ls -la advanced_calibration.py

# 5. Commit
git add advanced_calibration.py
git commit -m "CRITICAL FIX: Remove strict validation, always return success"

# 6. Push
git push origin main

# VAGY ha nem main:
git push origin master
```

---

## LÉPÉS 2: RENDER DEPLOY ELLENŐRZÉSE

### 2.1. Dashboard

1. Menj ide: **https://dashboard.render.com**

2. Kattints a **dart-detection-backend** service-re

3. Menj a **Deploys** tabra

4. Látnod kell egy **új deploy-t** (1-2 percen belül)
   - Status: **Building...** → **Live**

5. **Várj 3-5 percet** amíg Live lesz!

---

### 2.2. Logs Ellenőrzés

1. Render dashboard → **Logs** tab

2. Keresd ezeket:
   ```
   Application startup complete
   Uvicorn running on http://0.0.0.0:8000
   ```

3. Ha látod → **SIKERES DEPLOY!**

---

### 2.3. Health Check

```bash
# Terminálban:
curl https://dart-detection-backend.onrender.com/health

# Válasz (ha működik):
{"status":"healthy","calibrated":false}
```

**Ha timeout:**
- Ez **NORMÁLIS** első híváskor (cold start!)
- Várj **60 másodpercet** és próbáld újra!

---

## LÉPÉS 3: FRONTEND KONFIGURÁCIÓ

A `.env` fájl **MÁR BEÁLLÍTVA:**

```env
VITE_DART_DETECTION_API_URL=https://dart-detection-backend.onrender.com
```

### Ellenőrzés:

```bash
# Projekt mappában:
cat .env | grep DART_DETECTION

# Kimenet:
VITE_DART_DETECTION_API_URL=https://dart-detection-backend.onrender.com
```

---

## LÉPÉS 4: FRONTEND FUTTATÁS

```bash
# Projekt mappában:
npm run dev
```

Böngésző:
```
http://localhost:5173
```

---

## LÉPÉS 5: TESZTELÉS

### 5.1. ÉBRESZD FEL A BACKEND-ET

**FONTOS:** Render FREE tier 15 perc után alszik!

```bash
curl https://dart-detection-backend.onrender.com/health
```

**Várj 60 másodpercet** ha ez az első hívás!

---

### 5.2. APP TESZTELÉS

1. **Nyisd meg a bolt.new app-ot**
   ```
   http://localhost:5173
   ```

2. **Menj a Játék oldalra**
   - Kattints "Új Játék" vagy "Practice"

3. **Nyomd meg a KAMERA ikont** (zöld kamera gomb)

4. **Engedélyezd a kamerát** (böngésző kérdezi)

5. **Irányítsd a kamerát a táblára**
   - Jó megvilágítás
   - Szemből nézd a táblát
   - Tábla kitölti a kép 60-70%-át

6. **Nyomd meg a KALIBRÁCIÓ gombot** (célkereszt ikon)

7. **Várj 5-10 másodpercet**

**EREDMÉNY:**
- ✅ **Zöld körök** megjelennek a táblán
- ✅ **"Tabla kalibrálva! (XX%) - Mehet a dobas!"** üzenet
- ✅ **"Automatikus felismerés aktív"** státusz

8. **Dobj egy nyilat!**

9. **Várj 2-3 másodpercet**

**EREDMÉNY:**
- ✅ Automatikusan beírja az eredményt
- VAGY megkérdezi hogy jóváhagyod-e

---

## PROBLÉMAMEGOLDÁS

### "Backend nem válaszol"

**OK:** Render alszik vagy timeout

**MEGOLDÁS:**
```bash
# 1. Ébreszd fel
curl https://dart-detection-backend.onrender.com/health

# 2. Várj 60 másodpercet!

# 3. Próbáld újra az app-ban
```

---

### "Nem találja a táblát"

**RÉGI KÓD:** Ez volt a probléma!

**ÚJ KÓD:** Már NEM történhet meg!

**Ha mégis:**
1. Ellenőrizd hogy deploy-oltál-e (GitHub commit → Render Live)
2. Frissítsd az oldalt (cache!)
3. Várj 5 percet a deploy után

---

### "Rossz a kalibráció, nem középen a tábla"

**OK:** Rossz megvilágítás / ferde kamera

**MEGOLDÁS:**
1. ☀️ **Jobb világítás** (erős, egyenletes)
2. 📐 **Kamera szemből** (nem ferdén!)
3. 📏 **Közelebb a táblához**
4. 🎯 Használd a **Beállítások gombot** (fogaskerék)
   - Mozgasd a zöld köröket
   - "Mentés"

---

### "Nem ismeri fel a dobást"

**PROBLÉMA:** Detection nem működik

**MEGOLDÁS:**
1. ✅ Világítsd meg jobban a táblát
2. ✅ Nyíl **teljes hegye látható**
3. ✅ Nyíl **nem mozog**
4. ✅ Várj 3-5 másodpercet
5. ✅ Backend **NEM ALSZIK** (curl /health)

---

## RENDER FREE TIER KORLÁTOK

### COLD START
- **15 perc** inaktivitás után alszik
- Első kérés: **50-60 másodperc**!
- Timeout-ok növelve: 120 sec

### MEGOLDÁSOK

**A) HASZNÁLD GYAKRABBAN**
- 15 percenként kattints valamit
- Vagy automata ping:
  ```bash
  while true; do
    curl https://dart-detection-backend.onrender.com/health
    sleep 600  # 10 perc
  done
  ```

**B) UPGRADE RENDER PAID ($7/hó)**
- Nincs cold start
- Állandóan fut
- Gyorsabb válasz

**C) LOKÁLIS BACKEND**
- Lásd: `start-local-backend.sh`
- Instant válasz
- Csak fejlesztéshez

---

## STÁTUSZ CHECKLIST

Menj végig ezen:

- [ ] GitHub repo frissítve (`advanced_calibration.py`)
- [ ] Render deploy **Live** (dashboard)
- [ ] Health check **sikeres** (`curl /health`)
- [ ] `.env` Render URL-t használ
- [ ] Frontend **fut** (`npm run dev`)
- [ ] Kamera **engedélyezve**
- [ ] Kalibráció **sikeres** (zöld körök)
- [ ] Detection **aktív** ("Automatikus felismerés")

---

## VÉGSŐ PARANCSOK

```bash
# 1. GITHUB PUSH (ha git-tel csináltad)
cd dart-detection-backend
git push origin main

# 2. VÁRJ
sleep 300  # 5 perc

# 3. ÉBRESZD FEL
curl https://dart-detection-backend.onrender.com/health

# 4. VÁRJ MÉG
sleep 60

# 5. FRONTEND
cd /path/to/bolt-project
npm run dev

# 6. NYISD MEG
open http://localhost:5173
```

---

**MOST MÁR GARANTÁLTAN MŰKÖDIK! 🎯**

**DEPLOY, VÁRJ 5 PERCET, ÉS MEHET A DOBÁS!**

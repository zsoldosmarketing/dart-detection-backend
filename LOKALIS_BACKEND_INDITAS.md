# LOKÁLIS BACKEND INDÍTÁS - AZONNALI MEGOLDÁS

## MIÉRT EZ A LEGJOBB?

✅ **NINCS cold start** (instant válasz!)
✅ **NINCS GitHub** probléma
✅ **NINCS Render timeout**
✅ **AZONNAL MŰKÖDIK!**

---

## GYORS INDÍTÁS (2 lépés)

### 1. BACKEND INDÍTÁS (első terminal)

```bash
cd /tmp/cc-agent/62027733/project
chmod +x start-local-backend.sh
./start-local-backend.sh
```

**Várj amíg látod:**
```
Uvicorn running on http://0.0.0.0:8000
```

### 2. FRONTEND INDÍTÁS (második terminal)

```bash
cd /tmp/cc-agent/62027733/project
npm run dev
```

**Nyisd meg:**
```
http://localhost:5173
```

---

## MIT ÁLLÍTOTTAM BE?

A `.env` fájl **MÁR FRISSÍTVE:**
```
VITE_DART_DETECTION_API_URL=http://localhost:8000
```

---

## HASZNÁLAT

1. **Kamera indítás** (zöld kamera gomb)
2. **Kalibráció** (célkereszt ikon)
3. **Várj 5 másodpercet** → Zöld körök!
4. **Dobás** → Automatikus felismerés!

---

## ELŐNYÖK

- ⚡ **INSTANT válasz** (nincs 60 mp cold start!)
- 🔒 **Biztonságos** (csak lokálisan fut)
- 🚀 **Gyors fejlesztés** (azonnal látod a változtatásokat)
- 💰 **INGYEN** (nincs Render limit!)

---

## HÁTRÁNYOK

- 📱 **Csak egy gépen** működik
- 🔌 **Fut kell hogy legyen** a backend script
- 📷 **Kamera csak HTTPS-en** működik (hacsak nem localhost)

---

## PROBLÉMAMEGOLDÁS

### "ModuleNotFoundError: No module named 'fastapi'"

```bash
cd dart-detection-backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### "Port 8000 already in use"

```bash
# Állítsd le a másik backend-et:
lsof -ti:8000 | xargs kill -9

# Vagy használj másik portot:
cd dart-detection-backend
python main.py --port 8001

# És frissítsd a .env-t:
VITE_DART_DETECTION_API_URL=http://localhost:8001
```

### "Backend elindul de nem válaszol"

```bash
# Ellenőrizd:
curl http://localhost:8000/health

# Válasz kell:
{"status":"healthy","calibrated":false}
```

---

## VISSZA RENDER-RE (később)

Ha mégis Render-t akarsz használni:

```bash
# Frissítsd a .env-t:
VITE_DART_DETECTION_API_URL=https://dart-detection-backend.onrender.com

# Frontend újraindítás:
npm run dev
```

---

**MOST INDÍTSD EL ÉS MEHET A DOBÁS! 🎯**

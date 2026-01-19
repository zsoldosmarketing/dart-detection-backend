# LOKÁLIS BACKEND - EGYSZERŰ INDÍTÁS

## PROBLÉMA
- Render backend nem éled fel (cold start timeout)
- GitHub repo hozzáférés nincs

## MEGOLDÁS - LOKÁLIS BACKEND

✅ **INSTANT válasz** (nincs 60 mp várás!)
✅ **AZONNAL MŰKÖDIK!**

---

## INDÍTÁS (2 terminál)

### Terminal 1: BACKEND

```bash
cd dart-detection-backend
pip3 install --user -r requirements.txt
python3 main.py
```

**Várj amíg látod:**
```
Uvicorn running on http://0.0.0.0:8000
```

---

### Terminal 2: FRONTEND

```bash
npm run dev
```

**Nyisd meg:**
```
http://localhost:5173
```

---

## BEÁLLÍTÁS

A `.env` **MÁR FRISSÍTVE:**
```
VITE_DART_DETECTION_API_URL=http://localhost:8000
```

---

## TESZT

1. Kamera indítás
2. Kalibráció
3. Várj 5 másodpercet
4. ✅ **Zöld körök!**
5. Dobás → Automatikus felismerés!

---

**ENNYI! INSTANT MŰKÖDÉS! 🚀**

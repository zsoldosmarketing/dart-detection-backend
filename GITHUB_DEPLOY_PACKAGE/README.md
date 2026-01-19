# Dart Detection Backend - TELJES PACKAGE

## TARTALOM

Ez a mappa tartalmazza a **TELJES backend-et** ami kell a GitHub repo-ba:

```
✅ main.py                    - FastAPI backend (25KB)
✅ advanced_calibration.py    - Tábla felismerés
✅ advanced_detection.py      - Nyíl felismerés
✅ image_preprocessing.py     - Kép előkészítés
✅ requirements.txt           - Python dependencies
✅ Dockerfile                 - Docker build
✅ render.yaml                - Render config
```

---

## GYORS DEPLOY

### GitHub Web UI (3 PERC):

1. Menj ide: https://github.com/zsoldosmarketing/dart-detection-backend

2. Kattints **"Add file" → "Upload files"**

3. **Húzd be ezt a 7 fájlt:**
   - main.py
   - advanced_calibration.py
   - advanced_detection.py
   - image_preprocessing.py
   - requirements.txt
   - Dockerfile
   - render.yaml

4. Commit message:
   ```
   Complete backend with all dependencies
   ```

5. **Commit changes**

6. **VÁRJ 5 PERCET** → Render automatikusan deploy-ol!

---

## ELLENŐRZÉS

```bash
# Várj 5 percet, aztán:
curl https://dart-detection-backend.onrender.com/health

# Válasz:
{"status":"healthy","calibrated":false}
```

---

## RENDER DASHBOARD

**Ellenőrizd itt:**
- https://dashboard.render.com
- Service: dart-detection-backend
- Logs: "Uvicorn running on http://0.0.0.0:8000" ✅

---

**RÉSZLETEK:** Olvasd el `DEPLOY_AZONNAL.md`

# Backend Deploy Útmutató

## Render Deploy (5 perc)

### 1. Deploy Button

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

**VAGY**

### 2. Manuális Deploy

1. **Menj a Render Dashboard-ra:** https://dashboard.render.com

2. **Kattints: New + → Blueprint**

3. **GitHub repo csatlakoztatása:**
   - Connect GitHub repository
   - Válaszd ki ezt a repo-t
   - Kattints: Connect

4. **Blueprint Detection:**
   - Render automatikusan megtalálja a `render.yaml` fájlt
   - Root Directory: `dart-detection-backend`
   - Service Name: `dart-detection-api`

5. **Apply Blueprint** → Várj 3-5 percet

6. **URL megszerzése:**
   - Deploy után látod az URL-t (pl: `https://dart-detection-api-abc123.onrender.com`)
   - Másold ki!

### 3. Frontend Konfiguráció

A deploy után írd be az URL-t (nekem vagy a frontendbe):

```bash
# .env fájlban:
VITE_DART_DETECTION_API_URL=https://dart-detection-api-ABC123.onrender.com
```

### 4. Ellenőrzés

```bash
curl https://dart-detection-api-ABC123.onrender.com/health
```

Válasz:
```json
{"status":"healthy","calibrated":false}
```

---

## GYORS Deploy - EGY KATTINTÁS

Ha a repo publikus GitHub-on:

1. Menj ide: https://dashboard.render.com/select-repo

2. Válaszd ki a repo-t → Connect

3. Beállítások:
   - **Root Directory:** `dart-detection-backend`
   - **Build Command:** (üresen hagyva, Docker használ)
   - **Start Command:** (üresen hagyva, Docker használ)

4. **Create Web Service**

5. **Várj 3-5 percet**

6. **Másold ki az URL-t és add meg nekem!**

---

## Render Free Tier

- Cold start: 60+ másodperc
- Auto-sleep 15 perc után
- Első kérés ébreszti fel
- **Ingyenes!**

Ha nem megy a deploy, add meg a GitHub repo URL-t és segítek!

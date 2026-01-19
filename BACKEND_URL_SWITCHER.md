# 🔄 Backend URL Switcher - Admin Feature

## ⚡ GYORS HASZNÁLAT

### Admin Panel:

1. **Jelentkezz be admin user-ként**

2. **Menj a CRM → Config oldalra:**
   ```
   /crm/config
   ```

3. **Látni fogsz egy sárga card-ot a tetején:**
   ```
   Backend URL Override (Admin)
   ```

4. **Válassz backend-et:**
   - **Production (.env)** → Render backend (vagy .env-ben megadott)
   - **Local (localhost:8000)** → Helyi backend
   - **Custom** → Saját URL megadása

---

## 🎯 MŰKÖDÉS

### Prioritási sorrend:

1. **localStorage override** (ha be van állítva)
2. **.env fájl** (`VITE_DART_DETECTION_API_URL`)
3. **Default** (`http://localhost:8000`)

### LocalStorage kulcs:

```javascript
localStorage.getItem('dart_backend_url_override')
```

---

## 🔧 HASZNÁLATI ESETEK

### 1. LOKÁLIS FEJLESZTÉS

**Probléma:** Render backend hideg indítása lassú (30 sec)

**Megoldás:**
1. Indítsd el a lokális backend-et: `./RUN_BACKEND.sh`
2. Admin Panel → **"Local (localhost:8000)"** gomb
3. ✅ Azonnali dart detection!

### 2. PRODUCTION TESZTELÉS

**Probléma:** El akarod érni a Render backend-et

**Megoldás:**
1. Admin Panel → **"Production (.env)"** gomb
2. ✅ .env-ben beállított Render URL-t használja

### 3. CUSTOM BACKEND (STAGING)

**Probléma:** Van egy staging backend is

**Megoldás:**
1. Admin Panel → Custom URL mező: `https://staging-backend.com`
2. Kattints **"Set Custom"**
3. ✅ Staging backend-et használja

---

## 📊 VISUAL FEEDBACK

### Aktív backend megjelenítés:

```
🌐 Aktív backend: http://localhost:8000
[OVERRIDE AKTÍV] badge
```

### Gombok állapota:

- **Primary (kék)** = Aktív backend
- **Outline (szürke)** = Inaktív opció
- **✓ Check icon** = Sikeres váltás (2 mp-ig)

---

## 🚨 FONTOS MEGJEGYZÉSEK

### ⚠️ Browser-specifikus:

- Az override **localStorage-ban** tárolódik
- **Csak az adott böngészőben** érvényes
- Más user NEM látja az override-ot
- Más böngésző NEM látja az override-ot

### ⚠️ Real-time váltás:

- **NINCS szükség page refresh-re**
- A következő API hívás már az új backend-et használja
- A `getApiUrl()` mindig az aktuális override-ot ellenőrzi

### ⚠️ Production deployment:

- A .env-ben lévő URL a **default production** backend
- Ha local-ra váltasz fejlesztéskor, **ne felejtsd el visszaváltani** production-re!

---

## 🛠️ TECHNIKAI RÉSZLETEK

### Érintett fájlok:

1. **`src/stores/configStore.ts`**
   ```typescript
   getBackendUrl() // Visszaadja az aktuális backend URL-t
   setBackendUrlOverride(url) // Beállít egy override-ot
   getBackendUrlOverride() // Lekéri az override-ot
   ```

2. **`src/lib/dartDetectionApi.ts`**
   ```typescript
   getApiUrl() // Használja a configStore-ból az URL-t
   ```

3. **`src/pages/crm/CRMConfigPage.tsx`**
   - UI a backend váltáshoz
   - Admin panel card

### API használat:

```typescript
import { getApiUrl } from './lib/dartDetectionApi';

// Mindig az aktuális backend URL-t kapod
const apiUrl = getApiUrl();

// Ez lehet:
// - http://localhost:8000 (local override)
// - https://render-backend.com (production .env)
// - https://custom.com (custom override)
```

---

## 🧪 TESZTELÉS

### 1. Local backend tesztelése:

```bash
# Terminal 1: Backend indítása
cd dart-detection-backend
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Frontend
npm run dev
```

**Admin Panel:**
1. Válts "Local (localhost:8000)" backend-re
2. Készíts egy kalibrációs képet
3. Network tab (F12) → Ellenőrizd hogy `http://localhost:8000/auto-calibrate` hívódik

### 2. Production backend tesztelése:

**Admin Panel:**
1. Válts "Production (.env)" backend-re
2. Készíts egy kalibrációs képet
3. Network tab → Ellenőrizd hogy a Render URL hívódik

---

## 💡 PRO TIPS

### Quick switch a konzolból:

```javascript
// Local backend
localStorage.setItem('dart_backend_url_override', 'http://localhost:8000');

// Custom backend
localStorage.setItem('dart_backend_url_override', 'https://staging.com');

// Vissza production-re
localStorage.removeItem('dart_backend_url_override');

// Ellenőrzés
console.log(getApiUrl());
```

### Debug:

```javascript
// Aktuális backend
import { getApiUrl } from './lib/dartDetectionApi';
console.log('Current backend:', getApiUrl());

// Override status
console.log('Override:', localStorage.getItem('dart_backend_url_override'));

// Default .env backend
console.log('Default:', import.meta.env.VITE_DART_DETECTION_API_URL);
```

---

## 🎉 PÉLDA WORKFLOW

**Reggeli munka lokálisan:**

1. 🌅 Indítsd a local backend-et: `./RUN_BACKEND.sh`
2. 🔧 Admin Panel → "Local (localhost:8000)"
3. 💻 Fejlessz nyugodtan, gyors feedback!
4. ✅ Commitolás előtt: "Production (.env)" gomb
5. 🚀 Build & Deploy

**Este production tesztelés:**

1. 🌙 Admin Panel → "Production (.env)"
2. 🧪 Teszteld a Render backend-et
3. 📊 Ellenőrizd a cold start időt
4. 🔄 Ha szar → Váltás local-ra, debug

---

## ❓ FAQ

**Q: Mi történik ha lokálisan nincs backend futva?**
A: Az API hívások timeout-olnak (10-30 sec), majd fallback logika működik

**Q: Production-re deployolás előtt mit csináljak?**
A: Váltsd vissza "Production (.env)" backend-re!

**Q: Más user is látja az override-om?**
A: NEM! Csak a te böngésződben érvényes

**Q: Törölhetek override-ot?**
A: Igen, kattints "Production (.env)" gombra

**Q: Működik mobilon is?**
A: Igen, ugyanúgy localStorage-ban tárolódik

---

**🎯 Enjoy instant dart detection fejlesztés közben!**

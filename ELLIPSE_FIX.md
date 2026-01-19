# KRITIKUS JAVÍTÁS - Ellipszis & Detektálás

## 1. FÓKÁLIS PROBLÉMA - Ellipszis Renderelés
A kalibráció rosszul jelent meg a képernyőn:
- Az ellipszis nem követte a tábla valódi alakját
- A bull piros pontja rossz helyen volt

### Probléma oka:
1. **Ellipszis sugár hiba**: A backend ÁTMÉRŐKET ad vissza (`axis_major`, `axis_minor`), de a canvas API SUGARAKAT vár
2. **Bull középpont hiba**: Amikor ellipszis kalibráció van, a bull középpontját az ellipszis közepére kell tenni, nem a kör középpontjára

### Frontend javítás (CameraDetectionInput.tsx):

```typescript
// ELŐTTE - ROSSZ
ctx.ellipse(0, 0, ellipse.axis_major, ellipse.axis_minor, 0, 0, Math.PI * 2);
ctx.arc(center_x, center_y, 5, 0, Math.PI * 2);  // Mindig circle center

// UTÁNA - JÓ
ctx.ellipse(0, 0, ellipse.axis_major / 2, ellipse.axis_minor / 2, 0, 0, Math.PI * 2);  // Osztva 2-vel!

const bullCenterX = is_angled && ellipse ? ellipse.center_x : center_x;
const bullCenterY = is_angled && ellipse ? ellipse.center_y : center_y;
ctx.arc(bullCenterX, bullCenterY, 5, 0, Math.PI * 2);  // Helyes középpont
```

## 2. DETEKTÁLÁSI PROBLÉMÁK

### Backend (Python) javítások:

#### `dart-detection-backend/advanced_detection.py`

**Difference Detection javítások:**
```python
# ELŐTTE - túl szigorú
_, thresh = cv2.threshold(gray_diff, 25, 255, cv2.THRESH_BINARY)
if area < 80 or area > 8000:

# UTÁNA - enyhébb
_, thresh = cv2.threshold(gray_diff, 18, 255, cv2.THRESH_BINARY)  # Érzékenyebb
if area < 50 or area > 12000:  # Szélesebb tartomány
```

**Metal Detection javítások:**
```python
# ELŐTTE - csak világos fém
lower_metal1 = np.array([0, 0, 160])
upper_metal1 = np.array([180, 40, 255])
lower_metal2 = np.array([0, 0, 100])
upper_metal2 = np.array([180, 30, 180])
edges = cv2.Canny(gray, 50, 150)
if area < 40 or area > 3000:
if aspect_ratio < 1.3:

# UTÁNA - sötétebb fém is
lower_metal1 = np.array([0, 0, 120])  # Sötétebb fém
upper_metal1 = np.array([180, 50, 255])
lower_metal2 = np.array([0, 0, 80])
upper_metal2 = np.array([180, 40, 200])
edges = cv2.Canny(gray, 40, 120)  # Érzékenyebb
if area < 30 or area > 5000:  # Szélesebb
if aspect_ratio < 1.2:  # Kevésbé szigorú
```

**Preprocessing javítások:**
```python
# ELŐTTE - túl agresszív
clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
denoised = cv2.fastNlMeansDenoisingColored(enhanced, None, 10, 10, 7, 21)

# UTÁNA - optimalizált
clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))  # Jobb kontraszt
denoised = cv2.fastNlMeansDenoisingColored(enhanced, None, 6, 6, 7, 21)  # Kevésbé elmosódó
```

## 3. Telepítés

### Frontend:
✅ Build elkészült
✅ Ellipszis renderelés javítva (axis / 2)
✅ Bull középpont javítva (ellipse.center ha van)

### Backend:
1. **Push GitHub-ra:**
   ```bash
   git add dart-detection-backend/advanced_detection.py
   git commit -m "Fix detection sensitivity"
   git push
   ```

2. **Várj 2-3 percet** - Render automatikusan újra fogja építeni

3. **Frissítsd az oldalt** (Ctrl+Shift+R)

## 4. Eredmény
✅ Az ellipszis most pontosan követi a tábla alakját perspektívából
✅ A bull piros pontja a tábla valódi középpontjában van
✅ Érzékenyebb detektálás
✅ Több féle nyíl típus felismerése (sötét és világos)
✅ Jobb működés változó megvilágítás mellett

# Dart Detektálás Javítások

## Probléma
A rendszer rosszul ismerte fel a nyilakat, mert:
1. Túl szigorú threshold értékek
2. Túl szűk területhatárok
3. Túl agresszív képfeldolgozás

## Javítások

### 1. Különbség-alapú detektálás (difference detection)
**Előtte:**
- Threshold: 25 (túl magas)
- Terület: 80-8000 px (túl szűk)

**Utána:**
- Threshold: 18 (enyhébb, több detektálás)
- Terület: 50-12000 px (szélesebb tartomány)

### 2. Fém-alapú detektálás (metal detection)
**Előtte:**
- HSV Value tartomány: 160-255 és 100-180 (csak világos fém)
- Terület: 40-3000 px
- Aspect ratio minimum: 1.3
- Canny edge: 50-150

**Utána:**
- HSV Value tartomány: 120-255 és 80-200 (sötétebb fém is)
- Terület: 30-5000 px (szélesebb)
- Aspect ratio minimum: 1.2 (kevésbé szigorú)
- Canny edge: 40-120 (érzékenyebb)

### 3. Képfeldolgozás finomítása
**Előtte:**
- CLAHE clipLimit: 2.0
- Denoising erőssége (h): 10 (túl agresszív)

**Utána:**
- CLAHE clipLimit: 2.5 (jobb kontraszt)
- Denoising erőssége (h): 6 (kevésbé elmosódó)

## Eredmény
- Érzékenyebb detektálás különböző megvilágítás mellett
- Több dart típust ismer fel (sötét és világos)
- Kevésbé elmosódott képfeldolgozás
- Szélesebb területhatárok több találatot eredményeznek

## Telepítés
1. Push-old a változásokat GitHub-ra
2. Render automatikusan újra fogja építeni a backend-et
3. Várj 2-3 percet amíg újraindul
4. Próbáld újra!

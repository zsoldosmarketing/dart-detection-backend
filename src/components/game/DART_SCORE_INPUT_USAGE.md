# DartScoreInput - Univerzális Dart Pontszám Bemenet Komponens

## Áttekintés

A `DartScoreInput` az **EGY és EGYETLEN** központi komponens, amit **MINDENHOL** használunk dart pontszámok beküldésére az alkalmazásban. Ez tartalmazza:

- ✅ 3 dart dobás kijelzőt
- ✅ Pontszám számlálót (Nyíl X/3 | Y pont)
- ✅ Vezérlő gombokat (vissza, beküldés, súgó)
- ✅ Input mód váltókat (dartboard/numberpad)
- ✅ Hangfelismerést (voice input)
- ✅ Hangbeállításokat
- ✅ Javaslatok megjelenítését (opcio integrálás számára)

## Használati helyek

Ez a komponens **KÖTELEZŐ** a következő helyeken:

1. **Online játékoknál** (PVP, direct challenge, arena)
2. **Edzéseknél** (training sessions)
3. **Party játékoknál** (Cricket, Killer, Halve-It, stb.)
4. **Bot elleni játékoknál**
5. **Helyi játékoknál**

## Használat minden eszközön

- ✅ **Mobil** (telefon)
- ✅ **Tablet**
- ✅ **Asztali számítógép**

Reszponzív design, automatikusan alkalmazkodik a képernyő méretéhez.

## Props

### Kötelező props

```typescript
interface DartScoreInputProps {
  // Dobás eseménykezelő - amikor a felhasználó egy dartot dob
  onThrow: (target: DartTarget) => void;

  // Vissza eseménykezelő - visszavonás funkció
  onUndo: () => void;

  // Beküldés eseménykezelő - amikor a felhasználó beküld egy fordulót
  onSubmit: () => void;

  // Már dobott dartok ebben a fordulóban
  currentDarts: DartThrow[];

  // Várakozó dartok (hangfelismerésből)
  queuedDarts: DartTarget[];

  // Már dobott dartok pontszáma
  thrownScore: number;

  // Várakozó dartok pontszáma
  queuedScore: number;

  // Folyamatban van-e a feldolgozás
  isProcessing: boolean;

  // Be lehet-e küldeni a fordulót
  canSubmit: boolean;
}
```

### Opcionális props

```typescript
interface DartScoreInputProps {
  // Javaslatok megjelenítése
  showSuggestions?: boolean;
  onToggleSuggestions?: () => void;
  suggestions?: Suggestion[];

  // Letiltás
  disabled?: boolean;

  // Hangfelismerés automatikus indítása
  autoStart?: boolean;
}
```

## Használati példák

### 1. Online játékoknál (GamePlayPage)

```tsx
import { DartScoreInput } from '../components/game/DartScoreInput';

// Állapot kezelés
const [currentTurnDarts, setCurrentTurnDarts] = useState<DartThrow[]>([]);
const [dartQueue, setDartQueue] = useState<DartTarget[]>([]);

const thrownScore = currentTurnDarts.reduce((s, d) => s + d.score, 0);
const queuedScore = dartQueue.reduce((s, t) => s + getScore(t), 0);

const handleThrow = (target: DartTarget) => {
  setDartQueue([...dartQueue, target]);
};

const handleUndo = () => {
  if (dartQueue.length > 0) {
    setDartQueue(dartQueue.slice(0, -1));
  } else if (currentTurnDarts.length > 0) {
    setCurrentTurnDarts(currentTurnDarts.slice(0, -1));
  }
};

const handleSubmit = async () => {
  // Forduló beküldése
  await submitTurn();
};

return (
  <DartScoreInput
    onThrow={handleThrow}
    onUndo={handleUndo}
    onSubmit={handleSubmit}
    currentDarts={currentTurnDarts}
    queuedDarts={dartQueue}
    thrownScore={thrownScore}
    queuedScore={queuedScore}
    isProcessing={isProcessing}
    canSubmit={canSubmit}
    showSuggestions={showSuggestions}
    onToggleSuggestions={() => setShowSuggestions(!showSuggestions)}
    suggestions={checkoutRoutes}
    autoStart={isMyTurn}
  />
);
```

### 2. Edzéseknél (TrainingSessionPage)

```tsx
import { DartScoreInput } from '../components/game/DartScoreInput';

// Ugyanaz a használat, mint az online játékoknál
// Javaslatok opciósan elhagyhatók, ha nincs szükség rájuk

return (
  <DartScoreInput
    onThrow={handleThrow}
    onUndo={handleUndo}
    onSubmit={handleSubmit}
    currentDarts={currentTurnDarts}
    queuedDarts={dartQueue}
    thrownScore={thrownScore}
    queuedScore={queuedScore}
    isProcessing={isProcessing}
    canSubmit={canSubmit}
    autoStart={true}
  />
);
```

### 3. Party játékoknál (Cricket, Killer, stb.)

```tsx
import { DartScoreInput } from '../components/game/DartScoreInput';

// Cricket, Killer, Halve-It, Shanghai, Knockout játékokhoz
// Ugyanaz a használat

return (
  <DartScoreInput
    onThrow={handleThrow}
    onUndo={handleUndo}
    onSubmit={handleSubmit}
    currentDarts={currentTurnDarts}
    queuedDarts={dartQueue}
    thrownScore={thrownScore}
    queuedScore={queuedScore}
    isProcessing={isProcessing}
    canSubmit={canSubmit}
    autoStart={true}
  />
);
```

## Fontos megjegyzések

### 🚨 NE HOZZ LÉTRE SAJÁT VÁLTOZATOKAT!

- ❌ **NE** készíts új számláló komponenseket
- ❌ **NE** másolj ki részeket és módosíts
- ❌ **NE** készíts "egyedi" verziókat különböző helyekre
- ✅ **MINDIG** ezt az EGY komponenst használd

### Miért ez az EGY komponens?

1. **Egységes felhasználói élmény**: Minden helyen ugyanúgy működik
2. **Könnyebb karbantartás**: Egy helyen kell javítani, ha valami nem jó
3. **Konzisztens funkciók**: Hangfelismerés, beállítások mindig ugyanúgy működnek
4. **Kevesebb kód**: Nem kell többször implementálni ugyanazt

### Ha új funkciót akarsz hozzáadni

1. **NE** hozz létre új komponenst
2. **Adj hozzá** új opcionális prop-ot ehhez a komponenshez
3. **Tesztelj** minden használati helyen
4. **Frissítsd** ezt a dokumentációt

## Hangfelismerés

A komponens automatikusan kezeli a hangfelismerést:

- Automatikus indítás (ha `autoStart={true}`)
- Felismerési módok (gyors, kiegyensúlyozott, pontos)
- Zajszűrő beállítások
- Hang be/ki kapcsolás

Parancsok:
- "Húsz" vagy "Egyszerű húsz" → S20
- "Dupla húsz" → D20
- "Tripla húsz" → T20
- "Huszonöt" → Outer Bull
- "Bika" vagy "Bull" → Inner Bull
- "Mellé" vagy "Miss" → Miss
- "Vissza" → Visszavonás
- "Kész" vagy "Beküld" → Beküldés

## Támogatás

Ha kérdésed van a használattal kapcsolatban, vagy hibát találsz:

1. Először nézd meg ezt a dokumentációt
2. Nézd meg a kód példákat fent
3. Ha továbbra is problémád van, jelezd a fejlesztőknek

---

**Készítve:** 2026-01-17
**Utolsó frissítés:** 2026-01-17
**Verzió:** 1.0.0

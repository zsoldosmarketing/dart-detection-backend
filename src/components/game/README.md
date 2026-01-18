# Dart Játék Komponensek

## DartScoreInput - KÖZPONTI KOMPONENS ⚠️

**Ez az EGY és EGYETLEN számláló komponens az egész alkalmazásban!**

### Használat

```tsx
import { DartScoreInput } from './DartScoreInput';

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
/>
```

**Részletes dokumentáció:** [DART_SCORE_INPUT_USAGE.md](./DART_SCORE_INPUT_USAGE.md)

### 🚨 KRITIKUS SZABÁLY

- ✅ **MINDIG** a `DartScoreInput` komponenst használd
- ❌ **SOHA** ne hozz létre saját változatokat
- ❌ **SOHA** ne másolj ki és módosíts

Ez a komponens használható:
- Online játékokban
- Edzésekben
- Party játékokban
- Bot ellen
- Minden eszközön (mobil, tablet, desktop)

---

## Egyéb komponensek

### DartboardInput

Dartboard input (célkerék alapú pontbeküldés). **NE használd közvetlenül**, a `DartScoreInput` automatikusan használja.

### NumberPadInput

Szám billentyűzet input. **NE használd közvetlenül**, a `DartScoreInput` automatikusan használja.

### VoiceInput

Hangvezérlés komponens. **NE használd közvetlenül**, a `DartScoreInput` automatikusan használja.

---

## További komponensek

- `FriendInviteModal`: Barátok meghívása
- `GameInviteCard`: Játék meghívó kártya
- `OnlineGameControls`: Online játék vezérlők
- `TextInputWithVoice`: Szöveg input hanggal

---

**Fontos:** Ha új dart pontszám input komponenst szeretnél, **NE hozz létre újat**! Használd a `DartScoreInput` komponenst, és ha szükséges, bővítsd azt új prop-okkal.

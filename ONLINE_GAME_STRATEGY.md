# Online/PVP Játék Disconnection & Reconnection Stratégia

## Jelenlegi Állapot

### Már Implementált:
- ✅ `game_rooms.status`: 'waiting', 'in_progress', 'completed', 'abandoned'
- ✅ `game_players.is_connected`: boolean
- ✅ `game_players.last_ping_at`: timestamptz
- ✅ Meghívók lejárati ideje (10-30 perc)

### Hiányzó Funkciók:
- ❌ Disconnect automatikus detektálás
- ❌ Reconnect időablak kezelés
- ❌ Pause/Resume közös megegyezéssel
- ❌ Automatikus győzelem szabályok
- ❌ Statisztika kezelés megszakított játékokhoz

---

## Javasolt Megoldás

### 1. Disconnect Detektálás (Heartbeat System)

**Működés:**
- Minden játékos 15 másodpercenként küld "ping"-et
- Ha 45 másodpercig nincs ping → `is_connected = false`
- Játék automatikusan "paused" állapotba kerül

**Mezők:**
```sql
game_players:
  - is_connected: boolean (van)
  - last_ping_at: timestamptz (van)
  - disconnect_count: integer (új)
  - total_disconnect_time: interval (új)

game_rooms:
  - paused_at: timestamptz (új)
  - pause_reason: text (új) -- 'disconnect', 'mutual', 'timeout'
  - resume_deadline: timestamptz (új)
```

### 2. Reconnection Időablak

**Szabályok:**
- **Rövid disconnect (<2 perc)**: Automatikus visszacsatlakozás, nincs büntetés
- **Közép disconnect (2-5 perc)**: Visszacsatlakozás lehetséges, figyelmeztetés
- **Hosszú disconnect (>5 perc)**: Ellenfél dönthet:
  - Vár tovább (max 10 perc)
  - Nyerőnek nyilvánítja magát
  - Döntetlen-ként lezárja (ha mindketten egyetértenek)

**Státuszok:**
```
game_rooms.status:
  - waiting
  - in_progress
  - paused_disconnect (új)
  - paused_mutual (új)
  - completed
  - abandoned
  - forfeited (új) - ellenfél feladta/disconnect miatt
```

### 3. Pause/Resume Közös Megegyezéssel

**Funkció:**
- Bármelyik játékos kérhet szünetet
- Másik játékosnak el kell fogadnia (30 sec timeout)
- Max szünet idő: 10 perc
- Max szünetek száma meccsenként: 2/játékos

**Táblák:**
```sql
game_pause_requests:
  - id: uuid
  - room_id: uuid
  - requester_id: uuid
  - status: text ('pending', 'accepted', 'declined', 'expired')
  - pause_duration_minutes: integer
  - created_at: timestamptz
  - expires_at: timestamptz
```

### 4. Automatikus Győzelem & Feladás

**Szabályok:**

1. **Automatikus győzelem (Technical Win):**
   - Ha ellenfél 10 perc után sem csatlakozik vissza
   - Ha ellenfél 3x disconnect-el ugyanabban a meccben
   - Statisztikában: "Technical Win" / "Technical Loss"

2. **Feladás (Forfeit):**
   - Játékos önként feladja a meccset
   - Statisztikában: "Forfeited" / "Won by Forfeit"

3. **Abandon (mindkét fél elhagyja):**
   - Ha mindkét játékos >10 perc offline
   - Statisztikában: "Abandoned" - NEM számít be átlagokba

**Győzelmi típusok:**
```sql
game_rooms:
  - win_type: text (új)
    - 'normal' -- normál befejezés
    - 'forfeit' -- ellenfél feladta
    - 'technical' -- ellenfél túl sokáig offline
    - 'mutual_cancel' -- közös megegyezés
    - null -- nincs győztes (abandoned)
```

### 5. Statisztika Kezelés

**Megszakított játékok kezelése:**

```sql
match_statistics:
  - is_completed: boolean (új)
  - disconnect_count: integer (új)
  - total_disconnect_time: interval (új)
  - win_type: text (új)
  - forfeit_reason: text (új)
```

**Szabályok:**
1. **Normál győzelem**: Minden stat számít (ppd, checkout%, stb.)
2. **Technical Win**: Győzelem számít, egyéb statisztikák részlegesek
3. **Forfeit**: Győzelem számít, statisztikák részlegesek
4. **Abandoned**: SEMMI nem számít bele az átlagokba
5. **Mutual Cancel**: SEMMI nem számít bele

**Leaderboard kezelés:**
- Win/Loss ratio: Technical Win = fél győzelem (0.5 W)
- PPD, Checkout%: Csak completed játékok
- Külön "Forfeit rate" mutató

### 6. UI/UX Elemek

**Disconnect történt:**
```
┌─────────────────────────────────────┐
│  ⚠️  Ellenfél megszakadt            │
│                                     │
│  Várakozás a visszacsatlakozásra... │
│  Idő: 1:23 / 5:00                   │
│                                     │
│  [Tovább várok] [Nyerőnek hirdetem]│
└─────────────────────────────────────┘
```

**Pause kérés:**
```
┌─────────────────────────────────────┐
│  Player123 szünetet kért            │
│  Időtartam: 5 perc                  │
│                                     │
│  [Elfogad] [Elutasít]               │
│  Lejár: 0:28                        │
└─────────────────────────────────────┘
```

**Saját disconnect:**
```
┌─────────────────────────────────────┐
│  🔌 Kapcsolat megszakadt            │
│                                     │
│  Újracsatlakozás...                 │
│  [Újra] [Feladom]                   │
└─────────────────────────────────────┘
```

---

## Implementálási Prioritás

### MAGAS prioritás (azonnal):
1. ✅ Heartbeat system (ping 15 sec-enként)
2. ✅ Disconnect detektálás (45 sec timeout)
3. ✅ Reconnect alapok (visszacsatlakozás ugyanabba a roomba)
4. ✅ Automatikus timeout (10 perc után technical loss)

### KÖZEPES prioritás (hamarosan):
5. ⏳ Pause/Resume kérés rendszer
6. ⏳ Forfeit gomb
7. ⏳ Statisztika tisztítás (abandoned játékok kiszűrése)

### ALACSONY prioritás (később):
8. 📋 Disconnection history tracking
9. 📋 Fair-play score (sok disconnect = rossz score)
10. 📋 Automatikus matchmaking ban ismételt disconnect esetén

---

## Edge Case-ek

### Kérdés: Mi van ha mindkét játékos egyszerre disconnect-el?
**Válasz**: 10 perc múlva abandoned. Aki előbb visszacsatlakozik, várhat vagy abandon-olhatja.

### Kérdés: Lehet-e visszaélni a pause funkcióval?
**Válasz**:
- Max 2 pause/játékos/meccs
- Max 10 perc pause
- Ellenfélnek el kell fogadnia
- Túl sok pause kérés → Fair-play score csökken

### Kérdés: Mi van ha valaki szándékosan disconnect-el vesztéskor?
**Válasz**:
- 10 perc után automatikus technical loss
- Disconnect rate tracking
- Magas disconnect rate → matchmaking ban (pl. 3 abandon/nap = 24h ban)

### Kérdés: Lehet-e folytatni másnap a meccset?
**Válasz**:
- NEM alapértelmezetten
- DE: Pause kéréssel max 10 percet lehet kérni
- Jövőbeli feature: "Long pause" opció barátok között (max 24 óra)

---

## Javasolt Adatbázis Változások

Kész a migrációs fájl: `042_online_game_disconnect_handling.sql`

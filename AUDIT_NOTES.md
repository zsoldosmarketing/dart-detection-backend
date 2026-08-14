# Darts AI — első műszaki auditjegyzetek

**Ág:** `fix/detection-pipeline-foundation`  
**Dátum:** 2026-08-14  
**Hatókör:** kizárólag a `zsoldosmarketing/dart-detection-backend` repó és a hozzá rendelt `darts ai` Supabase-projekt olvasási vizsgálata.

## Megállapított futási útvonal

A repóban két, eltérő dobásfelismerési implementáció található. A beágyazott FastAPI/OpenCV backend fejlett kalibrációt, perspektíva-transzformációt és képkülönbség-alapú felismerést valósít meg, de a kliens jelenleg nem ezt hívja. A `src/lib/dartDetectionApi.ts` a `darts ai` Supabase-projekt `roboflow-proxy` Edge Functionjét használja. Emiatt a beágyazott Python backend jelenlegi javításai önmagukban nem javítanák az éles kliens pontozását.

> **Következmény:** a közvetlen, nagy hatású első fejlesztési iránynak a tényleges kliens–Edge Function adatútvonalat kell egységesítenie, nem egy párhuzamos backend algoritmusát tovább finomítania.

## Legfontosabb kockázatok

| Prioritás | Megállapítás | Várható hatás |
|---|---|---|
| Kritikus | A `scoreThrow` csak az aktuális képet küldi az Edge Functionnek; az előző képet és a kalibrációt nem használja. | A dobás becslése nem támaszkodik képkülönbségre vagy valódi táblageometriára. |
| Kritikus | A `roboflow-proxy` geometriai tartalékága a kép közepét és a kép rövidebb oldalának 45%-át tekinti táblának. | Oldalirányú kameraállásnál, változó kivágásnál és nem középre helyezett táblánál hibás szektor- és gyűrűpontozás várható. |
| Magas | A tábladetekció egy `dart` osztályú előrejelzést is táblajelöltként elfogadhat. | Egyetlen dobás téves kalibrációt indíthat el. |
| Magas | A FastAPI backend folyamatglobális `session_data` objektumban tárol kalibrációt és referencia-képet. | Egyidejű játékosoknál állapotösszekeveredést és nem skálázható viselkedést okozhat. |
| Magas | A Python backend `yolov8_detection` modult importálna, de ilyen modul nincs a repóban; a tényleges külső modul Roboflow-alapú. | A hirdetett YOLO-vonal jelenleg nem aktiválódik. |
| Közepes | A kalibrációs smoke-test egy „fallback” választ sikeresnek vár, miközben az implementáció helyesen sikertelen kalibrációnak jelöli. | A teszt hibásan megbukik, ezért nem ad használható regressziós jelzést. |
| Közepes | A TypeScript típusellenőrzés 213 hibával megáll, miközben a Vite build elkészül. | A fejlesztési minőségkapu nem megbízható, a fokozatos rendbetétel szükséges. |

## Versenytársi tanulságok

Az Autodarts dokumentációja a többkamerás készülékválasztást, a felbontás- és képkockasebesség-beállítást, az automatikus kalibrációt, a manuális 20-as szektor-igazítást, majd a valós dobásteszttel záruló munkafolyamatot írja le. A lencsetorzítás kezelését is a kalibráció részének tekinti. [1]

A Scolia nem kizárólag pontozóként pozicionálja magát: az online lobbit, saját versenyeket, ranglistát és klub- vagy helyszínhasználatot is a termékélményhez kapcsolja. Ez összhangban van a projekt közösségi és klubos irányával, amelynek adatséma-alapjai már megvannak a `darts ai` projektben. [2]

## Első fejlesztési csomag javaslata

A legkisebb kockázatú, mégis érdemi első csomag a felismerési szerződés és a tesztek rendbetétele:

1. A kliensben explicit, szerializálható kalibrációs pillanatkép bevezetése; ennek a `before` és `after` képpel együtt kell utaznia a felismerő kérésben.
2. A pontozási geometriát tiszta, tesztelhető függvénybe kell emelni, amely a kalibrált középpontot, ellipszist és szektor-elforgatást használja, és soha nem a képközéphez tér vissza csendben.
3. A külső modell eredményét csak dobásjelöltként kell kezelni. A pontszámot kizárólag ellenőrzött kalibrációs geometria adhatja meg; hiányzó kalibrációnál a válasz legyen egyértelműen `ASSIST` vagy `RETRY`.
4. A jelenlegi Python smoke-test elvárását a valós API-szerződéshez kell igazítani, majd szintetikus geometriai regressziós tesztekkel kell bővíteni.

A `darts ai` adatbázisban sok, a későbbi klub-, verseny-, közösségi-, edzés- és statisztikai funkcióhoz szükséges tábla már létezik, és mindegyik felsorolt publikus tábla esetén RLS aktív. A biztonsági ellenőrzés ugyanakkor számos, anonim GraphQL-sémában látható táblára figyelmeztetett; ezt külön, óvatos jogosultsági auditként kell kezelni, nem szabad automatikusan tömeges jogosultság-visszavonással javítani.

## Referenciák

[1]: https://autodarts.diy/Autodarts-Desktop/Setup/ "Autodarts Docs — Setup"
[2]: https://scoliadarts.com/ "Scolia — Automatic dart scoring system"

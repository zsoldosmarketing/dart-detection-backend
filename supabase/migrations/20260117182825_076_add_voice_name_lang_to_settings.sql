/*
  # Hang név és nyelv mentése a beállításokba
  
  1. Módosítások
    - `voice_settings` táblához hozzáadunk két új opcionális mezőt:
      - `voice_name` - A kiválasztott hang pontos neve
      - `voice_lang` - A kiválasztott hang nyelve
    
  2. Miért fontos?
    - A hang nevének és nyelvének tárolásával minden eszközön megpróbáljuk használni ugyanazt a hangot
    - Ha az eszközön nincs telepítve a pontos hang, intelligens fallback-et használunk
    - Prioritási lista alapján választjuk ki a legjobb magyar hangot
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_settings' AND column_name = 'voice_name'
  ) THEN
    ALTER TABLE voice_settings ADD COLUMN voice_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_settings' AND column_name = 'voice_lang'
  ) THEN
    ALTER TABLE voice_settings ADD COLUMN voice_lang text;
  END IF;
END $$;
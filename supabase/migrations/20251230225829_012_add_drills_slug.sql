/*
  # Add slug column to drills table
  
  This migration adds a slug column to the drills table which is used
  to identify specific drill types in the training session logic.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drills' AND column_name = 'slug'
  ) THEN
    ALTER TABLE drills ADD COLUMN slug text;
  END IF;
END $$;

UPDATE drills SET slug = 
  CASE 
    WHEN name_key = 'drill.doubles.bobs27.name' THEN 'bobs27'
    WHEN name_key = 'drill.doubles.d16only.name' THEN 'd16only'
    WHEN name_key = 'drill.doubles.ladder.name' THEN 'doubles-ladder'
    WHEN name_key = 'drill.doubles.d20only.name' THEN 'd20only'
    WHEN name_key = 'drill.doubles.d10only.name' THEN 'd10only'
    WHEN name_key = 'drill.doubles.d8only.name' THEN 'd8only'
    WHEN name_key = 'drill.doubles.favorite3.name' THEN 'favorite3'
    WHEN name_key = 'drill.doubles.twohit.name' THEN 'twohit'
    WHEN name_key = 'drill.doubles.random.name' THEN 'random-doubles'
    WHEN name_key = 'drill.doubles.clock.name' THEN 'doubles-clock'
    WHEN name_key = 'drill.triples.t20group.name' THEN 't20-group'
    WHEN name_key = 'drill.triples.switch2019.name' THEN 't20t19-switch'
    WHEN name_key = 'drill.triples.t19focus.name' THEN 't19focus'
    WHEN name_key = 'drill.triples.t18focus.name' THEN 't18focus'
    WHEN name_key = 'drill.triples.t17focus.name' THEN 't17focus'
    WHEN name_key = 'drill.triples.ladder.name' THEN 'triples-ladder'
    WHEN name_key = 'drill.triples.switch201918.name' THEN 'switch201918'
    WHEN name_key = 'drill.triples.switch1917.name' THEN 'switch1917'
    WHEN name_key = 'drill.triples.scoring100.name' THEN 'scoring100'
    WHEN name_key = 'drill.triples.180hunt.name' THEN '180hunt'
    WHEN name_key = 'drill.sectors.aroundclock.name' THEN 'aroundclock'
    WHEN name_key = 'drill.sectors.evenodd.name' THEN 'evenodd'
    WHEN name_key = 'drill.sectors.1to10.name' THEN '1to10'
    WHEN name_key = 'drill.sectors.11to20.name' THEN '11to20'
    WHEN name_key = 'drill.sectors.shanghai.name' THEN 'shanghai'
    WHEN name_key = 'drill.sectors.neighbour.name' THEN 'neighbour'
    WHEN name_key = 'drill.sectors.random.name' THEN 'random-sectors'
    WHEN name_key = 'drill.sectors.opposite.name' THEN 'opposite'
    WHEN name_key = 'drill.bull.bull30.name' THEN 'bull30'
    WHEN name_key = 'drill.bull.bull50.name' THEN 'bull50'
    WHEN name_key = 'drill.bull.obfocus.name' THEN 'obfocus'
    WHEN name_key = 'drill.bull.alternate.name' THEN 'alternate'
    WHEN name_key = 'drill.bull.pressure.name' THEN 'bull-pressure'
    WHEN name_key = 'drill.checkout.40to100.random.name' THEN '40to100-random'
    WHEN name_key = 'drill.checkout.101to170.random.name' THEN '101to170-random'
    WHEN name_key = 'drill.checkout.fix40.name' THEN 'fix40'
    WHEN name_key = 'drill.checkout.fix61.name' THEN 'fix61'
    WHEN name_key = 'drill.checkout.fix81.name' THEN 'fix81'
    WHEN name_key = 'drill.checkout.fix100.name' THEN 'fix100'
    WHEN name_key = 'drill.checkout.fix121.name' THEN 'fix121'
    WHEN name_key = 'drill.checkout.fix141.name' THEN 'fix141'
    WHEN name_key = 'drill.checkout.fix161.name' THEN 'fix161'
    WHEN name_key = 'drill.checkout.fix170.name' THEN 'fix170'
    WHEN name_key = 'drill.checkout.1dart.name' THEN '1dart'
    WHEN name_key = 'drill.checkout.2dart.name' THEN '2dart'
    WHEN name_key = 'drill.setup.preferreddouble.name' THEN 'preferreddouble'
    WHEN name_key = 'drill.setup.leave32.name' THEN 'leave32'
    WHEN name_key = 'drill.setup.leave24.name' THEN 'leave24'
    WHEN name_key = 'drill.setup.leave20.name' THEN 'leave20'
    WHEN name_key = 'drill.setup.leave16.name' THEN 'leave16'
    WHEN name_key = 'drill.setup.bogeyavoid.name' THEN 'bogeyavoid'
    WHEN name_key = 'drill.setup.twovisit.name' THEN 'twovisit'
    WHEN name_key = 'drill.general.pressure100.name' THEN 'pressure100'
    WHEN name_key = 'drill.general.pressure170.name' THEN 'pressure170'
    WHEN name_key = 'drill.general.matchplay.name' THEN 'matchplay'
    WHEN name_key = 'drill.general.warmup.name' THEN 'warmup'
    WHEN name_key = 'drill.general.cooldown.name' THEN 'cooldown'
    WHEN name_key = 'drill.pressure.matchdart.name' THEN 'matchdart'
    WHEN name_key = 'drill.pressure.countdown.name' THEN 'countdown'
    WHEN name_key = 'drill.pressure.elimination.name' THEN 'elimination'
    ELSE LOWER(REPLACE(REPLACE(name_key, 'drill.', ''), '.name', ''))
  END
WHERE slug IS NULL;

/*
  # Fix drill translation keys

  1. Changes
    - Update all drill name_key and desc_key values to use proper translation key format
    - Add missing .name and .desc suffixes where needed
    - Convert direct Hungarian text descriptions to proper translation keys
  
  2. Notes
    - All translation keys should follow the pattern: drill.category.slug.name and drill.category.slug.desc
    - This ensures proper translation through the i18n system
*/

-- Fix pressure.matchdart
UPDATE drills SET 
  name_key = 'drill.pressure.matchdart.name',
  desc_key = 'drill.pressure.matchdart.desc'
WHERE slug = 'pressure.matchdart';

-- Fix general.pressure170
UPDATE drills SET 
  name_key = 'drill.general.pressure170.name',
  desc_key = 'drill.general.pressure170.desc'
WHERE slug = 'general.pressure170';

-- Fix pressure.countdown
UPDATE drills SET 
  name_key = 'drill.pressure.countdown.name',
  desc_key = 'drill.pressure.countdown.desc'
WHERE slug = 'pressure.countdown';

-- Fix setup.leave32
UPDATE drills SET 
  name_key = 'drill.setup.leave32.name',
  desc_key = 'drill.setup.leave32.desc'
WHERE slug = 'setup.leave32';

-- Fix sectors.evenodd
UPDATE drills SET 
  name_key = 'drill.sectors.evenodd.name',
  desc_key = 'drill.sectors.evenodd.desc'
WHERE slug = 'sectors.evenodd';

-- Fix bull.bull50
UPDATE drills SET 
  name_key = 'drill.bull.bull50.name',
  desc_key = 'drill.bull.bull50.desc'
WHERE slug = 'bull.bull50';

-- Fix sectors.1to10
UPDATE drills SET 
  name_key = 'drill.sectors.1to10.name',
  desc_key = 'drill.sectors.1to10.desc'
WHERE slug = 'sectors.1to10';

-- Fix checkout.fix40
UPDATE drills SET 
  name_key = 'drill.checkout.fix40.name',
  desc_key = 'drill.checkout.fix40.desc'
WHERE slug = 'checkout.fix40';

-- Fix triples.t19focus
UPDATE drills SET 
  name_key = 'drill.triples.t19focus.name',
  desc_key = 'drill.triples.t19focus.desc'
WHERE slug = 'triples.t19focus';

-- Fix pressure.elimination
UPDATE drills SET 
  name_key = 'drill.pressure.elimination.name',
  desc_key = 'drill.pressure.elimination.desc'
WHERE slug = 'pressure.elimination';

-- Fix bull.obfocus
UPDATE drills SET 
  name_key = 'drill.bull.obfocus.name',
  desc_key = 'drill.bull.obfocus.desc'
WHERE slug = 'bull.obfocus';

-- Fix setup.leave24
UPDATE drills SET 
  name_key = 'drill.setup.leave24.name',
  desc_key = 'drill.setup.leave24.desc'
WHERE slug = 'setup.leave24';

-- Fix general.matchplay
UPDATE drills SET 
  name_key = 'drill.general.matchplay.name',
  desc_key = 'drill.general.matchplay.desc'
WHERE slug = 'general.matchplay';

-- Fix sectors.11to20
UPDATE drills SET 
  name_key = 'drill.sectors.11to20.name',
  desc_key = 'drill.sectors.11to20.desc'
WHERE slug = 'sectors.11to20';

-- Fix bull.alternate
UPDATE drills SET 
  name_key = 'drill.bull.alternate.name',
  desc_key = 'drill.bull.alternate.desc'
WHERE slug = 'bull.alternate';

-- Fix general.warmup
UPDATE drills SET 
  name_key = 'drill.general.warmup.name',
  desc_key = 'drill.general.warmup.desc'
WHERE slug = 'general.warmup';

-- Fix doubles.d20only
UPDATE drills SET 
  name_key = 'drill.doubles.d20only.name',
  desc_key = 'drill.doubles.d20only.desc'
WHERE slug = 'doubles.d20only';

-- Fix checkout.fix61
UPDATE drills SET 
  name_key = 'drill.checkout.fix61.name',
  desc_key = 'drill.checkout.fix61.desc'
WHERE slug = 'checkout.fix61';

-- Fix triples.t18focus
UPDATE drills SET 
  name_key = 'drill.triples.t18focus.name',
  desc_key = 'drill.triples.t18focus.desc'
WHERE slug = 'triples.t18focus';

-- Fix setup.leave20
UPDATE drills SET 
  name_key = 'drill.setup.leave20.name',
  desc_key = 'drill.setup.leave20.desc'
WHERE slug = 'setup.leave20';

-- Fix general.cooldown
UPDATE drills SET 
  name_key = 'drill.general.cooldown.name',
  desc_key = 'drill.general.cooldown.desc'
WHERE slug = 'general.cooldown';

-- Fix setup.leave16
UPDATE drills SET 
  name_key = 'drill.setup.leave16.name',
  desc_key = 'drill.setup.leave16.desc'
WHERE slug = 'setup.leave16';

-- Fix triples.t17focus
UPDATE drills SET 
  name_key = 'drill.triples.t17focus.name',
  desc_key = 'drill.triples.t17focus.desc'
WHERE slug = 'triples.t17focus';

-- Fix bull.pressure
UPDATE drills SET 
  name_key = 'drill.bull.pressure.name',
  desc_key = 'drill.bull.pressure.desc'
WHERE slug = 'bull.pressure';

-- Fix sectors.shanghai
UPDATE drills SET 
  name_key = 'drill.sectors.shanghai.name',
  desc_key = 'drill.sectors.shanghai.desc'
WHERE slug = 'sectors.shanghai';

-- Fix checkout.fix81
UPDATE drills SET 
  name_key = 'drill.checkout.fix81.name',
  desc_key = 'drill.checkout.fix81.desc'
WHERE slug = 'checkout.fix81';

-- Fix doubles.d10only
UPDATE drills SET 
  name_key = 'drill.doubles.d10only.name',
  desc_key = 'drill.doubles.d10only.desc'
WHERE slug = 'doubles.d10only';

-- Fix sectors.neighbour
UPDATE drills SET 
  name_key = 'drill.sectors.neighbour.name',
  desc_key = 'drill.sectors.neighbour.desc'
WHERE slug = 'sectors.neighbour';

-- Fix setup.bogeyavoid
UPDATE drills SET 
  name_key = 'drill.setup.bogeyavoid.name',
  desc_key = 'drill.setup.bogeyavoid.desc'
WHERE slug = 'setup.bogeyavoid';

-- Fix triples.ladder
UPDATE drills SET 
  name_key = 'drill.triples.ladder.name',
  desc_key = 'drill.triples.ladder.desc'
WHERE slug = 'triples.ladder';

-- Fix doubles.d8only
UPDATE drills SET 
  name_key = 'drill.doubles.d8only.name',
  desc_key = 'drill.doubles.d8only.desc'
WHERE slug = 'doubles.d8only';

-- Fix checkout.fix100
UPDATE drills SET 
  name_key = 'drill.checkout.fix100.name',
  desc_key = 'drill.checkout.fix100.desc'
WHERE slug = 'checkout.fix100';

-- Fix setup.twovisit
UPDATE drills SET 
  name_key = 'drill.setup.twovisit.name',
  desc_key = 'drill.setup.twovisit.desc'
WHERE slug = 'setup.twovisit';

-- Fix doubles.favorite3
UPDATE drills SET 
  name_key = 'drill.doubles.favorite3.name',
  desc_key = 'drill.doubles.favorite3.desc'
WHERE slug = 'doubles.favorite3';

-- Fix triples.switch201918
UPDATE drills SET 
  name_key = 'drill.triples.switch201918.name',
  desc_key = 'drill.triples.switch201918.desc'
WHERE slug = 'triples.switch201918';

-- Fix sectors.random
UPDATE drills SET 
  name_key = 'drill.sectors.random.name',
  desc_key = 'drill.sectors.random.desc'
WHERE slug = 'sectors.random';

-- Fix checkout.fix121
UPDATE drills SET 
  name_key = 'drill.checkout.fix121.name',
  desc_key = 'drill.checkout.fix121.desc'
WHERE slug = 'checkout.fix121';

-- Fix doubles.twohit
UPDATE drills SET 
  name_key = 'drill.doubles.twohit.name',
  desc_key = 'drill.doubles.twohit.desc'
WHERE slug = 'doubles.twohit';

-- Fix triples.switch1917
UPDATE drills SET 
  name_key = 'drill.triples.switch1917.name',
  desc_key = 'drill.triples.switch1917.desc'
WHERE slug = 'triples.switch1917';

-- Fix checkout.fix141
UPDATE drills SET 
  name_key = 'drill.checkout.fix141.name',
  desc_key = 'drill.checkout.fix141.desc'
WHERE slug = 'checkout.fix141';

-- Fix sectors.opposite
UPDATE drills SET 
  name_key = 'drill.sectors.opposite.name',
  desc_key = 'drill.sectors.opposite.desc'
WHERE slug = 'sectors.opposite';

-- Fix doubles.random
UPDATE drills SET 
  name_key = 'drill.doubles.random.name',
  desc_key = 'drill.doubles.random.desc'
WHERE slug = 'doubles.random';

-- Fix checkout.fix161
UPDATE drills SET 
  name_key = 'drill.checkout.fix161.name',
  desc_key = 'drill.checkout.fix161.desc'
WHERE slug = 'checkout.fix161';

-- Fix triples.scoring100
UPDATE drills SET 
  name_key = 'drill.triples.scoring100.name',
  desc_key = 'drill.triples.scoring100.desc'
WHERE slug = 'triples.scoring100';

-- Fix checkout.fix170
UPDATE drills SET 
  name_key = 'drill.checkout.fix170.name',
  desc_key = 'drill.checkout.fix170.desc'
WHERE slug = 'checkout.fix170';

-- Fix doubles.clock
UPDATE drills SET 
  name_key = 'drill.doubles.clock.name',
  desc_key = 'drill.doubles.clock.desc'
WHERE slug = 'doubles.clock';

-- Fix triples.180hunt
UPDATE drills SET 
  name_key = 'drill.triples.180hunt.name',
  desc_key = 'drill.triples.180hunt.desc'
WHERE slug = 'triples.180hunt';

-- Fix checkout.1dart
UPDATE drills SET 
  name_key = 'drill.checkout.1dart.name',
  desc_key = 'drill.checkout.1dart.desc'
WHERE slug = 'checkout.1dart';

-- Fix checkout.2dart
UPDATE drills SET 
  name_key = 'drill.checkout.2dart.name',
  desc_key = 'drill.checkout.2dart.desc'
WHERE slug = 'checkout.2dart';

-- Fix catch-40
UPDATE drills SET 
  name_key = 'drill.general.catch40.name',
  desc_key = 'drill.general.catch40.desc'
WHERE slug = 'catch-40';

-- Fix high-score
UPDATE drills SET 
  name_key = 'drill.scoring.highscore.name',
  desc_key = 'drill.scoring.highscore.desc'
WHERE slug = 'high-score';

-- Fix finish-50
UPDATE drills SET 
  name_key = 'drill.checkout.finish50.name',
  desc_key = 'drill.checkout.finish50.desc'
WHERE slug = 'finish-50';

-- Fix jdc-challenge
UPDATE drills SET 
  name_key = 'drill.challenge.jdc.name',
  desc_key = 'drill.challenge.jdc.desc'
WHERE slug = 'jdc-challenge';

-- Fix game-121
UPDATE drills SET 
  name_key = 'drill.checkout.game121.name',
  desc_key = 'drill.checkout.game121.desc'
WHERE slug = 'game-121';

-- Fix pristley-triple
UPDATE drills SET 
  name_key = 'drill.triples.pristley.name',
  desc_key = 'drill.triples.pristley.desc'
WHERE slug = 'pristley-triple';

-- Fix a1-drill
UPDATE drills SET 
  name_key = 'drill.general.a1drill.name',
  desc_key = 'drill.general.a1drill.desc'
WHERE slug = 'a1-drill';

-- Fix game-420
UPDATE drills SET 
  name_key = 'drill.scoring.game420.name',
  desc_key = 'drill.scoring.game420.desc'
WHERE slug = 'game-420';

-- Fix cricket-countup
UPDATE drills SET 
  name_key = 'drill.cricket.countup.name',
  desc_key = 'drill.cricket.countup.desc'
WHERE slug = 'cricket-countup';
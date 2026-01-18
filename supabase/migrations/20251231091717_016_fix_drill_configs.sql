/*
  # Fix drill configurations

  1. Changes
    - Update one_dart_setup to random_checkout with 2-40 range
    - Update two_dart_only to random_checkout with 41-100 range  
    - Update finish-50 to fixed_checkout
    - Update game-121 to fixed_checkout
    - Fix pressure drills to use focus_drill format
    - Fix other non-standard drill configs
*/

UPDATE drills SET config = jsonb_build_object(
  'type', 'random_checkout',
  'range', jsonb_build_array(2, 40),
  'attempts', 20
) WHERE slug = 'checkout.1dart';

UPDATE drills SET config = jsonb_build_object(
  'type', 'random_checkout',
  'range', jsonb_build_array(41, 100),
  'attempts', 20
) WHERE slug = 'checkout.2dart';

UPDATE drills SET config = jsonb_build_object(
  'type', 'fixed_checkout',
  'score', 50,
  'targets', jsonb_build_array('S10', 'D20'),
  'attempts', 15
) WHERE slug = 'finish-50';

UPDATE drills SET config = jsonb_build_object(
  'type', 'fixed_checkout',
  'score', 121,
  'targets', jsonb_build_array('T20', 'T11', 'D14'),
  'attempts', 15
) WHERE slug = 'game-121';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'BULL',
  'required_hits', 30
) WHERE slug = 'bull.pressure';

UPDATE drills SET config = jsonb_build_object(
  'type', 'fixed_checkout',
  'score', 100,
  'targets', jsonb_build_array('T20', 'D20'),
  'attempts', 20
) WHERE slug = 'pressure100';

UPDATE drills SET config = jsonb_build_object(
  'type', 'fixed_checkout',
  'score', 170,
  'targets', jsonb_build_array('T20', 'T20', 'BULL'),
  'attempts', 15
) WHERE slug = 'general.pressure170';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'targets', jsonb_build_array('T20', 'T19', 'T18'),
  'required_hits', 30
) WHERE slug = 'general.matchplay';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'targets', jsonb_build_array('T20', 'BULL', 'D20'),
  'required_hits', 15
) WHERE slug = 'general.warmup';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'targets', jsonb_build_array('S20', 'S19', 'S18'),
  'required_hits', 9
) WHERE slug = 'general.cooldown';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'targets', jsonb_build_array('T20', 'T19', 'D20'),
  'required_hits', 30
) WHERE slug = 'catch-40';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('T20', 'T20', 'T20', 'BULL', 'BULL', 'BULL', 'D20', 'D16', 'D8'),
  'hits_per_target', 7
) WHERE slug = 'jdc-challenge';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'targets', jsonb_build_array('T20', 'T19', 'D20'),
  'required_hits', 60
) WHERE slug = 'a1-drill';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('T20', 'T19', 'T18', 'T17', 'T16', 'T15', 'BULL'),
  'hits_per_target', 3
) WHERE slug = 'cricket-countup';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'D16',
  'required_hits', 30
) WHERE slug = 'pressure.matchdart';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'D20',
  'required_hits', 30
) WHERE slug = 'pressure.countdown';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('D20', 'D16', 'D8', 'D10', 'D4'),
  'hits_per_target', 5
) WHERE slug = 'pressure.elimination';

UPDATE drills SET config = jsonb_build_object(
  'type', 'alternating_drill',
  'targets', jsonb_build_array('S2', 'S4', 'S6', 'S8', 'S10', 'S1', 'S3', 'S5', 'S7', 'S9'),
  'hits_per_target', 2
) WHERE slug = 'sectors.evenodd';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('S1', 'D1', 'T1', 'S2', 'D2', 'T2', 'S3', 'D3', 'T3', 'S4', 'D4', 'T4', 'S5', 'D5', 'T5', 'S6', 'D6', 'T6', 'S7', 'D7', 'T7'),
  'hits_per_target', 1
) WHERE slug = 'sectors.shanghai';

UPDATE drills SET config = jsonb_build_object(
  'type', 'alternating_drill',
  'targets', jsonb_build_array('S5', 'S20', 'S1', 'S12', 'S9', 'S14'),
  'hits_per_target', 5
) WHERE slug = 'sectors.neighbour';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('S1', 'S5', 'S10', 'S15', 'S20', 'S2', 'S6', 'S11', 'S16', 'S3'),
  'hits_per_target', 2
) WHERE slug = 'sectors.random';

UPDATE drills SET config = jsonb_build_object(
  'type', 'alternating_drill',
  'targets', jsonb_build_array('S3', 'S17', 'S6', 'S14', 'S11', 'S9'),
  'hits_per_target', 5
) WHERE slug = 'sectors.opposite';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('T20', 'T19', 'T18', 'T17'),
  'hits_per_target', 4
) WHERE slug = 'preferreddouble';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'D16',
  'required_hits', 30
) WHERE slug = 'setup.leave32';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'D12',
  'required_hits', 30
) WHERE slug = 'setup.leave24';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'D10',
  'required_hits', 30
) WHERE slug = 'setup.leave20';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'D8',
  'required_hits', 30
) WHERE slug = 'setup.leave16';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('T20', 'S19', 'T19', 'S17', 'T18', 'S16'),
  'hits_per_target', 3
) WHERE slug = 'setup.bogeyavoid';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('T20', 'T19', 'D20', 'D16'),
  'hits_per_target', 5
) WHERE slug = 'setup.twovisit';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('D20', 'D16', 'D10', 'D8'),
  'hits_per_target', 5
) WHERE slug = 'doubles.favorite3';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('D20', 'D20', 'D16', 'D16', 'D10', 'D10', 'D8', 'D8', 'D4', 'D4', 'D2', 'D2'),
  'hits_per_target', 2
) WHERE slug = 'doubles.twohit';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('D1', 'D5', 'D10', 'D15', 'D20', 'D2', 'D6', 'D11', 'D16', 'D3', 'D7', 'D12', 'D17', 'D4', 'D8', 'D13', 'D18', 'D9', 'D14', 'D19'),
  'hits_per_target', 1
) WHERE slug = 'doubles.random';

UPDATE drills SET config = jsonb_build_object(
  'type', 'sequence_drill',
  'targets', jsonb_build_array('D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20'),
  'hits_per_target', 1
) WHERE slug = 'doubles.clock';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'T20',
  'required_hits', 100
) WHERE slug = 'triples.scoring100';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'T20',
  'required_hits', 90
) WHERE slug = 'triples.180hunt';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'T20',
  'required_hits', 30
) WHERE slug = 'high-score';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'target', 'T20',
  'required_hits', 50
) WHERE slug = 'pristley-triple';

UPDATE drills SET config = jsonb_build_object(
  'type', 'focus_drill',
  'targets', jsonb_build_array('T20', 'T19', 'T18'),
  'required_hits', 42
) WHERE slug = 'game-420';
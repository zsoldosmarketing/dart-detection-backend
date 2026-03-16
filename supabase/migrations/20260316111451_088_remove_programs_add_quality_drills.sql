/*
  # Remove Hardcoded Programs & Add Quality Drills

  ## Changes

  ### Removed
  - All hardcoded training programs - AI will generate personalized ones per player based on their statistics and goals

  ### New Drills Added (14 new tournament-standard drills)

  #### Checkout (6 new)
  - Bull Finish: 30 darts at bullseye, for high checkouts (170, 167, 161)
  - Two-Dart Easy: D20-D2 sequence, pure doubles from even scores under 40
  - Madhouse: D1 practice - the feared finish when you leave 2
  - Killer Doubles: D3,D5,D7,D9... the ugly odd doubles nobody practices
  - Fixed 32: Most common finish in 501, D16 reflex builder
  - Fixed 16: After missing D16 you get here - D8 automatic response

  #### Triples/Scoring (3 new)
  - Max Scoring 8 Visits: T20 ceiling test, max 1440 points
  - T20 Consistency 30: The single most important drill - hit rate tracking
  - T19 Consistency 30: Fallback triple practice

  #### Doubles (2 new)
  - Clock Doubles Speed: Every double 1-20 plus bull, one shot each
  - Top 6 Doubles: D20,D16,D10,D8,D4,D2 - the most critical 6, 5 rounds

  #### Pressure (2 new)
  - Last Darts Pressure: 10 checkouts with only 3 total lives
  - Sudden Death Doubles: 12 doubles, 1 life - championship pressure simulation

  #### Bull (1 new)
  - Bull Consistency 20: 20 bull attempts, honest percentage tracking

  #### Setup (2 new)
  - Leave Engineering: T20/T19/T18 to ideal leaves (40, 32, 24)
  - Two Visit Finish: Plan and execute 2-visit finishes from 60-100

  ## Security
  - No RLS changes needed (inherits existing drills policies)
*/

-- Clear all hardcoded programs (AI generates personalized ones)
DELETE FROM program_enrollments;
DELETE FROM programs;

-- CHECKOUT: Bull Finish
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.bull_finish',
  'drill.bull_finish.desc',
  'checkout',
  3,
  '{"type":"focus_drill","target":"BULL","total_darts":30,"scoring":"hit_miss","description":"Practice finishing on the bullseye (50). Essential for high checkouts like 170, 167, 164, 161."}',
  true, 'checkout.bull', 10,
  'bull-finish'
) ON CONFLICT (slug) DO NOTHING;

-- CHECKOUT: Two-Dart Easy
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.two_dart_checkout_easy',
  'drill.two_dart_checkout_easy.desc',
  'checkout',
  2,
  '{"type":"sequence_drill","targets":["D20","D16","D8","D10","D4","D12","D6","D2","D18","D14"],"darts_per_target":3,"scoring":"doubles_accuracy","description":"Two-dart checkouts on even numbers 40 and below. Pure doubles practice with direct approach."}',
  true, 'checkout.ndart', 12,
  'two-dart-checkout-easy'
) ON CONFLICT (slug) DO NOTHING;

-- CHECKOUT: Madhouse D1
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.madhouse',
  'drill.madhouse.desc',
  'checkout',
  4,
  '{"type":"focus_drill","target":"D1","total_darts":30,"scoring":"hit_miss","description":"Practice D1 - the feared Madhouse finish. If you leave 2 after missing D2, this is your last resort."}',
  true, 'checkout.fixed', 10,
  'madhouse'
) ON CONFLICT (slug) DO NOTHING;

-- CHECKOUT: Killer Doubles
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.killer_doubles',
  'drill.killer_doubles.desc',
  'checkout',
  4,
  '{"type":"sequence_drill","targets":["D3","D5","D7","D9","D11","D13","D15","D17","D19"],"darts_per_target":3,"scoring":"doubles_accuracy","description":"The ugly odd doubles. Master these and never fear a bad leave again."}',
  true, 'checkout.fixed', 15,
  'killer-doubles'
) ON CONFLICT (slug) DO NOTHING;

-- CHECKOUT: Fixed 32
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.fixed_32',
  'drill.fixed_32.desc',
  'checkout',
  2,
  '{"type":"fixed_checkout","score":32,"attempts":25,"scoring":"checkout_rate","description":"32 is the most common finish in 501. D16, or two D8s. Builds the fundamental reflex every serious player needs."}',
  true, 'checkout.fixed', 10,
  'fixed-checkout-32'
) ON CONFLICT (slug) DO NOTHING;

-- CHECKOUT: Fixed 16
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.fixed_16',
  'drill.fixed_16.desc',
  'checkout',
  2,
  '{"type":"fixed_checkout","score":16,"attempts":25,"scoring":"checkout_rate","description":"16 = D8. After missing D16 you land here. 25 attempts to build automatic accuracy."}',
  true, 'checkout.fixed', 8,
  'fixed-checkout-16'
) ON CONFLICT (slug) DO NOTHING;

-- TRIPLES: Max Scoring 8 visits
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.max_scoring_8',
  'drill.max_scoring_8.desc',
  'triples',
  3,
  '{"type":"max_score","visits":8,"target":"T20","scoring":"total_score","max_possible":1440,"description":"8 visits of T20 focus. Max possible: 1440. World class: 1200+. Competitive: 1000+."}',
  true, 'triples.scoring', 8,
  'max-scoring-8'
) ON CONFLICT (slug) DO NOTHING;

-- TRIPLES: T20 Consistency 30
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.t20_consistency_30',
  'drill.t20_consistency_30.desc',
  'triples',
  3,
  '{"type":"focus_drill","target":"T20","total_darts":30,"scoring":"hit_rate","description":"30 darts at T20. 50%+ developing. 65%+ solid. 75%+ competitive level. The most important single drill."}',
  true, 'triples.scoring', 10,
  't20-consistency-30'
) ON CONFLICT (slug) DO NOTHING;

-- TRIPLES: T19 Consistency 30
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.t19_consistency_30',
  'drill.t19_consistency_30.desc',
  'triples',
  3,
  '{"type":"focus_drill","target":"T19","total_darts":30,"scoring":"hit_rate","description":"30 darts at T19. Your fallback when T20 is off. Many pros prefer T19 for consistent scoring."}',
  true, 'triples.scoring', 10,
  't19-consistency-30'
) ON CONFLICT (slug) DO NOTHING;

-- DOUBLES: Clock Doubles Speed
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.clock_doubles_speed',
  'drill.clock_doubles_speed.desc',
  'doubles',
  4,
  '{"type":"sequence_drill","targets":["D1","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12","D13","D14","D15","D16","D17","D18","D19","D20","BULL"],"darts_per_target":1,"scoring":"doubles_accuracy","description":"One dart at every double 1-20 plus bull. Must hit each to advance. Covers every possible finish."}',
  true, 'doubles.clock', 15,
  'clock-doubles-speed'
) ON CONFLICT (slug) DO NOTHING;

-- DOUBLES: Top 6 Doubles
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.top6_doubles',
  'drill.top6_doubles.desc',
  'doubles',
  3,
  '{"type":"rotation_drill","targets":["D20","D16","D10","D8","D4","D2"],"rounds":5,"darts_per_target":3,"scoring":"doubles_accuracy","description":"5 rounds of the 6 most critical doubles. 90 total darts. Master these to close out competitive legs."}',
  true, 'doubles.focused', 18,
  'top6-doubles'
) ON CONFLICT (slug) DO NOTHING;

-- PRESSURE: Last Darts Pressure
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.last_darts_pressure',
  'drill.last_darts_pressure.desc',
  'pressure',
  4,
  '{"type":"sequence_drill","targets":["D20","D16","D8","D10","D18","D4","D12","D6","D2","BULL"],"darts_per_target":3,"lives":3,"scoring":"checkout_rate","description":"10 checkouts with only 3 total lives. Miss 3 and the drill ends. Real match pressure simulation."}',
  true, 'pressure.checkout', 15,
  'last-darts-pressure'
) ON CONFLICT (slug) DO NOTHING;

-- PRESSURE: Sudden Death Doubles
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.sudden_death_doubles',
  'drill.sudden_death_doubles.desc',
  'pressure',
  5,
  '{"type":"focus_drill","target":"D20","total_darts":12,"lives":1,"scoring":"doubles_accuracy","description":"12 doubles, one life. Miss once and it is over. Championship match pressure simulation."}',
  true, 'pressure.mental', 8,
  'sudden-death-doubles'
) ON CONFLICT (slug) DO NOTHING;

-- BULL: Bull Consistency 20
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.bull_consistency_20',
  'drill.bull_consistency_20.desc',
  'bull',
  3,
  '{"type":"focus_drill","target":"BULL","total_darts":20,"scoring":"hit_rate","description":"20 darts at bullseye. Critical for 170, 167, 161 checkouts. Track your bull percentage honestly."}',
  true, 'bull.consistency', 8,
  'bull-consistency-20'
) ON CONFLICT (slug) DO NOTHING;

-- SETUP: Leave Engineering
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.leave_engineering',
  'drill.leave_engineering.desc',
  'setup',
  3,
  '{"type":"sequence_drill","targets":["T20","T19","T18","T20","T19","T20"],"scoring":"setup_accuracy","description":"T20 to leave 40, T19 to leave 32, T18 to leave 24. The setup game separates amateur from professional."}',
  true, 'setup.engineering', 12,
  'leave-engineering'
) ON CONFLICT (slug) DO NOTHING;

-- SETUP: Two Visit Finish
INSERT INTO drills (name_key, desc_key, category, difficulty, config, is_active, group_key, estimated_minutes, slug)
VALUES (
  'drill.two_visit_finish',
  'drill.two_visit_finish.desc',
  'setup',
  4,
  '{"type":"sequence_drill","targets":["S20","S19","S18","S17","S16"],"scoring":"setup_accuracy","attempts":15,"description":"From 60-100: plan and execute a 2-visit finish. Tests arithmetic and shot selection under combined pressure."}',
  true, 'setup.planning', 15,
  'two-visit-finish'
) ON CONFLICT (slug) DO NOTHING;

/*
  # Seed Data - Drills, Programs, Challenges, Bot Presets
  
  ## Overview
  This migration seeds the database with initial training content:
  - 60+ drills across all categories
  - 12 training programs
  - 24 challenges
  
  ## Categories
  - doubles: Double target practice
  - triples: Triple target practice
  - sectors: Sector control drills
  - bull: Bull targeting
  - checkout: Checkout practice
  - setup: Setup shots
  - general: General practice
  - pressure: Pressure training
*/

INSERT INTO drills (category, name_key, desc_key, config, difficulty, estimated_minutes, sort_order) VALUES
('doubles', 'drill.doubles.bobs27.name', 'drill.doubles.bobs27.desc', '{"type": "classic_bobs27", "rounds": 20, "start_score": 27, "scoring": "bobs27"}', 3, 15, 1),
('doubles', 'drill.doubles.d16only.name', 'drill.doubles.d16only.desc', '{"type": "target_hits", "target": "D16", "darts": 60, "score_mode": "hits"}', 2, 10, 2),
('doubles', 'drill.doubles.ladder.name', 'drill.doubles.ladder.desc', '{"type": "ladder", "targets": ["D1","D2","D3","D4","D5","D6","D7","D8","D9","D10","D11","D12","D13","D14","D15","D16","D17","D18","D19","D20"], "darts_per_target": 6}', 3, 20, 3),
('doubles', 'drill.doubles.d20only.name', 'drill.doubles.d20only.desc', '{"type": "target_hits", "target": "D20", "darts": 60}', 2, 10, 4),
('doubles', 'drill.doubles.d10only.name', 'drill.doubles.d10only.desc', '{"type": "target_hits", "target": "D10", "darts": 60}', 2, 10, 5),
('doubles', 'drill.doubles.d8only.name', 'drill.doubles.d8only.desc', '{"type": "target_hits", "target": "D8", "darts": 60}', 2, 10, 6),
('doubles', 'drill.doubles.favorite3.name', 'drill.doubles.favorite3.desc', '{"type": "rotation", "targets": ["D20", "D16", "D8"], "darts_per_target": 20}', 2, 12, 7),
('doubles', 'drill.doubles.twohit.name', 'drill.doubles.twohit.desc', '{"type": "two_hit_switch", "targets": ["D20","D16","D10","D8","D4","D2"]}', 3, 15, 8),
('doubles', 'drill.doubles.random.name', 'drill.doubles.random.desc', '{"type": "random_doubles", "darts": 60}', 3, 12, 9),
('doubles', 'drill.doubles.clock.name', 'drill.doubles.clock.desc', '{"type": "around_the_clock", "mode": "doubles"}', 4, 20, 10),

('triples', 'drill.triples.t20group.name', 'drill.triples.t20group.desc', '{"type": "grouping", "primary": "T20", "secondary": "S20", "darts": 60, "metric": "cluster_score"}', 3, 12, 1),
('triples', 'drill.triples.switch2019.name', 'drill.triples.switch2019.desc', '{"type": "switching", "sequence": ["T20","T19"], "darts": 60, "score_mode": "points"}', 3, 12, 2),
('triples', 'drill.triples.t19focus.name', 'drill.triples.t19focus.desc', '{"type": "target_hits", "target": "T19", "darts": 60}', 3, 10, 3),
('triples', 'drill.triples.t18focus.name', 'drill.triples.t18focus.desc', '{"type": "target_hits", "target": "T18", "darts": 60}', 3, 10, 4),
('triples', 'drill.triples.t17focus.name', 'drill.triples.t17focus.desc', '{"type": "target_hits", "target": "T17", "darts": 60}', 3, 10, 5),
('triples', 'drill.triples.ladder.name', 'drill.triples.ladder.desc', '{"type": "ladder", "targets": ["T20","T19","T18","T17","T16","T15"]}', 4, 18, 6),
('triples', 'drill.triples.switch201918.name', 'drill.triples.switch201918.desc', '{"type": "switching", "sequence": ["T20","T19","T18"], "darts": 60}', 4, 15, 7),
('triples', 'drill.triples.switch1917.name', 'drill.triples.switch1917.desc', '{"type": "switching", "sequence": ["T19","T17"], "darts": 60}', 3, 12, 8),
('triples', 'drill.triples.scoring100.name', 'drill.triples.scoring100.desc', '{"type": "scoring_target", "min_score": 100, "rounds": 20}', 4, 15, 9),
('triples', 'drill.triples.180hunt.name', 'drill.triples.180hunt.desc', '{"type": "max_scoring", "target": 180, "attempts": 30}', 5, 20, 10),

('sectors', 'drill.sectors.aroundclock.name', 'drill.sectors.aroundclock.desc', '{"type": "around_the_clock", "mode": "singles", "targets": ["S1","S2","S3","S4","S5","S6","S7","S8","S9","S10","S11","S12","S13","S14","S15","S16","S17","S18","S19","S20"], "darts": 60}', 2, 15, 1),
('sectors', 'drill.sectors.evenodd.name', 'drill.sectors.evenodd.desc', '{"type": "sector_control", "groups": ["even", "odd"]}', 2, 12, 2),
('sectors', 'drill.sectors.1to10.name', 'drill.sectors.1to10.desc', '{"type": "speed_sectors", "range": [1, 10]}', 2, 10, 3),
('sectors', 'drill.sectors.11to20.name', 'drill.sectors.11to20.desc', '{"type": "speed_sectors", "range": [11, 20]}', 2, 10, 4),
('sectors', 'drill.sectors.shanghai.name', 'drill.sectors.shanghai.desc', '{"type": "shanghai", "full": true}', 4, 25, 5),
('sectors', 'drill.sectors.neighbour.name', 'drill.sectors.neighbour.desc', '{"type": "neighbour_control", "targets": ["5-20-1", "12-9-14"]}', 3, 12, 6),
('sectors', 'drill.sectors.random.name', 'drill.sectors.random.desc', '{"type": "random_sectors", "darts": 60}', 2, 10, 7),
('sectors', 'drill.sectors.opposite.name', 'drill.sectors.opposite.desc', '{"type": "opposite_control"}', 3, 15, 8),

('bull', 'drill.bull.bull30.name', 'drill.bull.bull30.desc', '{"type": "target_hits", "target": "BULL", "darts": 30, "score_mode": "hits_weighted", "weights": {"OB": 1, "BULL": 2}}', 3, 8, 1),
('bull', 'drill.bull.bull50.name', 'drill.bull.bull50.desc', '{"type": "target_hits", "target": "BULL", "darts": 50}', 3, 12, 2),
('bull', 'drill.bull.obfocus.name', 'drill.bull.obfocus.desc', '{"type": "target_hits", "target": "OB", "darts": 40}', 2, 10, 3),
('bull', 'drill.bull.alternate.name', 'drill.bull.alternate.desc', '{"type": "alternating", "targets": ["BULL", "OB"]}', 4, 15, 4),
('bull', 'drill.bull.pressure.name', 'drill.bull.pressure.desc', '{"type": "pressure", "target": "BULL", "lives": 5}', 4, 12, 5),

('checkout', 'drill.checkout.40to100.random.name', 'drill.checkout.40to100.random.desc', '{"type": "random_checkout", "range": [40,100], "attempts": 20, "show_alt_routes": true, "prefer_doubles": true}', 3, 15, 1),
('checkout', 'drill.checkout.101to170.random.name', 'drill.checkout.101to170.random.desc', '{"type": "random_checkout", "range": [101,170], "attempts": 15, "show_alt_routes": true}', 4, 18, 2),
('checkout', 'drill.checkout.fix40.name', 'drill.checkout.fix40.desc', '{"type": "fixed_checkout", "score": 40, "attempts": 20}', 2, 10, 3),
('checkout', 'drill.checkout.fix61.name', 'drill.checkout.fix61.desc', '{"type": "fixed_checkout", "score": 61, "attempts": 15}', 3, 12, 4),
('checkout', 'drill.checkout.fix81.name', 'drill.checkout.fix81.desc', '{"type": "fixed_checkout", "score": 81, "attempts": 15}', 3, 12, 5),
('checkout', 'drill.checkout.fix100.name', 'drill.checkout.fix100.desc', '{"type": "fixed_checkout", "score": 100, "attempts": 15}', 3, 12, 6),
('checkout', 'drill.checkout.fix121.name', 'drill.checkout.fix121.desc', '{"type": "fixed_checkout", "score": 121, "attempts": 12}', 4, 15, 7),
('checkout', 'drill.checkout.fix141.name', 'drill.checkout.fix141.desc', '{"type": "fixed_checkout", "score": 141, "attempts": 12}', 4, 15, 8),
('checkout', 'drill.checkout.fix161.name', 'drill.checkout.fix161.desc', '{"type": "fixed_checkout", "score": 161, "attempts": 10}', 5, 15, 9),
('checkout', 'drill.checkout.fix170.name', 'drill.checkout.fix170.desc', '{"type": "fixed_checkout", "score": 170, "attempts": 10}', 5, 15, 10),
('checkout', 'drill.checkout.1dart.name', 'drill.checkout.1dart.desc', '{"type": "one_dart_setup", "attempts": 20}', 3, 12, 11),
('checkout', 'drill.checkout.2dart.name', 'drill.checkout.2dart.desc', '{"type": "two_dart_only", "attempts": 20}', 3, 15, 12),

('setup', 'drill.setup.preferreddouble.name', 'drill.setup.preferreddouble.desc', '{"type": "setup_to_preferred_double", "attempts": 15, "start_scores": [233,287,312,356], "show_projections": true}', 3, 15, 1),
('setup', 'drill.setup.leave32.name', 'drill.setup.leave32.desc', '{"type": "setup_leave", "target_leave": 32, "attempts": 15}', 3, 12, 2),
('setup', 'drill.setup.leave24.name', 'drill.setup.leave24.desc', '{"type": "setup_leave", "target_leave": 24, "attempts": 15}', 3, 12, 3),
('setup', 'drill.setup.leave20.name', 'drill.setup.leave20.desc', '{"type": "setup_leave", "target_leave": 20, "attempts": 15}', 3, 12, 4),
('setup', 'drill.setup.leave16.name', 'drill.setup.leave16.desc', '{"type": "setup_leave", "target_leave": 16, "attempts": 15}', 3, 12, 5),
('setup', 'drill.setup.bogeyavoid.name', 'drill.setup.bogeyavoid.desc', '{"type": "bogey_avoidance", "bogey_numbers": [169,168,166,165,163,162,159]}', 4, 15, 6),
('setup', 'drill.setup.twovisit.name', 'drill.setup.twovisit.desc', '{"type": "two_visit_plan", "attempts": 12}', 4, 18, 7),

('general', 'drill.general.pressure100.name', 'drill.general.pressure100.desc', '{"type": "pressure", "goal": "checkout", "score": 100, "lives": 5, "show_alt_routes": true}', 4, 12, 1),
('general', 'drill.general.pressure170.name', 'drill.general.pressure170.desc', '{"type": "pressure", "goal": "checkout", "score": 170, "lives": 3}', 5, 15, 2),
('general', 'drill.general.matchplay.name', 'drill.general.matchplay.desc', '{"type": "match_simulation", "legs": 3}', 4, 25, 3),
('general', 'drill.general.warmup.name', 'drill.general.warmup.desc', '{"type": "warmup", "rounds": 5}', 1, 8, 4),
('general', 'drill.general.cooldown.name', 'drill.general.cooldown.desc', '{"type": "cooldown", "rounds": 3}', 1, 5, 5),

('pressure', 'drill.pressure.matchdart.name', 'drill.pressure.matchdart.desc', '{"type": "match_dart_simulation", "scenarios": 10}', 5, 15, 1),
('pressure', 'drill.pressure.countdown.name', 'drill.pressure.countdown.desc', '{"type": "countdown_pressure", "time_limit": 30}', 4, 12, 2),
('pressure', 'drill.pressure.elimination.name', 'drill.pressure.elimination.desc', '{"type": "elimination", "starting_lives": 5}', 4, 15, 3)

ON CONFLICT DO NOTHING;

INSERT INTO programs (name_key, desc_key, config, duration_days, daily_minutes, difficulty, target_skill, sort_order) VALUES
('program.7day.foundation.name', 'program.7day.foundation.desc', '{"duration_days": 7, "daily_minutes": 15, "schedule": [{"day": 1, "drills_by_category": ["doubles","triples"]}, {"day": 2, "drills_by_category": ["checkout","setup"]}, {"day": 3, "drills_by_category": ["sectors","bull"]}, {"day": 4, "drills_by_category": ["doubles","checkout"]}, {"day": 5, "drills_by_category": ["triples","setup"]}, {"day": 6, "drills_by_category": ["general"]}, {"day": 7, "drills_by_category": ["pressure","checkout"]}]}', 7, 15, 2, 'foundation', 1),
('program.14day.doubleboost.name', 'program.14day.doubleboost.desc', '{"duration_days": 14, "focus": "doubles"}', 14, 20, 3, 'doubles', 2),
('program.30day.checkoutmaster.name', 'program.30day.checkoutmaster.desc', '{"duration_days": 30, "focus": "checkout"}', 30, 25, 4, 'checkout', 3),
('program.14day.scoringstabil.name', 'program.14day.scoringstabil.desc', '{"duration_days": 14, "focus": "triples"}', 14, 20, 3, 'scoring', 4),
('program.7day.quickreturn.name', 'program.7day.quickreturn.desc', '{"duration_days": 7, "focus": "general"}', 7, 10, 1, 'general', 5),
('program.30day.tournamentprep.name', 'program.30day.tournamentprep.desc', '{"duration_days": 30, "focus": "all"}', 30, 30, 4, 'tournament', 6),
('program.14day.bullcontrol.name', 'program.14day.bullcontrol.desc', '{"duration_days": 14, "focus": "bull"}', 14, 15, 3, 'bull', 7),
('program.21day.complete.name', 'program.21day.complete.desc', '{"duration_days": 21, "focus": "all"}', 21, 25, 3, 'complete', 8),
('program.7day.pressure.name', 'program.7day.pressure.desc', '{"duration_days": 7, "focus": "pressure"}', 7, 15, 4, 'pressure', 9),
('program.14day.setupmaster.name', 'program.14day.setupmaster.desc', '{"duration_days": 14, "focus": "setup"}', 14, 20, 3, 'setup', 10),
('program.30day.propath.name', 'program.30day.propath.desc', '{"duration_days": 30, "focus": "advanced"}', 30, 35, 5, 'pro', 11),
('program.7day.maintenance.name', 'program.7day.maintenance.desc', '{"duration_days": 7, "focus": "maintenance"}', 7, 12, 2, 'maintenance', 12)

ON CONFLICT DO NOTHING;

INSERT INTO challenges (name_key, desc_key, rule, reward) VALUES
('challenge.streak3.name', 'challenge.streak3.desc', '{"type": "streak_days", "value": 3}', '{"type": "badge", "value": "STREAK_3"}'),
('challenge.checkout5.name', 'challenge.checkout5.desc', '{"type": "checkouts", "value": 5, "range": [40,100], "window_days": 7}', '{"type": "badge", "value": "FINISHER"}'),
('challenge.streak7.name', 'challenge.streak7.desc', '{"type": "streak_days", "value": 7}', '{"type": "badge", "value": "STREAK_7"}'),
('challenge.streak14.name', 'challenge.streak14.desc', '{"type": "streak_days", "value": 14}', '{"type": "badge", "value": "STREAK_14"}'),
('challenge.streak30.name', 'challenge.streak30.desc', '{"type": "streak_days", "value": 30}', '{"type": "badge", "value": "STREAK_30"}'),
('challenge.checkout121.name', 'challenge.checkout121.desc', '{"type": "high_checkout", "min_score": 121, "count": 3}', '{"type": "badge", "value": "HIGH_FINISHER"}'),
('challenge.checkout170.name', 'challenge.checkout170.desc', '{"type": "checkout_exact", "score": 170}', '{"type": "badge", "value": "PERFECT_CHECKOUT"}'),
('challenge.bull10.name', 'challenge.bull10.desc', '{"type": "bull_hits", "value": 10}', '{"type": "badge", "value": "BULLSEYE"}'),
('challenge.bull50.name', 'challenge.bull50.desc', '{"type": "bull_hits", "value": 50}', '{"type": "badge", "value": "BULL_MASTER"}'),
('challenge.noundo.name', 'challenge.noundo.desc', '{"type": "no_undo_week"}', '{"type": "badge", "value": "PRECISION"}'),
('challenge.club10.name', 'challenge.club10.desc', '{"type": "club_games", "value": 10, "window_days": 7}', '{"type": "badge", "value": "CLUB_WARRIOR"}'),
('challenge.tournament_semi.name', 'challenge.tournament_semi.desc', '{"type": "tournament_position", "max_position": 4}', '{"type": "badge", "value": "SEMI_FINALIST"}'),
('challenge.tournament_final.name', 'challenge.tournament_final.desc', '{"type": "tournament_position", "max_position": 2}', '{"type": "badge", "value": "FINALIST"}'),
('challenge.tournament_win.name', 'challenge.tournament_win.desc', '{"type": "tournament_position", "max_position": 1}', '{"type": "badge", "value": "CHAMPION"}'),
('challenge.180hit.name', 'challenge.180hit.desc', '{"type": "max_score_hit", "score": 180}', '{"type": "badge", "value": "180_CLUB"}'),
('challenge.180x3.name', 'challenge.180x3.desc', '{"type": "max_score_count", "score": 180, "count": 3}', '{"type": "badge", "value": "180_MASTER"}'),
('challenge.avg50.name', 'challenge.avg50.desc', '{"type": "average_above", "value": 50}', '{"type": "badge", "value": "AVG_50"}'),
('challenge.avg60.name', 'challenge.avg60.desc', '{"type": "average_above", "value": 60}', '{"type": "badge", "value": "AVG_60"}'),
('challenge.avg70.name', 'challenge.avg70.desc', '{"type": "average_above", "value": 70}', '{"type": "badge", "value": "AVG_70"}'),
('challenge.games10.name', 'challenge.games10.desc', '{"type": "games_played", "value": 10}', '{"type": "badge", "value": "PLAYER_10"}'),
('challenge.games50.name', 'challenge.games50.desc', '{"type": "games_played", "value": 50}', '{"type": "badge", "value": "PLAYER_50"}'),
('challenge.games100.name', 'challenge.games100.desc', '{"type": "games_played", "value": 100}', '{"type": "badge", "value": "VETERAN"}'),
('challenge.wins10.name', 'challenge.wins10.desc', '{"type": "wins", "value": 10}', '{"type": "badge", "value": "WINNER_10"}'),
('challenge.wins50.name', 'challenge.wins50.desc', '{"type": "wins", "value": 50}', '{"type": "badge", "value": "WINNER_50"}')

ON CONFLICT DO NOTHING;
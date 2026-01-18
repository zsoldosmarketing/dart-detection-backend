/*
  # Add drill grouping support

  1. Changes
    - Add `group_key` column to drills table for grouping related drills
    - Add `group_name_key` column for translation key of group name
    - Update existing checkout drills to group them logically
  
  2. Groups Created
    - Fixed Checkouts (40-170)
    - Random Checkouts
    - N-Dart Finishes
    - Other checkout drills remain ungrouped
*/

ALTER TABLE drills ADD COLUMN IF NOT EXISTS group_key text;
ALTER TABLE drills ADD COLUMN IF NOT EXISTS group_name_key text;

UPDATE drills SET 
  group_key = 'checkout.fixed',
  group_name_key = 'drill.group.checkout.fixed.name'
WHERE slug IN (
  'checkout.fix40',
  'checkout.fix61', 
  'checkout.fix81',
  'checkout.fix100',
  'checkout.fix121',
  'checkout.fix141',
  'checkout.fix161',
  'checkout.fix170'
);

UPDATE drills SET
  group_key = 'checkout.random',
  group_name_key = 'drill.group.checkout.random.name'
WHERE slug IN (
  '40to100-random',
  '101to170-random'
);

UPDATE drills SET
  group_key = 'checkout.ndart',
  group_name_key = 'drill.group.checkout.ndart.name'
WHERE slug IN (
  'checkout.1dart',
  'checkout.2dart'
);
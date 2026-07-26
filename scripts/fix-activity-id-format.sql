-- Fix any existing activity_ids that used wrong separator.
-- Format must be: {tag_with_hyphens}_{3-digit-serial} e.g. E-421_001.
-- NULL out ids that don't match so they get regenerated on next save.

UPDATE activities
SET activity_id = NULL
WHERE activity_id IS NOT NULL
  AND activity_id !~ '^[A-Za-z0-9]+-[A-Za-z0-9]+_[0-9]{3}$';

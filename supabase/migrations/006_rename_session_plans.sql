-- Rename existing seeded session plans in live databases.
-- Updating the seed files only affects fresh database setup; this migration fixes
-- rows that were already inserted under older names.

update public.session_plans
set name = 'Postnatal Foundation'
where name = 'Postnatal Recovery — Week 1';

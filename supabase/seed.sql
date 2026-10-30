-- Seed file for NeighbourPulse
-- Creates demo communities, mock users/profiles, incidents, confirmations, and updates

-- Seed Communities
insert into public.communities (id, name, locality, center, boundary)
values 
(
  'a1b2c3d4-0000-0000-0000-000000000001',
  'Oakridge Heights',
  'Green Valley Sector 4',
  ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
  ST_SetSRID(ST_GeomFromText('MULTIPOLYGON(((-122.425 37.770, -122.415 37.770, -122.415 37.780, -122.425 37.780, -122.425 37.770)))'), 4326)
),
(
  'a1b2c3d4-0000-0000-0000-000000000002',
  'Maple Park Estate',
  'Riverside District',
  ST_SetSRID(ST_MakePoint(-122.4080, 37.7850), 4326)::geography,
  null
),
(
  'a1b2c3d4-0000-0000-0000-000000000003',
  'Silverlake Gardens',
  'Central West',
  ST_SetSRID(ST_MakePoint(-122.4350, 37.7620), 4326)::geography,
  null
)
on conflict (id) do nothing;

-- Admin bootstrap instructions:
-- To assign an existing Supabase authenticated user as an administrator:
-- INSERT INTO public.community_members (community_id, user_id, role)
-- VALUES ('a1b2c3d4-0000-0000-0000-000000000001', '<SUPABASE_USER_UUID>', 'admin')
-- ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'admin';


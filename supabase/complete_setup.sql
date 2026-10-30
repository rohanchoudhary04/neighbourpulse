-- =============================================================================
-- NeighbourPulse Complete Database Schema, Extensions, Functions & Seed Data
-- Run this script in the Supabase Dashboard SQL Editor (Project: oeqygslvkafpauvfamca)
-- =============================================================================

-- 1. EXTENSIONS
create extension if not exists postgis;

-- 1b. PRIVATE SCHEMA FOR INTERNAL SECURITY DEFINER HELPERS
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

-- Helper function: Check if current authenticated user belongs to community
create or replace function app_private.is_community_member(p_community_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = (select auth.uid())
  );
$$;

-- Helper function: Check if current authenticated user is an admin of community
create or replace function app_private.is_community_admin(p_community_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.community_members cm
    where cm.community_id = p_community_id
      and cm.user_id = (select auth.uid())
      and cm.role = 'admin'
  );
$$;

revoke all on function app_private.is_community_member(uuid) from public;
grant execute on function app_private.is_community_member(uuid) to authenticated;

revoke all on function app_private.is_community_admin(uuid) from public;
grant execute on function app_private.is_community_admin(uuid) to authenticated;

-- 2. PROFILES TABLE (Linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  created_at timestamptz default now() not null
);

-- 3. COMMUNITIES TABLE
create table if not exists public.communities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  locality text not null,
  center geography(Point, 4326) not null,
  boundary geometry(MultiPolygon, 4326),
  created_at timestamptz default now() not null
);

-- 4. COMMUNITY MEMBERS TABLE
create table if not exists public.community_members (
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('resident', 'admin')) default 'resident',
  created_at timestamptz default now() not null,
  primary key (community_id, user_id)
);

-- 5. INCIDENTS TABLE
create table if not exists public.incidents (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade not null,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('water', 'power', 'road', 'safety', 'garbage', 'animals')),
  title text not null,
  description text not null,
  location geography(Point, 4326) not null,
  location_label text not null,
  photo_url text,
  resolution_note text,
  resolution_photo_url text,
  hide_reporter_name boolean default false not null,
  status text not null check (status in ('open', 'in_progress', 'resolved')) default 'open',
  admin_verified boolean default false not null,
  urgent boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  last_activity_at timestamptz default now() not null,
  resolved_at timestamptz
);

-- 6. INCIDENT PHOTOS TABLE
create table if not exists public.incident_photos (
  id uuid default gen_random_uuid() primary key,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  storage_path text not null,
  kind text not null check (kind in ('report', 'resolution')) default 'report',
  uploaded_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- 7. CONFIRMATIONS TABLE (Unique confirmation per user per incident)
create table if not exists public.confirmations (
  incident_id uuid references public.incidents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (incident_id, user_id)
);

-- 8. INCIDENT UPDATES / TIMELINE AUDIT TABLE
create table if not exists public.incident_updates (
  id uuid default gen_random_uuid() primary key,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  actor_id uuid references auth.users(id),
  update_type text not null check (update_type in ('created', 'status_change', 'admin_verification', 'resolution_note', 'community_confirmed', 'reopened')),
  note text,
  previous_status text,
  new_status text,
  created_at timestamptz default now() not null
);

-- 9. INCIDENT FOLLOWERS TABLE
create table if not exists public.incident_followers (
  incident_id uuid references public.incidents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (incident_id, user_id)
);

-- 10. RESOLUTION FEEDBACK ("Still an issue" reports for admin review)
create table if not exists public.resolution_feedback (
  id uuid default gen_random_uuid() primary key,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  note text not null,
  review_status text not null check (review_status in ('pending', 'reviewed', 'reopened')) default 'pending',
  created_at timestamptz default now() not null
);

-- 11. NOTIFICATIONS TABLE
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
create index if not exists idx_incidents_community_status on public.incidents (community_id, status);
create index if not exists idx_incidents_category on public.incidents (category);
create index if not exists idx_incidents_location on public.incidents using gist (location);
create index if not exists idx_communities_center on public.communities using gist (center);
create index if not exists idx_confirmations_incident on public.confirmations (incident_id);
create index if not exists idx_notifications_user_read on public.notifications (user_id, read_at);
create index if not exists idx_incident_updates_incident on public.incident_updates (incident_id, created_at desc);

-- =============================================================================
-- TRIGGER: Automatically populate profiles when a user signs up
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), 'Resident')
  )
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, profiles.display_name, 'Resident');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing auth.users into public.profiles
insert into public.profiles (id, display_name)
select 
  id, 
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1), 'Resident')
from auth.users
on conflict (id) do update
set display_name = coalesce(profiles.display_name, excluded.display_name, 'Resident');

-- =============================================================================
-- SAFE RESIDENT-FACING VIEW WITH PRIVACY
-- =============================================================================
create or replace view public.incidents_view as
select 
  i.id,
  i.community_id,
  i.category,
  i.title,
  i.description,
  st_y(i.location::geometry) as latitude,
  st_x(i.location::geometry) as longitude,
  i.location_label,
  i.photo_url,
  i.resolution_note,
  i.resolution_photo_url,
  i.status,
  i.admin_verified,
  i.urgent,
  i.hide_reporter_name,
  case 
    when i.hide_reporter_name and (select auth.uid()) <> i.reporter_id and not app_private.is_community_admin(i.community_id) then null
    else i.reporter_id
  end as reporter_id,
  case 
    when i.hide_reporter_name and (select auth.uid()) <> i.reporter_id and not app_private.is_community_admin(i.community_id) then 'Resident'
    else coalesce(p.display_name, 'Resident')
  end as reporter_name,
  i.created_at,
  i.updated_at,
  i.last_activity_at,
  i.resolved_at,
  (select count(*) from public.confirmations c where c.incident_id = i.id) as confirmation_count,
  case 
    when i.admin_verified then 'admin_verified'
    when (select count(*) from public.confirmations c where c.incident_id = i.id) >= 3 then 'community_confirmed'
    else 'unverified'
  end as verification_state,
  exists (
    select 1 from public.confirmations c 
    where c.incident_id = i.id and c.user_id = auth.uid()
  ) as user_has_confirmed,
  exists (
    select 1 from public.incident_followers f 
    where f.incident_id = i.id and f.user_id = auth.uid()
  ) as user_is_following
from public.incidents i
left join public.profiles p on p.id = i.reporter_id;

-- =============================================================================
-- DATABASE FUNCTIONS / RPCs
-- =============================================================================

-- 1. Find duplicate candidates within proximity radius (default 150m)
create or replace function public.find_duplicate_candidates(
  p_community_id uuid,
  p_category text,
  p_lat double precision,
  p_lng double precision,
  p_radius_meters double precision default 150
)
returns table (
  id uuid,
  title text,
  description text,
  category text,
  status text,
  distance_meters double precision,
  confirmation_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
as $$
declare
  point_geog geography;
begin
  point_geog := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;
  
  return query
  select 
    i.id,
    i.title,
    i.description,
    i.category,
    i.status,
    round(ST_Distance(i.location, point_geog)::numeric, 1)::double precision as distance_meters,
    (select count(*) from public.confirmations c where c.incident_id = i.id) as confirmation_count,
    i.created_at
  from public.incidents i
  where i.community_id = p_community_id
    and i.category = p_category
    and i.status in ('open', 'in_progress')
    and i.last_activity_at >= now() - interval '48 hours'
    and ST_DWithin(i.location, point_geog, p_radius_meters)
  order by distance_meters asc
  limit 5;
end;
$$;

-- 2. Calculate Community Health Score: max(0, 100 - (10 * unresolved_verified))
create or replace function public.calculate_health_score(p_community_id uuid)
returns json
language plpgsql
security definer
as $$
declare
  v_open_verified_count integer;
  v_total_verified_count integer;
  v_unverified_open_count integer;
  v_score integer;
  v_label text;
begin
  -- Total verified records ever in community
  select count(*) into v_total_verified_count
  from public.incidents i
  where i.community_id = p_community_id
    and (i.admin_verified = true or (select count(*) from public.confirmations c where c.incident_id = i.id) >= 3);

  -- Unresolved verified incidents (Open or In progress)
  select count(*) into v_open_verified_count
  from public.incidents i
  where i.community_id = p_community_id
    and i.status in ('open', 'in_progress')
    and (i.admin_verified = true or (select count(*) from public.confirmations c where c.incident_id = i.id) >= 3);

  -- Unverified open incidents
  select count(*) into v_unverified_open_count
  from public.incidents i
  where i.community_id = p_community_id
    and i.status in ('open', 'in_progress')
    and not (i.admin_verified = true or (select count(*) from public.confirmations c where c.incident_id = i.id) >= 3);

  if v_total_verified_count = 0 then
    return json_build_object(
      'score', null,
      'label', 'Not enough data',
      'open_verified_count', 0,
      'total_verified_count', 0,
      'unverified_open_count', v_unverified_open_count,
      'has_history', false,
      'message', 'Not enough verified incidents recorded yet to calculate a reliable score.'
    );
  end if;

  v_score := greatest(0, 100 - (10 * v_open_verified_count));

  if v_score >= 80 then
    v_label := 'Good';
  elsif v_score >= 50 then
    v_label := 'Needs attention';
  else
    v_label := 'Critical';
  end if;

  return json_build_object(
    'score', v_score,
    'label', v_label,
    'open_verified_count', v_open_verified_count,
    'total_verified_count', v_total_verified_count,
    'unverified_open_count', v_unverified_open_count,
    'has_history', true,
    'message', case 
      when v_open_verified_count = 0 then 'No unresolved verified issues.'
      else 'Based on unresolved verified reports, not an official safety rating.'
    end
  );
end;
$$;

-- 3. Idempotent confirmation with non-reporter check and threshold notifications
create or replace function public.confirm_incident(
  p_incident_id uuid,
  p_user_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  v_reporter_id uuid;
  v_community_id uuid;
  v_current_count integer;
  v_title text;
begin
  select reporter_id, community_id, title into v_reporter_id, v_community_id, v_title
  from public.incidents where id = p_incident_id;

  if not found then
    raise exception 'Incident not found';
  end if;

  -- Enforce non-reporter confirmation rule
  if v_reporter_id = p_user_id then
    raise exception 'Residents cannot confirm their own incident';
  end if;

  -- Ensure user is a member of the community
  if not exists (select 1 from public.community_members where community_id = v_community_id and user_id = p_user_id) then
    raise exception 'User is not a member of this community';
  end if;

  -- Insert confirmation (idempotent ignore)
  insert into public.confirmations (incident_id, user_id)
  values (p_incident_id, p_user_id)
  on conflict (incident_id, user_id) do nothing;

  -- Also auto-follow the incident to receive status updates
  insert into public.incident_followers (incident_id, user_id)
  values (p_incident_id, p_user_id)
  on conflict (incident_id, user_id) do nothing;

  -- Count total confirmations
  select count(*) into v_current_count
  from public.confirmations where incident_id = p_incident_id;

  -- Check if just reached community-confirmed threshold (3 confirmations)
  if v_current_count = 3 then
    insert into public.incident_updates (incident_id, actor_id, update_type, note)
    values (p_incident_id, p_user_id, 'community_confirmed', 'Corroborated by 3 community residents');

    insert into public.notifications (user_id, incident_id, type, message)
    select 
      f.user_id, 
      p_incident_id, 
      'community_confirmed', 
      'Issue "' || v_title || '" has been corroborated by the community (3+ confirmations).'
    from public.incident_followers f
    where f.user_id <> p_user_id;

    insert into public.notifications (user_id, incident_id, type, message)
    values (
      v_reporter_id, 
      p_incident_id, 
      'community_confirmed', 
      'Your report "' || v_title || '" has reached 3 confirmations and is now Community Confirmed.'
    )
    on conflict do nothing;
  end if;

  update public.incidents
  set last_activity_at = now()
  where id = p_incident_id;

  return json_build_object(
    'success', true,
    'confirmation_count', v_current_count,
    'community_confirmed', v_current_count >= 3
  );
end;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.incidents enable row level security;
alter table public.incident_photos enable row level security;
alter table public.confirmations enable row level security;
alter table public.incident_updates enable row level security;
alter table public.incident_followers enable row level security;
alter table public.resolution_feedback enable row level security;
alter table public.notifications enable row level security;

-- Profiles Policies
create policy "Profiles viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Communities Policies
create policy "Communities viewable by authenticated users"
  on public.communities for select
  to authenticated
  using (true);

-- Community Members Policies
create policy "Residents can read own membership and admins can read all"
  on public.community_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or app_private.is_community_admin(community_members.community_id)
  );

create policy "Users can join as resident or admins can add members"
  on public.community_members for insert
  to authenticated
  with check (
    (user_id = (select auth.uid()) and role = 'resident')
    or app_private.is_community_admin(community_members.community_id)
  );

create policy "Users can update own membership or admins manage members"
  on public.community_members for update
  to authenticated
  using (
    user_id = (select auth.uid())
    or app_private.is_community_admin(community_members.community_id)
  )
  with check (
    (user_id = (select auth.uid()) and role = 'resident')
    or app_private.is_community_admin(community_members.community_id)
  );

create policy "Users can leave community or admins can remove members"
  on public.community_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or app_private.is_community_admin(community_members.community_id)
  );

-- Incidents Policies
create policy "Members can read community incidents"
  on public.incidents for select
  to authenticated
  using (
    app_private.is_community_member(incidents.community_id)
  );

create policy "Residents can report incidents in joined community"
  on public.incidents for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and app_private.is_community_member(incidents.community_id)
  );

create policy "Admins can update incidents"
  on public.incidents for update
  to authenticated
  using (
    app_private.is_community_admin(incidents.community_id)
  )
  with check (
    app_private.is_community_admin(incidents.community_id)
  );

-- Confirmations Policies
create policy "Members can view confirmations"
  on public.confirmations for select
  to authenticated
  using (true);

create policy "Members can confirm incidents"
  on public.confirmations for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.incidents i
      where i.id = confirmations.incident_id
        and i.reporter_id = auth.uid()
    )
  );

-- Incident Updates Policies
create policy "Members can view incident updates"
  on public.incident_updates for select
  to authenticated
  using (true);

create policy "Admins can insert updates"
  on public.incident_updates for insert
  to authenticated
  with check (
    exists (
      select 1 from public.incidents i
      where i.id = incident_updates.incident_id
        and app_private.is_community_admin(i.community_id)
    )
  );

-- Incident Followers Policies
create policy "Users can view and manage their following"
  on public.incident_followers for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Resolution Feedback Policies
create policy "Members can view feedback"
  on public.resolution_feedback for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.incidents i
      where i.id = resolution_feedback.incident_id
        and app_private.is_community_admin(i.community_id)
    )
  );

create policy "Members can submit resolution feedback"
  on public.resolution_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Notifications Policies
create policy "Users can view and manage own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

-- Incident Photos Policies
create policy "Photos viewable by community members"
  on public.incident_photos for select
  to authenticated
  using (true);

create policy "Users can upload incident photos"
  on public.incident_photos for insert
  to authenticated
  with check (auth.uid() = uploaded_by);

-- =============================================================================
-- SEEDED COMMUNITIES (Default Neighbourhoods)
-- =============================================================================
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
on conflict (id) do update 
set name = excluded.name, locality = excluded.locality;


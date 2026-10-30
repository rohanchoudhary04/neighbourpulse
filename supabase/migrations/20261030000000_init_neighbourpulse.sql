-- Migration: Initial NeighbourPulse schema with PostGIS and RLS policies
-- Enable PostGIS extension
create extension if not exists postgis;

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  created_at timestamptz default now() not null
);

-- 2. COMMUNITIES
create table if not exists public.communities (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  locality text not null,
  center geography(Point, 4326) not null,
  boundary geometry(MultiPolygon, 4326),
  created_at timestamptz default now() not null
);

-- 3. COMMUNITY MEMBERS
create table if not exists public.community_members (
  community_id uuid references public.communities(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null check (role in ('resident', 'admin')) default 'resident',
  created_at timestamptz default now() not null,
  primary key (community_id, user_id)
);

-- 4. INCIDENTS
create table if not exists public.incidents (
  id uuid default gen_random_uuid() primary key,
  community_id uuid references public.communities(id) on delete cascade not null,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('water', 'power', 'road', 'safety', 'garbage', 'animals')),
  title text not null,
  description text not null,
  location geography(Point, 4326) not null,
  location_label text not null,
  hide_reporter_name boolean default false not null,
  status text not null check (status in ('open', 'in_progress', 'resolved')) default 'open',
  admin_verified boolean default false not null,
  urgent boolean default false not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  last_activity_at timestamptz default now() not null,
  resolved_at timestamptz
);

-- 5. INCIDENT PHOTOS
create table if not exists public.incident_photos (
  id uuid default gen_random_uuid() primary key,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  storage_path text not null,
  kind text not null check (kind in ('report', 'resolution')) default 'report',
  uploaded_by uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

-- 6. CONFIRMATIONS
create table if not exists public.confirmations (
  incident_id uuid references public.incidents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (incident_id, user_id)
);

-- 7. INCIDENT UPDATES / ACTIVITY TIMELINE
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

-- 8. INCIDENT FOLLOWERS
create table if not exists public.incident_followers (
  incident_id uuid references public.incidents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (incident_id, user_id)
);

-- 9. RESOLUTION FEEDBACK ("Still an issue" reports)
create table if not exists public.resolution_feedback (
  id uuid default gen_random_uuid() primary key,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  note text not null,
  review_status text not null check (review_status in ('pending', 'reviewed', 'reopened')) default 'pending',
  created_at timestamptz default now() not null
);

-- 10. NOTIFICATIONS
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  incident_id uuid references public.incidents(id) on delete cascade not null,
  type text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

-- INDEXES FOR PERFORMANCE
create index if not exists idx_incidents_community_status on public.incidents (community_id, status);
create index if not exists idx_incidents_category on public.incidents (category);
create index if not exists idx_incidents_location on public.incidents using gist (location);
create index if not exists idx_communities_center on public.communities using gist (center);
create index if not exists idx_confirmations_incident on public.confirmations (incident_id);
create index if not exists idx_notifications_user_read on public.notifications (user_id, read_at);
create index if not exists idx_incident_updates_incident on public.incident_updates (incident_id, created_at desc);

-- SAFE RESIDENT-FACING VIEW WITH PRIVACY PROTECTION
-- When hide_reporter_name is true, reporter identity is masked as 'Resident' for non-admin viewers.
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
  i.status,
  i.admin_verified,
  i.urgent,
  i.hide_reporter_name,
  case 
    when i.hide_reporter_name and auth.uid() <> i.reporter_id and not exists (
      select 1 from public.community_members cm 
      where cm.community_id = i.community_id and cm.user_id = auth.uid() and cm.role = 'admin'
    ) then null
    else i.reporter_id
  end as reporter_id,
  case 
    when i.hide_reporter_name and auth.uid() <> i.reporter_id and not exists (
      select 1 from public.community_members cm 
      where cm.community_id = i.community_id and cm.user_id = auth.uid() and cm.role = 'admin'
    ) then 'Resident'
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

-- FUNCTION: Find duplicate candidate incidents within radius meters (default 150m)
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

-- FUNCTION: Calculate Health Score for a community
-- Score = max(0, 100 - 10 * unresolved verified incidents)
-- Verified: admin_verified = true OR confirmation_count >= 3
-- Unresolved: status in ('open', 'in_progress')
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
  -- Total verified records ever in community (to check for "Not enough data")
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

-- FUNCTION: Confirm incident (idempotent, checks non-reporter rule, triggers update at 3 confirmations)
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
    -- Record activity timeline update
    insert into public.incident_updates (incident_id, actor_id, update_type, note)
    values (p_incident_id, p_user_id, 'community_confirmed', 'Corroborated by 3 community residents');

    -- Notify reporter and followers
    insert into public.notifications (user_id, incident_id, type, message)
    select 
      f.user_id, 
      p_incident_id, 
      'community_confirmed', 
      'Issue "' || v_title || '" has been corroborated by the community (3+ confirmations).'
    from public.incident_followers f
    where f.user_id <> p_user_id;

    -- Also notify reporter if not in followers
    insert into public.notifications (user_id, incident_id, type, message)
    values (
      v_reporter_id, 
      p_incident_id, 
      'community_confirmed', 
      'Your report "' || v_title || '" has reached 3 confirmations and is now Community Confirmed.'
    )
    on conflict do nothing;
  end if;

  -- Update incident last_activity_at
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

-- ROW LEVEL SECURITY POLICIES
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

-- Profiles: Anyone authenticated can view; only owner can update
create policy "Profiles viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Communities: Viewable by authenticated users
create policy "Communities viewable by authenticated users"
  on public.communities for select
  to authenticated
  using (true);

-- Community Members:
create policy "Members viewable by community members"
  on public.community_members for select
  to authenticated
  using (
    exists (
      select 1 from public.community_members self_cm
      where self_cm.community_id = community_members.community_id
        and self_cm.user_id = auth.uid()
    )
  );

create policy "Users can join as resident"
  on public.community_members for insert
  to authenticated
  with check (auth.uid() = user_id and role = 'resident');

-- Incidents:
-- Residents can read incidents in their joined communities
create policy "Members can read community incidents"
  on public.incidents for select
  to authenticated
  using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = incidents.community_id
        and cm.user_id = auth.uid()
    )
  );

-- Residents can insert incidents as themselves in their community
create policy "Residents can report incidents in joined community"
  on public.incidents for insert
  to authenticated
  with check (
    auth.uid() = reporter_id
    and exists (
      select 1 from public.community_members cm
      where cm.community_id = incidents.community_id
        and cm.user_id = auth.uid()
    )
  );

-- Admins can update incident status/verification
create policy "Admins can update incidents"
  on public.incidents for update
  to authenticated
  using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = incidents.community_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );

-- Confirmations:
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

-- Incident Updates:
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
      join public.community_members cm on cm.community_id = i.community_id
      where i.id = incident_updates.incident_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );

-- Notifications:
create policy "Users can view and manage own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id);

-- Incident Followers:
create policy "Users can view and manage their following"
  on public.incident_followers for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Resolution Feedback:
create policy "Members can view feedback"
  on public.resolution_feedback for select
  to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.incidents i
      join public.community_members cm on cm.community_id = i.community_id
      where i.id = resolution_feedback.incident_id
        and cm.user_id = auth.uid()
        and cm.role = 'admin'
    )
  );

create policy "Members can submit resolution feedback"
  on public.resolution_feedback for insert
  to authenticated
  with check (auth.uid() = user_id);


-- =============================================================================
-- Migration: Fix RLS Infinite Recursion on community_members and incidents
-- =============================================================================

-- 1. Create private, non-API-exposed schema for internal helper functions
create schema if not exists app_private;

-- Ensure public cannot execute or inspect anything by default in app_private
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

-- Helper function: Check if current authenticated user belongs to community
-- SECURITY DEFINER runs with creator (postgres) privileges, bypassing RLS on community_members.
-- SET search_path = '' prevents search_path hijacking vulnerabilities.
-- Derives current user strictly from auth.uid() - no arbitrary user lookup parameter.
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

-- Restrict execution strictly to authenticated users
revoke all on function app_private.is_community_member(uuid) from public;
grant execute on function app_private.is_community_member(uuid) to authenticated;

revoke all on function app_private.is_community_admin(uuid) from public;
grant execute on function app_private.is_community_admin(uuid) to authenticated;

-- 2. Drop all old/recursive policies on public.community_members
do $$
declare
  pol record;
begin
  for pol in (
    select policyname 
    from pg_policies 
    where schemaname = 'public' and tablename = 'community_members'
  ) loop
    execute format('drop policy if exists %I on public.community_members', pol.policyname);
  end loop;
end;
$$;

-- Re-create clean, non-recursive policies on public.community_members:
-- Policy 1 (SELECT): Residents can read their own membership; Admins can read all members in their community
create policy "Residents can read own membership and admins can read all"
  on public.community_members for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or app_private.is_community_admin(community_members.community_id)
  );

-- Policy 2 (INSERT): Residents can join as 'resident'; Admins can add members
-- Prevents residents from granting themselves admin privileges (role must be 'resident')
create policy "Users can join as resident or admins can add members"
  on public.community_members for insert
  to authenticated
  with check (
    (user_id = (select auth.uid()) and role = 'resident')
    or app_private.is_community_admin(community_members.community_id)
  );

-- Policy 3 (UPDATE): Users can update their own record without elevating role; Admins can manage members
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

-- Policy 4 (DELETE): Users can leave a community; Admins can remove members
create policy "Users can leave community or admins can remove members"
  on public.community_members for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or app_private.is_community_admin(community_members.community_id)
  );

-- 3. Replace policies on public.incidents with non-recursive checks
drop policy if exists "Members can read community incidents" on public.incidents;
drop policy if exists "Residents can report incidents in joined community" on public.incidents;
drop policy if exists "Admins can update incidents" on public.incidents;

-- Incidents SELECT: Only community members can view incidents
create policy "Members can read community incidents"
  on public.incidents for select
  to authenticated
  using (
    app_private.is_community_member(incidents.community_id)
  );

-- Incidents INSERT: Reporter must be auth.uid() and must belong to the community
create policy "Residents can report incidents in joined community"
  on public.incidents for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and app_private.is_community_member(incidents.community_id)
  );

-- Incidents UPDATE: Authorized community admins only
create policy "Admins can update incidents"
  on public.incidents for update
  to authenticated
  using (
    app_private.is_community_admin(incidents.community_id)
  )
  with check (
    app_private.is_community_admin(incidents.community_id)
  );

-- 4. Replace policies on incident_updates and resolution_feedback
drop policy if exists "Admins can insert updates" on public.incident_updates;

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

drop policy if exists "Members can view feedback" on public.resolution_feedback;

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

-- 5. Update incidents_view to use app_private.is_community_admin
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
    when i.hide_reporter_name 
      and (select auth.uid()) <> i.reporter_id 
      and not app_private.is_community_admin(i.community_id) 
    then null
    else i.reporter_id
  end as reporter_id,
  case 
    when i.hide_reporter_name 
      and (select auth.uid()) <> i.reporter_id 
      and not app_private.is_community_admin(i.community_id) 
    then 'Resident'
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
    where c.incident_id = i.id and c.user_id = (select auth.uid())
  ) as user_has_confirmed,
  exists (
    select 1 from public.incident_followers f 
    where f.incident_id = i.id and f.user_id = (select auth.uid())
  ) as user_is_following
from public.incidents i
left join public.profiles p on p.id = i.reporter_id;


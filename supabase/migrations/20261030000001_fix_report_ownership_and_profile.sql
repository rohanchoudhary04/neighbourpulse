-- Migration: Fix Report Ownership, Profiles, and Community Membership
-- 1. Ensure required columns exist on public.incidents
alter table public.incidents 
  add column if not exists photo_url text,
  add column if not exists resolution_note text,
  add column if not exists resolution_photo_url text;

-- 2. Trigger to auto-create profile in public.profiles when user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Resident'))
  on conflict (id) do update
  set display_name = coalesce(excluded.display_name, profiles.display_name, 'Resident');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3. Backfill existing auth.users into public.profiles
insert into public.profiles (id, display_name)
select 
  id, 
  coalesce(raw_user_meta_data->>'display_name', 'Resident')
from auth.users
on conflict (id) do update
set display_name = coalesce(profiles.display_name, excluded.display_name, 'Resident');

-- 4. Update incidents_view to include photo_url, resolution_note, resolution_photo_url
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

-- 5. Row Level Security: Enforce strict auth.uid() = reporter_id on insert
alter table public.incidents enable row level security;

drop policy if exists "Residents can report incidents in joined community" on public.incidents;
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

-- 6. Ensure users can join/upsert community_members
drop policy if exists "Users can join as resident" on public.community_members;
create policy "Users can join as resident"
  on public.community_members for insert
  to authenticated
  with check (auth.uid() = user_id and role = 'resident');

-- 7. Ensure users can insert/update their own profile
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 8. Ensure incident_followers can be inserted by authenticated user for themselves
drop policy if exists "Users can view and manage their following" on public.incident_followers;
create policy "Users can view and manage their following"
  on public.incident_followers for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


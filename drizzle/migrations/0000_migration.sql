-- Roles
create type public.app_role as enum ('student', 'supervisor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Student',
  student_number text not null unique,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "Own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());
create policy "Own profile readable" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(), 'supervisor'));
create policy "Own profile updatable" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Campus settings (single row)
create table public.campus_settings (
  id int primary key default 1 check (id = 1),
  open_time time not null default '06:00',
  close_time time not null default '23:00',
  timezone text not null default 'America/New_York',
  near_capacity_pct int not null default 80
);
grant select, update on public.campus_settings to authenticated;
grant all on public.campus_settings to service_role;
alter table public.campus_settings enable row level security;
create policy "Settings readable" on public.campus_settings for select to authenticated using (true);
create policy "Supervisors update settings" on public.campus_settings for update to authenticated using (public.has_role(auth.uid(), 'supervisor'));
insert into public.campus_settings (id) values (1);

-- Buildings
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag_code text not null unique,
  capacity int not null default 100 check (capacity > 0),
  occupancy int not null default 0 check (occupancy >= 0),
  restricted boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.buildings to authenticated;
grant all on public.buildings to service_role;
alter table public.buildings enable row level security;
create policy "Buildings readable" on public.buildings for select to authenticated using (true);
create policy "Supervisors update buildings" on public.buildings for update to authenticated using (public.has_role(auth.uid(), 'supervisor'));

create table public.building_access (
  building_id uuid not null references public.buildings(id) on delete cascade,
  user_id uuid not null,
  primary key (building_id, user_id)
);
grant select, insert, delete on public.building_access to authenticated;
grant all on public.building_access to service_role;
alter table public.building_access enable row level security;
create policy "Access readable" on public.building_access for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'supervisor'));
create policy "Supervisors grant access" on public.building_access for insert to authenticated with check (public.has_role(auth.uid(), 'supervisor'));
create policy "Supervisors revoke access" on public.building_access for delete to authenticated using (public.has_role(auth.uid(), 'supervisor'));

-- Tap log
create table public.access_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  building_id uuid references public.buildings(id) on delete set null,
  building_name text not null,
  student_name text not null,
  student_number text not null,
  direction text not null check (direction in ('in','out')),
  granted boolean not null,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.access_logs (created_at desc);
create index on public.access_logs (user_id, building_id, created_at desc);
grant select on public.access_logs to authenticated;
grant all on public.access_logs to service_role;
alter table public.access_logs enable row level security;
create policy "Logs readable" on public.access_logs for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'supervisor'));

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Own notifications update" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "Own notifications delete" on public.notifications for delete to authenticated using (user_id = auth.uid());

-- Classes (per student)
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  code text not null,
  title text not null,
  room text not null default '',
  days int[] not null default '{}', -- 0=Sun..6=Sat
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.classes to authenticated;
grant all on public.classes to service_role;
alter table public.classes enable row level security;
create policy "Own classes" on public.classes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Campus events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null default '',
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;
create policy "Events readable" on public.events for select to authenticated using (true);
create policy "Supervisors add events" on public.events for insert to authenticated with check (public.has_role(auth.uid(), 'supervisor'));
create policy "Supervisors delete events" on public.events for delete to authenticated using (public.has_role(auth.uid(), 'supervisor'));

-- New user: profile + roles (first user becomes supervisor too), starter classes
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare is_first boolean;
begin
  select not exists (select 1 from public.profiles) into is_first;
  insert into public.profiles (id, full_name, student_number)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name',''), nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
    'CC' || lpad((floor(random()*10000000))::int::text, 7, '0'));
  insert into public.user_roles (user_id, role) values (new.id, 'student');
  if is_first then insert into public.user_roles (user_id, role) values (new.id, 'supervisor'); end if;
  insert into public.classes (user_id, code, title, room, days, start_time, end_time) values
    (new.id, 'BIO 101', 'Intro to Biology', 'Science Hall 204', '{1,3,5}', '09:00', '09:50'),
    (new.id, 'ENG 210', 'Modern Literature', 'Library 3B', '{2,4}', '11:00', '12:15'),
    (new.id, 'MAT 150', 'Calculus I', 'Engineering 110', '{1,3}', '13:30', '14:45');
  insert into public.notifications (user_id, title, body) values
    (new.id, 'Welcome to Campus Connect', 'Tap your phone on a building''s NFC tag to check in.');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Tap: validate & record
create or replace function public.tap_building(_tag text)
returns json language plpgsql security definer set search_path = public as $$
declare
  b public.buildings; s public.campus_settings; p public.profiles;
  uid uuid := auth.uid(); local_t time; last_dir text; reason text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into p from public.profiles where id = uid;
  select * into b from public.buildings where tag_code = _tag for update;
  if not found then return json_build_object('granted', false, 'reason', 'Unknown tag'); end if;
  select * into s from public.campus_settings where id = 1;

  select direction into last_dir from public.access_logs
    where user_id = uid and building_id = b.id and granted order by created_at desc limit 1;

  if last_dir = 'in' then
    update public.buildings set occupancy = greatest(occupancy - 1, 0) where id = b.id;
    insert into public.access_logs (user_id, building_id, building_name, student_name, student_number, direction, granted)
      values (uid, b.id, b.name, p.full_name, p.student_number, 'out', true);
    return json_build_object('granted', true, 'direction', 'out', 'building', b.name, 'at', now(), 'name', p.full_name);
  end if;

  local_t := (now() at time zone s.timezone)::time;
  if b.restricted and not exists (select 1 from public.building_access where building_id = b.id and user_id = uid) then
    reason := 'No access';
  elsif local_t < s.open_time or local_t >= s.close_time then
    reason := 'After hours';
  elsif b.occupancy >= b.capacity then
    reason := 'At capacity';
  end if;

  if reason is not null then
    insert into public.access_logs (user_id, building_id, building_name, student_name, student_number, direction, granted, reason)
      values (uid, b.id, b.name, p.full_name, p.student_number, 'in', false, reason);
    insert into public.notifications (user_id, title, body)
      values (uid, 'Access denied: ' || b.name, reason);
    return json_build_object('granted', false, 'reason', reason, 'building', b.name, 'at', now());
  end if;

  update public.buildings set occupancy = occupancy + 1 where id = b.id;
  insert into public.access_logs (user_id, building_id, building_name, student_name, student_number, direction, granted)
    values (uid, b.id, b.name, p.full_name, p.student_number, 'in', true);
  return json_build_object('granted', true, 'direction', 'in', 'building', b.name, 'at', now(), 'name', p.full_name);
end; $$;
revoke execute on function public.tap_building(text) from anon, public;
grant execute on function public.tap_building(text) to authenticated;

-- Seed buildings & events
insert into public.buildings (name, tag_code, capacity, occupancy, restricted) values
  ('Main Library', 'LIB-01', 300, 241, false),
  ('Science Hall', 'SCI-01', 200, 88, false),
  ('Recreation Center', 'REC-01', 150, 139, false),
  ('Engineering Building', 'ENG-01', 180, 64, false),
  ('Research Lab', 'LAB-01', 40, 12, true);

insert into public.events (title, location, starts_at) values
  ('Career Fair', 'Recreation Center', now() + interval '2 days'),
  ('Midterm Review Session', 'Main Library', now() + interval '4 days'),
  ('Club Night', 'Student Union', now() + interval '7 days');

alter publication supabase_realtime add table public.buildings;
create table public.tutors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  location text not null default '',
  bio text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.tutors to authenticated;
grant all on public.tutors to service_role;
alter table public.tutors enable row level security;
create policy "Tutors readable" on public.tutors for select to authenticated using (true);

create table public.tutor_bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  tutor_id uuid not null references public.tutors(id) on delete cascade,
  starts_at timestamptz not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (tutor_id, starts_at)
);
grant select, insert, delete on public.tutor_bookings to authenticated;
grant all on public.tutor_bookings to service_role;
alter table public.tutor_bookings enable row level security;
create policy "Own bookings readable" on public.tutor_bookings for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'supervisor'));
create policy "Book for self" on public.tutor_bookings for insert to authenticated with check (user_id = auth.uid());
create policy "Cancel own" on public.tutor_bookings for delete to authenticated using (user_id = auth.uid());

-- Lets students see which slots are taken without seeing who booked them
create or replace function public.tutor_taken_slots(_tutor uuid, _from timestamptz, _to timestamptz)
returns setof timestamptz language sql stable security definer set search_path = public as $$
  select starts_at from public.tutor_bookings where tutor_id = _tutor and starts_at >= _from and starts_at < _to
$$;
revoke execute on function public.tutor_taken_slots(uuid, timestamptz, timestamptz) from anon, public;
grant execute on function public.tutor_taken_slots(uuid, timestamptz, timestamptz) to authenticated;
-- Called numbers for the current game
create table if not exists called_numbers (
  id bigint generated always as identity primary key,
  number integer not null unique,
  created_at timestamptz default now()
);

-- Players who have registered
create table if not exists players (
  id bigint generated always as identity primary key,
  name text not null,
  name_lower text not null unique,  -- lowercase for dedup
  stamps integer[] default '{}',
  created_at timestamptz default now()
);

-- Winners
create table if not exists winners (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz default now()
);

-- Global theme (single row, id=1)
create table if not exists theme (
  id integer primary key default 1,
  bg_color text default '#1a1a2e',
  card_color text default '#16213e',
  stamp_color text default '#e94560',
  header_color text default '#0f3460',
  text_color text default '#ffffff',
  accent_color text default '#e94560'
);
insert into theme (id) values (1) on conflict do nothing;

-- Stamp reset version (single row, id=1)
create table if not exists stamp_resets (
  id integer primary key default 1,
  version integer default 0
);
insert into stamp_resets (id) values (1) on conflict do nothing;

-- Enable Row Level Security (RLS) - allow all for anon since this is a fun game app
alter table called_numbers enable row level security;
alter table players enable row level security;
alter table winners enable row level security;
alter table theme enable row level security;
alter table stamp_resets enable row level security;

-- Allow full access for anon key
create policy "allow all" on called_numbers for all to anon using (true) with check (true);
create policy "allow all" on players for all to anon using (true) with check (true);
create policy "allow all" on winners for all to anon using (true) with check (true);
create policy "allow all" on theme for all to anon using (true) with check (true);
create policy "allow all" on stamp_resets for all to anon using (true) with check (true);

-- Enable realtime for all tables
alter publication supabase_realtime add table called_numbers;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table winners;
alter publication supabase_realtime add table theme;
alter publication supabase_realtime add table stamp_resets;

-- Fix RLS policies to ensure anon can read all players
-- Drop existing policies and recreate them explicitly
-- Run this in the Supabase SQL Editor if the player list shows "No players yet"
-- or if you see RLS-related errors in the admin panel.

-- Players table
drop policy if exists "allow all" on players;
create policy "anon_select" on players for select to anon using (true);
create policy "anon_insert" on players for insert to anon with check (true);
create policy "anon_update" on players for update to anon using (true) with check (true);
create policy "anon_delete" on players for delete to anon using (true);

-- Also grant explicit permissions to anon role
grant select, insert, update, delete on players to anon;
grant select, insert, update, delete on winners to anon;
grant select, insert, update, delete on called_numbers to anon;
grant select, insert, update, delete on theme to anon;
grant select, insert, update, delete on stamp_resets to anon;
grant select, insert, update, delete on game_settings to anon;

-- Grant sequence usage for identity columns
grant usage, select on all sequences in schema public to anon;

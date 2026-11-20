-- Survivalmon ranking (src/systems/ranking.js): the online table every player reads, and the two
-- functions that are the only way to write it. Run once in the Supabase project (SQL editor or a
-- migration). Safe to run again.
--
-- Each save has a random id and secret (kept in that phone's storage). The table keeps only a hash of
-- the secret, which nobody can read; a row can be changed or deleted only by the save that made it.

create table if not exists public.ranking (
  id          text primary key check (char_length(id) between 8 and 40),
  secret_hash text not null,
  name        text not null default 'Ranger',
  hero        text not null default '',
  top_gate    int  not null default 0,   -- the newest gate opened (0 = only the North Gate)
  best_level  int  not null default 0,   -- the highest level reached in a run
  best_kills  int  not null default 0,   -- the most kills in one run
  dex         int  not null default 0,   -- Survidex: survivalmons found
  lord_wins   int  not null default 0,   -- times the Night Lord was beaten
  strongest   jsonb,                     -- the strongest survivalmon: species, nickname, level, stars, skills, stats
  power       int  not null default 0,   -- its Power (monPower in collection.js)
  version     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.ranking enable row level security;

-- Everyone may read the ranking (never the secret hashes); nobody writes the table directly
revoke all on table public.ranking from anon, authenticated;
grant select (id, name, hero, top_gate, best_level, best_kills, dex, lord_wins, strongest, power, version, updated_at)
  on public.ranking to anon, authenticated;
drop policy if exists "Anyone can read the ranking" on public.ranking;
create policy "Anyone can read the ranking" on public.ranking for select to anon, authenticated using (true);

-- A save sends its row: added the first time, updated afterwards only with the same secret.
-- Names are cleaned and every number is kept in a sensible range.
create or replace function public.submit_rank(
  p_id text, p_secret text, p_name text, p_hero text, p_top_gate int, p_best_level int, p_best_kills int,
  p_dex int, p_lord_wins int, p_strongest jsonb, p_power int, p_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text := encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex');
  n text := left(btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[<>"&]', '', 'g'), '\s+', ' ', 'g')), 14);
  s jsonb := case when p_strongest is not null and jsonb_typeof(p_strongest) = 'object' and octet_length(p_strongest::text) <= 2000 then p_strongest end;
begin
  if p_id is null or char_length(p_id) not between 8 and 40 or char_length(coalesce(p_secret, '')) < 16 then
    raise exception 'bad id';
  end if;
  if n = '' then n := 'Ranger'; end if;
  insert into public.ranking as r (id, secret_hash, name, hero, top_gate, best_level, best_kills, dex, lord_wins, strongest, power, version)
  values (p_id, h, n, left(coalesce(p_hero, ''), 20),
          least(greatest(coalesce(p_top_gate, 0), 0), 10000), least(greatest(coalesce(p_best_level, 0), 0), 10000),
          least(greatest(coalesce(p_best_kills, 0), 0), 100000000), least(greatest(coalesce(p_dex, 0), 0), 10000),
          least(greatest(coalesce(p_lord_wins, 0), 0), 1000000), s,
          case when s is null then 0 else least(greatest(coalesce(p_power, 0), 0), 100000000) end,
          left(coalesce(p_version, ''), 12))
  on conflict (id) do update set
    name = excluded.name, hero = excluded.hero, top_gate = excluded.top_gate, best_level = excluded.best_level,
    best_kills = excluded.best_kills, dex = excluded.dex, lord_wins = excluded.lord_wins, strongest = excluded.strongest,
    power = excluded.power, version = excluded.version, updated_at = now()
  where r.secret_hash = excluded.secret_hash;
end;
$$;

-- A save leaves the ranking (Hide me, or the save is erased or deleted)
create or replace function public.leave_rank(p_id text, p_secret text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.ranking
  where id = p_id and secret_hash = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex');
$$;

revoke all on function public.submit_rank(text, text, text, text, int, int, int, int, int, jsonb, int, text) from public;
revoke all on function public.leave_rank(text, text) from public;
grant execute on function public.submit_rank(text, text, text, text, int, int, int, int, int, jsonb, int, text) to anon, authenticated;
grant execute on function public.leave_rank(text, text) to anon, authenticated;

-- Politician profiles (from Wikipedia), candidate → person links, and Anyanwụ model runs.

create table public.people (
  id text primary key,
  name text not null,
  wiki_title text not null,
  summary text not null default '',
  born text,            -- ISO date (or year) as given by Wikipedia
  died text,
  birth_place text,
  birth_state text references public.states (code),
  gender text check (gender in ('male', 'female')),
  party text,           -- current party per Wikipedia
  education text,
  occupation text,
  offices jsonb not null default '[]'::jsonb,  -- [{title, term}]
  source_key text references public.sources (key)
);
comment on table public.people is 'Politician profiles from Wikipedia (CC BY-SA 4.0); source_key gives the exact revision.';

alter table public.results add column person_id text references public.people (id);
create index results_person on public.results (person_id);

create table public.model_runs (
  id bigint generated always as identity primary key,
  model text not null,
  version text not null,
  generated_at timestamptz not null,
  published_at timestamptz not null default now(),
  payload jsonb not null
);
create index model_runs_latest on public.model_runs (model, published_at desc);
comment on table public.model_runs is 'Anyanwụ forecasts and backtests; the site reads the latest run.';

alter table public.people enable row level security;
alter table public.model_runs enable row level security;
create policy "public read" on public.people for select to anon, authenticated using (true);
create policy "public read" on public.model_runs for select to anon, authenticated using (true);

-- Reload now also replaces people and links results to them
create or replace function public.neli_reload(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare counts jsonb;
begin
  truncate public.results, public.area_totals, public.registered_voters, public.elections,
           public.people, public.parties, public.sources, public.states, public.zones restart identity cascade;

  insert into public.zones select * from jsonb_populate_recordset(null::public.zones, payload->'zones');
  insert into public.states select * from jsonb_populate_recordset(null::public.states, payload->'states');
  insert into public.parties select * from jsonb_populate_recordset(null::public.parties, payload->'parties');
  insert into public.sources select * from jsonb_populate_recordset(null::public.sources, payload->'sources');
  insert into public.people select * from jsonb_populate_recordset(null::public.people, payload->'people');
  insert into public.elections select * from jsonb_populate_recordset(null::public.elections, payload->'elections');
  insert into public.results (election_id, area_type, area_code, candidate, party, party_label, votes, source_key, person_id)
    select election_id, area_type, area_code, candidate, party, party_label, votes, source_key, person_id
    from jsonb_populate_recordset(null::public.results, payload->'results');
  insert into public.area_totals select * from jsonb_populate_recordset(null::public.area_totals, payload->'area_totals');
  insert into public.registered_voters select * from jsonb_populate_recordset(null::public.registered_voters, payload->'registered_voters');

  select jsonb_build_object(
    'zones', (select count(*) from public.zones),
    'states', (select count(*) from public.states),
    'parties', (select count(*) from public.parties),
    'sources', (select count(*) from public.sources),
    'people', (select count(*) from public.people),
    'elections', (select count(*) from public.elections),
    'results', (select count(*) from public.results),
    'linked_results', (select count(*) from public.results where person_id is not null),
    'area_totals', (select count(*) from public.area_totals),
    'registered_voters', (select count(*) from public.registered_voters)
  ) into counts;
  return counts;
end $$;

revoke all on function public.neli_reload(jsonb) from public, anon, authenticated;
grant execute on function public.neli_reload(jsonb) to service_role;

-- Publish an Anyanwụ run (kept as history; the site reads the newest)
create or replace function public.anyanwu_publish(payload jsonb)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare new_id bigint;
begin
  insert into public.model_runs (model, version, generated_at, payload)
  values (payload->>'model', payload->>'version', (payload->>'generated_at')::timestamptz, payload)
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.anyanwu_publish(jsonb) from public, anon, authenticated;
grant execute on function public.anyanwu_publish(jsonb) to service_role;

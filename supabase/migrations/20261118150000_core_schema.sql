-- NELI core schema: reference data, elections, results, registers, provenance.
-- Public data, read-only to the world: RLS on every table with a SELECT-only policy.
-- Writes happen only through migrations / the service role (pipeline), never the browser.

create table public.zones (
  code text primary key check (code in ('NW','NE','NC','SW','SE','SS')),
  name text not null
);

create table public.states (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null unique,
  zone text not null references public.zones(code)
);

create table public.parties (
  code text primary key,
  name text,
  lineage text not null default 'OTHER'   -- party family for continuity across mergers (e.g. ANPP -> APC)
);

create table public.sources (
  key text primary key,                     -- e.g. wikipedia:presidential:2023
  title text not null,
  url text not null,                        -- includes the exact revision (oldid)
  revision text,
  retrieved_at timestamptz not null,
  sha256 text not null,
  license text not null
);

create type public.election_type as enum ('presidential', 'governorship');
create type public.coverage as enum ('all candidates', 'top candidates only', 'winner only');

create table public.elections (
  id text primary key,                      -- pres-2023, gov-la-2023
  type public.election_type not null,
  year smallint not null check (year between 1999 and 2100),
  state_code text references public.states(code),   -- null for presidential
  off_cycle boolean not null default false,
  coverage public.coverage not null default 'all candidates',
  registered bigint check (registered >= 0),
  valid_votes bigint check (valid_votes >= 0),
  rejected_votes bigint check (rejected_votes >= 0),
  total_votes bigint check (total_votes >= 0),
  sum_check numeric,                        -- (candidate sum - stated total) / stated total
  source_key text references public.sources(key),
  check ((type = 'presidential') = (state_code is null))
);
create index elections_type_year on public.elections (type, year);
create index elections_state on public.elections (state_code);

-- One row per election x area x candidate. Presidential: area = each state.
-- Governorship: area = the whole state (LGA rows can be added later with area_type 'lga').
create table public.results (
  id bigint generated always as identity primary key,
  election_id text not null references public.elections(id) on delete cascade,
  area_type text not null check (area_type in ('state', 'lga')),
  area_code text not null,
  candidate text not null default '',
  party text not null references public.parties(code),
  party_label text,                          -- party as printed in the source
  votes bigint not null check (votes >= 0),
  source_key text references public.sources(key)
);
create index results_election on public.results (election_id);
create index results_area on public.results (area_type, area_code);
create index results_party on public.results (party);

-- Per-area totals where the source gives them (e.g. presidential valid votes by state).
create table public.area_totals (
  election_id text not null references public.elections(id) on delete cascade,
  area_type text not null check (area_type in ('state', 'lga')),
  area_code text not null,
  valid_votes bigint, rejected_votes bigint, total_votes bigint, registered bigint,
  primary key (election_id, area_type, area_code)
);

create table public.registered_voters (
  year smallint not null,
  state_code text references public.states(code),   -- null = national total
  registered bigint not null check (registered >= 0),
  note text not null default '',
  source_key text references public.sources(key),
  unique nulls not distinct (year, state_code)
);

-- Public read-only access
do $$
declare t text;
begin
  foreach t in array array['zones','states','parties','sources','elections','results','area_totals','registered_voters'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- Convenience view: candidate totals per election with shares (only where shares are meaningful)
create view public.election_tallies with (security_invoker = true) as
select r.election_id, e.type, e.year, e.state_code, e.coverage, r.candidate, r.party, p.lineage,
       sum(r.votes) as votes,
       case when e.coverage = 'winner only' then null
            else sum(r.votes)::numeric / nullif(coalesce(e.valid_votes, sum(sum(r.votes)) over (partition by r.election_id)), 0)
       end as share
from public.results r
join public.elections e on e.id = r.election_id
join public.parties p on p.code = r.party
group by r.election_id, e.type, e.year, e.state_code, e.coverage, e.valid_votes, r.candidate, r.party, p.lineage;

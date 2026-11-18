-- Atomic reload of all public data from one JSON payload (used by the Python pipeline).
-- Only the service role may call it; anon/authenticated cannot.
create or replace function public.neli_reload(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare counts jsonb;
begin
  truncate public.results, public.area_totals, public.registered_voters, public.elections,
           public.parties, public.sources, public.states, public.zones restart identity cascade;

  insert into public.zones select * from jsonb_populate_recordset(null::public.zones, payload->'zones');
  insert into public.states select * from jsonb_populate_recordset(null::public.states, payload->'states');
  insert into public.parties select * from jsonb_populate_recordset(null::public.parties, payload->'parties');
  insert into public.sources select * from jsonb_populate_recordset(null::public.sources, payload->'sources');
  insert into public.elections select * from jsonb_populate_recordset(null::public.elections, payload->'elections');
  insert into public.results (election_id, area_type, area_code, candidate, party, party_label, votes, source_key)
    select election_id, area_type, area_code, candidate, party, party_label, votes, source_key
    from jsonb_populate_recordset(null::public.results, payload->'results');
  insert into public.area_totals select * from jsonb_populate_recordset(null::public.area_totals, payload->'area_totals');
  insert into public.registered_voters select * from jsonb_populate_recordset(null::public.registered_voters, payload->'registered_voters');

  select jsonb_build_object(
    'zones', (select count(*) from public.zones),
    'states', (select count(*) from public.states),
    'parties', (select count(*) from public.parties),
    'sources', (select count(*) from public.sources),
    'elections', (select count(*) from public.elections),
    'results', (select count(*) from public.results),
    'area_totals', (select count(*) from public.area_totals),
    'registered_voters', (select count(*) from public.registered_voters)
  ) into counts;
  return counts;
end $$;

revoke all on function public.neli_reload(jsonb) from public, anon, authenticated;
grant execute on function public.neli_reload(jsonb) to service_role;

-- Senate and House of Representatives races, and LGA-level rows.
alter type public.election_type add value if not exists 'senate';
alter type public.election_type add value if not exists 'reps';

alter table public.elections add column if not exists constituency text;  -- senatorial district / federal constituency
alter table public.elections add column if not exists conflict boolean not null default false;  -- source figures contradict its declared winner
comment on column public.elections.conflict is 'True when the source''s vote figures disagree with the winner it declares; the declared winner is kept.';
create index if not exists elections_state on public.elections (state_code, type, year);

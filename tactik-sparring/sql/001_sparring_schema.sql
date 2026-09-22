-- TACTIK Live Sparring — schema
--
-- Extends the existing TACTIK tables (personas, sessions, persona_dna_cache)
-- rather than replacing them. Sparring sessions are a new session_mode, not a
-- new product database.
--
-- Design commitments carried over from the v5 execution freeze:
--   * Ledger rows are written IN-TURN, never synthesised after the call.
--   * Every scored row carries a verbatim quote or it is not admissible.
--   * Every row is pinned to a compilation_hash, so a dossier can always be
--     re-derived against the exact persona build that produced it.

-- ---------------------------------------------------------------------------
-- Compiled persona builds
-- ---------------------------------------------------------------------------

create table if not exists sparring_persona_builds (
  compilation_hash    text primary key,
  persona_id          uuid not null references personas(id) on delete cascade,
  genome_hash         text not null,
  dna_version         integer not null,

  -- What left the building. Safe to inspect; contains no reservation values.
  phenotype           jsonb not null,

  -- What stayed home. The trainee must never be able to read this.
  arbiter_genome      jsonb not null,

  tavus_pal_id        text,
  tavus_objectives_id text,
  tavus_guardrail_ids text[] not null default '{}',

  -- Likeness clearance for real-person DNA. Without it the build renders as an
  -- archetype: same behaviour, no name, stock face.
  likeness_cleared    boolean not null default false,
  face_id             text not null,

  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id)
);

create index if not exists idx_builds_persona on sparring_persona_builds(persona_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

do $$ begin
  create type sparring_mode as enum ('text_rehearsal', 'live_video');
exception when duplicate_object then null; end $$;

do $$ begin
  create type sparring_status as enum ('pending', 'live', 'completed', 'aborted', 'expired');
exception when duplicate_object then null; end $$;

create table if not exists sparring_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  persona_id          uuid not null references personas(id),
  compilation_hash    text not null references sparring_persona_builds(compilation_hash),

  mode                sparring_mode not null default 'text_rehearsal',
  status              sparring_status not null default 'pending',
  scenario            text not null,

  -- The trainee's OWN mandate. Required: without a declared floor there is
  -- nothing to score Red-Line Integrity against, and the debrief is opinion.
  human_mandate       jsonb not null,

  tavus_conversation_id text,
  daily_room_url        text,

  -- Cost control. Human-vs-AI bills think-time, so the cap is not advisory.
  max_duration_sec    integer not null default 900,
  started_at          timestamptz,
  ended_at            timestamptz,
  billed_seconds      integer,
  estimated_cost_usd  numeric(10,4),

  created_at          timestamptz not null default now(),

  constraint sparring_duration_cap check (max_duration_sec between 60 and 3600)
);

create index if not exists idx_spar_user on sparring_sessions(user_id, created_at desc);
create index if not exists idx_spar_live on sparring_sessions(status) where status = 'live';
create unique index if not exists idx_spar_conv on sparring_sessions(tavus_conversation_id)
  where tavus_conversation_id is not null;

-- ---------------------------------------------------------------------------
-- The ledger
-- ---------------------------------------------------------------------------

do $$ begin
  create type ledger_event_kind as enum (
    'utterance', 'offer', 'concession', 'red_line_contact',
    'red_line_breach', 'objective_complete', 'interrupt', 'steering'
  );
exception when duplicate_object then null; end $$;

create table if not exists sparring_ledger (
  id                    bigserial primary key,
  session_id            uuid not null references sparring_sessions(id) on delete cascade,

  turn_idx              integer not null,
  seq                   integer not null,
  event_time            timestamptz not null,

  kind                  ledger_event_kind not null,
  actor                 text not null check (actor in ('human', 'pal', 'tactik')),

  -- Verbatim evidence. A scored row without a quote is inadmissible.
  quote                 text,

  variable              text,
  value                 numeric(14,4),
  delta_to_reservation  numeric(14,4),

  compilation_hash      text not null,
  meta                  jsonb not null default '{}',

  created_at            timestamptz not null default now(),

  -- Enforces the evidence rule at the storage layer, not in application code.
  constraint scored_rows_need_evidence check (
    kind not in ('offer', 'concession', 'red_line_contact', 'red_line_breach')
    or quote is not null
    or meta ? 'source'
  )
);

create index if not exists idx_ledger_session on sparring_ledger(session_id, turn_idx, seq);
create index if not exists idx_ledger_kind on sparring_ledger(session_id, kind);
-- Idempotency: Tavus may redeliver a webhook. Same event, same row.
create unique index if not exists idx_ledger_dedupe
  on sparring_ledger(session_id, turn_idx, seq, kind, actor, coalesce(variable, ''), coalesce(value, 0));

-- ---------------------------------------------------------------------------
-- Debriefs
-- ---------------------------------------------------------------------------

create table if not exists sparring_debriefs (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null unique references sparring_sessions(id) on delete cascade,

  composite           integer not null check (composite between 0 and 100),
  axes                jsonb not null,
  leverage_trajectory jsonb not null,
  concession_curves   jsonb not null,
  red_line_status     jsonb not null,
  interventions       jsonb not null,

  -- Populated only when a shadow AI-vs-AI run was executed for comparison.
  shadow_delta        jsonb,
  shadow_session_id   uuid references sessions(id),

  -- Scores the BUILD, never folded into the trainee's composite.
  build_adherence     integer not null check (build_adherence between 0 and 100),
  rendering_faults    integer not null default 0,

  compilation_hash    text not null,
  genome_hash         text not null,
  recording_url       text,
  generated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Longitudinal view: the reason enterprises buy seats instead of projects
-- ---------------------------------------------------------------------------

create or replace view sparring_progression as
select
  s.user_id,
  s.persona_id,
  s.mode,
  d.generated_at,
  d.composite,
  (axis->>'key')    as axis_key,
  (axis->>'score')::int as axis_score,
  d.rendering_faults,
  d.build_adherence
from sparring_debriefs d
join sparring_sessions s on s.id = d.session_id
cross join lateral jsonb_array_elements(d.axes) as axis
-- Only builds that tracked their DNA produce comparable scores.
where d.build_adherence >= 70;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table sparring_sessions enable row level security;
alter table sparring_ledger   enable row level security;
alter table sparring_debriefs enable row level security;
alter table sparring_persona_builds enable row level security;

create policy spar_own_sessions on sparring_sessions
  for all using (auth.uid() = user_id);

create policy spar_own_ledger on sparring_ledger
  for select using (
    exists (select 1 from sparring_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

create policy spar_own_debriefs on sparring_debriefs
  for select using (
    exists (select 1 from sparring_sessions s where s.id = session_id and s.user_id = auth.uid())
  );

-- Builds are readable (the phenotype is safe) but arbiter_genome must never be
-- exposed to a client. Serve builds through a view that drops that column.
create policy spar_read_builds on sparring_persona_builds
  for select using (true);

create or replace view sparring_persona_builds_public as
select compilation_hash, persona_id, genome_hash, dna_version, phenotype,
       tavus_pal_id, likeness_cleared, face_id, created_at
from sparring_persona_builds;

comment on column sparring_persona_builds.arbiter_genome is
  'Reservation thresholds and expected concession curves. NEVER expose to a client: a trainee who reads this can read the counterparty''s walk-away number.';

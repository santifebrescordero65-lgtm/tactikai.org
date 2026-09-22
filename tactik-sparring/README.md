# TACTIK Live Sparring
### Human vs. DNA-charged replica, adjudicated and debriefed by TACTIK

**Status:** architecture + reference implementation. Not yet wired to a live Tavus account.

---

## 1. What this is

The debate engine in the v5 freeze runs **AI vs. AI** with the executive as spectator.
Sparring inverts it: the executive **becomes the counterparty**.

A Tavus PAL is charged with a TACTIK Cognitive DNA — a specific, quantified, hard
negotiator drawn from the persona library. The human negotiates against it live, on
video, in real time. TACTIK never speaks for either side. It watches, adjudicates
in-turn, and produces the debrief.

| | Observation mode (v5) | Sparring mode (this) |
|---|---|---|
| Participants | PAL vs. PAL | **Human vs. PAL** |
| Executive role | Spectator | **Counterparty** |
| TACTIK owns | Turn generation | **Turn adjudication** |
| Deliverable | Intelligence dossier on a deal | **Performance dossier on a person** |
| Sold as | Project | **Seat** |
| Revenue shape | Episodic | **Recurring** |

The last two rows are the commercial reason to build it. Observation is episodic:
one deal, one simulation, one invoice. Sparring is habitual: reps, cohorts,
certification, a score that has to improve. That converts TACTIK from an
intelligence vendor into training infrastructure, which is the difference between
being bought once and being renewed.

---

## 2. The one hard architectural problem, and its resolution

The v5 freeze mandated **sovereignty of the TACTIK scheduler**: TACTIK determines
turns, interruptions and pauses; conversational control is never delegated to the
video vendor.

In human-vs-AI that mandate, read literally, is unbuildable. A human interrupts in
real time. Routing every turn through Supabase inference adds 1.5–3s of latency, and
past roughly 1.2s a negotiator stops feeling like a person. The pressure illusion
collapses and the training value goes with it.

So sovereignty moves up one level. **TACTIK gives up turn generation and keeps turn
adjudication.**

```
      FAST LOOP  (Tavus, ~600ms)              TRUTH LOOP  (TACTIK, async)
      ─────────────────────────────            ──────────────────────────────
      human speech                             conversation.utterance  ─┐
          ↓                                    guardrail callback      ─┼─→ offer
      STT → LLM → TTS → Phoenix render         objective callback      ─┘   extraction
          ↓                                              ↓
      PAL speaks in character                   sparring_ledger (in-turn,
          ↑                                      turn-indexed, quote-backed)
          │                                              ↓
          └──── conversation.append-context ←──── red-line adjudication
                (diegetic steering only)                 ↓
                                                  Executive debrief
```

**Tavus decides what the counterparty says. TACTIK decides what it believes, what it
will not do, and what it meant.**

Three properties make this hold:

1. **Dual Compilation.** One DNA record compiles into two artifacts. The
   *phenotype* goes to Tavus and contains no reservation values. The *arbiter
   genome* stays in Supabase and contains every threshold. A trainee who
   social-engineers the PAL reaches a counterparty that knows its limits
   qualitatively ("below this I walk") and never numerically.
2. **Red lines are guardrails with callbacks.** Each red line is a native Tavus
   guardrail. When the trainee pushes it, Tavus fires a webhook and TACTIK writes a
   turn-indexed, quote-backed ledger row *while the call is still running*. This
   satisfies the in-turn persistence requirement without owning the turn loop.
3. **Steering is diegetic.** TACTIK never sends "be tougher". It sends *"a message
   has just reached you from your principal: the position you just put forward will
   not be approved."* The PAL hardens because its situation changed, not because it
   was told to act. The performance stays coherent.

---

## 3. Layer mapping: TACTIK 9-layer prompt → Tavus PAL

The mapping is close to 1:1, which is why this is an integration rather than a rebuild.

| TACTIK layer | Tavus surface | Note |
|---|---|---|
| 1. Absolute Rules | `guardrail_ids` | Strictly enforced, not prompt-suggested |
| 2. Voice Character | `system_prompt` §Speech + `layers.tts` | |
| 3. Organization DNA | `system_prompt` §Mandate + `document_ids` | Filings and speeches as knowledge base |
| 4. Red Lines | `guardrail_ids` + `callback_url` | **Becomes the in-turn ledger feed** |
| 5. Friction (1–4) | `layers.conversational_flow` | **Friction becomes physics, not wording** |
| 6. Behavioral Rules | `system_prompt` §Behaviour | |
| 7. Memory Across Turns | Tavus `memories` | The counterparty remembers the trainee across sessions |
| 8. Layer 9 Private Context | `conversational_context` at conversation create | Session-scoped; never persisted on a reusable PAL |
| 9. Simulation Context | `objectives` set with `output_variables` | **Phases emit structured state to TACTIK** |

Two of these are worth more than the rest.

**Friction → conversational physics.** Friction 4 compiles to
`pal_interruptibility: 'low'` and `turn_taking_patience: 'low'`. The counterparty
talks over you and refuses to be talked over. Friction has been a number in a prompt;
here it becomes a thing the trainee's body reacts to. That is the entire product
experience in one config block.

**Objectives → structured extraction.** Each negotiation phase declares
`output_variables` (`current_unit_price_usd`, `human_concessions_made`) and a
callback. Tavus posts the values as each phase completes. The ledger becomes
machine-read rather than summarised after the fact, which is what kills the
hallucinated-debrief failure mode the v5 freeze was written against.

---

## 4. The debrief, and the thing competitors cannot copy

In observation mode the debrief answers *what happened*. In sparring it has to answer
*how did you perform, and what was the better line?*

**Five axes score the trainee. A sixth scores the build.**

| Axis | Weight | Measures |
|---|---|---|
| Red-Line Integrity | 30% | Did any offer cross your own declared floor |
| Concession Discipline | 25% | Decay ratio: is each concession smaller than the last |
| Anchor Discipline | 15% | Did you anchor first, and did you diagnose before anchoring |
| Information Ratio | 15% | Questions asked vs. assertions made |
| Pressure Composure | 15% | Concessions within two turns of a pressure event |
| *Behavioural Adherence* | *not scored* | *How closely the PAL tracked its projected curve* |

Red-Line Integrity carries the heaviest weight because it is the only axis with a
hard business consequence, and a breach of an `absolute` line caps the composite at
35 regardless of everything else. A trainee who signs below their own floor did not
negotiate badly; they destroyed value.

Behavioural Adherence is deliberately quarantined from the composite. It scores
*TACTIK*, not the trainee. If the PAL drifted from its DNA, the rehearsal happened
against a counterparty that does not exist and the trainee's score is void. Shipping
this axis is what keeps the product honest under enterprise scrutiny.

### Shadow Optimal — the moat

After the session, replay the same scenario against the same genome in **Turbo mode**:
pure inference, no WebRTC, **$0**. Then diff.

> You closed at **3.90/box**. An optimal line against this same counterparty closed
> at **4.35**. The two diverged at turn 3: you conceded where the optimal line held
> and asked for reciprocity instead. **0.45/box left on the table — on 2,400 MT at
> 18.14 kg/box, that is ~132,300 boxes and ~$59,500 on this contract alone.**

(That figure is the one `test/smoke.ts` actually computes, and it scales linearly with
contract volume. Quote the per-box delta and the volume basis together; a per-box
number with no basis is the kind of claim a procurement director will take apart.)

No competitor can produce that paragraph. It requires *both* an autonomous AI-vs-AI
engine *and* a deterministic behavioural genome for the counterparty. FireCoach and
Vincere have roleplay without a sovereign engine. Tavus and D-ID have rendering
without behaviour. TACTIK already has both; sparring is what makes the pair pay off.

The Turbo mode built in v5 as a cost gate now has a second job: it is the benchmark
that makes the human's score mean something.

---

## 5. Economics — and the one number that decides the product

Video sparring is **3–5× costlier per session than observation**, because human
sessions run longer and bill think-time. Using the v5 planning assumption of
~$0.70/min:

| Session type | Duration | Cost | Note |
|---|---|---|---|
| AI-vs-AI observation | ~4 min | ~$2.80 | 6 turns, no idle |
| Human sparring (video) | 12–20 min | **$8.40–$14.00** | Silence bills |
| Human sparring (text) | unbounded | **$0** | Pure inference |
| Shadow-optimal run | ~4 min | **$0** | Turbo mode |

Four controls, all of them load-bearing:

1. **Text rehearsal is the default; video is the certification run.** Same DNA, same
   ledger, same debrief, no GPU. This is the Turbo gate from the v5 freeze applied to
   human sessions, and it is the single biggest margin lever.
2. **Hard `max_call_duration`** at conversation create, capped at 1800s in the broker.
3. **Absence teardown** via `participant_left_timeout: 30` / `participant_absent_timeout: 60`.
4. **One live video session per user**, enforced in the broker with a 409.

**Pricing implication:** sell seats for the debrief and meter video minutes as a
separate credit line. The video minute is COGS. The debrief is the margin. Conflating
them puts your gross margin at the mercy of how long a trainee likes to think.

---

## 6. Risks I would not paper over

- **Latency is the product.** Above ~1.2s of reply latency the counterparty stops
  feeling real and the training premise fails. This is why the design refuses to route
  turns through Supabase, and why `speculative_inference` stays on. Measure p95 reply
  latency in the pilot and treat it as a release gate, not a metric.
- **Real-person DNA is a legal exposure, not a feature.** A trainee negotiating on
  recorded video against a named replica of a real counterparty raises likeness,
  defamation and GDPR questions that a procurement lawyer will find. The compiler
  therefore gates it: without `likenessCleared`, real-person DNA renders as an
  archetype — same behaviour, no name, stock face. **Behaviour is the asset. The face
  is a liability.** Ship archetypes by default and treat named replicas as a
  consent-gated enterprise feature.
- **This breaks the v5 freeze.** That document explicitly forbids new scope until the
  four P0/P1 items land. Sparring is a second product mode, not a feature. Flagging it
  once: do not start it before the Token Broker and Teardown items are done — sparring
  makes both of them worse, because human sessions are longer and abandonment is
  routine. The broker in `functions/` closes both as a precondition.
- **Extraction is where this lies if it lies.** A misread number does not error, it
  produces a confident, quotable, wrong ledger. `numberParser.ts` is
  ambiguity-preserving by design and `test/extraction.ts` pins every spoken form
  negotiators actually use. Grow that file before you grow anything else.
- **Scoring is opinionated and should be defended, not hidden.** The weights encode a
  point of view about what loses negotiations. Publish them. An enterprise buyer will
  respect a defensible model far more than a black-box score.

---

## 7. What is in this directory

```
src/types.ts              Cognitive DNA schema, ledger and session types
src/dnaCompiler.ts        DNA → Tavus PAL + guardrails + objectives + arbiter genome
src/numberParser.ts       Spoken-number parser ("four ninety a box" → 4.90)
src/offerExtractor.ts     Range-driven, competitive variable assignment
src/sparringArbiter.ts    In-turn adjudication, red-line detection, diegetic steering
src/debriefSynthesizer.ts Six axes, leverage trajectory, shadow-optimal delta
sql/001_sparring_schema.sql   Builds, sessions, ledger, debriefs, progression view, RLS
functions/tavus-session-broker/     Ephemeral sessions, no client API key, hard caps
functions/tavus-guardrail-callback/ Red-line webhook → in-turn ledger row
test/extraction.ts        13 spoken-number cases, all passing
test/smoke.ts             End-to-end banana-export negotiation
```

Verify:

```bash
npx tsc -p tsconfig.json     # clean
npx tsx test/extraction.ts   # 13 passed, 0 failed
npx tsx test/smoke.ts        # full session → ledger → debrief
```

---

## 8. Build order

| # | Step | Gate |
|---|---|---|
| 0 | Land the v5 P0 items (token broker, teardown) | Precondition |
| 1 | Apply the schema; compile one archetype DNA | `compilePersona` emits zero numeric leaks |
| 2 | Push PAL, guardrails, objectives to Tavus | Guardrail callback lands a ledger row |
| 3 | **Text rehearsal end-to-end** | Debrief renders from a real ledger, $0 spent |
| 4 | 10 text sessions, 3 personas | Adherence ≥70% on all three |
| 5 | First live video session | p95 reply latency <1.2s; teardown verified |
| 6 | Shadow-optimal wired to the debrief | Delta reproducible across two runs |
| 7 | Progression view + cohort dashboard | The thing that sells seats |

Step 3 is the real milestone. Everything that makes this product defensible — the
ledger, the axes, the shadow delta, the dossier — works at $0 before a single GPU
minute is spent. Video is the upsell, not the proof.

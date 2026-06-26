# Belief-Delta — SPEC

## What this does

Turns cross-session drift from something a human reads into something the engine computes.

Given two consecutive runs on the same counterparty/scenario chain,
`belief_delta(s1_id, s2_id)` returns a structured delta with its formula attached —
recomputable, transparent, not a black box.

## The Convergence Formula

```
convergence_score = alignment_axes_gained - alignment_axes_lost + red_lines_dropped
```

This is a transparent heuristic over measured count movements. It ships with its
formula string in every output. It is NOT a validated psychometric.

Whether these engine signals track real negotiation belief is an empirical question.
That is what makes this useful to researchers — and what makes it honest to state plainly.

## COBANA S1→S2 — Verified in logic

Chain: COBANA negotiation, Session 1 → Session 2
- `red_lines_delta`: -1 (one red line dropped between sessions)
- `alignment_axes_up`: 2 (two axes gained)
- `convergence_score`: 3
- Formula: `alignment_axes_gained(2) - alignment_axes_lost(0) + red_lines_dropped(1) = 3`

Run IDs to backfill: c904ead7 (seq 1) → c0e28d95 (seq 2)

## What is NOT claimed

- `convergence_score` is NOT a validated psychometric
- It captures structural signal counts, not semantic shift
- It does not replace the Cognitive DNA or PCG — it is a cross-session delta layer
- Confidence values from the engine are heuristic (boolean flag sums), not Episteme metrics

## The honest sentence for when a researcher asks

> "The number ships with its formula. It is a transparent sum over measured count
> movements, recomputable from the persisted states, not a black box. Whether those
> engine signals track real negotiation belief is the empirical question, and that is
> where your work and this instrument meet."

## Apply order

1. Review `migration.sql` — additive only, creates new objects, touches nothing existing
2. Apply migration to Supabase (dashboard SQL editor or MCP)
3. Drop `capture-position-state.ts` alongside `run-simulation`, wire the INTEGRATION call
4. Backfill COBANA: insert position_state for c904ead7 (seq 1) and c0e28d95 (seq 2),
   then `SELECT belief_delta(s1_id, s2_id)` — expected: convergence_score 3

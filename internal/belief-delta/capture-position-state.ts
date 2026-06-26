// capture-position-state.ts
// Writes one position snapshot per completed run, resolves the chain.
// NON-BLOCKING: if this fails, the run is unaffected.
// Drop alongside run-simulation. Wire per INTEGRATION block below.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RunSnapshot {
  runId: string
  counterpartyId: string
  scenarioId: string
  redLines: string[]
  alignmentAxes: string[]
  positionVector?: Record<string, unknown>
}

export async function capturePositionState(snapshot: RunSnapshot): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const chainKey = `${snapshot.counterpartyId}:${snapshot.scenarioId}`

  const { data: existing } = await supabase
    .from('position_state')
    .select('sequence_number')
    .eq('chain_key', chainKey)
    .order('sequence_number', { ascending: false })
    .limit(1)

  const nextSeq = existing && existing.length > 0
    ? existing[0].sequence_number + 1
    : 1

  await supabase
    .from('position_state')
    .insert({
      run_id: snapshot.runId,
      chain_key: chainKey,
      sequence_number: nextSeq,
      red_lines: snapshot.redLines,
      alignment_axes: snapshot.alignmentAxes,
      position_vector: snapshot.positionVector ?? {},
    })
  // Intentionally no error throw — non-blocking
}

// ─── INTEGRATION ─────────────────────────────────────────────────────────────
// In run-simulation/index.ts, AFTER the run is persisted to DB:
//
//   import { capturePositionState } from './capture-position-state.ts'
//
//   // After: await supabase.from('simulations').insert(runRecord)
//   capturePositionState({
//     runId: runRecord.id,
//     counterpartyId: simulationInput.counterparty_id,
//     scenarioId: simulationInput.scenario_id,
//     redLines: extractedDNA.red_lines ?? [],
//     alignmentAxes: extractedDNA.alignment_axes ?? [],
//   }).catch(() => {}) // non-blocking: swallow errors
// ─────────────────────────────────────────────────────────────────────────────

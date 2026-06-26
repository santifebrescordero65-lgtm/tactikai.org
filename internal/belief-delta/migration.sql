-- Belief-Delta Migration
-- Turns cross-session drift from something a human reads into something the engine computes.
-- ADDITIVE ONLY: creates new objects, touches nothing in simulate-response or run-simulation.

CREATE TABLE IF NOT EXISTS position_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  chain_key TEXT NOT NULL, -- "{counterparty_id}:{scenario_id}"
  sequence_number INTEGER NOT NULL,
  red_lines JSONB NOT NULL DEFAULT '[]',
  alignment_axes JSONB NOT NULL DEFAULT '[]',
  position_vector JSONB NOT NULL DEFAULT '{}',
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain_key, sequence_number)
);

-- Chain integrity: rejects mixing counterparties or scenarios within a chain
CREATE OR REPLACE FUNCTION enforce_chain_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM position_state
    WHERE chain_key = NEW.chain_key
      AND sequence_number >= NEW.sequence_number
  ) THEN
    RAISE EXCEPTION 'Chain integrity violation: sequence % already exists for chain %',
      NEW.sequence_number, NEW.chain_key;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chain_integrity_check
  BEFORE INSERT ON position_state
  FOR EACH ROW EXECUTE FUNCTION enforce_chain_integrity();

-- belief_delta(s1_id, s2_id): the core function — ships with its formula
CREATE OR REPLACE FUNCTION belief_delta(s1_id UUID, s2_id UUID)
RETURNS JSONB AS $$
DECLARE
  s1 position_state%ROWTYPE;
  s2 position_state%ROWTYPE;
  rl_delta INTEGER;
  ax_up INTEGER;
  ax_down INTEGER;
  conv_score INTEGER;
  formula TEXT;
BEGIN
  SELECT * INTO s1 FROM position_state WHERE id = s1_id;
  SELECT * INTO s2 FROM position_state WHERE id = s2_id;

  IF s1 IS NULL OR s2 IS NULL THEN
    RAISE EXCEPTION 'Position state not found';
  END IF;

  IF s1.chain_key != s2.chain_key THEN
    RAISE EXCEPTION 'Cannot compute delta across different chains: % vs %', s1.chain_key, s2.chain_key;
  END IF;

  rl_delta := (SELECT COUNT(*) FROM jsonb_array_elements_text(s2.red_lines))::INTEGER
            - (SELECT COUNT(*) FROM jsonb_array_elements_text(s1.red_lines))::INTEGER;

  ax_up := (
    SELECT COUNT(*) FROM jsonb_array_elements_text(s2.alignment_axes) ax
    WHERE ax NOT IN (SELECT jsonb_array_elements_text(s1.alignment_axes))
  )::INTEGER;

  ax_down := (
    SELECT COUNT(*) FROM jsonb_array_elements_text(s1.alignment_axes) ax
    WHERE ax NOT IN (SELECT jsonb_array_elements_text(s2.alignment_axes))
  )::INTEGER;

  -- Transparent sum over measured count movements
  conv_score := ax_up - ax_down + GREATEST(-rl_delta, 0);

  formula := format(
    'convergence_score = alignment_axes_gained(%s) - alignment_axes_lost(%s) + red_lines_dropped(%s) = %s',
    ax_up, ax_down, GREATEST(-rl_delta, 0), conv_score
  );

  RETURN jsonb_build_object(
    'chain_key', s1.chain_key,
    's1_sequence', s1.sequence_number,
    's2_sequence', s2.sequence_number,
    'red_lines_delta', rl_delta,
    'alignment_axes_up', ax_up,
    'alignment_axes_down', ax_down,
    'convergence_score', conv_score,
    'formula', formula,
    'computed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- chain_trajectory: full delta history for a negotiation chain
CREATE OR REPLACE FUNCTION chain_trajectory(p_chain_key TEXT)
RETURNS TABLE(from_seq INTEGER, to_seq INTEGER, delta JSONB) AS $$
DECLARE
  states UUID[];
  i INTEGER;
BEGIN
  SELECT ARRAY_AGG(id ORDER BY sequence_number)
  INTO states
  FROM position_state
  WHERE chain_key = p_chain_key;

  IF array_length(states, 1) < 2 THEN RETURN; END IF;

  FOR i IN 1 .. array_length(states, 1) - 1 LOOP
    SELECT ps1.sequence_number, ps2.sequence_number,
           belief_delta(states[i], states[i+1])
    INTO from_seq, to_seq, delta
    FROM position_state ps1, position_state ps2
    WHERE ps1.id = states[i] AND ps2.id = states[i+1];
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

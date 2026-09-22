/**
 * TACTIK Live Sparring — canonical types.
 *
 * Sparring inverts the AI-vs-AI debate engine: the executive is no longer a
 * spectator, they are the counterparty. A Tavus PAL is charged with a TACTIK
 * Cognitive DNA and negotiates against a human in real time. TACTIK never
 * generates the PAL's turns — it governs, scores and debriefs them.
 *
 * Two artifacts are compiled from one DNA record (see dnaCompiler.ts):
 *   - PhenotypePayload  → what Tavus needs in order to *speak* in character.
 *   - ArbiterGenome     → what TACTIK needs in order to *judge* what was said.
 *
 * The ArbiterGenome is the authority. If the PAL concedes below its reservation
 * value, that is a rendering fault, not a negotiation outcome, and the ledger
 * records it as such.
 */

// ---------------------------------------------------------------------------
// Cognitive DNA (source of truth — mirrors persona_dna_cache.dna_payload)
// ---------------------------------------------------------------------------

/** Friction calibration, 1 (accommodating) → 4 (hostile). SynerGIA moderator control. */
export type FrictionLevel = 1 | 2 | 3 | 4;

export type NegotiationDoctrine =
  | 'distributive'      // claim value; zero-sum framing
  | 'integrative'       // expand the pie before splitting it
  | 'positional'        // anchor hard, concede in decreasing increments
  | 'relational'        // protect the relationship above the deal
  | 'bureaucratic';     // defer to process, mandate and committee

export interface BigFive {
  openness: number;           // 0..1
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

/**
 * A quantified limit the persona will not cross. This is the object the whole
 * product hinges on: it is simultaneously a Tavus guardrail (so the PAL refuses
 * in character) and an arbiter predicate (so TACTIK can score the human).
 */
export interface RedLine {
  id: string;
  /** Human-readable statement used verbatim in the guardrail prompt. */
  statement: string;
  /** Machine-checkable dimension, e.g. 'unit_price_usd', 'payment_terms_days'. */
  variable: string;
  /** Direction of the bound relative to the persona's interest. */
  comparator: 'min' | 'max';
  /** The reservation value on `variable`. Crossing it is a hard failure. */
  threshold: number;
  unit: string;
  /**
   * Severity drives both guardrail strictness and debrief weighting.
   * 'absolute'  → PAL must walk out.
   * 'mandated'  → PAL must escalate to an absent authority before moving.
   * 'preferred' → PAL resists, then may trade it for value elsewhere.
   */
  severity: 'absolute' | 'mandated' | 'preferred';
}

/** The concession the persona is *willing* to make, and how fast. */
export interface ConcessionPolicy {
  variable: string;
  openingValue: number;
  reservationValue: number;
  unit: string;
  /**
   * Decay factor applied to each successive concession. 0.5 means every
   * concession is half the size of the one before it — classic positional
   * discipline. >0.8 reads as a soft negotiator who leaks value.
   */
  concessionDecay: number;
  /** Minimum turns the persona holds the opening value before moving at all. */
  anchorHoldTurns: number;
  /** Concessions are only offered in exchange for these. */
  requiredReciprocity: string[];
}

export interface CognitiveDNA {
  id: string;
  version: number;
  /** Stable hash of the behavioral payload — pins a session to a DNA revision. */
  genomeHash: string;
  subjectName: string;
  /** 'real' requires consent/likeness clearance before a named replica is used. */
  subjectType: 'real_person' | 'institution' | 'archetype';
  role: string;                       // "Head of Procurement, EU retail group"

  // Layer 2 — Voice character
  voice: {
    register: string;                 // "clipped, corporate, faintly impatient"
    tics: string[];                   // recurring verbal habits
    languages: string[];              // BCP-47
    sentenceLength: 'short' | 'medium' | 'long';
  };

  // Layer 3 — Organization DNA
  organization: {
    name: string;
    mandate: string;                  // what HQ has authorised them to do
    absentAuthority: string;          // who they must defer to ("the board")
    incentives: string[];             // what they are personally measured on
  };

  // Layer 4 — Red lines
  redLines: RedLine[];

  // Layer 5 — Friction
  friction: FrictionLevel;

  // Layer 6 — Behavioral rules
  behavior: {
    doctrine: NegotiationDoctrine;
    bigFive: BigFive;
    tactics: string[];                // "good cop/bad cop", "nibble at close"
    triggers: { cue: string; reaction: string }[];
    concessions: ConcessionPolicy[];
    /** BATNA strength 0..1. Drives how credibly they can walk away. */
    batnaStrength: number;
  };

  // Layer 8 — Private context, never exposed in a reusable PAL
  privateContext?: string;

  // Provenance
  sources: { kind: string; ref: string; ingestedAt: string }[];
}

// ---------------------------------------------------------------------------
// Compilation targets
// ---------------------------------------------------------------------------

/** Tavus PAL creation payload (POST /v2/personas). */
export interface PhenotypePayload {
  pal_name: string;
  system_prompt: string;
  greeting?: string;
  pipeline_mode: 'full';
  default_face_id: string;
  languages: string[];
  document_ids?: string[];
  objectives_id?: string;
  guardrail_ids?: string[];
  layers: {
    llm: { model: string; speculative_inference: boolean };
    tts: { tts_engine: string; voice_id?: string; external_voice_id?: string };
    stt: { stt_engine: string; hotwords?: string };
    perception: {
      perception_model: 'raven-1' | 'raven-0' | 'off';
      emotion_recognition: 'full' | 'limited' | 'auto';
      audio_awareness_queries?: string[];
      visual_awareness_queries?: string[];
    };
    conversational_flow: {
      turn_detection_model: 'sparrow-2' | 'sparrow-1';
      turn_taking_patience: 'low' | 'medium' | 'high';
      pal_interruptibility: 'low' | 'medium' | 'high';
      voice_isolation: 'off' | 'near';
      idle_engagement: 'off' | 'patient' | 'eager';
    };
    mcp?: {
      connectors: string[];
      spoken_updates: 'none' | 'outcome' | 'all';
      visual_updates: 'none' | 'outcome' | 'all';
    };
  };
}

/** Tavus guardrail payload (POST /v2/guardrails) — one per red line. */
export interface GuardrailPayload {
  guardrail_name: string;
  guardrail_prompt: string;
  modality: 'verbal' | 'visual';
  callback_url: string;
  tags: string[];
  app_message: boolean;
}

/** Tavus objective payload — negotiation phases with structured extraction. */
export interface ObjectivePayload {
  objective_name: string;
  objective_prompt: string;
  confirmation_mode: 'auto' | 'manual';
  output_variables: string[];
  modality: 'verbal' | 'visual';
  next_required_objective?: string;
  next_conditional_objectives?: Record<string, string>;
  callback_url: string;
}

/**
 * The half of the DNA that never reaches Tavus. TACTIK scores against this.
 * Keeping it server-side is what stops a trainee from prompt-extracting the
 * counterparty's reservation price out of the PAL.
 */
export interface ArbiterGenome {
  genomeHash: string;
  personaId: string;
  redLines: RedLine[];
  concessions: ConcessionPolicy[];
  batnaStrength: number;
  doctrine: NegotiationDoctrine;
  friction: FrictionLevel;
  /** Expected concession curve, used to detect PAL drift. */
  expectedCurve: Record<string, number[]>;
}

export interface CompiledPersona {
  phenotype: PhenotypePayload;
  guardrails: GuardrailPayload[];
  objectives: ObjectivePayload[];
  arbiter: ArbiterGenome;
  /** Hash of phenotype+arbiter. Written to every ledger row for auditability. */
  compilationHash: string;
}

// ---------------------------------------------------------------------------
// Live session state
// ---------------------------------------------------------------------------

export type LedgerEventKind =
  | 'utterance'
  | 'offer'              // a quantified proposal was made by either side
  | 'concession'         // a party moved toward the other on a variable
  | 'red_line_contact'   // the human pushed a persona red line
  | 'red_line_breach'    // the PAL crossed its own red line → rendering fault
  | 'objective_complete'
  | 'interrupt'
  | 'steering';          // TACTIK injected context

export interface LedgerEvent {
  sessionId: string;
  turnIdx: number;
  seq: number;
  timestamp: string;
  kind: LedgerEventKind;
  actor: 'human' | 'pal' | 'tactik';
  /** Verbatim quote backing this event. Non-negotiable: no quote, no event. */
  quote: string | null;
  variable?: string;
  value?: number;
  /** Signed distance to the relevant reservation threshold. */
  deltaToReservation?: number;
  compilationHash: string;
  meta?: Record<string, unknown>;
}

export interface SparringSession {
  id: string;
  userId: string;
  personaId: string;
  compilationHash: string;
  tavusConversationId?: string;
  mode: 'text_rehearsal' | 'live_video';
  scenario: string;
  /** The human's own declared position — required, or scoring is meaningless. */
  humanMandate: {
    objective: string;
    targets: Record<string, number>;
    redLines: RedLine[];
  };
  startedAt: string;
  endedAt?: string;
  maxDurationSec: number;
}

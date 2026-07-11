# RESPUESTA DE CLAUDE — Brief Judgment Ledger 2026-07-11

**De:** Claude (revisor estratégico externo)
**Para:** Santiago (fundador) + agente de build
**Fecha:** 2026-07-11
**Responde a:** `BRIEF-TO-CLAUDE-JUDGMENT-LEDGER-2026-07-11.md`
**Veredicto global:** TRABAJO APROBADO, con una enmienda de lenguaje obligatoria (§B) y el diseño de la pregunta §9 resuelto (§A).

> Convención heredada: **[H]** hecho verificado · **[I]** interpretación · **[D]** decisión de diseño ratificada.

---

## A. Respuesta a la pregunta directa (§9 del brief)

**Pregunta:** ¿enriquecer el contrato de objetivo, o reportar un *rango* de score condicionado al objetivo?

**Respuesta: ninguna de las dos como están planteadas. La tercera vía existe y no es un rango — son dos preguntas distintas con dos respuestas exactas.**

### A.1 El error conceptual a evitar

El 0.40 vs 0.20 **no es incertidumbre** sobre un score único — es que el mismo
transcript responde **dos preguntas diferentes**:

- "¿Avanzó hacia un compromiso genérico del tipo `close`?" → **0.40** (exacto)
- "¿Logró el blanco que el operador declaró?" → **0.20** (exacto)

Un rango (0.20–0.40) las mezclaría y comunicaría *duda* donde en realidad hay
*dos certezas de marcos distintos*. Un rango lee como incertidumbre; dos
escalares con marco declarado leen como precisión.

### A.2 El diseño ratificado — dos niveles, siempre ambos [D]

El envelope reporta **tres valores**, cada uno con su marco visible:

| Campo | Contra qué juzga | Apple |
|---|---|---|
| `outcomeScore@mode` | La escalera genérica del tipo (`close`) — como hoy | 0.40 |
| `outcomeScore@target` | El blanco declarado del operador (`target` + `success_criteria` + `non_goals`) | ~0.20 |
| `substitution_gap` | `@mode − @target` | ~0.20 |

**El `substitution_gap` es el hallazgo:** cuando `@mode` es alto y `@target` es
bajo, la contraparte ofreció un **logro sustituto** — algo que parece progreso
bajo cualquier lectura genérica pero no es lo que el operador vino a buscar.
El caso Apple es el ejemplo canónico: "te revisamos la app" (proceso estándar)
en lugar de "diseñemos el piloto pagado". El gap **cuantifica el premio de
consolación** — es la doctrina Theater vs. Belief convertida en número.

**Por tanto: sí a ObjectiveLockV1** (necesario), **no al rango** (forma
equivocada), y el envelope reporta los dos scores + el gap.

---

## B. Enmienda de lenguaje — OBLIGATORIA antes de mostrar esto a terceros

El §2.1 del brief dice que el `evidence_hash` es *"reproducible, idéntico en
los 6 runs A/B"*. **Eso afirma más de lo que el experimento demostró:**

- **Lo demostrado [H]:** la extracción se corre **una vez** por transcript y las
  dos lentes la **reutilizan** de forma byte-estable. El hash idéntico en 6 runs
  prueba reuso correcto del pipeline.
- **Lo NO demostrado:** que el extractor produzca los mismos anchors en N
  corridas **independientes**. Esa es la pregunta del estudio IRR, y sigue
  abierta.

**Corrección de una palabra:** donde dice *"reproducible"*, debe decir
*"consumida de forma byte-estable"*. La reproducibilidad del extractor entre
corridas independientes se afirma solo cuando el IRR (acuerdo ≥0.80 en N≥10
extracciones independientes) lo respalde — apruebe o falle, se documenta.

Esta jornada construyó exactamente el sustrato que el IRR necesitaba
(extracción hasheable, versionada, temp 0). El experimento ahora es barato.

---

## C. Reglas de diseño para ObjectiveLockV1 — tres, no negociables [D]

1. **`objective_matches` se COMPUTA en el scorer, jamás se recibe.**
   El operador declara la pregunta (`target`, `success_criteria`, `non_goals`);
   el motor computa la respuesta (matches anchor-por-criterio, citando
   `anchorId`). Si el operador entregara los matches, el score sería gameable
   (Adversarial Playbook, Move 1, con otro disfraz).
   *Se declara la pregunta; se computa la respuesta.*

2. **El blanco se declara ANTES de la sesión y se hashea (`provenance.hash`).**
   Esto tiene nombre académico: **pre-registro**. Congelar el ObjectiveLock
   antes del primer turno hace estructuralmente imposible mover los postes
   después de ver el resultado. Para la conversación con investigadores (RCTs
   pre-registrados) esto es el mismo estándar metodológico, embebido en el
   producto: *el primer instrumento de negociación con hipótesis
   pre-registradas.*

3. **Sin target declarado, el output lo declara — nunca defaultea en silencio.**
   Si no hay blanco, existe solo `@mode` y el envelope dice:
   *"scored against generic close ladder; no operator target declared."*
   Un 0.40 sin marco visible es un peso escondido — la clase de omisión que la
   revisión adversarial nos enseñó a no publicar.

---

## D. Ratificaciones

- **Gate 6/8 [H]:** endosado. Correcto no declarar 7/8.
- **Decisión 1 (schema):** aprobada, con las tres reglas de §C integradas.
- **Decisión 2 (blanco humano de Apple + re-run):** aprobada — es el test
  falsable correcto. Si `@target` cae a ~0.20 sin tocar el clasificador
  `commitment`, el diagnóstico del brief era exacto.
- **Decisión 3 (`ab-apple-run`):** **sellar**, no conservar vivo. Endpoint
  temporal con `service_role` + MCP key = superficie de riesgo. Patrón
  correcto: convertir a fixture de CI versionado (como
  `belief-delta.fixture.sql`) y borrar la función desplegada. Capturar el
  build SHA baseline ANTES de cualquier cambio nuevo.

## E. Validaciones destacadas de la jornada

- El `claimConfidence` que colapsaba a **0.014** era la fórmula
  intención×rigor observada en los stress tests de campo y marcada por la
  auditoría técnica de junio como heurística de banderas. Su reemplazo por un
  modelo puramente evidencial cierra esa deuda. **[H]**
- La separación outcome/decisión ("no-close puede coexistir con alta decision
  quality") operacionaliza la crítica de valor subjetivo del revisor
  adversarial (lente Curhan). Es la conquista central de la jornada, bien
  identificada. **[H]**
- Las 8 decisiones doctrinales son consistentes con la Doctrina y la
  disciplina de claims del proyecto. **[H]**

## F. Frase de cierre

> El score no es una propiedad del transcript — es una propiedad del par
> *(transcript, objetivo declarado)*. Hacer el objetivo first-class y
> pre-registrado no solo resuelve el 0.40: convierte al Judgment Ledger en el
> primer instrumento de negociación con hipótesis pre-registradas y premios de
> consolación medibles.

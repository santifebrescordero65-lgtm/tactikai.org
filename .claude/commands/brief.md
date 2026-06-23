# /brief — TACTIK Session Debrief

Genera el TACTIK READOUT de la sesión actual y actualiza el modelo acumulado de Santiago.

## Qué hace este skill

1. **Lee** `SANTIAGO-DNA.md` para cargar el modelo acumulado del operador
2. **Genera** el READOUT estructurado de la sesión (Cognitive DNA update + PCG + Decision Graph)
3. **Actualiza** `SANTIAGO-DNA.md`:
   - Nuevas observaciones en los layers relevantes
   - Nueva entrada en SESSION LEDGER
   - Layer 9 (Active Context) con el estado actual
4. **Hace commit** del archivo actualizado

## Formato del READOUT

Genera el debrief con estas secciones:

### COGNITIVE DNA UPDATE
Solo los layers que cambiaron o que esta sesión añade evidencia. Si un layer no cambió, no lo incluyas — escribe solo deltas.

### PCG SCORES
```
F1 Iniciativa (25%):     [score/100] — [evidencia de 1 línea]
F2 Profundidad (20%):    [score/100] — [evidencia de 1 línea]
F3 Avance (20%):         [score/100] — [evidencia de 1 línea]
F4 Coherencia (20%):     [score/100] — [evidencia de 1 línea]
F5 inv. Dependencia(15%):[score/100] — [evidencia de 1 línea]
────────────────────────────────────
PROBABILIDAD DE ÉXITO:   [score/100]
```

### DECISION GRAPH
```
ANTES → DESPUÉS (solo lo que cambió)
```

### LO QUE NO CAMBIÓ
Lista concisa — máximo 5 ítems. Estas son decisiones correctas, no omisiones.

### FAILURE CASCADE
Los 2-3 riesgos reales de lo que se construyó. Con mitigación.

### NEXT ACTIONS
Tabla: Prioridad · Acción · Superficie. Máximo 5 ítems.

## Instrucciones de actualización de SANTIAGO-DNA.md

Después de generar el READOUT, actualiza el archivo:

1. En **LAYER 9 — Active Context**: actualiza los campos que cambiaron
2. En **SESSION LEDGER**: añade nueva entrada con:
   - Número de sesión (incrementar el último)
   - Fecha
   - Branch activo
   - PCG Score
   - **What was decided**: las 2-3 decisiones clave
   - **What was built**: archivos creados/modificados
   - **What didn't change**: decisiones de no-cambio
   - **Key insight**: la frase más importante dicha en esta sesión (literal si es posible)
   - **Open questions**: preguntas sin respuesta que se llevan a la siguiente sesión

3. Actualiza el contador `Sessions: N` en el header del archivo

## Commit

```bash
git add SANTIAGO-DNA.md
git commit -m "Update Santiago DNA — Session [N] · [fecha]

[Una línea con el insight clave de la sesión]"
```

## Principio del modelo

El modelo de Santiago no se reescribe — se acumula. Cada sesión añade evidencia. Contradicciones con sesiones anteriores se marcan como evolución, no como error.

La regla del belief tracker: **el modelo solo ve el estado acumulado, nunca los transcripts anteriores**. Lo que importa es el delta, no el volumen.

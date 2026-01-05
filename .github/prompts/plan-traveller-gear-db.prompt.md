## Plan: D1 Gear Schema + Embeddings (Needs + Availability)

Design a D1-friendly schema that supports hard constraints (TL/price/weight/species/skill) and a stable “needs” taxonomy for role-driven selection without coupling items to a closed role list. Use Vectorize for semantic recall/ranking only; enforce hard constraints in D1. Treat legality as an availability factor (no `currentLaw` concept in the system).

### Steps 1) Normalize core item fields in D1

1. Keep a base `equipment` table as the canonical item record, and normalize for querying:
    - `price_cr` (INT credits)
    - `weight_kg` (numeric; single source of truth for item weight)
    - `law_illegal_from` (nullable INT; illegal at law level ≥ X)
2. Do not hard-filter by legality by default. `law_illegal_from` is used as a proxy for how restricted/rare the item is.
3. Add indexes for the hard constraints you expect to apply often: `(category)`, `(tl)`, `(price_cr)`, `(weight_kg)`, `(law_illegal_from)`, and a composite like `(category, tl, price_cr)`.

### Steps 2) Add “needs” tagging (stable 10–30 vocabulary)

1. Introduce a minimal, stable needs vocabulary (target 10–30 needs total; avoid drift).
2. Store needs per item via a join table with integer weights:
    - `equipment_needs(equipment_id, need, weight)` where `weight` is an INT 0–10.
3. Roles are not stored in the DB. Role → needs mapping lives in code and can evolve without rebuilding the DB.

### Steps 3) Assign tags/needs during CSV → DB extraction

1. During ingestion, deterministically derive needs tags (and 0–10 weights) from CSV fields like section/subsection/category/notes.
2. Ensure the ingestion step only emits needs from the approved vocabulary and fails/flags unknown tags.
3. Implement this in the seed pipeline (`seed/generate-schema-sql.ts` → generated `seed/schema.sql`) so D1 is enriched before the worker runs.

### Steps 4) Model type-specific attributes (only where you have data)

1. If/when you have structured attributes for weapons/armour/computers/software/etc, use 1:1 detail tables keyed by `equipment_id`.
2. Do not duplicate shared fields (price/TL/weight/law) into subtype tables; keep them on `equipment`.

### Steps 5) Retrieval: D1 enforces constraints, Vectorize ranks

1. Keep the current pattern: Vectorize returns candidate IDs; D1 fetches rows and enforces hard constraints.
2. Use needs overlap (role→needs) as a ranking signal.
3. Use legality as availability (soft) signal:
    - Lower `law_illegal_from` ⇒ generally harder to acquire (more restricted across the setting).
    - Higher SOC/experience ⇒ can still acquire restricted items more often (reduce the penalty), but not guaranteed.

### Steps 6) Update embeddings to include needs + availability context

1. Update the indexing document/template so it includes needs tags + weights and `law_illegal_from` (framed as availability/restriction, not a strict compliance gate).
2. Store these fields in Vectorize metadata too for debugging.
3. Re-index after schema/tagging changes so Vectorize reflects the enriched D1 data.

### Further Considerations

1. Keep needs vocabulary stable (10–30) to minimize re-tagging and re-index churn.
2. Make ingestion deterministic (same CSV row ⇒ same tags/weights) to avoid drift.
3. Define a simple, testable availability scoring function so SOC/experience and `law_illegal_from` interact predictably.

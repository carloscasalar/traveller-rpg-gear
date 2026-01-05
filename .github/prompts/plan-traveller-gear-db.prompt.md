## Plan: D1 Gear Schema + Embeddings

Design a D1-friendly schema that supports strict filtering (TL/price/law/species/skill/weight) plus type-specific attributes (weapons/armour/computers/software/etc). Then align your embedding pipeline so Vectorize retrieves “candidate items” semantically, while D1 enforces the hard constraints like “TL ≤ 11” and “price ≤ 30000” for queries such as “weapon suitable for a scout…”.

### Steps 1) Normalize core item fields in D1

1. Keep a base `equipment` table (like today) but make `price` an integer `price_cr` and add `law_illegal_from` nullable int, plus a single `weight_kg` numeric field; update `seed/generate-schema-sql.ts` and `seed/schema.sql`.
2. Add small lookup/bridge tables for multi-valued fields: `equipment_species(equipment_id, species)` and `equipment_skill_req(equipment_id, skill, min_level?)` so “empty = all species/no skill” is representable without string parsing.
3. Add indexes in D1 on common filters: `(category)`, `(tl)`, `(price_cr)`, `(law_illegal_from)`, and `(category, tl, price_cr)`.

### Steps 2) Model type-specific attributes with 1:1 detail tables

1. Create subtype tables keyed by `equipment_id`:
    - `armour_stats(protection, rad, str_min, dex_min)`
    - `weapon_stats(weapon_kind, range_m, range_text, damage, magazine, traits)`
    - `electronics_stats(features, weight_kg)` and `computer_stats(processing)` and `software_stats(bandwidth)`
    - `augmentation_stats(body_part)`
2. Keep `equipment.category` (and optionally `subtype`) as the discriminator; only one subtype row should exist per item.

### Steps 3) Define “hard constraint” query path in D1

1. Implement a D1 query function in `src/EquipmentRepository.ts` (and Cloudflare impl) that filters by: category/subtype, TL range, `price_cr` max, law legality, species, and skill compatibility.
2. Use Vectorize only for ranking, not for enforcing numeric constraints; fetch candidates by ID then filter/verify via D1 (you already do “IDs → D1 rows” in `src/cloudflare/CloudflareEquipmentRepository.ts`).

### Steps 4) Update embeddings: what to embed + metadata

1. In the indexer endpoint `src/index.ts`, build the embedded document from normalized fields + subtype stats (e.g., weapon damage/range/traits; armour protection/rad; computer processing; software bandwidth).
2. Store key scalars in Vectorize metadata too (e.g., `category`, `tl`, `price_cr`, `weapon_kind`) to help debugging and potential future metadata filtering, but still treat D1 as the source of truth.

### Steps 5) Fix price parsing + data hygiene in ingestion

1. Update `src/price.ts` and the seed ingestion to robustly parse: `Cr1,200,000`, empty/`-`, and optionally `MCr` into integer credits (or mark unpriced items as null).
2. Re-run the generator + re-index so Vectorize reflects the new normalized fields.

### Further Considerations 1) Clarify 2 key decisions before finalizing schema

1. Roles will NOT be stored in the DB. Instead, define a stable taxonomy of “needs” (tags) and tag each item with one or more needs plus an optional weight/score (e.g., `needs:combat:primary=0.9`, `needs:medical=0.3`). Roles (open-ended and changeable) will be translated to a set of needs at request time (or via a separate, small role→needs mapping store/config).
2. `law_illegal_from` will mean “illegal at ≥ X” and will be nullable for always-legal items (confirmed).

If you confirm those two clarifications, I can refine the exact table DDL and the exact text/metadata template used in the Vectorize indexing step.

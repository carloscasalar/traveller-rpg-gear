# Adding embeddings using Cloudflare D1 and Vectorize

Create the index by executing:

```bash
npx wrangler vectorize create traveller-equipment-index --dimensions=768 --metric=cosine
```

This command creates a new index named `traveller-equipment-index` with 768 dimensions and the cosine similarity metric. The index is created in the Cloudflare Durable Objects namespace.

Create the DB to contain the embeddings by executing:

```bash
npx wrangler d1 create traveller-equipment
```

Now we have to create the DB table to hold the equipment list. These are a few example rows:

```csv
Section,Subsection,Name,TL,Mass,Price,AmmoPrice,Species,Skill,Book,Page,Contraband,Category,Law,Notes,Mod
Armour,Armour,Ablat,9,2,Cr75,0,,,CSC 2,16,Weapons,4,2,,
Armour,Armour,Advanced Poly Carapace,13,2,Cr35000,0,,,CSC 2,13,Weapons,4,2,,
```

So the to create the DB table execute:

```bash
npx wrangler d1 execute traveller-equipment --remote --command "CREATE TABLE IF NOT EXISTS equipment (Section TEXT, Subsection TEXT, Name TEXT, TL INT, Mass INT, Price TEXT, AmmoPrice TEXT, Species TEXT, Skill TEXT, Book TEXT, Page INT, Contraband INT, Category TEXT, Law INT, Notes TEXT, Mod TEXT)"
```


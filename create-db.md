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

Now we have to create the DB table to hold the equipment list. Change to `seed` dir and execute:

```bash
npm i && npm run schema:generate
```

It will generate a file called `schema.sql`. Execute it in the DB by running:

```bash
npx wrangler d1 execute traveller-equipment --file=./schema.sql --remote
```

Or if you want to create it in the local db, use the --local flag:

```bash
npx wrangler d1 execute traveller-equipment --file=./schema.sql --local
```

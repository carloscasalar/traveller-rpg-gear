# Traveller RPG equipment generator for NPCs

## Install
This project needs Node.js >= 22.7.0 . Install the dependencies with:

```bash
npm i
```

Then generate the db by following the instructions in the [create-db.md](./create-db.md) file.

## Run in dev
Execute the following command:

```bash
npx wrangler dev --remote
```

It will start the server in `http://localhost:8787`.

## Test requests
You can test the requests using the browser, a tool like Postman or curl. It is a POST to `/api/v1/equipment`:

```bash
curl -X POST http://localhost:8787/api/v1/equipment -H "Content-Type: application/json" -d '{"name": "John Doe"}'
```





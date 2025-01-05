# Traveller RPG equipment generator for NPCs

This project is a simple API to generate equipment for NPCs in the Traveller RPG.
It is a simple project to test the [Cloudflare Workers](https://workers.cloudflare.com/) platform with workers AI and RAG.

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
curl -X POST http://localhost:8787/api/v1/equipment -H "Content-Type: application/json" -d '{"characteristics":{"DEX":8,"EDU":7,"END":6,"INT":9,"SOC":5,"STR":7},"citizen_category":"average","experience":"regular","first_name":"John","role":"pilot","skills":["Pilot (Spacecraft)-2","Astrogation-2","Electronic (Sensors)-1","Gunnery-1","Mechanic-0","Leadership-0","Vacc Suit-0","Electronics-0","Drive-0"],"surname":"Doe"}'
```

There is also an endpoint to estimate a budget for the equipment. It is a POST to `/api/v1/budget`:

```bash
curl -X POST http://localhost:8787/api/v1/budget -H "Content-Type: application/json" -d '{"characteristics":{"DEX":8,"EDU":7,"END":6,"INT":9,"SOC":5,"STR":7},"citizen_category":"average","experience":"regular","first_name":"John","role":"pilot","skills":["Pilot (Spacecraft)-2","Astrogation-2","Electronic (Sensors)-1","Gunnery-1","Mechanic-0","Leadership-0","Vacc Suit-0","Electronics-0","Drive-0"],"surname":"Doe"}'
```

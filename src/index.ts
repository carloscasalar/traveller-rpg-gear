/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.toml`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
import { Context, Hono } from 'hono';
interface Env {
	DB: D1Database;
	VECTORIZE: VectorizeIndex;
	AI: Ai;
}

interface Equipment {
	id: string;
	section: string;
	subsection: string;
	name: string;
	tl: number;
	mass: number;
	price: string;
	ammo_price: string;
	species: string;
	skill: string;
	book: string;
	page: number;
	contraband: number;
	category: string;
	law: number;
	notes: string;
	mod: string;
}

const app = new Hono();

app.post('api/v1/equipment', async (c: Context<{ Bindings: Env }>) => {
	const answer = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
		messages: [{ role: 'user', content: `What personal gear could bear a traveller rpg NPC which is a veteran scout?` }],
	});

	return c.json(answer);
});

app.get('api/v1/equipment', async (c: Context<{ Bindings: Env }>) => {
	const firstEquipment = await c.env.DB.prepare('SELECT * FROM equipment ORDER BY Tl, Name').first<Equipment>();

	if (!firstEquipment) {
		return c.json({ status: '500', error: 'no equipment found' });
	}

	return c.json({ status: '200', firstEquipment });
});

app.post('api/v1/admin/index', async (c: Context<{ Bindings: Env }>) => {
	// Read all rows from the equipment table and stream them to a process that generates and upsert the vector index
	const lastIndexed = c.req.query('last_indexed') || null;
	console.log('lastIndexed', lastIndexed);
	const query = await c.env.DB.prepare('SELECT * FROM equipment WHERE id > ? or ? IS NULL ORDER BY id LIMIT 10')
	.bind(lastIndexed, lastIndexed)
	.run<Equipment>();

	if (query.error) {
		return c.json({ status: '500', error: query.error });
	}

	if (query.results.length === 0) {
		return c.json({ status: '200', message: 'no more equipment to index', last_indexed: null });
	}

	const removeThoseWithoutValues = (value: string) => value.split(': ')[1] !== '';
	const equipmentListData = query.results.map((row) => ({
		equipment: row,
		data: [
			`## Name: ${row.name}`,
			'### Metadata',
			`- Section: ${row.section}`,
			`- Subsection: ${row.subsection}`,
			`- TL (technology level): ${row.tl}`,
			`- Category: ${row.category}`,
			`- Mass: ${row.mass === 0 ? 'negligible' : row.mass}`,
			`- Price: ${row.price === '0' ? 'free' : row.price}`,
			`- Ammo Price: ${row.ammo_price === '0' ? '' : row.ammo_price}`,
			`- Species that uses it: ${row.species}`,
			`- Skill required to properly use it: ${row.skill}`,
			`- Source book: ${row.book}`,
			`- Level of law above which the object is illegal: ${row.law === 0 ? 'legal everywhere' : row.law}`,
			`- Notes: ${row.notes}`,
			`- Mod: ${row.mod}`,
		]
			.filter(removeThoseWithoutValues)
			.join('\n'),
	}));

	// For each row, generate a vector embedding. As each single row has to be processed with async/await, we have to use a for loop
	// and wait for each row to be processed before moving to the next one.
	for (const { equipment, data } of equipmentListData) {
		const embeddings = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [data] });
		await c.env.VECTORIZE.upsert([
			{
				id: equipment.id,
				values: embeddings.data[0],
				metadata: {
					name: equipment.name,
					section: equipment.section,
					subsection: equipment.subsection,
					tl: equipment.tl,
					mass: equipment.mass,
					price: equipment.price,
					species: equipment.species,
					skill: equipment.skill,
					law: equipment.law,
					notes: equipment.notes,
					mod: equipment.mod,
				},
			},
		]);
	}

	return c.json({ status: '200', message: 'indexing complete', last_indexed: query.results[query.results.length - 1].id });
});

export default app;

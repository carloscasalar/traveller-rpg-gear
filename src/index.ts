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
import { stripIndents } from 'common-tags';
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
interface Character {
	characteristics: {
		DEX: number;
		EDU: number;
		END: number;
		INT: number;
		SOC: number;
		STR: number;
	};
	citizen_category: string;
	experience: string;
	first_name: string;
	role: string;
	skills: string[];
	surname: string;
}

interface EquipmentEmbedding {
	id: string;
	values: number[];
	metadata: {
		name: string;
		section: string;
		subsection: string;
		tl: number;
		mass: number;
		price: string;
		species: string;
		skill: string;
		law: number;
		notes: string;
		mod: string;
	};
}

const app = new Hono();

app.post('api/v1/equipment', async (c: Context<{ Bindings: Env }>) => {
	// Body is expected to have a character
	const character = await c.req.json<Character>();
	const name = `${character.first_name} ${character.surname}`;
	const characteristics = Object.entries(character.characteristics)
		.map(([key, value]) => `${key}: ${value}`)
		.join(', ');
	const skills = character.skills.join(', ');
	const { experience, role } = character;

	const question = stripIndents`
		${name} is a human who is a ${experience} ${role}.
		If we rate experience from lower to highest, they will be:
		- recruit
		- rookie
		- intermediate
		- regular
		- veteran
		- elite

		${name} characteristics are ${characteristics}.

		To make a guess about its equipment budget, bear in mind that these are average monthly living expenses based on the SOC characteristic are:
		- SOC 2, Very poor, month cost Cr 400
		- SOC 4, Poor, month cost Cr 800
		- SOC 5, Low, month cost Cr 1,000
		- SOC 6, Average, month cost Cr 1,200
		- SOC 7, Good, month cost Cr 1,500
		- SOC 8, High, month cost Cr 2,000
		- SOC 10, Very High, month cost Cr 2,500
		- SOC 12, Rich, month cost Cr 5,000
		- SOC 14, Very Rich, month cost Cr 12,000
		- SOC 15, Ludicrously Rich, month cost Cr 20,000

		According to its experience level, ${name} had accumulated a certain amount of credits to spend on equipment.

		${name} skills are ${skills}.

		Typically it will have the equipment necessary for its profession. It will very rarely exceed TL12. If it is in a profession
		exposed to combat, it will have a bladed weapon, a firearm and the best armour it can afford. If there is a budget to spare,
		you can also suggest some unexpected equipment for someone in his profession. If it is not a combat-exposed profession,
		it will typically possess a small sidearm and/or a handgun and light armour. Following this criterion, suggest a
		list of equipment that ${name} may have accumulated and carried with them.
	`;

	const embeddings = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: question });
	const vectors = embeddings.data[0];

	const vectorQuery = await c.env.VECTORIZE.query(vectors, { topK: 20 });
	let itemIds: string[] = [];
	if(vectorQuery.count>0){
		itemIds = vectorQuery.matches.map((match) => match.id);
		console.log('scores', vectorQuery.matches.map((match) => match.score));
	}

	let equipmentList: string[] = [];
	if (itemIds.length>0) {
		const query = `SELECT * FROM equipment WHERE id IN (SELECT value FROM json_each(?1))`;
		const allIds = JSON.stringify(itemIds);
		const { results } = await c.env.DB.prepare(query).bind(allIds).all<Equipment>();
		if (results) equipmentList = results.map((e) => `${e.name}, TL: ${e.tl}, Price: ${e.price}, Law: ${e.law}, Mass: ${e.mass}, Skill: ${e.skill}, Notes: ${e.notes}`);
	}else{
		console.log('***** No equipment suggestions found');
	}

	const contextMessage = equipmentList.length ? `Context:\n${equipmentList.map((item) => `- ${item}`).join('\n')}` : '';
	console.log('contextMessage', contextMessage);

	const systemPrompt = stripIndents`
	   You are a Traveller RPG assistant helping to design remarkable NPCs for the adventure.
	   When answering the question or responding, use the context provided, if it is provided and relevant.
	   Answer in JSON list format.
	   DON'T explain the answer, just provide the list of equipment.
	`;

	const { response: answer } = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
		messages: [
			...(equipmentList.length ? [{ role: 'system', content: contextMessage }] : []),
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: question },
		],
	});

	return c.text(answer);
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

app.onError((err, c) => {
	return c.text(err.message);
});

export default app;

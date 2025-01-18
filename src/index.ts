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
import { stripIndents } from 'common-tags';
import { Context, Hono } from 'hono';

import { BudgetEstimator } from './BudgetEstimator';
import { Equipment } from './EquipmentRepository';
import { PersonalShopper } from './PersonalShopper';
import { Character } from './character';
import { CloudflareEquipmentRepository } from './cloudflare/CloudflareEquipmentRepository';
import { CloudflareQuestionRepository } from './cloudflare/CloudflareQuestionRepository';
import { Env } from './env';

const app = new Hono<{ Bindings: Env }>();

app.post('api/v1/budget', async (c) => {
    let character: Character;
    try {
        //TODO validate character
        character = await c.req.json<Character>();
    } catch (e) {
        return c.json({ error: 'invalid character' }, 400);
    }

    const questionRepository = new CloudflareQuestionRepository(c.env.AI);
    const budgetEstimator = new BudgetEstimator(questionRepository);

    const estimation = await budgetEstimator.estimateBudget(character);
    if ('error' in estimation) {
        return c.json(estimation, 500);
    }
    return c.json(estimation);
});

app.post('api/v1/equipment/wip', async (c) => {
    // Read and validate the character from the body
    let character: Character;
    try {
        character = await c.req.json<Character>();
    } catch (e) {
        return c.json({ error: 'invalid character' }, 400);
    }

    // Get an budget estimation
    const questionRepository = new CloudflareQuestionRepository(c.env.AI);
    const budgetEstimator = new BudgetEstimator(questionRepository);
    const budget = await budgetEstimator.estimateBudget(character);
    if ('error' in budget) {
        return c.json({ error: 'unable to estimate, please try again', message: budget.context }, 500);
    }

    // For each budget category (armour, weapons, tools, commodities) ask the personal shopper for suggestions
    const equipmentRepository = new CloudflareEquipmentRepository(c.env.DB, c.env.VECTORIZE, questionRepository);
    const personalShopper = new PersonalShopper(equipmentRepository, questionRepository);

    const armourSuggestion = await personalShopper.suggestArmour(character, budget.armour);
    let armourDescription: string | null = null;
    if ('error' in armourSuggestion) {
        log('unable to suggest armour', armourSuggestion.context);
    } else if (armourSuggestion.found) {
        const {
            result: { armour, augments },
        } = armourSuggestion;
        armourDescription = stripIndents`${armour.name} (TL ${armour.tl}) ${armour.price} ${augments.length ? '[Augments: ' + augments.map((a) => a.name).join(', ') + ']' : ''}`;
    }

    const weaponsSuggestions = await personalShopper.suggestWeapons(character, budget.weapons);
    let weaponsDescription: string | null = null;
    if ('error' in weaponsSuggestions) {
        log('unable to suggest weapons', weaponsSuggestions.context);
    } else if (weaponsSuggestions.found) {
        const { result } = weaponsSuggestions;
        weaponsDescription = result.map((w) => `${w.name} (TL ${w.tl}) ${w.price}`).join(', ');
    }

    const toolsSuggestions = await personalShopper.suggestTools(character, budget.tools);
    let toolsDescription: string | null = null;
    if ('error' in toolsSuggestions) {
        log('unable to suggest tools', toolsSuggestions.context);
    } else if (toolsSuggestions.found) {
        const { result } = toolsSuggestions;
        toolsDescription = result.map((t) => `${t.name} (TL ${t.tl}) ${t.price}`).join(', ');
    }

    return c.json({ armour: armourDescription, weapons: weaponsDescription, tools: toolsDescription, budget });
});

app.post('api/v1/equipment', async (c) => {
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
    if (vectorQuery.count > 0) {
        itemIds = vectorQuery.matches.map((match) => match.id);
        console.log(
            'scores',
            vectorQuery.matches.map((match) => match.score),
        );
    }

    let equipmentList: string[] = [];
    if (itemIds.length > 0) {
        const query = `SELECT * FROM equipment WHERE id IN (SELECT value FROM json_each(?1))`;
        const allIds = JSON.stringify(itemIds);
        const { results } = await c.env.DB.prepare(query).bind(allIds).all<Equipment>();
        if (results)
            equipmentList = results.map(
                (e) => `${e.name}, TL: ${e.tl}, Price: ${e.price}, Law: ${e.law}, Mass: ${e.mass}, Skill: ${e.skill}, Notes: ${e.notes}`,
            );
    } else {
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

    const result = await c.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
            ...(equipmentList.length ? [{ role: 'system', content: contextMessage }] : []),
            { role: 'system', content: systemPrompt },
            { role: 'user', content: question },
        ],
    });

    if ('response' in result) {
        return c.json(result.response);
    }

    return c.json({ error: 'unable to generate response' }, 500);
});

app.get('api/v1/equipment', async (c) => {
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

function log(...args: any[]) {
    console.log('*** Index App: ', ...args);
}

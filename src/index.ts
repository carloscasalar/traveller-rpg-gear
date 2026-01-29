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
import { toCrFormat } from './price';

const app = new Hono<{ Bindings: Env }>();

app.post('api/v1/characters/budget', async (c) => {
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

app.post('api/v1/characters/equipment', async (c) => {
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
        armourDescription = stripIndents`${armour.name} (TL ${armour.tl}) ${toCrFormat(armour.price_cr)} ${augments.length ? '[Augments: ' + augments.map((a) => a.name).join(', ') + ']' : ''}`;
    }

    const weaponsSuggestions = await personalShopper.suggestWeapons(character, budget.weapons);
    let weaponsDescription: string | null = null;
    if ('error' in weaponsSuggestions) {
        log('unable to suggest weapons', weaponsSuggestions.context);
    } else if (weaponsSuggestions.found) {
        const { result } = weaponsSuggestions;
        weaponsDescription = result.map((w) => `${w.name} (TL ${w.tl}) ${toCrFormat(w.price_cr)}`).join(', ');
    }

    const toolsSuggestions = await personalShopper.suggestTools(character, budget.tools);
    let toolsDescription: string | null = null;
    if ('error' in toolsSuggestions) {
        log('unable to suggest tools', toolsSuggestions.context);
    } else if (toolsSuggestions.found) {
        const { result } = toolsSuggestions;
        toolsDescription = result.map((t) => `${t.name} (TL ${t.tl}) ${toCrFormat(t.price_cr)}`).join(', ');
    }

    const commoditiesSuggestions = await personalShopper.suggestCommodities(character, budget.commodities);
    let commoditiesDescription: string | null = null;
    if ('error' in commoditiesSuggestions) {
        log('unable to suggest commodities', commoditiesSuggestions.context);
    } else if (commoditiesSuggestions.found) {
        const { result } = commoditiesSuggestions;
        commoditiesDescription = result.map((c) => `${c.name} (TL ${c.tl}) ${toCrFormat(c.price_cr)}`).join(', ');
    }

    return c.json({
        armour: armourDescription,
        weapons: weaponsDescription,
        tools: toolsDescription,
        commodities: commoditiesDescription,
        budget,
    });
});

app.get('api/v1/admin/equipment', async (c) => {
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
    const query = await c.env.DB.prepare(
        `
        SELECT e.*,
               json_group_array(
                   json_object('need', en.need, 'weight', en.weight)
               ) FILTER (WHERE en.need IS NOT NULL) as needs_json
        FROM equipment e
        LEFT JOIN equipment_needs en ON e.id = en.equipment_id
        WHERE e.id > ? or ? IS NULL
        GROUP BY e.id
        ORDER BY e.id LIMIT 10
    `,
    )
        .bind(lastIndexed, lastIndexed)
        .run<Equipment & { needs_json: string }>();

    if (query.error) {
        return c.json({ status: '500', error: query.error });
    }

    if (query.results.length === 0) {
        return c.json({ status: '200', message: 'no more equipment to index', last_indexed: null });
    }

    const removeThoseWithoutValues = (value: string) => value.split(': ')[1] !== '';
    const equipmentListData = query.results.map((row) => {
        const needs = row.needs_json ? JSON.parse(row.needs_json) : [];
        const needsText = needs.length > 0 ? `\n- Needs: ${needs.map((n: any) => `${n.need} (weight: ${n.weight})`).join(', ')}` : '';

        return {
            equipment: { ...row, needs },
            data: [
                `## Name: ${row.name}`,
                '### Metadata',
                `- Section: ${row.section}`,
                `- Subsection: ${row.subsection}`,
                `- TL (technology level): ${row.tl}`,
                `- Category: ${row.category}`,
                `- Mass (kg): ${row.weight_kg === 0 ? 'negligible' : row.weight_kg}`,
                `- Price: ${row.price_cr === 0 ? 'free' : toCrFormat(row.price_cr)}`,
                `- Ammo Price: ${row.ammo_price === '0' ? '' : row.ammo_price}`,
                `- Species that uses it: ${row.species}`,
                `- Skill required to properly use it: ${row.skill}`,
                `- Source book: ${row.book}`,
                `- Illegal at law level: ${row.law_illegal_from === null ? 'legal everywhere' : row.law_illegal_from}`,
                `- Notes: ${row.notes}`,
                `- Mod: ${row.mod}`,
                needsText,
            ]
                .filter(removeThoseWithoutValues)
                .join('\n'),
        };
    });

    // For each row, generate a vector embedding. As each single row has to be processed with async/await, we have to use a for loop
    // and wait for each row to be processed before moving to the next one.
    for (const { equipment, data } of equipmentListData) {
        const embeddings = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [data] });
        if (!('data' in embeddings) || !embeddings.data?.[0]) {
            throw new Error(`Failed to generate embeddings for equipment: ${equipment.name}`);
        }

        // Build metadata object, excluding null values
        const metadata: Record<string, string | number> = {
            name: equipment.name,
            section: equipment.section,
            subsection: equipment.subsection,
            tl: equipment.tl,
            weight_kg: equipment.weight_kg,
            price_cr: equipment.price_cr,
            species: equipment.species,
            skill: equipment.skill,
            notes: equipment.notes,
            mod: equipment.mod,
        };

        if (equipment.law_illegal_from !== null) {
            metadata.law_illegal_from = equipment.law_illegal_from;
        }

        if (equipment.needs && equipment.needs.length > 0) {
            metadata.needs = JSON.stringify(equipment.needs);
        }

        await c.env.VECTORIZE.upsert([
            {
                id: equipment.id,
                values: embeddings.data[0],
                metadata,
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

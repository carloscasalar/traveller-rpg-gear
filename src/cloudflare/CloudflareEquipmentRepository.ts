import { D1Database, VectorizeIndex } from '@cloudflare/workers-types'
import { stripIndents } from 'common-tags';
import { z } from 'zod';
import { Equipment, EquipmentQueryResponse, EquipmentRepository } from '../EquipmentRepository';
import { QuestionRepository } from '../QuestionRepository';

interface EquipmentMetadata {
    name: string;
    section: string;
    subsection: string;
    tl: number;
    mass: number;
    price: number;
    species: string;
    skill: string;
    law: string;
    notes: string;
    mod: string;
}

const GOOD_ENOUGH_SCORE_THRESHOLD = 0.4;
const VECTORIZED_RESULTS_TO_RETRIEVE = 20;

const queryEquipmentIdsSchema = z.object({
    itemIds: z.array(z.string()),
    reasoning: z.string(),
});

export class CloudflareEquipmentRepository implements EquipmentRepository {
    constructor(private readonly db: D1Database, private readonly vectorize: VectorizeIndex, private readonly questionRepository: QuestionRepository) {}

    public async findByQuestion(semanticQuery: string, maxResults: number): Promise<EquipmentQueryResponse> {
        const standaloneQuestion = stripIndents`
                ${semanticQuery}

                Keep in mind that money amounts are expressed in the format "CrXXXX". For example Cr160000 means 160000 Credits.
            `;

        const vectorizedQuery = await this.questionRepository.translateQuestionToEmbeddings(standaloneQuestion);

        const vectorQuery = await this.vectorize.query(vectorizedQuery, {
            topK: VECTORIZED_RESULTS_TO_RETRIEVE,
            returnMetadata: 'all',
        });
        if (vectorQuery.count === 0) {
            return { found: false };
        }
        const equipmentContext = vectorQuery.matches
            .filter((match) => match.score > GOOD_ENOUGH_SCORE_THRESHOLD && !!match.metadata?.name)
            .map((match) => {
                const { id, metadata } = match;
                const { name, section, subsection, tl, mass, price, skill } = metadata as unknown as EquipmentMetadata;
                return `${id}: ${name} [${section}/${subsection}] [${tl}] [${price}] [${mass}] [${skill}]`;
            })
            .join('\n\n');

        const additionalContext = stripIndents`
            These are the items you can choose from, in format "id: name [section/subsection] [tl] [price in credits] [weight in kg] [skill requirement if any]".
            Keep in mind that mony amount are expressed in the format "CrXXXX" where Cr means credits and XXXX is the amount. For example Cr160000 is 160000 credits.
            Each item is listed with its price, if user provide budget DON'T exceed it:

            ${equipmentContext}
        `;

        const systemPrompt = stripIndents`
            You are an assistant helping to build a NPC character in a Traveller RPG session.
        `;

        const query = stripIndents`
            ${semanticQuery}

            Please select a maximum of ${maxResults} equipment items suitable for such an NPC from the provided list.
            Use the reasoning attribute to reason how have you selected them (for example what budget considerations have you considered and what budget unspent is left).
            Provide the response in JSON format:

            {
                "itemIds": string[]
                "reasoning": string
            }

            Don't explain the answer, just provide the JSON.
        `;

        const itemsAnswer = await this.questionRepository.ask(systemPrompt, query, additionalContext);

        let itemsParsingResult;
        try {
            const parsedAnswer = JSON.parse(itemsAnswer);
            itemsParsingResult = queryEquipmentIdsSchema.safeParse(parsedAnswer);
            if (!itemsParsingResult.success) {
                return { error: 'Unexpected answer response shape', answer: itemsAnswer };
            }
        } catch (e) {
            return { error: 'Error parsing items answer response', answer: itemsAnswer };
        }
        const itemIds = itemsParsingResult.data.itemIds;
        if (itemIds.length === 0) {
            return { found: false };
        }
        this.log('reasoning:', itemsParsingResult.data.reasoning);

        const dbQuery = `SELECT * FROM equipment WHERE id IN (SELECT value FROM json_each(?1))`;
        const allIds = JSON.stringify(itemIds);
        const { results } = await this.db.prepare(dbQuery).bind(allIds).all<Equipment>();
        if (results.length === 0) {
            this.log(`question returned ${itemIds.join(', ')} but those IDs were not found in the database`);
            return { found: false };
        }

        return { found: true, equipment: results };
    }

    private log(...args: any[]) {
        console.debug('*** CloudflareEquipmentRepository:', ...args);
    }
}

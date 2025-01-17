import { creditsFromCrFormat } from './../price';
import { D1Database, VectorizeIndex } from '@cloudflare/workers-types';
import { stripIndents } from 'common-tags';
import { Equipment, EquipmentCriteria, EquipmentRepository } from '../EquipmentRepository';
import { QuestionRepository } from '../QuestionRepository';
import { toCrFormat } from '../price';

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

const GOOD_ENOUGH_SCORE_THRESHOLD = 0.7;

export class CloudflareEquipmentRepository implements EquipmentRepository {
    constructor(
        private readonly db: D1Database,
        private readonly vectorize: VectorizeIndex,
        private readonly questionRepository: QuestionRepository
    ) {}

    public async findByCriteria(criteria: EquipmentCriteria, additionalContext: string | null, maxResults: number): Promise<Equipment[]> {
        const getSectionsFilter = (criteria: EquipmentCriteria) => {
            if (criteria.sections.type === 'sections') {
                return `section should be one of ${criteria.sections.sections.join(', ')}.`;
            }
            return `section/subsection should be one of ${criteria.sections.sections
                .map(({ section, subsection }) => `${section}/${subsection}`)
                .join(', ')}.`;
        };
        const getPriceFilter = (criteria: EquipmentCriteria) =>
            !criteria.maxPrice
                ? ''
                : `prices should be lower than ${criteria.maxPrice} credits. Prices are provided in CrX format where Cr means credits and X is an integer number that can be represented with comma separator for thousands or as a plain integer.`;
        const getTLFilter = (criteria: EquipmentCriteria) => (!criteria.maxTL ? '' : `TL should be lower than ${criteria.maxTL}.`);
        const getAdditionalContext = (additionalContext: string | null) =>
            additionalContext ? `\nAdditional context: ${additionalContext}` : '';
        const question = stripIndents`
            Suggest equipment items that match the following criteria:
            ${getSectionsFilter(criteria)}
            ${getPriceFilter(criteria)}
            ${getTLFilter(criteria)}
            ${getAdditionalContext(additionalContext)}
        `;
        this.log('question:', question);

        const vectorizedQuery = await this.questionRepository.translateQuestionToEmbeddings(question);
        const vectorQuery = await this.vectorize.query(vectorizedQuery, { topK: maxResults });
        if (vectorQuery.count === 0) {
            this.log('no results found on the vectorized results');
            return [];
        }

        const equipmentIds = vectorQuery.matches.filter((match) => match.score > GOOD_ENOUGH_SCORE_THRESHOLD).map((match) => match.id);

        if (equipmentIds.length === 0) {
            this.log('no results found on the vectorized results with a good enough score');
            return [];
        }

        const dbQuery = `SELECT * FROM equipment WHERE id IN (SELECT value FROM json_each(?1))`;
        const allIds = JSON.stringify(equipmentIds);
        const { results } = await this.db.prepare(dbQuery).bind(allIds).all<Equipment>();

        // Because of these are only the best scored items, they can exceed some of the criteria
        const meetsPriceCriteria = (e: Equipment) => (criteria.maxPrice == undefined || creditsFromCrFormat(e.price) <= criteria.maxPrice!);
        const meetsTLCriteria = (e: Equipment) => (criteria.maxTL == undefined || e.tl <= criteria.maxTL!);
        const meetsSectionsCriteria = (e: Equipment) => {
            if (criteria.sections.type === 'sections') {
                return criteria.sections.sections.includes(e.section);
            }
            return criteria.sections.sections.some((s) => s.section === e.section && s.subsection === e.subsection);
        }
        const items = results.filter((e) => meetsPriceCriteria(e) && meetsTLCriteria(e) && meetsSectionsCriteria(e));
        return items;
    }

    private log(...args: any[]) {
        console.debug('*** CloudflareEquipmentRepository:', ...args);
    }
}

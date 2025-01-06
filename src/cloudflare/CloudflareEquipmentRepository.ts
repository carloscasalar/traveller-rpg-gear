import { Context } from 'hono';
import { Env } from '../env';
import { Equipment, EquipmentRepository } from '../EquipmentRepository';

export class CloudflareEquipmentRepository implements EquipmentRepository {
    constructor(private readonly context: Context<{ Bindings: Env }>) {}

    public async findByQuestion(semanticQuery: string, maxResults: number): Promise<Equipment[]> {
        const embeddings = await this.context.env.AI.run('@cf/baai/bge-base-en-v1.5', { text: semanticQuery });
        const vectors = embeddings.data[0];

        const vectorQuery = await this.context.env.VECTORIZE.query(vectors, { topK: maxResults });
        if (vectorQuery.count === 0) {
            return [];
        }
        const itemIds = vectorQuery.matches.map((match) => match.id);

        const query = `SELECT * FROM equipment WHERE id IN (SELECT value FROM json_each(?1))`;
        const allIds = JSON.stringify(itemIds);
        const { results } = await this.context.env.DB.prepare(query).bind(allIds).all<Equipment>();
        if (results.length === 0) {
            return [];
        }

        // Ensure the order of the results is the same as the order of the itemIds,
        // as they are ordered by score.
        const resultsById = new Map<string, Equipment>();
        for (const result of results) {
            resultsById.set(result.id, result);
        }
        return itemIds.map((id) => resultsById.get(id)!);
    }
}

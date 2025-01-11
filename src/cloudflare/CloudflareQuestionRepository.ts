import { Ai, AiModels } from '@cloudflare/workers-types';
import { QuestionRepository } from '../QuestionRepository';

const questionModel: keyof AiModels = '@cf/meta/llama-3.1-8b-instruct-awq';
const to768EmbeddingsModel: keyof AiModels = '@cf/baai/bge-base-en-v1.5';
export class CloudflareQuestionRepository implements QuestionRepository {
    constructor(private readonly ai: Ai) {}

    async ask(systemPrompt: string, question: string, additionalContext?: string): Promise<string> {
        const result = await this.ai.run(questionModel, {
            messages: [
                ...(additionalContext ? [{ role: 'system', content: additionalContext }] : []),
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question },
            ],
        });

        if ('response' in result) {
            return result.response || '';
        }

        throw new Error(`unable get response from model: ${questionModel}`);
    }

    async askWithoutContext(question: string): Promise<string> {
        const result = await this.ai.run(questionModel, {
            prompt: question,
        });

        if ('response' in result) {
            return result.response || '';
        }

        throw new Error(`unable get response from model: ${questionModel}`);
    }

    async translateQuestionToEmbeddings(question: string): Promise<number[]> {
        const embeddings = await this.ai.run(to768EmbeddingsModel, { text: question });
        if ('data' in embeddings) {
            const vectorizedQuery = embeddings.data[0];
            return vectorizedQuery;
        }
        throw new Error(`unable to translate question to embeddings with model ${to768EmbeddingsModel}: ${question}`);
    }

    private log(...args: any[]) {
        console.debug('*** CloudflareQuestionRepository:', ...args);
    }
}

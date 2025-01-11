import { Ai } from '@cloudflare/workers-types'
import { QuestionRepository } from '../QuestionRepository';

const questionModel = '@cf/meta/llama-3.1-8b-instruct-awq';
const to768EmbeddingsModel = '@cf/baai/bge-base-en-v1.5';
export class CloudflareQuestionRepository implements QuestionRepository {
    constructor(private readonly ai: Ai) {}

    async ask(systemPrompt: string, question: string, additionalContext?: string): Promise<string> {
        const { response: answer } = await this.ai.run(questionModel, {
            messages: [
                ...(additionalContext ? [{ role: 'system', content: additionalContext }] : []),
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question },
            ],
        });
        return answer;
    }

    async askWithoutContext(question: string): Promise<string> {
        const { response: answer } = await this.ai.run(questionModel, {
            prompt: question,
        });
        return answer;
    }

    async translateQuestionToEmbeddings(question: string): Promise<number[]> {
        const embeddings = await this.ai.run(to768EmbeddingsModel, { text: question });
        const vectorizedQuery = embeddings.data[0];
        return vectorizedQuery;
    }

    private log(...args: any[]) {
        console.debug('*** CloudflareQuestionRepository:', ...args);
    }
}

import { Context } from 'hono';
import { Env } from '../env';
import { QuestionRepository } from '../QuestionRepository';

const questionModel = '@cf/meta/llama-3-8b-instruct';
const to768EmbeddingsModel = '@cf/baai/bge-base-en-v1.5';
export class CloudflareQuestionRepository implements QuestionRepository {
    constructor(private readonly context: Context<{ Bindings: Env }>) {}

    async ask(systemPrompt: string, question: string, additionalContext?: string): Promise<string> {
        const { response: answer } = await this.context.env.AI.run(questionModel, {
            messages: [
                ...(additionalContext ? [{ role: 'system', content: additionalContext }] : []),
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question },
            ],
        });
        return answer;
    }

    async askWithoutContext(question: string): Promise<string> {
        const { response: answer } = await this.context.env.AI.run(questionModel, {
            prompt: question,
        });
        return answer;
    }

    async translateQuestionToEmbeddings(question: string): Promise<number[]> {
        const embeddings = await this.context.env.AI.run(to768EmbeddingsModel, { text: question });
        const vectorizedQuery = embeddings.data[0];
        this.log('vectorizedQuery =>', vectorizedQuery);
        return vectorizedQuery;
    }

    private log(...args: any[]) {
        console.debug('*** CloudflareQuestionRepository:', ...args);
    }
}

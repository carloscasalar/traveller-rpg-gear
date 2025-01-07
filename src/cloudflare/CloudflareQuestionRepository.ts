import { Context } from 'hono';
import { Env } from '../env';
import { QuestionRepository } from '../QuestionRepository';

const questionModel = '@cf/meta/llama-3-8b-instruct';
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

    async askWithoutContext(prompt: string): Promise<string> {
        const { response: answer } = await this.context.env.AI.run(questionModel, {
            prompt,
        });
        return answer;
    }
}

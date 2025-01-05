import { Context } from 'hono';
import { Env } from '../env';
import { QuestionRepository } from '../QuestionRepository';

export class LlmRepository implements QuestionRepository {
    constructor(private readonly context: Context<{ Bindings: Env }>) {}

    async ask(systemPrompt: string, question: string, additionalContext?: string): Promise<string> {
        const { response: answer } = await this.context.env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
                ...(additionalContext ? [{ role: 'system', content: additionalContext }] : []),
                { role: 'system', content: systemPrompt },
                { role: 'user', content: question },
            ],
        });
        return answer;
    }
}

import { Ai, AiModels } from '@cloudflare/workers-types';
import { stripIndent } from 'common-tags';

import { AskOptions, QuestionRepository } from '../QuestionRepository';
import { JsonUnmarshaler } from '../json/JsonUnmarshaler';
import { ErrorAware } from '../types/returnTypes';

const questionModel: keyof AiModels = '@cf/meta/llama-3.1-8b-instruct-awq';
const to768EmbeddingsModel: keyof AiModels = '@cf/baai/bge-base-en-v1.5';
export class CloudflareQuestionRepository implements QuestionRepository {
    constructor(private readonly ai: Ai) {}

    async ask<T extends object>(
        systemPrompt: string,
        question: string,
        unmarshaler: JsonUnmarshaler<T>,
        { additionalContext }: AskOptions = {},
    ): Promise<ErrorAware<T>> {
        const typeConstrainedQuestion = stripIndent`${question}
        Answer in JSON format, don't explain the answer:
        ${unmarshaler.serializeSchema()}
        `;
        this.log('typeConstrainedQuestion: ', typeConstrainedQuestion);

        const result = await this.ai.run(questionModel, {
            messages: [
                ...(additionalContext ? [{ role: 'system', content: additionalContext }] : []),
                { role: 'system', content: systemPrompt },
                { role: 'user', content: typeConstrainedQuestion },
            ],
        });

        if (typeof result !== 'object' || result === null || !('response' in result) || typeof result.response !== 'string') {
            return { error: `unable get response from model ${questionModel}` };
        }

        const unmarshaledResponse = unmarshaler.unmarshal(result.response);
        if ('error' in unmarshaledResponse) {
            return unmarshaledResponse;
        }

        return unmarshaledResponse;
    }

    async askWithoutContext(question: string): Promise<string> {
        const result = await this.ai.run(questionModel, { prompt: question });

        if (typeof result === 'object' && result !== null && 'response' in result && typeof result.response === 'string') {
            return result.response || '';
        }

        throw new Error(`unable get response from model: ${questionModel}`);
    }

    async translateQuestionToEmbeddings(question: string): Promise<number[]> {
        const embeddings = await this.ai.run(to768EmbeddingsModel, { text: question });
        if (typeof embeddings === 'object' && embeddings !== null && 'data' in embeddings && embeddings.data?.[0]) {
            const vectorizedQuery = embeddings.data[0];
            return vectorizedQuery;
        }
        throw new Error(`unable to translate question to embeddings with model ${to768EmbeddingsModel}: ${question}`);
    }

    private log(...args: any[]) {
        console.debug('*** CloudflareQuestionRepository:', ...args);
    }
}

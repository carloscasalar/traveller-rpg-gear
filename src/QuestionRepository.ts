import { ErrorAware } from './types/returnTypes';
import { JsonUnmarshaler } from './json/JsonUnmarshaler';

export interface AskOptions {
    additionalContext?: string;
}
export interface QuestionRepository {
    ask<T extends object>(
        systemPrompt: string,
        question: string,
        unmarshaler: JsonUnmarshaler<T>,
        options?: AskOptions
    ): Promise<ErrorAware<T>>;
    askWithoutContext(question: string): Promise<string>;
    translateQuestionToEmbeddings(query: string): Promise<number[]>;
}

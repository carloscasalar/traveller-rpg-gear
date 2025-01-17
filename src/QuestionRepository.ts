export interface AskOptions {
    additionalContext?: string;
}
export interface QuestionRepository {
    ask(systemPrompt: string, question: string, options?: AskOptions): Promise<string>;
    askWithoutContext(question: string): Promise<string>;
    translateQuestionToEmbeddings(query: string): Promise<number[]>;
}

export interface QuestionRepository {
    ask(systemPrompt: string, question: string, additionalContext?: string): Promise<string>;
    askWithoutContext(question: string): Promise<string>;
    translateQuestionToEmbeddings(query: string): Promise<number[]>;
}

export interface QuestionRepository {
    ask(systemPrompt: string, question: string, additionalContext?: string): Promise<string>;
    askWithoutContext(prompt: string): Promise<string>;
}

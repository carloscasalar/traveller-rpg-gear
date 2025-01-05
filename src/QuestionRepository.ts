export interface QuestionRepository {
    ask(systemPrompt: string, question: string, additionalContext?: string): Promise<string>;
}

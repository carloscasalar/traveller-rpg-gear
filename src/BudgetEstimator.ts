import { stripIndents } from 'common-tags';
import { Character, Experience, experienceLevels } from './Character';
import { QuestionRepository } from './QuestionRepository';

export interface EstimatedBudget {
    salary: number;
    max_budget: number;
    armour: number;
    weapons: number;
    tools: number;
    commodities: number;
    reasoning: string;
}

export interface EstimateBudgetError {
    error: string;
    answer: string;
}

// Return type for the estimateBudget function that is either a EstimatedBudget or a EstimateBudgetError:
export type EstimateBudgetResponse = EstimatedBudget | EstimateBudgetError;

// This is a code example about how to handle the estimateBudget function response:
// const response = await estimateBudget({ req: { json: async () => character } });
// if ('error' in response) {
// 	console.error('Error:', response.error);
// } else {
// 	console.log('Armour:', response.armour);
// ...

export class BudgetEstimator {
    constructor(private readonly questionRepository: QuestionRepository) {}

    public async estimateBudget(character: Character): Promise<EstimateBudgetResponse> {
        const name = `${character.first_name} ${character.surname}`;
        const characteristics = Object.entries(character.characteristics)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
        const skills = character.skills.join(', ');
        const { experience, role } = character;
        const salary = this.estimateSalary(character);
        const maxBudget = this.estimateMaxTotalBudget(character);

        const question = stripIndents`
			${name} is a human who is a ${role}.
			We can rate his/her experience ${experience}, the rank of experience from lower to higher is: ${experienceLevels.join(', ')}.

			${name} characteristics are ${characteristics}.

			${name} skills are ${skills}.

			${name} current monthly salary is ${salary} Cr and the max budget for equipment based on her/his savings along his working life is ${maxBudget} Cr.

			Taking into account the profession of ${name}, suggest a budget for equipment distributed in several categories: armour, weapons, tools and commodities.
			Provide the response in JSON format, numbers are expressed as credits. Use this format:
			{
				"armour": number,
				"weapons": number,
				"tools": number,
				"commodities": number,
				"reasoning": string
			}
			DON'T explain the answer, just provide the budget JSON object.
		`;

        const systemPrompt = stripIndents`
			You are a Traveller RPG assistant helping to design remarkable NPCs for the adventure.
			The output must be in JSON format as it will be used by the system to return the result in a REST API.
		`;

        const answer = await this.questionRepository.ask(systemPrompt, question);

        try {
            const jsonAnswer = JSON.parse(answer) satisfies Omit<EstimatedBudget, 'salary' | 'max_budget'>;
            return { ...jsonAnswer, salary, max_budget: maxBudget };
        } catch (e) {
            return { error: 'unexpected answer format', answer };
        }
    }

    /*
    To make a guess about the character salary, we now live expenses are:
    - SOC 2, Very poor, month cost Cr 400
    - SOC 4, Poor, month cost Cr 800
    - SOC 5, Low, month cost Cr 1,000
    - SOC 6, Average, month cost Cr 1,200
    - SOC 7, Good, month cost Cr 1,500
    - SOC 8, High, month cost Cr 2,000
    - SOC 10, Very High, month cost Cr 2,500
    - SOC 12, Rich, month cost Cr 5,000
    - SOC 14, Very Rich, month cost Cr 12,000
    - SOC 15, Ludicrously Rich, month cost Cr 20,000

    We can assume that the character will spend a given percentage of his salary in living expense based on his experience level:
    - recruit 70%
    - rookie 60%
    - intermediate 50%
    - regular 40%
    - veteran 20%
    - elite 10%
  */
    private estimateSalary(character: Character, experience?: Experience): number {
        const expensesPctByExperience: Record<Experience, number> = {
            recruit: 70,
            rookie: 60,
            intermediate: 50,
            regular: 40,
            veteran: 20,
            elite: 10,
        };
        const cost = this.estimateMonthlyLivingCost(character);
        const pct = expensesPctByExperience[experience || character.experience] || 40;
        const salary = Math.round((cost * 100) / pct);
        return salary;
    }

    private estimateMonthlyLivingCost(character: Character): number {
        const monthlyLivingCostBySoc: Record<number, number> = {
            2: 400,
            4: 800,
            5: 1000,
            6: 1200,
            7: 1500,
            8: 2000,
            10: 2500,
            12: 5000,
            14: 12000,
            15: 20000,
        };
        return monthlyLivingCostBySoc[character.characteristics.SOC] || 2000;
    }

    private estimateMaxTotalBudget(character: Character): number {
        const maxMonthsByExperience: Record<Experience, number> = {
            recruit: 24, // up to 2 years
            rookie: 60, // up to 5 years
            intermediate: 72, // up to 6 years
            regular: 120, // up to 10 years
            veteran: 180, // up to 15 years
            elite: 204, // up to 17 years
        };

        const characterExperience = experienceLevels.includes(character.experience as Experience) ? character.experience : 'regular';
        const experienceLevelsAchieved = experienceLevels.slice(0, experienceLevels.indexOf(characterExperience) + 1);
        const maxBudget = experienceLevelsAchieved.reduce((acc, experience) => {
            const months = Math.floor(Math.random() * maxMonthsByExperience[experience]);
            const salary = this.estimateSalary(character, experience);
            const expenses = this.estimateMonthlyLivingCost(character);
            const savings = (salary - expenses) * months;
            return acc + savings;
        }, 0);
        return maxBudget;
    }
}

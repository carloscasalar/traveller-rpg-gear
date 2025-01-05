export interface Character {
    characteristics: {
        DEX: number;
        EDU: number;
        END: number;
        INT: number;
        SOC: number;
        STR: number;
    };
    citizen_category: string;
    experience: Experience;
    first_name: string;
    role: string;
    skills: string[];
    surname: string;
}
export type Experience = 'recruit' | 'rookie' | 'intermediate' | 'regular' | 'veteran' | 'elite';
export const experienceLevels: Experience[] = ['recruit', 'rookie', 'intermediate', 'regular', 'veteran', 'elite'];

const estimateMonthlyLivingCost = (character: Character): number => {
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
};
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
export const estimateSalary = (character: Character, experience?: Experience): number => {
    const expensesPctByExperience: Record<Experience, number> = {
        recruit: 70,
        rookie: 60,
        intermediate: 50,
        regular: 40,
        veteran: 20,
        elite: 10,
    };
    const cost = estimateMonthlyLivingCost(character);
    const pct = expensesPctByExperience[experience || character.experience] || 40;
    const salary = Math.round((cost * 100) / pct);
    return salary;
};

/*
  If we rate experience from lower to highest, here are the estimated amount of time the has been working at his current experience level:
	- recruit up to 2 years
	- rookie up to 5 years
	- intermediate up to 6 years
	- regular up to 10 years
	- veteran up to 15 years
	- elite up to 17 years

	All them are accumulative so an intermediate character has been working 1 month to 2 years as recruit, 1 year to 5 years as rookie and 4 years to 10 years as intermediate.
	Max budget will be the sum of the estimated savings (salary - living expenses)*time worked at each level.
*/
export const estimateMaxTotalBudget = (character: Character): number => {
    const maxMonthsByExperience: Record<Experience, number> = {
        recruit: 24,
        rookie: 60,
        intermediate: 72,
        regular: 120,
        veteran: 180,
        elite: 204,
    };

    const characterExperience = experienceLevels.includes(character.experience as Experience) ? character.experience : 'regular';
    const experienceLevelsAchieved = experienceLevels.slice(0, experienceLevels.indexOf(characterExperience) + 1);
    const maxBudget = experienceLevelsAchieved.reduce((acc, experience) => {
        const months = Math.floor(Math.random() * maxMonthsByExperience[experience]);
        const salary = estimateSalary(character, experience);
        const expenses = estimateMonthlyLivingCost(character);
        const savings = (salary - expenses) * months;
        return acc + savings;
    }, 0);
    return maxBudget;
};

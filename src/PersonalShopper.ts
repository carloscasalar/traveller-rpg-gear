import { stripIndent } from 'common-tags';
import { z } from 'zod';
import { Character, experienceLevels } from './character';
import { Equipment, EquipmentCriteria, EquipmentRepository } from './EquipmentRepository';
import { QuestionRepository } from './QuestionRepository';
import { creditsFromCrFormat } from './price';

export interface SuggestionError {
    error: string;
    answer: string;
}

export interface ArmourSuggestion {
    found: true;
    armour: Equipment;
    augments: Equipment[];
}

export interface NoSuggestionFound {
    found: false;
}

export type SingleSuggestion<SuggestedEntity> = SuggestedEntity | NoSuggestionFound | SuggestionError;

const queryEquipmentIdsSchema = z.object({
    itemIds: z.array(z.string()),
    reasoning: z.string(),
});

export class PersonalShopper {
    constructor(private readonly equipmentRepository: EquipmentRepository, private readonly questionRepository: QuestionRepository) {}
    async suggestArmour(character: Character, budget: number): Promise<SingleSuggestion<ArmourSuggestion>> {
        const armourCriteria: EquipmentCriteria = {
            sections: {
                type: 'sections',
                sections: ['Armour'],
            },
            maxPrice: budget,
            maxTL: 12, // TODO: infer from SOC and/or experience
        };

        const additionalArmourContext = `suitable for a ${character.role} with ${character.experience} experience.`;
        const suitableAmours = await this.equipmentRepository.findByCriteria(armourCriteria, additionalArmourContext, 30);
        this.log('Suitable armours:\n', suitableAmours.map((i) => `${i.name} [${i.section}/${i.subsection}] [${i.tl}] [${creditsFromCrFormat(i.price)}] [${i.mass}] [${i.skill}]`));

        const additionalShoppingContext = stripIndent`These are the available items in format "id: name [section/subsection] [tl] [price in credits] [weight in kg] [skill requirement if any]:
            ${suitableAmours.map((i) => `${i.id}: ${i.name} [${i.section}/${i.subsection}] [${i.tl}] [${i.price}] [${i.mass}] [${i.skill}]`).join('\n')}
        `;
        const systemMessage = stripIndent`You are a personal shopper for Traveller RPG NPCs.
            You will be asked to suggest equipment for a character based on their characteristics, experience, skills and budget.
            You will NEVER suggest an item with price higher than the budget.
            For example, if the budget is 1000, and there is an item with price 10000 you'll never suggest it because 10000 (the price) is higher than 1000 (the budget). If there is no item within the budget, is ok to suggest nothing.
            Keep in mind that experience levels are these, from lower to higher: ${experienceLevels.join(', ')}.
            Characteristics are rated from 2 to 15. Characters with higher SOC (social standing) and/or experience should have access to higher TL (tech level) equipment.
            TL is the tech level of the equipment and is rated from 0 to 15. TL higher than 12 is considered very advanced and only available for high SOC or high experience NPCs.
        `;

        const whoAmI = stripIndent`
            I am a ${character.role} with ${character.experience} experience.

            My skills are ${character.skills.join(', ')}.

            My characteristics are ${Object.entries(character.characteristics)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}

            I cannot spend more than Cr${budget}.
        `;
        const whatDoIWant = stripIndent`I want you to suggest me one single armour to wear
        Answer in JSON format, use the 'reasoning' attribute to explain your choices if you need to:
            {
                "itemIds": string[],
                "reasoning": string
            }
        `;

        const rawArmourSuggestion = await this.questionRepository.ask(systemMessage, `${whoAmI}${whatDoIWant}`, additionalShoppingContext);
        let armoursSuggestion;
        try {
            const parsedAnswer = JSON.parse(rawArmourSuggestion);
            armoursSuggestion = queryEquipmentIdsSchema.safeParse(parsedAnswer);
            if (!armoursSuggestion.success) {
                return { error: 'Unexpected answer response shape', answer: rawArmourSuggestion };
            }
        } catch (e) {
            return { error: 'Error parsing items answer response', answer: rawArmourSuggestion };
        }
        this.log('raw armour suggestion:', armoursSuggestion.data);
        if (armoursSuggestion.data.itemIds.length === 0) {
            return { found: false };
        }
        if (armoursSuggestion.data.itemIds.length > 1) {
            this.log('More than one armour suggested, taking the first one', armoursSuggestion.data.itemIds);
        }
        const armour = suitableAmours.find((a) => a.id === armoursSuggestion.data.itemIds[0]);
        if (!armour) {
            return { error: 'armour ID suggested does not exists', answer: rawArmourSuggestion };
        }

        return {
            found: true,
            armour,
            augments: [],
        };
    }

    private log(...args: unknown[]) {
        console.log('*** PersonalShopper:', ...args);
    }
    private logError(message: string) {
        console.error(`*** PersonalShopper: ${message}`);
    }
}

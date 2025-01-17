import { stripIndent } from 'common-tags';
import { z } from 'zod';

import { Equipment, EquipmentCriteria, EquipmentRepository } from './EquipmentRepository';
import { QuestionRepository } from './QuestionRepository';
import { Character, experienceLevels } from './character';
import { ZodJsonUnmarshaler } from './json/ZodJsonUnmarshaler';
import { creditsFromCrFormat } from './price';
import { ErrorAware, SearchResult } from './types/returnTypes';

export interface ArmourSuggestion {
    armour: Equipment;
    augments: Equipment[];
}

const queryEquipmentIdsSchema = z.object({
    itemIds: z.array(z.string()),
    reasoning: z.string().optional(),
});

type QueryEquipmentIds = z.infer<typeof queryEquipmentIdsSchema>;

const questionEquipmentUnmarshaler = new ZodJsonUnmarshaler(
    queryEquipmentIdsSchema,
    stripIndent`
    {
        itemIds: []string,
        reasoning?: string
    }
    `,
);

export class PersonalShopper {
    constructor(
        private readonly equipmentRepository: EquipmentRepository,
        private readonly questionRepository: QuestionRepository,
    ) {}
    public async suggestArmour(character: Character, budget: number): Promise<SearchResult<ArmourSuggestion>> {
        const suitableAmours = await this.getAvailableArmours(character, budget);
        if (suitableAmours.length === 0) {
            return { found: false };
        }

        const whatDoIWant = 'I want you to suggest me ONE single armour to wear';
        const armourSuggestions = await this.suggestEquipment(character, whatDoIWant, suitableAmours, budget);
        if ('error' in armourSuggestions) {
            this.logError(`Error suggesting armour: ${armourSuggestions.error}`);
            this.log('raw armour suggestion:', armourSuggestions.context);
            return { found: false };
        }

        if (armourSuggestions.length > 1) {
            this.log('More than one armour suggested, taking the first one', armourSuggestions.map((a) => `${a.id}: ${a.name}`).join(', '));
        }
        const armour = armourSuggestions[0];
        const remainingBudget = budget - creditsFromCrFormat(armour.price);
        const suitableAugments = await this.getAvailableAugments(character, remainingBudget);
        if (suitableAugments.length === 0) {
            return {
                found: true,
                result: {
                    armour,
                    augments: [],
                },
            };
        }

        const whatDoIWantAugments = `I want you to suggest me up to three augmentations for my amour ${armour.name}`;
        const augmentsSuggestions = await this.suggestEquipment(character, whatDoIWantAugments, suitableAugments, remainingBudget);
        if ('error' in augmentsSuggestions) {
            this.logError(`Error suggesting augments: ${augmentsSuggestions.error}`);
            this.log('raw augments suggestion:', augmentsSuggestions.context);
            return { found: true, result: { armour, augments: [] } };
        }

        return {
            found: true,
            result: {
                armour,
                augments: augmentsSuggestions,
            },
        };
    }

    private async getAvailableArmours(character: Character, budget: number): Promise<Equipment[]> {
        const armourCriteria: EquipmentCriteria = {
            sections: {
                type: 'sections',
                sections: ['Armour'],
            },
            maxPrice: budget,
            maxTL: 12, // TODO: infer from SOC and/or experience
        };

        const additionalArmourContext = `suitable for a ${character.role} with ${character.experience} experience.`;
        return this.equipmentRepository.findByCriteria(armourCriteria, additionalArmourContext, 30);
    }

    private async getAvailableAugments(character: Character, budget: number): Promise<Equipment[]> {
        const armourCriteria: EquipmentCriteria = {
            sections: {
                type: 'sections-subsection',
                sections: [
                    { section: 'Armour', subsection: 'Armour Modifications' },
                    { section: 'Armour', subsection: 'Armour Mods' },
                    { section: 'Augments', subsection: 'Augment Options' },
                ],
            },
            maxPrice: budget,
            maxTL: 12, // TODO: infer from SOC and/or experience
        };

        const additionalArmourContext = `suitable for a ${character.role} with ${character.experience} experience.`;
        return this.equipmentRepository.findByCriteria(armourCriteria, additionalArmourContext, 30);
    }

    private async suggestEquipment(
        character: Character,
        whatDoIWant: string,
        itemsAvailable: Equipment[],
        budget: number,
    ): Promise<ErrorAware<Equipment[]>> {
        const additionalShoppingContext = stripIndent`These are the available items in format "id: name [section/subsection] [tl] [price in credits] [weight in kg] [skill requirement if any]:
        ${itemsAvailable
            .map(
                (i) =>
                    `${i.id}: ${i.name} [${i.section}/${i.subsection}] [${i.tl}] [${creditsFromCrFormat(i.price)}] [${i.mass}] [${i.skill}]`,
            )
            .join('\n')}
        `;
        this.log('shopping context:', additionalShoppingContext);

        const systemMessage = stripIndent`You are a personal shopper for Traveller RPG NPCs.
            You will be asked to suggest equipment for a NPC based on their characteristics, experience, skills and budget.
            You will NEVER suggest a group of items that together cost more than the NPC's budget.
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

            My budget is ${budget} Credits and I cannot exceed it.
        `;

        const itemsSuggestion = await this.questionRepository.ask<QueryEquipmentIds>(
            systemMessage,
            `${whoAmI}${whatDoIWant}`,
            questionEquipmentUnmarshaler,
            {
                additionalContext: additionalShoppingContext,
            },
        );

        if ('error' in itemsSuggestion) {
            return { error: itemsSuggestion.error, context: itemsSuggestion.context };
        }

        return itemsSuggestion.itemIds.reduce((acc: Equipment[], itemId) => {
            const item = itemsAvailable.find((i) => i.id === itemId);
            if (!item) {
                this.logError(`Item ID suggested does not exists ${itemId} [${itemsSuggestion.reasoning}]`);
                return acc;
            }
            return [...acc, item];
        }, []);
    }

    private log(...args: unknown[]) {
        console.log('*** PersonalShopper:', ...args);
    }
    private logError(message: string) {
        console.error(`*** PersonalShopper: ${message}`);
    }
}

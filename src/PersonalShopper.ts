import { stripIndent } from 'common-tags';
import { Character, experienceLevels } from './character';
import { Equipment, EquipmentRepository } from './EquipmentRepository';

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

export class PersonalShopper {
    constructor(private readonly equipmentRepository: EquipmentRepository) {}
    async suggestArmour(character: Character, budget: number): Promise<SingleSuggestion<ArmourSuggestion>> {
        const semanticQuery = stripIndent`
            Suggest an armour suitable for a ${character.role} with ${character.experience} experience.
            Keep in mind that experience levels are these, from lower to higher: ${experienceLevels.join(', ')}.

            The ${character.role}'s skills are ${character.skills.join(', ')}.

            The ${character.role}'s characteristics are ${Object.entries(character.characteristics)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')}, all them rated from 2 to 15.
            SOC (social standing) and experience should be the factors to consider which TL (tech level) the armour could have.

            The armour should be suitable for someone with ${character.role} duties.

            The budget for the armour is Cr${budget}.
        `;

        const armourSuggestions = await this.equipmentRepository.findByQuestion(semanticQuery, 1);
        if (armourSuggestions.length === 0) {
            return { found: false };
        }
        const suggestedAmour = armourSuggestions[0];

        const askForAugments = stripIndent`
            Suggest some Augment Options for the armour ${armourSuggestions[0].name} that could be useful for a ${character.experience} ${character.role}.

            The total budget for the armour and the augments is Cr${budget} and the ${character.experience} has already spent ${suggestedAmour.price}.
        `;
        const augmentSuggestions = await this.equipmentRepository.findByQuestion(askForAugments, 3);

        return {
            found: true,
            armour: armourSuggestions[0],
            augments: augmentSuggestions,
        };
    }
}

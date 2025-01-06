import { Character } from './Character';
import { Equipment, EquipmentRepository } from './EquipmentRepository';

export interface SuggestionError {
    error: string;
    answer: string;
}

export interface ArmourSuggestion {
    armour: Equipment;
    augments: Equipment[];
}

export type SingleSuggestion<SuggestedEntity> = SuggestedEntity | SuggestionError;

export class PersonalShopper {
    constructor(private readonly equipmentRepository: EquipmentRepository) {}
    async suggestArmour(character: Character, budget: number): Promise<SingleSuggestion<ArmourSuggestion>> {
        throw new Error('Method not implemented.');
    }
}

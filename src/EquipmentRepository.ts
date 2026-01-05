import { Need } from './needs';
import { ErrorAware } from './types/returnTypes';

export interface EquipmentNeed {
    need: Need;
    weight: number; // 0-10
}

export interface Equipment {
    id: string;
    section: Section;
    subsection: string;
    name: string;
    tl: number;
    weight_kg: number;
    price_cr: number;
    ammo_price: string;
    species: string;
    skill: string;
    book: string;
    page: number;
    contraband: number;
    category: string;
    law_illegal_from: number | null;
    notes: string;
    mod: string;
    needs?: EquipmentNeed[]; // Populated from equipment_needs join
}

const sections = [
    'Armour',
    'Augmentation',
    'Augments',
    'Computers',
    'Discerning Weapons Specialist',
    'Electronics',
    'Heavy Weapons',
    'Home Comforts',
    'Medical Supplies',
    'Robots',
    'Survival Gear',
    'Tools',
    'Weapons',
] as const;
export type Section = (typeof sections)[number];

export interface ListOfSectionsSubsectionCriteria {
    type: 'sections-subsection';
    sections: { section: Section; subsection: string }[];
}

export interface ListOfSectionsCriteria {
    type: 'sections';
    sections: Section[];
}

export type SectionsCriteria = ListOfSectionsCriteria | ListOfSectionsSubsectionCriteria;

export interface EquipmentCriteria {
    sections: SectionsCriteria;
    maxPrice?: number;
    maxTL?: number;
}

export interface EquipmentRepository {
    findByCriteria(criteria: EquipmentCriteria, additionalContext: string, maxResults: number): Promise<ErrorAware<Equipment[]>>;
}

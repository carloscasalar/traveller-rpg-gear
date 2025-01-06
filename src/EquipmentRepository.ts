export interface Equipment {
    id: string;
    section: Section;
    subsection: string;
    name: string;
    tl: number;
    mass: number;
    price: string;
    ammo_price: string;
    species: string;
    skill: string;
    book: string;
    page: number;
    contraband: number;
    category: string;
    law: number;
    notes: string;
    mod: string;
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

export interface EquipmentRepository {}
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

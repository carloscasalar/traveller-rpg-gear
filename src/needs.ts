/**
 * Stable needs vocabulary for equipment tagging and role-based selection.
 * 
 * IMPORTANT: Keep this list minimal and stable (10–30 needs).
 * Changes require re-tagging the entire equipment catalog and re-indexing Vectorize.
 * 
 * Each need represents a functional capability or requirement that equipment can fulfill.
 */

export const NEEDS = [
    'combat_ranged',     // Ranged weapons, ammunition
    'combat_melee',      // Melee weapons, close combat gear
    'protection',        // Armor, protective equipment
    'medical',           // Medical supplies, first aid
    'survival',          // Environmental suits, survival gear
    'mobility',          // Movement aids, transportation
    'stealth',           // Concealment, silent operation
    'sensors',           // Detection, scanning, reconnaissance
    'communications',    // Comms devices, translation
    'computing',         // Computers, data processing
    'hacking',           // Intrusion software, security bypass
    'engineering',       // Repair tools, technical equipment
    'science',           // Lab equipment, analysis tools
    'social',            // Luxury items, status symbols
    'cargo',             // Storage, containers
] as const;

export type Need = typeof NEEDS[number];

/**
 * Validate that a need string is in the approved vocabulary.
 */
export function isValidNeed(need: string): need is Need {
    return NEEDS.includes(need as Need);
}

/**
 * Weight must be an integer from 0 to 10 (inclusive).
 */
export function isValidNeedWeight(weight: number): boolean {
    return Number.isInteger(weight) && weight >= 0 && weight <= 10;
}

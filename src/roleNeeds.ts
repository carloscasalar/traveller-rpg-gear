import { Need } from './needs';

/**
 * Role → needs mapping.
 *
 * Maps each role to a weighted set of needs (0-10 scale).
 * This mapping is the application's source of truth for role intent;
 * roles are never stored in the database.
 *
 * Weight semantics:
 * - 10: Core requirement (primary function)
 * - 7-9: Important capability
 * - 4-6: Useful/common capability
 * - 1-3: Occasional/situational need
 */

export interface RoleNeeds {
    [need: string]: number; // Need → weight (0-10)
}

/**
 * Stable role → needs mapping for equipment selection.
 */
export const roleToNeeds: Record<string, RoleNeeds> = {
    pilot: {
        communications: 8,
        computing: 7,
        sensors: 6,
        survival: 5,
        protection: 4,
        combat_ranged: 1,
        combat_melee: 1,
    },
    navigator: {
        computing: 9,
        sensors: 8,
        communications: 6,
        science: 4,
        protection: 1,
        combat_ranged: 1,
        combat_melee: 1,
    },
    engineer: {
        engineering: 10,
        computing: 6,
        science: 5,
        survival: 4,
        protection: 1,
        combat_ranged: 1,
        combat_melee: 1,
    },
    steward: {
        social: 8,
        medical: 5,
        communications: 5,
        cargo: 4,
        protection: 1,
        combat_ranged: 1,
        combat_melee: 1,
    },
    medic: {
        medical: 10,
        science: 6,
        computing: 4,
        survival: 4,
        protection: 1,
        combat_ranged: 1,
        combat_melee: 1,
    },
    marine: {
        combat_ranged: 10,
        combat_melee: 8,
        protection: 9,
        survival: 6,
        sensors: 5,
    },
    gunner: {
        combat_ranged: 10,
        sensors: 7,
        computing: 5,
        protection: 6,
        combat_melee: 1,
    },
    scout: {
        sensors: 9,
        survival: 8,
        communications: 7,
        combat_ranged: 6,
        protection: 5,
        stealth: 5,
        combat_melee: 1,
    },
    technician: {
        engineering: 9,
        computing: 7,
        science: 5,
        hacking: 4,
        protection: 1,
        combat_ranged: 1,
        combat_melee: 1,
    },
    leader: {
        communications: 8,
        computing: 6,
        social: 7,
        combat_ranged: 5,
        protection: 5,
        combat_melee: 1,
    },
    diplomat: {
        social: 10,
        communications: 8,
        computing: 6,
        protection: 3,
        combat_ranged: 2,
        combat_melee: 1,
    },
    entertainer: {
        social: 9,
        communications: 6,
        computing: 4,
        protection: 1,
        combat_ranged: 1,
        combat_melee: 1,
    },
    trader: {
        social: 8,
        communications: 7,
        computing: 7,
        cargo: 6,
        sensors: 4,
        protection: 1,
        combat_ranged: 1,
        combat_melee: 1,
    },
    thug: {
        combat_melee: 9,
        combat_ranged: 8,
        protection: 7,
        stealth: 5,
    },
};

/**
 * Get the needs profile for a given role.
 * Returns empty object if role is unknown (graceful degradation).
 */
export function getNeedsForRole(role: string): RoleNeeds {
    const normalized = role.toLowerCase().trim();
    return roleToNeeds[normalized] || {};
}

import { describe, it, expect } from 'vitest';
import ageBands from '../../server/utils/ageBands.js';

const {
    AGE_BANDS,
    calcAgeFromBirthDate,
    getAgeBandIdForAge,
    getAgeBandIdFromBirthDate,
    storyMatchesAgeBand,
} = ageBands;

describe('AGE_BANDS', () => {
    it('contient les 3 tranches attendues', () => {
        expect(AGE_BANDS.map((b) => b.id)).toEqual(['petits', 'moyens', 'grands']);
    });
});

describe('calcAgeFromBirthDate', () => {
    it('retourne null si la date est absente', () => {
        expect(calcAgeFromBirthDate(null)).toBeNull();
        expect(calcAgeFromBirthDate(undefined)).toBeNull();
    });

    it('retourne null si la date est invalide', () => {
        expect(calcAgeFromBirthDate('pas-une-date')).toBeNull();
    });

    it('calcule correctement un âge', () => {
        const today = new Date();
        const birth = new Date(today.getFullYear() - 7, today.getMonth(), today.getDate());
        expect(calcAgeFromBirthDate(birth)).toBe(7);
    });

    it("ne compte pas l'année si l'anniversaire n'est pas encore passé", () => {
        const today = new Date();
        const birth = new Date(today.getFullYear() - 7, today.getMonth(), today.getDate() + 1);
        expect(calcAgeFromBirthDate(birth)).toBe(6);
    });
});

describe('getAgeBandIdForAge', () => {
    it('retourne null pour un âge invalide', () => {
        expect(getAgeBandIdForAge(null)).toBeNull();
        expect(getAgeBandIdForAge(NaN)).toBeNull();
    });

    it('classe les petits (3-5 ans)', () => {
        expect(getAgeBandIdForAge(3)).toBe('petits');
        expect(getAgeBandIdForAge(5)).toBe('petits');
    });

    it('classe les moyens (6-8 ans)', () => {
        expect(getAgeBandIdForAge(6)).toBe('moyens');
        expect(getAgeBandIdForAge(8)).toBe('moyens');
    });

    it('classe les grands (9 ans et plus)', () => {
        expect(getAgeBandIdForAge(9)).toBe('grands');
        expect(getAgeBandIdForAge(12)).toBe('grands');
    });
});

describe('getAgeBandIdFromBirthDate', () => {
    it('déduit la tranche depuis la date de naissance', () => {
        const today = new Date();
        const birth = new Date(today.getFullYear() - 4, today.getMonth(), today.getDate());
        expect(getAgeBandIdFromBirthDate(birth)).toBe('petits');
    });
});

describe('storyMatchesAgeBand', () => {
    it('accepte tout si aucune tranche demandée', () => {
        expect(storyMatchesAgeBand({ ageCategory: 'petits' }, null)).toBe(true);
    });

    it("accepte les histoires sans tranche d'âge", () => {
        expect(storyMatchesAgeBand({ title: 'Sans tranche' }, 'moyens')).toBe(true);
    });

    it('compare la tranche de l\'histoire à celle demandée', () => {
        expect(storyMatchesAgeBand({ ageCategory: 'moyens' }, 'moyens')).toBe(true);
        expect(storyMatchesAgeBand({ ageCategory: 'petits' }, 'moyens')).toBe(false);
    });

    it('supporte aussi le champ ageBand', () => {
        expect(storyMatchesAgeBand({ ageBand: 'grands' }, 'grands')).toBe(true);
    });
});

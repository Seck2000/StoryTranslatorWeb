import { describe, it, expect } from 'vitest';
import { containsDigits, DIGIT_ERROR_MESSAGE } from '../../client/src/utils/chatValidation.js';

describe('containsDigits', () => {
    it('détecte les chiffres occidentaux (0-9)', () => {
        expect(containsDigits('il y a 7 nains')).toBe(true);
        expect(containsDigits('42')).toBe(true);
    });

    it('détecte les chiffres arabes (٠-٩)', () => {
        expect(containsDigits('٧ أقزام')).toBe(true);
    });

    it('accepte les nombres écrits en lettres', () => {
        expect(containsDigits('il y a sept nains')).toBe(false);
        expect(containsDigits('quarante-deux')).toBe(false);
    });

    it('gère les textes vides ou absents', () => {
        expect(containsDigits('')).toBe(false);
        expect(containsDigits(null)).toBe(false);
        expect(containsDigits(undefined)).toBe(false);
    });
});

describe('DIGIT_ERROR_MESSAGE', () => {
    it('est un message non vide', () => {
        expect(typeof DIGIT_ERROR_MESSAGE).toBe('string');
        expect(DIGIT_ERROR_MESSAGE.length).toBeGreaterThan(0);
    });
});

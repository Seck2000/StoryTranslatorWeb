import { describe, it, expect } from 'vitest';
import aiChat from '../../server/services/aiChat.js';

const { buildStoryContext, normalizeScenes, containsDigits } = aiChat;

describe('buildStoryContext', () => {
    it('assemble le titre et les scènes', () => {
        const scenes = [
            { id: 1, text: 'Début' },
            { id: 2, text: 'Fin' },
        ];
        const context = buildStoryContext('Mon histoire', scenes);
        expect(context).toContain('Titre: Mon histoire');
        expect(context).toContain('Scène 1: Début');
        expect(context).toContain('Scène 2: Fin');
    });

    it("numérote à partir de l'index si l'id est absent", () => {
        const context = buildStoryContext('Titre', [{ text: 'Sans id' }]);
        expect(context).toContain('Scène 1: Sans id');
    });
});

describe('normalizeScenes', () => {
    it('retourne null pour une entrée invalide ou vide', () => {
        expect(normalizeScenes(null)).toBeNull();
        expect(normalizeScenes([])).toBeNull();
        expect(normalizeScenes('pas-un-tableau')).toBeNull();
    });

    it('retourne null si toutes les scènes sont vides', () => {
        expect(normalizeScenes([{ text: '' }, { text: '   ' }])).toBeNull();
    });

    it('nettoie et filtre les scènes', () => {
        const result = normalizeScenes([
            { id: 5, text: '  Bonjour  ' },
            { text: 'Deuxième' },
            { text: '' },
        ]);
        expect(result).toEqual([
            { id: 5, text: 'Bonjour' },
            { id: 2, text: 'Deuxième' },
        ]);
    });
});

describe('containsDigits (côté serveur)', () => {
    it('détecte les chiffres occidentaux, arabes et persans', () => {
        expect(containsDigits('7')).toBe(true);
        expect(containsDigits('٣')).toBe(true);
        expect(containsDigits('۴')).toBe(true);
    });

    it('accepte un texte sans chiffres', () => {
        expect(containsDigits('sept')).toBe(false);
        expect(containsDigits('')).toBe(false);
    });
});

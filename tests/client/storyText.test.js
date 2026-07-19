import { describe, it, expect } from 'vitest';
import { getSceneText, buildScenesPayload } from '../../client/src/utils/storyText.js';

describe('getSceneText', () => {
    it('retourne une chaîne vide si la scène est vide', () => {
        expect(getSceneText(null)).toBe('');
        expect(getSceneText({})).toBe('');
    });

    it('retourne le texte simple (string)', () => {
        expect(getSceneText({ text: '  Il était une fois  ' })).toBe('Il était une fois');
    });

    it('retourne le texte français en priorité (objet multilingue)', () => {
        const scene = { text: { fr: 'Bonjour', en: 'Hello', ar: 'مرحبا' } };
        expect(getSceneText(scene)).toBe('Bonjour');
    });

    it("retombe sur l'anglais puis l'arabe si le français est absent", () => {
        expect(getSceneText({ text: { en: 'Hello' } })).toBe('Hello');
        expect(getSceneText({ text: { ar: 'مرحبا' } })).toBe('مرحبا');
    });
});

describe('buildScenesPayload', () => {
    it("retourne un tableau vide si l'histoire n'a pas de scènes", () => {
        expect(buildScenesPayload(null)).toEqual([]);
        expect(buildScenesPayload({})).toEqual([]);
        expect(buildScenesPayload({ scenes: 'pas-un-tableau' })).toEqual([]);
    });

    it('construit le payload avec id et texte', () => {
        const story = {
            scenes: [
                { id: 1, text: 'Scène un' },
                { id: 2, text: { fr: 'Scène deux' } },
            ],
        };
        expect(buildScenesPayload(story)).toEqual([
            { id: 1, text: 'Scène un' },
            { id: 2, text: 'Scène deux' },
        ]);
    });

    it("génère un id à partir de l'index si absent", () => {
        const story = { scenes: [{ text: 'Sans id' }] };
        expect(buildScenesPayload(story)).toEqual([{ id: 1, text: 'Sans id' }]);
    });

    it('filtre les scènes sans texte', () => {
        const story = {
            scenes: [
                { id: 1, text: 'Valide' },
                { id: 2, text: '   ' },
                { id: 3 },
            ],
        };
        expect(buildScenesPayload(story)).toEqual([{ id: 1, text: 'Valide' }]);
    });
});

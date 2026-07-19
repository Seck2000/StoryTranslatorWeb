import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Tous les tests vivent dans le dossier tests/ à la racine
        include: ['tests/**/*.test.js'],
        environment: 'node',
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: [
                'server/utils/**/*.js',
                'server/services/**/*.js',
                'client/src/utils/**/*.js',
            ],
        },
    },
});

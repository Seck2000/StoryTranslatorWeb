const DIGIT_PATTERN = /[0-9٠-٩۰-۹]/;

export function containsDigits(text) {
    return DIGIT_PATTERN.test(text || '');
}

export const DIGIT_ERROR_MESSAGE =
    'Pas de chiffres ! Écris ta réponse en lettres (exemple : sept, pas 7).';

/** Tranches d'âge pour histoires enfants */
export const AGE_BANDS = [
    {
        id: 'petits',
        label: '3 à 5 ans',
        shortLabel: 'Petits',
        minAge: 3,
        maxAge: 5,
        description: 'Histoires très simples',
    },
    {
        id: 'moyens',
        label: '6 à 8 ans',
        shortLabel: 'Moyens',
        minAge: 6,
        maxAge: 8,
        description: 'Contes et aventures faciles',
    },
    {
        id: 'grands',
        label: '9 à 12 ans',
        shortLabel: 'Grands',
        minAge: 9,
        maxAge: 12,
        description: 'Histoires plus riches',
    },
];

export function calcAgeFromBirthDate(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age;
}

export function getAgeBandForAge(age) {
    if (age == null || Number.isNaN(age)) return null;
    if (age < 3) return AGE_BANDS[0];
    if (age <= 5) return AGE_BANDS[0];
    if (age <= 8) return AGE_BANDS[1];
    return AGE_BANDS[2];
}

export function getAgeBandById(id) {
    return AGE_BANDS.find((band) => band.id === id) || null;
}

export function storyMatchesAgeBand(story, bandId) {
    if (!bandId) return true;
    const storyBand = story?.ageCategory || story?.ageBand;
    if (!storyBand) return true;
    return storyBand === bandId;
}

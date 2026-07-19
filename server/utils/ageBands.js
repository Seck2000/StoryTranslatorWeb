const AGE_BANDS = [
    { id: 'petits', minAge: 3, maxAge: 5 },
    { id: 'moyens', minAge: 6, maxAge: 8 },
    { id: 'grands', minAge: 9, maxAge: 12 },
];

function calcAgeFromBirthDate(birthDate) {
    if (!birthDate) return null;
    const birth = birthDate instanceof Date ? birthDate : new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age;
}

function getAgeBandIdForAge(age) {
    if (age == null || Number.isNaN(age)) return null;
    if (age <= 5) return 'petits';
    if (age <= 8) return 'moyens';
    return 'grands';
}

function getAgeBandIdFromBirthDate(birthDate) {
    return getAgeBandIdForAge(calcAgeFromBirthDate(birthDate));
}

function storyMatchesAgeBand(story, bandId) {
    if (!bandId) return true;
    const storyBand = story?.ageCategory || story?.ageBand;
    if (!storyBand) return true;
    return storyBand === bandId;
}

module.exports = {
    AGE_BANDS,
    calcAgeFromBirthDate,
    getAgeBandIdForAge,
    getAgeBandIdFromBirthDate,
    storyMatchesAgeBand,
};

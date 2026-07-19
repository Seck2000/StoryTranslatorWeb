export function getSceneText(scene) {
    if (!scene?.text) return '';
    if (typeof scene.text === 'string') return scene.text.trim();
    return (scene.text.fr || scene.text.en || scene.text.ar || '').trim();
}

export function buildScenesPayload(story) {
    if (!Array.isArray(story?.scenes)) return [];

    return story.scenes
        .map((scene, index) => ({
            id: scene.id ?? index + 1,
            text: getSceneText(scene),
        }))
        .filter((scene) => scene.text.length > 0);
}

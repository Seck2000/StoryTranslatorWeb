import {
    Play,
    Loader2,
    LogOut,
    User,
    Menu,
    X,
    Heart,
    Clock,
    BookOpen,
    Camera,
    Save,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, API_URL, getApiErrorMessage } from '../api';
import { LANGUAGES, LEVELS } from '../constants/languages';
import {
    AGE_BANDS,
    getAgeBandById,
    storyMatchesAgeBand,
} from '../constants/ageBands';

function buildProfilePayload(form) {
    return {
        firstName: (form.firstName || '').trim(),
        lastName: (form.lastName || '').trim(),
        email: (form.email || '').trim().toLowerCase(),
        spokenLang: form.spokenLang || 'fr',
        learningLang: form.learningLang || 'en',
        level: form.level || 'debutant',
        ageBand: form.ageBand || 'moyens',
    };
}

function normalizeProfileForm(user) {
    const langCodes = new Set(LANGUAGES.map((lang) => lang.code));
    const levelCodes = new Set(LEVELS.map((level) => level.code));
    const ageCodes = new Set(AGE_BANDS.map((band) => band.id));
    const spoken = user?.preferences?.spokenLang;
    const learning = user?.preferences?.learningLang;
    const level = user?.preferences?.level;
    const ageBand = user?.preferences?.ageBand;

    return {
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        spokenLang: langCodes.has(spoken) ? spoken : 'fr',
        learningLang: langCodes.has(learning) ? learning : 'en',
        level: levelCodes.has(level) ? level : 'debutant',
        ageBand: ageCodes.has(ageBand) ? ageBand : 'moyens',
    };
}

function sceneProgressLabel(story, progressByStoryId) {
    const totalScenes = Array.isArray(story?.scenes) ? story.scenes.length : 0;
    if (totalScenes === 0) return null;

    const map =
        progressByStoryId && typeof progressByStoryId === 'object' && !Array.isArray(progressByStoryId)
            ? progressByStoryId
            : {};
    const storyId = story?.id;
    const hasProgress =
        storyId != null && Object.prototype.hasOwnProperty.call(map, storyId);
    if (!hasProgress) return `Pas commencé · ${totalScenes} scènes`;

    const sceneIndex = Number(map[storyId]) || 0;
    if (sceneIndex >= totalScenes - 1) {
        return `Terminé · Scène ${totalScenes}/${totalScenes}`;
    }
    return `Scène ${sceneIndex + 1} / ${totalScenes}`;
}

export default function LibraryPage({
    user,
    stories,
    isUploading,
    fileInputRef,
    storiesContainerRef,
    showResumeModal,
    storyToResume,
    savedSceneIndex,
    onLogout,
    onFileSelect,
    onScrollRight,
    onStartStory,
    onPlayRandom,
    favoriteIds = [],
    recentStoryIds = [],
    onToggleFavorite,
    onUserUpdate,
    onRestartStory,
    onResumeStory,
    onCloseResumeModal,
    getImageUrl,
    progressByStoryId = {},
}) {
    const [menuOpen, setMenuOpen] = useState(false);
    const [activeSection, setActiveSection] = useState('all');
    const [actionNotice, setActionNotice] = useState('');
    const [profileForm, setProfileForm] = useState(() => normalizeProfileForm(user));
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const pageTopRef = useRef(null);
    const safeStories = useMemo(() => (Array.isArray(stories) ? stories : []), [stories]);
    const safeFavoriteIds = useMemo(() => (Array.isArray(favoriteIds) ? favoriteIds : []), [favoriteIds]);
    const safeRecentStoryIds = useMemo(
        () => (Array.isArray(recentStoryIds) ? recentStoryIds : []),
        [recentStoryIds]
    );
    const userName = user?.displayName || user?.firstName || 'lecteur';
    const ageBand = useMemo(
        () => getAgeBandById(user?.preferences?.ageBand),
        [user?.preferences?.ageBand]
    );
    const avatarSrc = typeof user?.avatarUrl === 'string' && user.avatarUrl
        ? user.avatarUrl.startsWith('http')
            ? user.avatarUrl
            : `${API_URL}${user.avatarUrl}`
        : null;

    useEffect(() => {
        setProfileForm(normalizeProfileForm(user));
    }, [
        user?.id,
        user?.firstName,
        user?.lastName,
        user?.email,
        user?.preferences?.spokenLang,
        user?.preferences?.learningLang,
        user?.preferences?.level,
        user?.preferences?.ageBand,
    ]);

    const scrollToSectionTop = useCallback(() => {
        pageTopRef.current?.scrollIntoView({ block: 'start' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    useEffect(() => {
        scrollToSectionTop();
    }, [activeSection, scrollToSectionTop]);

    useEffect(() => {
        if (!actionNotice) return undefined;

        const timer = window.setTimeout(() => setActionNotice(''), 3500);
        return () => window.clearTimeout(timer);
    }, [actionNotice]);

    const navigationItems = [
        { id: 'all', label: 'Pour mon âge', icon: BookOpen },
        { id: 'favorites', label: 'Favoris', icon: Heart },
        { id: 'recent', label: 'Récemment lues', icon: Clock },
        { id: 'profile', label: 'Mon profil', icon: User },
    ];

    const ageFilteredStories = useMemo(() => {
        const bandId = user?.preferences?.ageBand;
        if (!bandId) return [];
        return safeStories.filter((story) => storyMatchesAgeBand(story, bandId));
    }, [safeStories, user?.preferences?.ageBand]);

    const visibleStories = useMemo(() => {
        if (activeSection === 'favorites') {
            return ageFilteredStories.filter((story) => story?.id && safeFavoriteIds.includes(story.id));
        }
        if (activeSection === 'recent') {
            return ageFilteredStories.filter((story) => story?.id && safeRecentStoryIds.includes(story.id));
        }
        return ageFilteredStories;
    }, [activeSection, ageFilteredStories, safeFavoriteIds, safeRecentStoryIds]);

    const sectionTitle = navigationItems.find((item) => item.id === activeSection)?.label;

    const handleLogoutClick = () => {
        setMenuOpen(false);
        onLogout();
    };

    const changeSection = (section) => {
        setActiveSection(section);
        setMenuOpen(false);
    };

    const handleProfileChange = (field, value) => {
        setProfileForm((form) => ({ ...form, [field]: value }));
        setProfileError('');
        setProfileSuccess('');
        setActionNotice('');
    };

    const handleProfileSubmit = async (e) => {
        e.preventDefault();
        setProfileError('');
        setProfileSuccess('');

        const payload = buildProfilePayload(profileForm);

        if (!payload.firstName || !payload.lastName) {
            setProfileError('Le prénom et le nom sont obligatoires.');
            return;
        }
        if (payload.spokenLang === payload.learningLang) {
            setProfileError('La langue cible doit être différente de la langue maternelle.');
            return;
        }

        setProfileSaving(true);
        try {
            const { data } = await api.patch('/api/auth/me', payload);
            if (!data?.user) {
                setProfileError("Le profil a été modifié, mais la réponse du serveur est incomplète.");
                return;
            }
            setProfileSuccess('Profil mis à jour avec succès.');
            setActionNotice('Profil enregistré avec succès.');
            // Différer la mise à jour parent : évite le crash DOM removeChild
            // (souvent lié à la traduction navigateur + re-render immédiat).
            window.setTimeout(() => onUserUpdate?.(data.user), 0);
        } catch (error) {
            setProfileError(
                getApiErrorMessage(error, 'Impossible de modifier le profil.')
            );
        } finally {
            setProfileSaving(false);
        }
    };

    const handleAvatarChange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setProfileError('');
        setProfileSuccess('');
        setAvatarUploading(true);

        const formData = new FormData();
        formData.append('avatar', file);

        try {
            // Ne pas forcer Content-Type : le navigateur ajoute la boundary multipart.
            const { data } = await api.post('/api/auth/me/avatar', formData);
            if (!data?.user) {
                setProfileError("La photo a été envoyée, mais la réponse du serveur est incomplète.");
                return;
            }
            window.setTimeout(() => onUserUpdate?.(data.user), 0);
            setProfileSuccess('Photo de profil mise à jour.');
            setActionNotice('Photo de profil mise à jour.');
        } catch (error) {
            setProfileError(getApiErrorMessage(error, "Impossible d'envoyer la photo."));
        } finally {
            setAvatarUploading(false);
            event.target.value = '';
        }
    };

    const handleFavoriteClick = async (storyId, isFavorite) => {
        if (!storyId || typeof onToggleFavorite !== 'function') return;

        const updated = await onToggleFavorite(storyId);
        if (updated === false) return;

        setActionNotice(
            isFavorite
                ? 'Histoire retirée des favoris.'
                : 'Histoire ajoutée aux favoris.'
        );
        scrollToSectionTop();
    };

    const renderNavigation = (mobile = false) => (
        <div className={mobile ? 'space-y-2' : 'space-y-2'}>
            {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = activeSection === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => changeSection(item.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition ${
                            active
                                ? 'bg-[#8C5EB9] text-white shadow-sm'
                                : 'bg-transparent text-gray-600 hover:bg-[#F2E9FB] hover:text-[#8C5EB9]'
                        }`}
                    >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                    </button>
                );
            })}
        </div>
    );

    const renderProfile = () => (
        <div className="bg-white border border-[#EBE6DC] rounded-2xl p-5 md:p-7 max-w-3xl">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8">
                <div className="relative w-24 h-24 rounded-2xl overflow-hidden border border-[#EBE6DC] bg-[#FAF8F6] flex items-center justify-center shrink-0">
                    {avatarSrc ? (
                        <img src={avatarSrc} alt="Photo de profil" className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-10 h-10 text-gray-400" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">Mon profil</h3>
                    <p className="text-gray-400 text-sm mb-4">
                        Modifiez vos informations personnelles et votre photo de profil.
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-[#F2E9FB] border border-[#EBE6DC] text-gray-700 text-sm font-medium cursor-pointer transition">
                        {avatarUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Camera className="w-4 h-4" />
                        )}
                        Changer la photo
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarChange}
                            className="hidden"
                            disabled={avatarUploading}
                        />
                    </label>
                </div>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-5">
                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Prénom</label>
                        <input
                            value={profileForm.firstName}
                            onChange={(e) => handleProfileChange('firstName', e.target.value)}
                            className="w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9]"
                            required
                        />
                    </div>
                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                        <input
                            value={profileForm.lastName}
                            onChange={(e) => handleProfileChange('lastName', e.target.value)}
                            className="w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9]"
                            required
                        />
                    </div>

                    <div className="min-w-0 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse courriel</label>
                        <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => handleProfileChange('email', e.target.value)}
                            className="w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9]"
                            required
                        />
                    </div>

                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Langue maternelle</label>
                        <select
                            value={profileForm.spokenLang}
                            onChange={(e) => handleProfileChange('spokenLang', e.target.value)}
                            className="w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9]"
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Langue cible</label>
                        <select
                            value={profileForm.learningLang}
                            onChange={(e) => handleProfileChange('learningLang', e.target.value)}
                            className="w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9]"
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Niveau</label>
                        <select
                            value={profileForm.level}
                            onChange={(e) => handleProfileChange('level', e.target.value)}
                            className="w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9]"
                        >
                            {LEVELS.map((level) => (
                                <option key={level.code} value={level.code}>
                                    {level.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tranche d’âge</label>
                        <select
                            value={profileForm.ageBand}
                            onChange={(e) => handleProfileChange('ageBand', e.target.value)}
                            className="w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#8C5EB9]"
                            required
                        >
                            {AGE_BANDS.map((band) => (
                                <option key={band.id} value={band.id}>
                                    {band.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {ageBand && (
                    <p className="text-xs text-gray-500 -mt-2">
                        Histoires affichées : {ageBand.label}
                    </p>
                )}

                {profileError && (
                    <p className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {profileError}
                    </p>
                )}
                {profileSuccess && (
                    <p className="text-[#8C5EB9] text-sm bg-[#F2E9FB] border border-[#EBE6DC] rounded-lg px-3 py-2">
                        {profileSuccess}
                    </p>
                )}

                <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#8C5EB9] hover:bg-[#7a4fa8] disabled:opacity-50 text-white font-semibold transition"
                >
                    <span className="inline-flex w-4 h-4 items-center justify-center" aria-hidden="true">
                        {profileSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                    </span>
                    <span>{profileSaving ? 'Enregistrement…' : 'Enregistrer'}</span>
                </button>
            </form>
        </div>
    );

    return (
        <div ref={pageTopRef} className="flex-1 flex flex-col relative pb-20">
            {actionNotice && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed right-4 bottom-4 z-[60] max-w-sm rounded-2xl border border-[#EBE6DC] bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-xl"
                >
                    {actionNotice}
                </div>
            )}

            <div className="mb-6 rounded-2xl border border-[#EBE6DC] bg-white px-5 py-4">
                <p className="text-[#8C5EB9] font-extrabold text-lg">Espace enfant</p>
                <p className="text-gray-400 text-sm mt-0.5">
                    Bonjour {userName}
                    {ageBand
                        ? ` — histoires pour ${ageBand.label}`
                        : ' — choisis ta tranche d’âge dans Mon profil'}
                </p>
            </div>

            <div className="flex justify-between items-start md:items-center mb-8 gap-4 relative">
                <div>
                    <div className="text-2xl font-bold text-[#8C5EB9]">Mes histoires</div>
                    <p className="text-gray-400 text-sm mt-1">
                        Seules les histoires de ton âge s&apos;affichent ici
                    </p>
                </div>

                {/* Menu mobile */}
                <div className="md:hidden relative">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        className="w-11 h-11 rounded-xl bg-white border border-[#EBE6DC] flex items-center justify-center text-gray-700 hover:bg-[#F2E9FB] transition"
                        aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                    >
                        {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>

                    {menuOpen && (
                        <div className="absolute right-0 mt-3 w-72 bg-white border border-[#EBE6DC] rounded-2xl shadow-xl z-40 overflow-hidden">
                            <div className="px-4 py-4 border-b border-[#EBE6DC] bg-[#FAF8F6]">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-[#F2E9FB] border border-[#EBE6DC] flex items-center justify-center">
                                        <User className="w-5 h-5 text-[#8C5EB9]" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-900 truncate">{userName}</p>
                                        <p className="text-xs text-gray-400 truncate">{user?.email}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 space-y-2">
                                {renderNavigation(true)}
                                <button
                                    type="button"
                                    onClick={handleLogoutClick}
                                    className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#FAF8F6] hover:bg-[#F2E9FB] text-gray-700 transition"
                                >
                                    <span>Déconnexion</span>
                                    <LogOut className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions desktop */}
                <div className="hidden md:flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 bg-white border border-[#EBE6DC] rounded-full pl-3 pr-2 py-1">
                        <User className="w-4 h-4 text-[#8C5EB9] shrink-0" />
                        <span className="text-sm text-gray-700 max-w-[200px] truncate font-medium">
                            {user?.displayName || user?.firstName || user?.email}
                        </span>
                        <button
                            onClick={onLogout}
                            className="p-2 rounded-full hover:bg-[#F2E9FB] text-gray-500 hover:text-[#8C5EB9] transition"
                            title="Déconnexion"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 gap-6 min-h-0">
                <aside className="hidden md:block w-64 shrink-0">
                    <div className="bg-white border border-[#EBE6DC] rounded-2xl p-3 sticky top-4">
                        {renderNavigation()}
                    </div>
                </aside>

                <main className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{sectionTitle}</h2>
                            {activeSection !== 'profile' && (
                                <p className="text-sm text-gray-400">
                                    {visibleStories.length} histoire{visibleStories.length > 1 ? 's' : ''} affichée
                                    {visibleStories.length > 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    </div>

                    {activeSection === 'profile' ? (
                        renderProfile()
                    ) : visibleStories.length === 0 ? (
                        <div className="bg-white border border-[#EBE6DC] rounded-2xl p-8 text-center text-gray-500">
                            {activeSection === 'favorites'
                                ? "Aucun favori pour le moment."
                                : activeSection === 'recent'
                                  ? "Aucune histoire récemment lue."
                                  : "Aucune histoire disponible pour ton âge pour le moment. Demande à un adulte d'en ajouter."}
                        </div>
                    ) : (
                        <div
                            ref={storiesContainerRef}
                            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 pb-8"
                        >
                            {visibleStories.map((story, index) => {
                                const isFavorite = safeFavoriteIds.includes(story.id);
                                const isRecent = safeRecentStoryIds.includes(story.id);
                                const storyBand = AGE_BANDS.find(
                                    (band) => band.id === (story.ageCategory || story.ageBand)
                                );
                                const sceneLabel = sceneProgressLabel(story, progressByStoryId);

                                return (
                                    <div
                                        key={story.id || index}
                                        className="bg-white border border-[#EBE6DC] rounded-2xl overflow-hidden shadow-sm hover:border-[#8C5EB9]/50 transition group"
                                    >
                                        <div
                                            onClick={() => onStartStory(story)}
                                            className="h-48 bg-blue-500 cursor-pointer relative bg-cover bg-center"
                                            style={
                                                story.thumbnail
                                                    ? {
                                                          backgroundImage: `url(${getImageUrl(story.thumbnail, story.id)})`,
                                                      }
                                                    : {}
                                            }
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />
                                            <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                                                {storyBand && (
                                                    <span className="bg-[#F2E9FB] text-[#8C5EB9] text-[10px] font-bold px-2 py-1 rounded-full shadow">
                                                        {storyBand.label}
                                                    </span>
                                                )}
                                                {isRecent && (
                                                    <span className="bg-[#F2E9FB] text-[#8C5EB9] text-[10px] font-bold px-2 py-1 rounded-full shadow">
                                                        Récent
                                                    </span>
                                                )}
                                                {isFavorite && (
                                                    <span className="bg-red-600/90 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow">
                                                        Favori
                                                    </span>
                                                )}
                                            </div>
                                            {sceneLabel && (
                                                <span className="absolute bottom-3 left-3 bg-black/75 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow">
                                                    {sceneLabel}
                                                </span>
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                                <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                                                    <Play className="w-7 h-7 text-gray-900 ml-1" fill="currentColor" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4">
                                            <h3 className="font-bold text-gray-900 mb-3 line-clamp-2">
                                                {story.title || 'Histoire sans titre'}
                                            </h3>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => onStartStory(story)}
                                                    className="flex-1 px-4 py-2 rounded-xl bg-[#8C5EB9] hover:bg-[#7a4fa8] text-white text-sm font-semibold transition"
                                                >
                                                    Lire
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleFavoriteClick(story.id, isFavorite)}
                                                    className={`px-3 py-2 rounded-xl border transition ${
                                                        isFavorite
                                                            ? 'bg-red-500 border-red-400 text-white'
                                                            : 'bg-white border-[#EBE6DC] text-gray-500 hover:text-[#8C5EB9] hover:bg-[#F2E9FB]'
                                                    }`}
                                                    title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                                >
                                                    <Heart
                                                        className="w-5 h-5"
                                                        fill={isFavorite ? 'currentColor' : 'none'}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </main>
            </div>

            {activeSection !== 'profile' && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <button
                    onClick={onPlayRandom}
                    className="bg-red-500/90 hover:bg-red-600 text-white p-4 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 group"
                    title="Lire une histoire au hasard"
                >
                    <Play className="w-8 h-8 group-hover:animate-pulse" fill="white" />
                </button>
            </div>
            )}

            {showResumeModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border-2 border-[#EBE6DC] rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center">
                        <h3 className="text-2xl font-bold text-[#8C5EB9] mb-2">Reprendre l'histoire ?</h3>
                        <p className="text-gray-600 mb-8">
                            Vous étiez en train de lire{' '}
                            <strong className="text-gray-900">"{storyToResume?.title}"</strong> à la scène{' '}
                            {savedSceneIndex + 1}. Que souhaitez-vous faire ?
                        </p>
                        <div className="flex flex-col gap-3 md:flex-row md:justify-center">
                            <button
                                onClick={onRestartStory}
                                className="px-6 py-3 bg-[#FAF8F6] hover:bg-[#F2E9FB] text-gray-700 border border-[#EBE6DC] rounded-xl font-medium transition"
                            >
                                Recommencer du début
                            </button>
                            <button
                                onClick={onResumeStory}
                                className="px-6 py-3 bg-[#8C5EB9] hover:bg-[#7a4fa8] text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4" /> Reprendre la lecture
                            </button>
                        </div>
                        <button
                            onClick={onCloseResumeModal}
                            className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

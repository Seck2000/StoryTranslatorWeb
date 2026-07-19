import {
    Play,
    Upload,
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
    Shield,
    Library,
    LayoutDashboard,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, API_URL, getApiErrorMessage } from '../api';
import { LANGUAGES, LEVELS } from '../constants/languages';
import { AGE_BANDS } from '../constants/ageBands';

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

const inputClass =
    'w-full min-w-0 box-border px-4 py-2.5 rounded-lg bg-white border border-[#EBE6DC] text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-500';

export default function AdminLibraryPage({
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
    const [activeSection, setActiveSection] = useState('dashboard');
    const [ageFilter, setAgeFilter] = useState('all');
    const [actionNotice, setActionNotice] = useState('');
    const [profileForm, setProfileForm] = useState(() => normalizeProfileForm(user));
    const [profileError, setProfileError] = useState('');
    const [profileSuccess, setProfileSuccess] = useState('');
    const [profileSaving, setProfileSaving] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const pageTopRef = useRef(null);
    const localFileInputRef = useRef(null);

    const safeStories = useMemo(() => (Array.isArray(stories) ? stories : []), [stories]);
    const safeFavoriteIds = useMemo(() => (Array.isArray(favoriteIds) ? favoriteIds : []), [favoriteIds]);
    const safeRecentStoryIds = useMemo(
        () => (Array.isArray(recentStoryIds) ? recentStoryIds : []),
        [recentStoryIds]
    );
    const userName = user?.displayName || user?.firstName || 'Admin';
    const avatarSrc =
        typeof user?.avatarUrl === 'string' && user.avatarUrl
            ? user.avatarUrl.startsWith('http')
                ? user.avatarUrl
                : `${API_URL}${user.avatarUrl}`
            : null;

    const storiesByBand = useMemo(() => {
        const groups = Object.fromEntries(AGE_BANDS.map((band) => [band.id, []]));
        groups.autre = [];
        for (const story of safeStories) {
            const band = story.ageCategory || story.ageBand;
            if (band && groups[band]) groups[band].push(story);
            else groups.autre.push(story);
        }
        return groups;
    }, [safeStories]);

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
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
        { id: 'all', label: 'Toutes les histoires', icon: Library },
        { id: 'favorites', label: 'Favoris', icon: Heart },
        { id: 'recent', label: 'Récemment lues', icon: Clock },
        { id: 'profile', label: 'Profil admin', icon: User },
    ];

    const filteredByAge = useMemo(() => {
        if (ageFilter === 'all') return safeStories;
        return safeStories.filter((story) => (story.ageCategory || story.ageBand) === ageFilter);
    }, [ageFilter, safeStories]);

    const visibleStories = useMemo(() => {
        if (activeSection === 'favorites') {
            return filteredByAge.filter((story) => story?.id && safeFavoriteIds.includes(story.id));
        }
        if (activeSection === 'recent') {
            return filteredByAge.filter((story) => story?.id && safeRecentStoryIds.includes(story.id));
        }
        return filteredByAge;
    }, [activeSection, filteredByAge, safeFavoriteIds, safeRecentStoryIds]);

    const sectionTitle = navigationItems.find((item) => item.id === activeSection)?.label;

    const handleImportClick = () => {
        setMenuOpen(false);
        const input = fileInputRef?.current || localFileInputRef.current;
        if (!input) {
            setActionNotice("Impossible d'ouvrir le sélecteur de fichier.");
            return;
        }
        input.click();
    };

    const handleLogoutClick = () => {
        setMenuOpen(false);
        onLogout();
    };

    const changeSection = (section) => {
        setActiveSection(section);
        setMenuOpen(false);
        if (section === 'all') setAgeFilter('all');
    };

    const openBandLibrary = (bandId) => {
        setAgeFilter(bandId);
        setActiveSection('all');
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
                setProfileError('Réponse serveur incomplète.');
                return;
            }
            setProfileSuccess('Profil admin mis à jour.');
            setActionNotice('Profil admin enregistré.');
            window.setTimeout(() => onUserUpdate?.(data.user), 0);
        } catch (error) {
            setProfileError(getApiErrorMessage(error, 'Impossible de modifier le profil.'));
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
            const { data } = await api.post('/api/auth/me/avatar', formData);
            if (!data?.user) {
                setProfileError('Réponse serveur incomplète après envoi de la photo.');
                return;
            }
            window.setTimeout(() => onUserUpdate?.(data.user), 0);
            setProfileSuccess('Photo mise à jour.');
            setActionNotice('Photo admin mise à jour.');
        } catch (error) {
            setProfileError(getApiErrorMessage(error, "Impossible d'envoyer la photo."));
        } finally {
            setAvatarUploading(false);
            event.target.value = '';
        }
    };

    const handleFavoriteClick = async (storyId, isFavorite) => {
        const ok = await onToggleFavorite?.(storyId, isFavorite);
        if (ok !== false) {
            setActionNotice(isFavorite ? 'Retiré des favoris.' : 'Ajouté aux favoris.');
        }
    };

    const renderNavigation = (compact = false) => (
        <nav className={`${compact ? 'space-y-1' : 'space-y-2'}`}>
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
                                ? 'bg-amber-600 text-white shadow-md'
                                : 'text-gray-700 hover:bg-amber-50'
                        }`}
                    >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="font-medium text-sm">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );

    const renderStoryCard = (story, index) => {
        const isFavorite = safeFavoriteIds.includes(story.id);
        const storyBand = AGE_BANDS.find((band) => band.id === (story.ageCategory || story.ageBand));
        const sceneLabel = sceneProgressLabel(story, progressByStoryId);

        return (
            <div
                key={story.id || index}
                className="bg-white border border-[#EBE6DC] rounded-2xl overflow-hidden hover:border-amber-400 transition group shadow-sm"
            >
                <div
                    onClick={() => onStartStory(story)}
                    className="h-44 cursor-pointer relative bg-cover bg-center bg-amber-100"
                    style={
                        story.thumbnail
                            ? { backgroundImage: `url(${getImageUrl(story.thumbnail, story.id)})` }
                            : {}
                    }
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                    {storyBand && (
                        <span className="absolute top-3 left-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                            {storyBand.label}
                        </span>
                    )}
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
                        {story.title || 'Sans titre'}
                    </h3>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => onStartStory(story)}
                            className="flex-1 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold"
                        >
                            Lire
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFavoriteClick(story.id, isFavorite)}
                            className={`px-3 py-2 rounded-xl border ${
                                isFavorite
                                    ? 'bg-red-500 border-red-400 text-white'
                                    : 'bg-[#FAF8F6] border-[#EBE6DC] text-gray-600'
                            }`}
                        >
                            <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderDashboard = () => (
        <div className="space-y-8">
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Tableau de bord</h2>
                <p className="text-sm text-gray-500 mb-5">
                    Toutes les catégories d’histoires — importe un fichier .zip pour en ajouter.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white border border-[#EBE6DC] rounded-2xl p-5 shadow-sm">
                        <p className="text-sm text-gray-500">Total histoires</p>
                        <p className="text-3xl font-extrabold text-amber-700 mt-1">{safeStories.length}</p>
                    </div>
                    {AGE_BANDS.map((band) => (
                        <button
                            key={band.id}
                            type="button"
                            onClick={() => openBandLibrary(band.id)}
                            className="bg-white border border-[#EBE6DC] rounded-2xl p-5 shadow-sm text-left hover:border-amber-400 transition"
                        >
                            <p className="text-sm text-gray-500">{band.label}</p>
                            <p className="text-3xl font-extrabold text-gray-900 mt-1">
                                {storiesByBand[band.id]?.length || 0}
                            </p>
                            <p className="text-xs text-amber-700 font-semibold mt-2">Voir la catégorie →</p>
                        </button>
                    ))}
                </div>
            </div>

            {AGE_BANDS.map((band) => {
                const list = storiesByBand[band.id] || [];
                return (
                    <section key={band.id}>
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-amber-600" />
                                {band.label}
                                <span className="text-sm font-medium text-gray-400">({list.length})</span>
                            </h3>
                            <button
                                type="button"
                                onClick={() => openBandLibrary(band.id)}
                                className="text-sm font-semibold text-amber-700 hover:underline"
                            >
                                Tout voir
                            </button>
                        </div>
                        {list.length === 0 ? (
                            <div className="bg-white border border-dashed border-[#EBE6DC] rounded-2xl p-6 text-center text-gray-400 text-sm">
                                Aucune histoire dans cette catégorie. Clique sur Importer pour en ajouter.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {list.slice(0, 3).map((story, index) => renderStoryCard(story, index))}
                            </div>
                        )}
                    </section>
                );
            })}
        </div>
    );

    const renderProfile = () => (
        <div className="bg-white border border-[#EBE6DC] rounded-2xl p-6 space-y-6 shadow-sm">
            <div className="flex items-center gap-2 text-amber-700 font-bold">
                <Shield className="w-5 h-5" />
                Profil administrateur
            </div>
            <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-24 h-24 rounded-full bg-amber-50 border-2 border-amber-200 overflow-hidden flex items-center justify-center">
                    {avatarSrc ? (
                        <img src={avatarSrc} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <User className="w-10 h-10 text-amber-600" />
                    )}
                </div>
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900">Gestion du compte</h3>
                    <p className="text-gray-500 text-sm mb-4">
                        Tu gères toute la bibliothèque et les imports d’histoires (.zip).
                    </p>
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FAF8F6] hover:bg-amber-50 border border-[#EBE6DC] text-sm font-medium cursor-pointer transition">
                        {avatarUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
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
                            className={inputClass}
                            required
                        />
                    </div>
                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom</label>
                        <input
                            value={profileForm.lastName}
                            onChange={(e) => handleProfileChange('lastName', e.target.value)}
                            className={inputClass}
                            required
                        />
                    </div>

                    <div className="min-w-0 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresse courriel</label>
                        <input
                            type="email"
                            value={profileForm.email}
                            onChange={(e) => handleProfileChange('email', e.target.value)}
                            className={inputClass}
                            required
                        />
                    </div>

                    <div className="min-w-0">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Langue maternelle</label>
                        <select
                            value={profileForm.spokenLang}
                            onChange={(e) => handleProfileChange('spokenLang', e.target.value)}
                            className={inputClass}
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
                            className={inputClass}
                        >
                            {LANGUAGES.map((lang) => (
                                <option key={lang.code} value={lang.code}>
                                    {lang.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-0 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Niveau</label>
                        <select
                            value={profileForm.level}
                            onChange={(e) => handleProfileChange('level', e.target.value)}
                            className={inputClass}
                        >
                            {LEVELS.map((level) => (
                                <option key={level.code} value={level.code}>
                                    {level.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {profileError && (
                    <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {profileError}
                    </p>
                )}
                {profileSuccess && (
                    <p className="text-amber-800 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        {profileSuccess}
                    </p>
                )}
                <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold"
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
        <div ref={pageTopRef} className="flex-1 flex flex-col relative pb-28">
            {actionNotice && (
                <div className="fixed right-4 bottom-4 z-[60] max-w-sm rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 shadow-xl">
                    {actionNotice}
                </div>
            )}

            <input
                type="file"
                accept=".zip,application/zip"
                ref={(node) => {
                    localFileInputRef.current = node;
                    if (fileInputRef) fileInputRef.current = node;
                }}
                onChange={onFileSelect}
                className="hidden"
            />

            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white border border-amber-300 flex items-center justify-center">
                        <Shield className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-amber-800 font-extrabold text-lg leading-tight">
                            Tableau de bord administrateur
                        </p>
                        <p className="text-gray-600 text-sm">
                            {userName} — gestion de toute la bibliothèque
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-white border border-[#EBE6DC] rounded-full pl-3 pr-2 py-1">
                        <User className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="text-sm text-gray-700 max-w-[200px] truncate font-medium">
                            {userName}
                        </span>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="p-2 rounded-full hover:bg-amber-50 text-gray-500"
                            title="Déconnexion"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Bouton Importer — bien visible */}
            <div className="mb-6 rounded-2xl border-2 border-dashed border-red-400 bg-red-50 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                    <p className="text-red-700 font-extrabold text-xl">Importer une histoire (.zip)</p>
                    <p className="text-gray-600 text-sm mt-1">
                        Comme avant : choisis un fichier ZIP contenant un story.json + images.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleImportClick}
                    disabled={isUploading}
                    className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-red-600 hover:bg-red-500 disabled:bg-red-300 text-white font-bold text-lg shadow-lg transition transform hover:scale-105 active:scale-95"
                >
                    {isUploading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                        <Upload className="w-6 h-6" />
                    )}
                    {isUploading ? 'Importation…' : 'Importer'}
                </button>
            </div>

            <div className="md:hidden mb-4 flex justify-end">
                <button
                    type="button"
                    onClick={() => setMenuOpen((open) => !open)}
                    className="w-11 h-11 rounded-xl bg-white border border-[#EBE6DC] flex items-center justify-center text-gray-700"
                >
                    {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>

            {menuOpen && (
                <div className="md:hidden mb-4 bg-white border border-[#EBE6DC] rounded-2xl p-3 shadow-xl space-y-2">
                    {renderNavigation(true)}
                    <button
                        type="button"
                        onClick={handleImportClick}
                        disabled={isUploading}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-600 text-white font-medium"
                    >
                        <span>{isUploading ? 'Importation…' : 'Importer une histoire'}</span>
                        <Upload className="w-5 h-5" />
                    </button>
                    <button
                        type="button"
                        onClick={handleLogoutClick}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#FAF8F6] text-gray-700"
                    >
                        <span>Déconnexion</span>
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex flex-1 gap-6 min-h-0">
                <aside className="hidden md:block w-64 shrink-0">
                    <div className="bg-white border border-[#EBE6DC] rounded-2xl p-3 sticky top-4 shadow-sm">
                        {renderNavigation()}
                        <button
                            type="button"
                            onClick={handleImportClick}
                            disabled={isUploading}
                            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:bg-red-300 text-white font-bold"
                        >
                            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                            Importer
                        </button>
                    </div>
                </aside>

                <main className="flex-1 min-w-0">
                    {activeSection === 'dashboard' && renderDashboard()}

                    {activeSection === 'profile' && renderProfile()}

                    {activeSection !== 'dashboard' && activeSection !== 'profile' && (
                        <>
                            {activeSection === 'all' && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setAgeFilter('all')}
                                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${
                                            ageFilter === 'all'
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-white text-gray-600 border border-[#EBE6DC]'
                                        }`}
                                    >
                                        Tous les âges
                                    </button>
                                    {AGE_BANDS.map((band) => (
                                        <button
                                            key={band.id}
                                            type="button"
                                            onClick={() => setAgeFilter(band.id)}
                                            className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${
                                                ageFilter === band.id
                                                    ? 'bg-amber-600 text-white'
                                                    : 'bg-white text-gray-600 border border-[#EBE6DC]'
                                            }`}
                                        >
                                            {band.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="mb-5">
                                <h2 className="text-xl font-bold text-gray-900">{sectionTitle}</h2>
                                <p className="text-sm text-gray-500">
                                    {visibleStories.length} histoire{visibleStories.length > 1 ? 's' : ''}
                                </p>
                            </div>

                            {visibleStories.length === 0 ? (
                                <div className="bg-white border border-[#EBE6DC] rounded-2xl p-8 text-center text-gray-500">
                                    Aucune histoire ici. Utilise le bouton rouge <strong>Importer</strong>.
                                </div>
                            ) : (
                                <div
                                    ref={storiesContainerRef}
                                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 pb-8"
                                >
                                    {visibleStories.map((story, index) => renderStoryCard(story, index))}
                                </div>
                            )}
                        </>
                    )}
                </main>
            </div>

            {/* Gros bouton flottant Importer (comme avant) */}
            <button
                type="button"
                onClick={handleImportClick}
                disabled={isUploading}
                className="fixed bottom-6 right-6 z-50 w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-600 hover:bg-red-500 disabled:bg-red-300 text-white shadow-2xl flex flex-col items-center justify-center gap-0.5 font-bold transition hover:scale-110 active:scale-95"
                title="Importer une histoire (.zip)"
            >
                {isUploading ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                    <>
                        <Upload className="w-6 h-6" />
                        <span className="text-[10px]">Import</span>
                    </>
                )}
            </button>

            {activeSection === 'dashboard' && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
                    <button
                        type="button"
                        onClick={onPlayRandom}
                        className="bg-amber-500 hover:bg-amber-600 text-white p-4 rounded-full shadow-lg"
                        title="Histoire au hasard"
                    >
                        <Play className="w-7 h-7" fill="white" />
                    </button>
                </div>
            )}

            {showResumeModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white border border-[#EBE6DC] rounded-2xl p-6 md:p-8 max-w-md w-full text-center shadow-xl">
                        <h3 className="text-2xl font-bold text-amber-700 mb-2">Reprendre l&apos;histoire ?</h3>
                        <p className="text-gray-600 mb-8">
                            Scène {savedSceneIndex + 1} de{' '}
                            <strong className="text-gray-900">&quot;{storyToResume?.title}&quot;</strong>.
                        </p>
                        <div className="flex flex-col gap-3 md:flex-row md:justify-center">
                            <button
                                onClick={onRestartStory}
                                className="px-6 py-3 bg-[#FAF8F6] border border-[#EBE6DC] hover:bg-amber-50 text-gray-800 rounded-xl"
                            >
                                Recommencer
                            </button>
                            <button
                                onClick={onResumeStory}
                                className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4" /> Reprendre
                            </button>
                        </div>
                        <button
                            onClick={onCloseResumeModal}
                            className="mt-6 text-sm text-gray-400 hover:text-gray-700 underline"
                        >
                            Annuler
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

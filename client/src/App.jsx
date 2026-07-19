// ==============================================================================
// 1. IMPORTATIONS DES OUTILS NÉCESSAIRES
// ==============================================================================
// On importe les "Hooks" de base de React qui nous permettent de gérer la mémoire (state) et les actions
import { useState, useEffect, useRef } from 'react';

// Axios est une bibliothèque qui nous permet de communiquer avec notre serveur (Backend)
import { api, API_URL, clearAuth, loadStoredUser, saveAuth } from './api';
import AuthPage from './components/AuthPage';
import WelcomePage from './components/WelcomePage';
import LibraryPage from './components/LibraryPage';
import AdminLibraryPage from './components/AdminLibraryPage';
import StoryChat from './components/StoryChat';
import {
  storyMatchesAgeBand,
} from './constants/ageBands';
import { LANGUAGES } from './constants/languages';

// Lucide-react nous fournit des petites icônes vectorielles prêtes à l'emploi (très jolies !)
import { Play, Volume2, VolumeX, Pause, ChevronRight, ChevronLeft, Loader2, Eye, EyeOff, MessageCircle } from 'lucide-react';

const LANGUAGES_CODES = LANGUAGES.map((lang) => lang.code);

function App() {
  // ==============================================================================
  // 2. LA MÉMOIRE DE NOTRE APPLICATION (Les "States")
  // ==============================================================================
  // Si une de ces variables change, React met automatiquement à jour l'écran visuellement !
  
  // welcome = page d'accueil publique | library = bibliothèque (connecté) | login | register | player
  const [currentView, setCurrentView] = useState('welcome'); 
  
  // Garde en mémoire l'histoire que l'utilisateur a choisie de lire
  const [currentStory, setCurrentStory] = useState(null);
  
  // Mémorise à quelle scène on se trouve (0 = la première page de l'histoire)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  
  // Mémorise la langue actuellement choisie par l'utilisateur ('fr', 'en', ou 'ar')
  const [currentLang, setCurrentLang] = useState('fr'); 
  
  // Un "interrupteur" pour savoir si on veut afficher le texte de l'histoire ou le cacher (Mode difficile)
  const [showText, setShowText] = useState(true); 

  // Garde en mémoire la liste de toutes les histoires récupérées depuis le serveur
  const [stories, setStories] = useState([]); 
  
  // Un "interrupteur" pour afficher une roue de chargement quand on importe un fichier ZIP
  const [isUploading, setIsUploading] = useState(false);

  // --- Variables liées à l'audio (la synthèse vocale) ---
  const [isAutoPlay, setIsAutoPlay] = useState(true); // Est-ce que l'audio démarre tout seul quand on tourne la page ?
  const [isPlaying, setIsPlaying] = useState(false); // Est-ce qu'une voix est en train de parler en ce moment ?
  const [isPaused, setIsPaused] = useState(false); // Est-ce que l'utilisateur a mis la voix sur "pause" manuellement ?

  // --- Variables liées au modal de reprise ---
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [storyToResume, setStoryToResume] = useState(null);
  const [savedSceneIndex, setSavedSceneIndex] = useState(0);

  // --- Authentification ---
  const [user, setUser] = useState(() => loadStoredUser());
  const [authChecking, setAuthChecking] = useState(!!localStorage.getItem('auth_token'));
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [recentStoryIds, setRecentStoryIds] = useState([]);
  const [progressByStoryId, setProgressByStoryId] = useState({});

  // ==============================================================================
  // 3. LES RÉFÉRENCES (Permet de manipuler directement des éléments HTML cachés)
  // ==============================================================================
  // useRef est comme un pointeur laser vers un élément spécifique
  const fileInputRef = useRef(null); // Pointe vers le bouton "choisir un fichier" (qui est invisible sur notre site)
  const storiesContainerRef = useRef(null); // Pointe vers la liste des histoires pour pouvoir la faire défiler

  // ==============================================================================
  // 4. LES EFFETS (Actions qui se lancent automatiquement à des moments précis)
  // ==============================================================================

  useEffect(() => {
    restoreSession();
  }, []);

  useEffect(() => {
    if (user && currentView === 'library') {
      fetchStories();
      fetchLibraryData();
    }
  }, [user, currentView]);

  const restoreSession = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setAuthChecking(false);
      return;
    }
    try {
      const { data } = await api.get('/api/auth/me');
      setUser(data.user);
      saveAuth(token, data.user);
      setCurrentView('library');
      fetchStories();
      fetchLibraryData();
    } catch {
      clearAuth();
      setUser(null);
      setCurrentView('welcome');
    } finally {
      setAuthChecking(false);
    }
  };

  const handleAuthSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    const learn = loggedInUser.preferences?.learningLang;
    if (learn && LANGUAGES_CODES.includes(learn)) {
      setCurrentLang(learn);
    }
    setCurrentView('library');
    fetchStories();
    fetchLibraryData();
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setFavoriteIds([]);
    setRecentStoryIds([]);
    setProgressByStoryId({});
    setCurrentView('welcome');
  };

  const handleUserUpdate = (updatedUser) => {
    if (!updatedUser) return;

    setUser((prev) => {
      const merged = {
        ...(prev || {}),
        ...updatedUser,
        role: updatedUser.role || prev?.role || 'user',
        preferences: {
          ...(prev?.preferences || {}),
          ...(updatedUser.preferences || {}),
        },
      };
      return merged;
    });

    const token = localStorage.getItem('auth_token');
    if (token) {
      const prev = loadStoredUser();
      const merged = {
        ...(prev || {}),
        ...updatedUser,
        role: updatedUser.role || prev?.role || 'user',
        preferences: {
          ...(prev?.preferences || {}),
          ...(updatedUser.preferences || {}),
        },
      };
      saveAuth(token, merged);
    }

    const learn = updatedUser.preferences?.learningLang;
    if (learn && LANGUAGES_CODES.includes(learn)) {
      setCurrentLang(learn);
    }
  };

  // Sauvegarde la progression : PostgreSQL pour les comptes connectés,
  // localStorage en secours pour conserver le comportement actuel.
  useEffect(() => {
    if (currentView === 'player' && currentStory) {
      localStorage.setItem(`progress_${currentStory.id}`, currentSceneIndex.toString());
      setProgressByStoryId((prev) => ({
        ...prev,
        [currentStory.id]: currentSceneIndex,
      }));
      if (user) {
        api.put(`/api/library/progress/${currentStory.id}`, { sceneIndex: currentSceneIndex })
          .catch((error) => console.error('Erreur sauvegarde progression en ligne:', error));
      }
    }
  }, [currentView, currentStory, currentSceneIndex, user]);

  useEffect(() => {
    if (
      user &&
      currentView === 'player' &&
      currentStory &&
      currentSceneIndex === currentStory.scenes.length - 1
    ) {
      api.post('/api/library/history', {
        storyId: currentStory.id,
        eventType: 'completed',
      }).catch((error) => console.error('Erreur historique fin de lecture:', error));
    }
  }, [user, currentView, currentStory, currentSceneIndex]);

  // Effet n°2 : Gère la voix de synthèse automatique
  // Il se relance à chaque fois que la Scène, la Langue ou la Vue changent
  useEffect(() => {
    const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

    // Si on est bien sur la vue du lecteur et qu'une histoire est ouverte
    if (currentView === 'player' && currentStory) {
      // On récupère le texte exact de la scène actuelle dans la bonne langue
      const scene = currentStory.scenes?.[currentSceneIndex];
      const text = scene?.text?.[currentLang];
      
      // Si la lecture auto est activée, qu'on a du texte et qu'on n'est pas en "pause"
      if (isAutoPlay && text && canSpeak && !isPaused) {
        
        window.speechSynthesis.cancel(); // On coupe la voix précédente (pour éviter le brouhaha)
        
        // On prépare le moteur vocal du navigateur avec le texte
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langMap[currentLang] || 'fr-FR'; // On lui donne le bon accent (français, anglais, etc.)
        
        // On connecte nos variables d'état aux événements de la voix (début, fin, erreur)
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => { setIsPlaying(false); setIsPaused(false); };
        utterance.onerror = () => { setIsPlaying(false); setIsPaused(false); };
        
        // C'est parti, on lance la lecture !
        window.speechSynthesis.speak(utterance);
      }
    } else if (canSpeak) {
      // Si on quitte le lecteur pour revenir à l'accueil, on coupe tout
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
    
    // Fonction de nettoyage : quand ce composant est "détruit", on s'assure que la voix s'arrête
    return () => {
        if (canSpeak) {
          window.speechSynthesis.cancel();
        }
        setIsPlaying(false);
        setIsPaused(false);
    };
  }, [currentSceneIndex, currentLang, currentView]);

  // Effet n°3 : Un tout petit effet pour relancer la voix si l'utilisateur clique sur "Activer l'AutoPlay"
  useEffect(() => {
     if(isAutoPlay && !isPlaying && !isPaused && currentView === 'player') {
         const text = currentStory?.scenes[currentSceneIndex]?.text?.[currentLang];
         if(text && 'speechSynthesis' in window) {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = langMap[currentLang] || 'fr-FR';
            u.onstart = () => setIsPlaying(true);
            u.onend = () => { setIsPlaying(false); setIsPaused(false); };
            window.speechSynthesis.speak(u);
         }
     }
  }, [isAutoPlay]);

  // ==============================================================================
  // 5. LES FONCTIONS OUTILS DE L'APPLICATION
  // ==============================================================================

  // Fonction pour demander la liste de toutes les histoires à notre serveur Backend
  const fetchStories = async () => {
    try {
      // On fait une requête GET (lire) vers notre serveur
      const response = await api.get('/api/stories');
      if (response.data && response.data.length > 0) {
        setStories(response.data); // On sauvegarde les données reçues dans notre mémoire "stories"
        return response.data; // On retourne la liste pour la fonction de chargement initial
      }
      setStories([]);
      return [];
    } catch (error) {
      console.error("Erreur lors du chargement des histoires:", error);
      return [];
    }
  };

  const fetchLibraryData = async () => {
    if (!localStorage.getItem('auth_token')) return;
    try {
      const [favoritesResponse, recentResponse, progressResponse] = await Promise.all([
        api.get('/api/library/favorites').catch(() => ({ data: { favorites: [] } })),
        api.get('/api/library/history/recent').catch(() => ({ data: { recent: [] } })),
        api.get('/api/library/progress').catch(() => ({ data: { progress: [] } })),
      ]);
      setFavoriteIds((favoritesResponse.data.favorites || []).map((f) => f.storyId));
      setRecentStoryIds((recentResponse.data.recent || []).map((h) => h.storyId));
      const progressMap = {};
      for (const row of progressResponse.data.progress || []) {
        progressMap[row.storyId] = Number(row.sceneIndex) || 0;
      }
      setProgressByStoryId(progressMap);
    } catch (error) {
      console.error('Erreur lors du chargement des données utilisateur:', error);
    }
  };

  // Fonction déclenchée quand l'utilisateur sélectionne un fichier ZIP sur son ordinateur
  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true); // On lance la petite roue de chargement
    
    // On prépare notre fichier pour l'envoyer comme un paquet postal
    const formData = new FormData();
    formData.append('file', file);

    try {
      // On envoie le paquet postal à notre serveur via une requête POST (créer/envoyer)
      await api.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Si tout s'est bien passé, on recharge la liste pour faire apparaître la nouvelle histoire
      await fetchStories();
      alert("Histoire importée avec succès !");
    } catch (error) {
      console.error("Erreur d'importation:", error);
      // On affiche le message d'erreur précis renvoyé par le serveur s'il y en a un
      if (error.response && error.response.data && error.response.data.error) {
        alert(error.response.data.error);
      } else {
        alert("Erreur lors de l'import de l'histoire.");
      }
    } finally {
      setIsUploading(false); // On arrête la roue de chargement quoiqu'il arrive
      if (fileInputRef.current) fileInputRef.current.value = ""; // On remet le formulaire à zéro
    }
  };

  // Fonction pour ouvrir et commencer la lecture d'une histoire précise
  const handleStartStory = async (story) => {
    if (!story?.id || !Array.isArray(story.scenes) || story.scenes.length === 0) {
      alert("Cette entrée n'est pas une histoire valide.");
      return;
    }

    let parsedSceneIndex = 0;

    try {
      if (user) {
        const response = await api.get(`/api/library/progress/${story.id}`);
        parsedSceneIndex = response.data.progress?.sceneIndex ?? 0;
      } else {
        const savedProgression = localStorage.getItem(`progress_${story.id}`);
        parsedSceneIndex = parseInt(savedProgression, 10) || 0;
      }
    } catch (error) {
      console.error('Erreur récupération progression:', error);
      const savedProgression = localStorage.getItem(`progress_${story.id}`);
      parsedSceneIndex = parseInt(savedProgression, 10) || 0;
    }
    
    if (parsedSceneIndex > 0) {
       // Si oui, on affiche la boîte de dialogue (modal) pour lui poser la question
       setStoryToResume(story);
       setSavedSceneIndex(Math.min(parsedSceneIndex, story.scenes.length - 1));
       setShowResumeModal(true);
    } else {
       // Sinon (pas de sauvegarde ou page 0), on commence directement du début
       startStoryAtScene(story, 0);
    }
  };

  // Sous-fonction pour vraiment lancer l'histoire à une page donnée
  const startStoryAtScene = (story, sceneIndex) => {
    if (!story?.id || !Array.isArray(story.scenes) || story.scenes.length === 0) {
      alert("Cette entrée n'est pas une histoire valide.");
      return;
    }

    setCurrentStory(story);
    setCurrentSceneIndex(sceneIndex);
    setCurrentView('player');
    setShowResumeModal(false); // On ferme la popup au cas où elle était ouverte
    if (user) {
      api.post('/api/library/history', {
        storyId: story.id,
        eventType: 'started',
      }).catch((error) => console.error('Erreur historique de lecture:', error));
    }
  };

  // Actions depuis la popup de reprise
  const handleResumeStory = () => {
    startStoryAtScene(storyToResume, savedSceneIndex);
  };

  const handleRestartStory = () => {
    // S'il recommence, on efface l'ancienne sauvegarde
    localStorage.removeItem(`progress_${storyToResume.id}`);
    if (user) {
      api.put(`/api/library/progress/${storyToResume.id}`, { sceneIndex: 0 })
        .catch((error) => console.error('Erreur remise à zéro progression:', error));
    }
    startStoryAtScene(storyToResume, 0);
  };

  const toggleFavorite = async (storyId) => {
    const isFavorite = favoriteIds.includes(storyId);
    setFavoriteIds((ids) =>
      isFavorite ? ids.filter((id) => id !== storyId) : [...ids, storyId]
    );

    try {
      if (isFavorite) {
        await api.delete(`/api/library/favorites/${storyId}`);
      } else {
        await api.post('/api/library/favorites', { storyId });
      }
      fetchLibraryData();
      return true;
    } catch (error) {
      console.error('Erreur modification favori:', error);
      setFavoriteIds((ids) =>
        isFavorite ? [...ids, storyId] : ids.filter((id) => id !== storyId)
      );
      alert("Impossible de modifier ce favori pour l'instant.");
      return false;
    }
  };

  // Fonction magique pour choisir une histoire au hasard (adaptée à l'âge)
  const playRandomStory = () => {
    const isAdmin = user?.role === 'admin';
    const bandId = user?.preferences?.ageBand;
    const pool = isAdmin
      ? stories
      : bandId
        ? stories.filter((story) => storyMatchesAgeBand(story, bandId))
        : [];
    const candidates = pool.length > 0 ? pool : isAdmin ? stories : [];

    if (candidates.length === 0) {
      alert("Il n'y a pas encore d'histoires à lire !");
      return;
    }
    const randomIndex = Math.floor(Math.random() * candidates.length);
    handleStartStory(candidates[randomIndex]);
  };

  // Fonction pour fermer le lecteur et revenir au menu principal
  const handleBackToLibrary = () => {
    window.speechSynthesis.cancel();
    setCurrentView('library');
    setCurrentStory(null);
  };

  const handleStartStoryChat = () => {
    if (!user) {
      alert('Connectez-vous pour discuter avec l\'IA.');
      return;
    }
    window.speechSynthesis.cancel();
    setCurrentView('storyChat');
  };

  // Fonction pour faire glisser les histoires vers la droite sur l'accueil
  const scrollStoriesRight = () => {
    if (storiesContainerRef.current) {
      // scrollBy permet de déplacer la barre de défilement (300px vers la droite en douceur)
      storiesContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Fonction pour changer la langue (tourne en boucle FR -> EN -> AR -> FR)
  const toggleLang = () => {
    const langs = ['fr', 'en', 'ar'];
    const currentIndex = langs.indexOf(currentLang);
    // Le symbole % (modulo) permet de revenir à 0 quand on arrive à la fin du tableau
    const nextIndex = (currentIndex + 1) % langs.length;
    setCurrentLang(langs[nextIndex]);
  };

  // Un petit dictionnaire d'accents obligatoires pour que la voix du navigateur lise bien
  const langMap = {
    fr: 'fr-FR', // Français de France
    en: 'en-US', // Anglais des USA
    ar: 'ar-SA', // Arabe d'Arabie Saoudite
    es: 'es-ES',
    de: 'de-DE',
    it: 'it-IT',
    pt: 'pt-PT',
  };

  const currentScene = currentStory?.scenes?.[currentSceneIndex] || null;
  const currentSceneText = currentScene?.text?.[currentLang] || currentScene?.text?.fr || '';
  const currentSceneImage = currentScene?.image || '';
  const currentCharacterAvatar = currentScene?.character?.avatar || currentSceneImage;
  const isLastScene =
    currentStory && currentSceneIndex === currentStory.scenes.length - 1;
  const learningLang = user?.preferences?.learningLang || currentLang;
  const userLevel = user?.preferences?.level || 'debutant';

  // Fonction pour allumer ou éteindre le système de lecture automatique
  const toggleAutoAudio = () => {
    setIsAutoPlay(!isAutoPlay); // Inverse la valeur (vrai devient faux, faux devient vrai)
    // Si on désactive, on coupe la voix qui parle en ce moment
    if (isAutoPlay) {
       window.speechSynthesis.cancel();
    }
  };

  // Fonction très importante pour "réparer" les liens des images et les afficher correctement
  const getImageUrl = (path, storyId) => {
    if (!path) return ''; // Pas de chemin = pas d'image
    if (typeof path !== 'string') return '';
    if (path.startsWith('http')) return path; // Si c'est déjà une adresse internet complète, on la garde telle quelle
    
    // Sinon, on rajoute l'adresse de notre serveur devant le chemin (ex: http://localhost:3000/uploads/story_1/image.png)
    const cleanPath = path.replace(/^\/+/, ''); // Petite sécurité : retire les barres obliques (slash) en trop
    return `${API_URL}/uploads/${storyId}/${cleanPath}`;
  };

  // ==============================================================================
  // 6. LE VISUEL DU SITE WEB (HTML "boosté" appelé JSX)
  // C'est ici qu'on dessine les boutons, les textes, les couleurs, etc.
  // ==============================================================================
  return (
    <div className="min-h-screen bg-[#FAF8F6] text-gray-900 font-sans selection:bg-[#8C5EB9] selection:text-white" translate="no">
      
      {/* Conteneur principal qui centre le contenu */}
      <div className="container mx-auto p-4 min-h-screen flex flex-col relative">
        
        {/* ==========================================
            VUES CONNEXION / INSCRIPTION
            ========================================== */}
        {(currentView === 'login' || currentView === 'register') && (
          <AuthPage
            mode={currentView}
            onSuccess={handleAuthSuccess}
            onSwitchMode={(m) => setCurrentView(m)}
            onBack={() => setCurrentView('welcome')}
          />
        )}

        {/* Page d'accueil publique (non connecté) */}
        {!user && currentView !== 'login' && currentView !== 'register' && (
          <WelcomePage
            loading={authChecking}
            onLogin={() => setCurrentView('login')}
            onRegister={() => setCurrentView('register')}
          />
        )}

        {/* Bibliothèque d'histoires (connecté) */}
        {user && currentView === 'library' && (
          (user.role || '').toLowerCase() === 'admin' ? (
            <AdminLibraryPage
              user={user}
              stories={stories}
              isUploading={isUploading}
              fileInputRef={fileInputRef}
              storiesContainerRef={storiesContainerRef}
              showResumeModal={showResumeModal}
              storyToResume={storyToResume}
              savedSceneIndex={savedSceneIndex}
              onLogout={handleLogout}
              onFileSelect={handleFileSelect}
              onStartStory={handleStartStory}
              onPlayRandom={playRandomStory}
              favoriteIds={favoriteIds}
              recentStoryIds={recentStoryIds}
              onToggleFavorite={toggleFavorite}
              onUserUpdate={handleUserUpdate}
              onRestartStory={handleRestartStory}
              onResumeStory={handleResumeStory}
              onCloseResumeModal={() => setShowResumeModal(false)}
              getImageUrl={getImageUrl}
              progressByStoryId={progressByStoryId}
            />
          ) : (
            <LibraryPage
              user={user}
              stories={stories}
              isUploading={isUploading}
              fileInputRef={fileInputRef}
              storiesContainerRef={storiesContainerRef}
              showResumeModal={showResumeModal}
              storyToResume={storyToResume}
              savedSceneIndex={savedSceneIndex}
              onLogout={handleLogout}
              onFileSelect={handleFileSelect}
              onScrollRight={scrollStoriesRight}
              onStartStory={handleStartStory}
              onPlayRandom={playRandomStory}
              favoriteIds={favoriteIds}
              recentStoryIds={recentStoryIds}
              onToggleFavorite={toggleFavorite}
              onUserUpdate={handleUserUpdate}
              onRestartStory={handleRestartStory}
              onResumeStory={handleResumeStory}
              onCloseResumeModal={() => setShowResumeModal(false)}
              getImageUrl={getImageUrl}
              progressByStoryId={progressByStoryId}
            />
          )
        )}

        {currentView === 'storyChat' && currentStory && user && (
          <StoryChat
            story={currentStory}
            targetLang={learningLang}
            level={userLevel}
            onBack={handleBackToLibrary}
          />
        )}

        {/* ==========================================
            VUE 2 : LE LECTEUR D'HISTOIRE (Plein écran)
            ========================================== */}
        {/* Cette ligne vérifie : "Est-ce qu'on est sur le lecteur et qu'une histoire est bien chargée ?" */}
        {currentView === 'player' && currentStory && !currentScene && (
          <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-[#EBE6DC] p-6 text-center shadow-sm">
            <div className="max-w-md">
              <h2 className="text-2xl font-bold text-red-600 mb-3">Histoire incomplète</h2>
              <p className="text-gray-600 mb-6">
                Cette histoire ne contient pas de scène valide à afficher.
              </p>
              <button
                onClick={handleBackToLibrary}
                className="px-5 py-3 rounded-xl bg-[#8C5EB9] hover:bg-[#7a4fa8] text-white font-semibold transition"
              >
                Retour à la bibliothèque
              </button>
            </div>
          </div>
        )}

        {currentView === 'player' && currentStory && currentScene && (
          <div className="flex-1 flex flex-col items-center justify-center relative bg-white rounded-xl overflow-hidden shadow-2xl border border-[#EBE6DC]">
             
             {/* 1. LA BARRE DE PROGRESSION EN HAUT */}
             <div className="absolute top-0 left-0 w-full h-1.5 bg-[#EBE6DC] z-30">
                <div 
                  className="h-full bg-[#8C5EB9] transition-all duration-300 ease-out"
                  // Mathématiques simples : (Scène Actuelle / Nombre total de Scènes) * 100 = Pourcentage (ex: 50%)
                  style={{ width: `${((currentSceneIndex + 1) / currentStory.scenes.length) * 100}%` }}
                ></div>
             </div>

             {/* 2. L'IMAGE GÉANTE DE LA SCÈNE */}
             <div className="w-full h-full relative z-10">
                <img 
                  // On récupère le bon lien de l'image de la scène en cours
                  src={getImageUrl(currentSceneImage, currentStory.id)} 
                  alt="Scène de l'histoire" 
                  className="w-full h-full object-cover" // object-cover permet à l'image de remplir l'écran sans s'écraser
                />
                
                {/* 3. LES BOUTONS DU HAUT DROIT (Numéro de scène et Fermer) */}
                <div className="absolute top-4 right-4 flex gap-2 z-30">
                   <div className="bg-black/60 px-3 py-2 rounded-full text-white text-xs md:text-sm font-medium backdrop-blur-sm shadow-md">
                      Scène {currentSceneIndex + 1} / {currentStory.scenes.length}
                   </div>
                   <button onClick={handleBackToLibrary} className="bg-black/60 px-4 py-2 rounded-full text-white hover:bg-black/80 transition backdrop-blur-sm shadow-md text-xs md:text-sm font-bold">
                      Fermer
                   </button>
                </div>
             </div>

             {/* 4. LE PUPITRE DE COMMANDE EN BAS (Avatar, Texte, Audio) */}
             {/* Flex-col sur téléphone, Flex-row sur ordinateur (responsive) */}
             <div className="absolute bottom-0 w-full p-4 md:p-8 bg-gradient-to-t from-black/80 to-transparent z-20 flex flex-col md:flex-row items-center md:items-end gap-4">
                
                {/* Bouton pour revenir à la page PRÉCÉDENTE */}
                <button 
                  disabled={currentSceneIndex === 0} // Inactif si on est déjà à la page 1
                  onClick={() => setCurrentSceneIndex(i => i - 1)}
                  className="hidden md:flex mb-4 shrink-0 w-12 h-12 items-center justify-center bg-black/60 text-white rounded-full hover:bg-black/80 hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 transition shadow-lg border-2 border-white/20"
                  title="Scène précédente"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>

                {/* COLONNE DE GAUCHE : LE PERSONNAGE ET LES CONTRÔLES */}
                <div className="flex flex-row md:flex-col items-center gap-4 shrink-0 bg-black/40 md:bg-transparent p-2 md:p-0 rounded-2xl md:rounded-none backdrop-blur-sm md:backdrop-blur-none">
                   
                   {/* Le Bouton Rouge pour la Langue */}
                   <button 
                    onClick={toggleLang} // Appelle la fonction qui change de langue au clic
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-600 border-2 md:border-4 border-white shadow-lg flex items-center justify-center text-sm md:text-xl font-bold z-10 hover:scale-105 transition"
                    title={`Changer de langue (Actuel: ${currentLang.toUpperCase()})`}
                   >
                     {/* On affiche FR, EN, ou AR en majuscules */}
                     {currentLang.toUpperCase()} 
                   </button>
                   
                   {/* Le visage du personnage (Avatar) */}
                   <div className="w-16 h-16 md:w-24 md:h-24 bg-white rounded-full md:rounded-xl overflow-hidden border-2 border-gray-300 shadow-lg relative md:-mt-8 z-0">
                      <img 
                        src={getImageUrl(currentCharacterAvatar, currentStory.id)} 
                        alt="Avatar du personnage" 
                        className="w-full h-full object-cover" 
                      />
                   </div>
                   
                   {/* Les petits boutons ronds pour l'audio */}
                   <div className="flex gap-2 justify-center md:mt-1">
                      {/* Bouton pour allumer/éteindre la lecture automatique au changement de page */}
                      <button
                        onClick={toggleAutoAudio}
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow text-white transition ${isAutoPlay ? 'bg-green-600 ring-2 ring-white' : 'bg-gray-600 hover:bg-gray-700'}`}
                        title={isAutoPlay ? "Lecture automatique activée" : "Lecture automatique désactivée"}
                      >
                         {/* Si AutoPlay=Vrai on montre le volume actif, sinon le volume barré */}
                         {isAutoPlay ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </button>
                      
                      {/* Bouton Play/Pause manuel (au cas où on voudrait réécouter ou couper) */}
                      <button
                        onClick={() => {
                           if ('speechSynthesis' in window) {
                              if (isPlaying) {
                                  window.speechSynthesis.pause();
                                  setIsPlaying(false);
                                  setIsPaused(true);
                              } else if (isPaused) {
                                  window.speechSynthesis.resume();
                                  setIsPlaying(true);
                                  setIsPaused(false);
                              } else {
                                  // Relancer du début de la phrase
                                  window.speechSynthesis.cancel();
                                  const text = currentStory.scenes?.[currentSceneIndex]?.text?.[currentLang];
                                  if(text) {
                                    const u = new SpeechSynthesisUtterance(text);
                                    u.lang = langMap[currentLang] || 'fr-FR';
                                    u.onstart = () => setIsPlaying(true);
                                    u.onend = () => { setIsPlaying(false); setIsPaused(false); };
                                    window.speechSynthesis.speak(u);
                                  }
                              }
                           }
                        }}
                        // Le bouton devient jaune et clignote si ça parle !
                        className={`w-10 h-10 rounded-full flex items-center justify-center shadow text-white transition ${isPlaying ? 'bg-amber-500 hover:bg-amber-600 animate-pulse' : 'bg-red-600 hover:bg-red-700'}`}
                        title={isPlaying ? "Mettre en pause" : (isPaused ? "Reprendre la lecture" : "Lire le texte")}
                       >
                         {isPlaying ? <Pause className="w-4 h-4" fill="white" /> : <Play className="w-4 h-4" fill="white" />}
                      </button>
                   </div>
                </div>

                {/* LA GRANDE BULLE BLEUE QUI CONTIENT L'HISTOIRE (Affichée uniquement si showText est vrai) */}
                {showText ? (
                  <div 
                    className={`w-full md:flex-1 bg-blue-500/90 backdrop-blur-md p-4 md:p-6 rounded-2xl border-2 border-white text-base md:text-xl shadow-lg font-medium leading-relaxed min-h-[100px] md:min-h-[120px] text-white ${currentLang === 'ar' ? 'text-right' : 'text-left'} transition-opacity animate-in fade-in duration-300`}
                    dir={currentLang === 'ar' ? "rtl" : "ltr"} 
                  >
                     {currentSceneText || 'Aucun texte disponible pour cette langue.'}
                  </div>
                ) : (
                  // Si le texte est caché, on met une "div invisible" de même hauteur 
                  // pour éviter que les boutons (Précédent/Suivant) ne remontent brusquement
                  <div className="w-full md:flex-1 min-h-[100px] md:min-h-[120px] transition-all"></div>
                )}

                {/* COLONNE DE DROITE : Boutons d'interface */}
                <div className="flex w-full md:w-auto justify-between md:flex-row md:justify-end md:shrink-0 md:mb-4 gap-2">
                  
                  {/* Sur mobile, on affiche le bouton "Précédent" ici en bas pour gagner de la place */}
                  <button 
                    disabled={currentSceneIndex === 0}
                    onClick={() => setCurrentSceneIndex(i => i - 1)}
                    className="md:hidden w-12 h-12 flex items-center justify-center bg-black/60 text-white rounded-full hover:bg-black/80 active:scale-95 disabled:opacity-30 transition shadow-lg border-2 border-white/20"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  {/* Le bouton "Mode Difficile" pour masquer le texte (l'icône d'œil) */}
                  <button
                    onClick={() => setShowText(!showText)}
                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 border-white/20 text-white transition hover:scale-105 active:scale-95 ${showText ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 hover:bg-gray-600'}`}
                    title={showText ? "Masquer le texte" : "Afficher le texte"}
                  >
                     {showText ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
                  </button>

                  {/* Dernière scène : discussion IA. Sinon : scène suivante. */}
                  {isLastScene ? (
                    <button
                      type="button"
                      onClick={handleStartStoryChat}
                      className="h-12 px-4 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white rounded-full hover:scale-105 active:scale-95 transition shadow-lg border-2 border-white/20 text-sm font-semibold"
                      title="Discuter avec l'IA"
                    >
                      <MessageCircle className="w-5 h-5" />
                      <span className="hidden sm:inline">Discuter</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setCurrentSceneIndex((i) => i + 1)}
                      className="w-12 h-12 flex items-center justify-center bg-black/60 text-white rounded-full hover:bg-black/80 hover:scale-110 active:scale-95 transition shadow-lg border-2 border-white/20"
                      title="Scène suivante"
                    >
                      <ChevronRight className="w-6 h-6" />
                    </button>
                  )}
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

// On exporte notre application pour que le navigateur puisse l'afficher !
export default App;

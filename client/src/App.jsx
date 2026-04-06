// ==============================================================================
// 1. IMPORTATIONS DES OUTILS NÉCESSAIRES
// ==============================================================================
// On importe les "Hooks" de base de React qui nous permettent de gérer la mémoire (state) et les actions
import { useState, useEffect, useRef } from 'react';

// Axios est une bibliothèque qui nous permet de communiquer avec notre serveur (Backend)
import axios from 'axios';

// Lucide-react nous fournit des petites icônes vectorielles prêtes à l'emploi (très jolies !)
import { Play, Upload, Volume2, VolumeX, Pause, ChevronRight, ChevronLeft, Loader2, Eye, EyeOff } from 'lucide-react';

function App() {
  // ==============================================================================
  // 2. LA MÉMOIRE DE NOTRE APPLICATION (Les "States")
  // ==============================================================================
  // Si une de ces variables change, React met automatiquement à jour l'écran visuellement !
  
  // Définit quelle page on affiche actuellement : 'home' (accueil) ou 'player' (lecteur d'histoire)
  const [currentView, setCurrentView] = useState('home'); 
  
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

  // ==============================================================================
  // 3. LES RÉFÉRENCES (Permet de manipuler directement des éléments HTML cachés)
  // ==============================================================================
  // useRef est comme un pointeur laser vers un élément spécifique
  const fileInputRef = useRef(null); // Pointe vers le bouton "choisir un fichier" (qui est invisible sur notre site)
  const storiesContainerRef = useRef(null); // Pointe vers la liste des histoires pour pouvoir la faire défiler

  // ==============================================================================
  // 4. LES EFFETS (Actions qui se lancent automatiquement à des moments précis)
  // ==============================================================================

  // Effet n°1 : Se lance UNE SEULE FOIS au chargement du site (grâce au tableau vide `[]` à la fin)
  useEffect(() => {
    fetchStories();
  }, []);

  // Effet de Sauvegarde (Marque-page individuel par histoire)
  // S'active à chaque fois que la vue, l'histoire ou la scène changent
  useEffect(() => {
    if (currentView === 'player' && currentStory) {
      // On sauvegarde la progression spécifique à CETTE histoire
      localStorage.setItem(`progress_${currentStory.id}`, currentSceneIndex.toString());
    }
  }, [currentView, currentStory, currentSceneIndex]);

  // Effet n°2 : Gère la voix de synthèse automatique
  // Il se relance à chaque fois que la Scène, la Langue ou la Vue changent
  useEffect(() => {
    // Si on est bien sur la vue du lecteur et qu'une histoire est ouverte
    if (currentView === 'player' && currentStory) {
      // On récupère le texte exact de la scène actuelle dans la bonne langue
      const scene = currentStory.scenes[currentSceneIndex];
      const text = scene?.text?.[currentLang];
      
      // Si la lecture auto est activée, qu'on a du texte et qu'on n'est pas en "pause"
      if (isAutoPlay && text && 'speechSynthesis' in window && !isPaused) {
        
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
    } else {
      // Si on quitte le lecteur pour revenir à l'accueil, on coupe tout
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
    
    // Fonction de nettoyage : quand ce composant est "détruit", on s'assure que la voix s'arrête
    return () => {
        window.speechSynthesis.cancel();
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
            u.lang = langMap[currentLang];
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
      const response = await axios.get('http://localhost:3000/api/stories');
      if (response.data && response.data.length > 0) {
        setStories(response.data); // On sauvegarde les données reçues dans notre mémoire "stories"
        return response.data; // On retourne la liste pour la fonction de chargement initial
      }
      return [];
    } catch (error) {
      console.error("Erreur lors du chargement des histoires:", error);
      return [];
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
      await axios.post('http://localhost:3000/api/upload', formData, {
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
  const handleStartStory = (story) => {
    // On vérifie s'il y a une sauvegarde pour CETTE histoire spécifique (et qu'on n'est pas à la page 0)
    const savedProgression = localStorage.getItem(`progress_${story.id}`);
    const parsedSceneIndex = parseInt(savedProgression, 10);
    
    if (savedProgression && parsedSceneIndex > 0) {
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
    setCurrentStory(story);
    setCurrentSceneIndex(sceneIndex);
    setCurrentView('player');
    setShowResumeModal(false); // On ferme la popup au cas où elle était ouverte
  };

  // Actions depuis la popup de reprise
  const handleResumeStory = () => {
    startStoryAtScene(storyToResume, savedSceneIndex);
  };

  const handleRestartStory = () => {
    // S'il recommence, on efface l'ancienne sauvegarde
    localStorage.removeItem(`progress_${storyToResume.id}`);
    startStoryAtScene(storyToResume, 0);
  };

  // Fonction magique pour choisir une histoire au hasard (le gros bouton rouge Play)
  const playRandomStory = () => {
    if (stories.length === 0) {
      alert("Il n'y a pas encore d'histoires à lire ! Importez-en une d'abord.");
      return;
    }
    // Math.random donne un chiffre au hasard, qu'on multiplie par le nombre d'histoires
    const randomIndex = Math.floor(Math.random() * stories.length);
    handleStartStory(stories[randomIndex]); // Et on lance l'histoire trouvée !
  };

  // Fonction pour fermer le lecteur et revenir au menu principal
  const handleBackToHome = () => {
    setCurrentView('home');
    setCurrentStory(null); // On vide la mémoire de l'histoire en cours
    
    // NB: On a supprimé la ligne qui effaçait la sauvegarde !
    // Maintenant, si l'utilisateur clique sur "Fermer", on garde sa progression 
    // pour pouvoir lui poser la question (reprendre ou recommencer) la prochaine fois.
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
    ar: 'ar-SA'  // Arabe d'Arabie Saoudite
  };

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
    if (path.startsWith('http')) return path; // Si c'est déjà une adresse internet complète, on la garde telle quelle
    
    // Sinon, on rajoute l'adresse de notre serveur devant le chemin (ex: http://localhost:3000/uploads/story_1/image.png)
    const cleanPath = path.replace(/^\/+/, ''); // Petite sécurité : retire les barres obliques (slash) en trop
    return `http://localhost:3000/uploads/${storyId}/${cleanPath}`;
  };

  // ==============================================================================
  // 6. LE VISUEL DU SITE WEB (HTML "boosté" appelé JSX)
  // C'est ici qu'on dessine les boutons, les textes, les couleurs, etc.
  // ==============================================================================
  return (
    // "min-h-screen bg-gradient-..." crée un fond noir/gris pour tout le site
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white font-sans selection:bg-red-500 selection:text-white">
      
      {/* Conteneur principal qui centre le contenu */}
      <div className="container mx-auto p-4 h-screen flex flex-col relative">
        
        {/* ==========================================
            VUE 1 : LA PAGE D'ACCUEIL
            ========================================== */}
        {/* Cette ligne vérifie : "Est-ce qu'on est sur la vue 'home' ?" Si OUI, on affiche ce qui suit : */}
        {currentView === 'home' && (
          <div className="flex-1 flex flex-col relative pb-20">
            
            {/* L'EN-TÊTE : Titre "Stories" et Bouton "Importer" */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div className="text-2xl font-bold text-teal-400">Stories</div>
              
              <div className="flex items-center gap-4">
                {/* L'entrée de fichier native de Windows/Mac, on la cache car elle est moche ! */}
                <input 
                  type="file" 
                  accept=".zip" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                />

                {/* Notre beau bouton rouge qui, quand on clique dessus, clique en secret sur l'entrée de fichier ci-dessus */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading} // On bloque le bouton pendant le chargement
                  className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white rounded-full w-16 h-16 md:w-20 md:h-20 flex flex-col items-center justify-center shadow-lg transform transition hover:scale-105 active:scale-95 shrink-0"
                  title="Importer une nouvelle histoire (.zip)"
                >
                  {isUploading ? (
                    // Si ça charge, on montre l'icône qui tourne (Loader2)
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    // Sinon on montre l'icône de téléchargement vers le haut
                    <>
                      <Upload className="w-6 h-6 mb-1" />
                      <span className="font-bold text-[10px] md:text-xs">Importer</span>
                    </>
                  )}
                </button>
                
                {/* Une petite boîte de texte grise pour expliquer quoi faire */}
                <div className="hidden md:block bg-[#2a2a2a] p-3 rounded text-gray-400 text-sm border border-gray-600 w-64 truncate">
                  {isUploading ? "Importation en cours..." : "Sélectionnez un fichier .zip"}
                </div>
              </div>
            </div>

            {/* LE RAYON DES HISTOIRES (La liste défilante horizontale) */}
            <div 
              ref={storiesContainerRef} // Le pointeur laser qu'on a défini plus haut pour le défilement
              className="flex-1 flex items-center justify-start gap-6 overflow-x-auto pb-8 scroll-smooth"
            >
              {/* Si on n'a aucune histoire (tableau vide), on affiche un message */}
              {stories.length === 0 ? (
                 <div className="text-gray-400 text-center w-full">Aucune histoire trouvée. Veuillez en importer une.</div>
              ) : (
                // Sinon, on parcourt chaque histoire de la mémoire avec map() pour créer une "Carte" pour chacune
                stories.map((story, index) => (
                  <div 
                    key={story.id || index}
                    onClick={() => handleStartStory(story)} // Au clic, ça lance le lecteur !
                    className="w-48 h-80 md:w-56 md:h-96 bg-blue-500 rounded-2xl p-4 flex flex-col justify-between cursor-pointer hover:ring-4 ring-white transition relative shadow-xl group shrink-0"
                    // On met l'image de couverture (thumbnail) en fond
                    style={story.thumbnail ? { 
                      backgroundImage: `url(${getImageUrl(story.thumbnail, story.id)})`, 
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    } : {}}
                  >
                    {/* S'il n'y a pas d'image, on affiche l'ID de l'histoire en petit en haut */}
                    {!story.thumbnail && (
                       <div className="bg-black/40 text-white text-xs py-1 px-2 rounded self-start">
                         {story.title || story.id}
                       </div>
                    )}
                    
                    {/* Le Titre de l'histoire affiché en bas de la carte sur un fond noir semi-transparent */}
                    <div className="mt-auto bg-black/70 p-2 rounded text-sm md:text-base font-bold text-center">
                      {story.title || "Histoire sans titre"}
                    </div>
  
                    {/* L'icône de lecture cachée qui apparaît quand on passe la souris (group-hover:opacity-100) */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-2xl">
                       <Play className="w-12 h-12 text-white" fill="white" />
                    </div>
                  </div>
                ))
              )}
              
               {/* Le bouton "Défiler vers la droite" (Seulement s'il y a des histoires) */}
              {stories.length > 0 && (
                <button 
                  onClick={scrollStoriesRight}
                  className="hidden md:flex p-4 border-2 border-white/20 rounded-xl hover:bg-white/10 shrink-0 transition-transform active:scale-95"
                  title="Voir plus d'histoires"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>
            
             {/* LE BOUTON MAGIQUE (HISTOIRE ALÉATOIRE) tout en bas au milieu */}
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <button 
                  onClick={playRandomStory}
                  className="bg-red-500/90 hover:bg-red-600 text-white p-4 rounded-full shadow-lg backdrop-blur-sm transition-transform hover:scale-110 active:scale-95 group"
                  title="Lire une histoire au hasard"
                >
                   <Play className="w-8 h-8 group-hover:animate-pulse" fill="white" />
                </button>
             </div>

             {/* LA POPUP (MODAL) DE REPRISE DE LECTURE */}
             {showResumeModal && (
               <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                 <div className="bg-gray-800 border-2 border-gray-600 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl text-center">
                    <h3 className="text-2xl font-bold text-teal-400 mb-2">Reprendre l'histoire ?</h3>
                    <p className="text-gray-300 mb-8">
                      Vous étiez en train de lire <strong className="text-white">"{storyToResume?.title}"</strong> à la scène {savedSceneIndex + 1}. Que souhaitez-vous faire ?
                    </p>
                    
                    <div className="flex flex-col gap-3 md:flex-row md:justify-center">
                      <button 
                        onClick={handleRestartStory}
                        className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition"
                      >
                        Recommencer du début
                      </button>
                      <button 
                        onClick={handleResumeStory}
                        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" /> Reprendre la lecture
                      </button>
                    </div>
                    
                    {/* Bouton pour juste fermer la popup et ne rien faire */}
                    <button 
                      onClick={() => setShowResumeModal(false)}
                      className="mt-6 text-sm text-gray-500 hover:text-gray-300 underline"
                    >
                      Annuler
                    </button>
                 </div>
               </div>
             )}
          </div>
        )}

        {/* ==========================================
            VUE 2 : LE LECTEUR D'HISTOIRE (Plein écran)
            ========================================== */}
        {/* Cette ligne vérifie : "Est-ce qu'on est sur le lecteur et qu'une histoire est bien chargée ?" */}
        {currentView === 'player' && currentStory && (
          <div className="flex-1 flex flex-col items-center justify-center relative bg-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl border border-gray-700">
             
             {/* 1. LA BARRE DE PROGRESSION EN HAUT */}
             <div className="absolute top-0 left-0 w-full h-1.5 bg-gray-800 z-30">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 ease-out"
                  // Mathématiques simples : (Scène Actuelle / Nombre total de Scènes) * 100 = Pourcentage (ex: 50%)
                  style={{ width: `${((currentSceneIndex + 1) / currentStory.scenes.length) * 100}%` }}
                ></div>
             </div>

             {/* 2. L'IMAGE GÉANTE DE LA SCÈNE */}
             <div className="w-full h-full relative z-10">
                <img 
                  // On récupère le bon lien de l'image de la scène en cours
                  src={getImageUrl(currentStory.scenes[currentSceneIndex].image, currentStory.id)} 
                  alt="Scène de l'histoire" 
                  className="w-full h-full object-cover" // object-cover permet à l'image de remplir l'écran sans s'écraser
                />
                
                {/* 3. LES BOUTONS DU HAUT DROIT (Numéro de scène et Fermer) */}
                <div className="absolute top-4 right-4 flex gap-2 z-30">
                   <div className="bg-black/60 px-3 py-2 rounded-full text-white text-xs md:text-sm font-medium backdrop-blur-sm shadow-md">
                      Scène {currentSceneIndex + 1} / {currentStory.scenes.length}
                   </div>
                   <button onClick={handleBackToHome} className="bg-black/60 px-4 py-2 rounded-full text-white hover:bg-black/80 transition backdrop-blur-sm shadow-md text-xs md:text-sm font-bold">
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
                        src={getImageUrl(currentStory.scenes[currentSceneIndex].character.avatar, currentStory.id)} 
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
                                  const text = currentStory.scenes[currentSceneIndex]?.text?.[currentLang];
                                  if(text) {
                                    const u = new SpeechSynthesisUtterance(text);
                                    u.lang = langMap[currentLang];
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
                     {currentStory.scenes[currentSceneIndex].text[currentLang]}
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

                  {/* Bouton pour passer à la page SUIVANTE */}
                  <button 
                    disabled={currentSceneIndex === currentStory.scenes.length - 1} // Inactif si on est à la dernière page
                    onClick={() => setCurrentSceneIndex(i => i + 1)}
                    className="w-12 h-12 flex items-center justify-center bg-black/60 text-white rounded-full hover:bg-black/80 hover:scale-110 active:scale-95 disabled:opacity-30 disabled:hover:scale-100 transition shadow-lg border-2 border-white/20"
                    title="Scène suivante"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
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

/**
 * Étiquette les histoires existantes + crée 4 histoires enfants connues
 * (réutilise les images illustrées déjà présentes).
 */
const fs = require('fs');
const path = require('path');

const UPLOADS = path.join(__dirname, '..', 'uploads');

const EXISTING = {
  story_1772352220159: { ageCategory: 'petits', title: 'Une journée au parc' },
  story_1772353919398: { ageCategory: 'moyens', title: "L'anniversaire surprise" },
  story_1773728612510: { ageCategory: 'grands', title: 'Une aventure sous la mer' },
};

function scene(id, character, texts, image = `images/scene${id}.png`) {
  return {
    id,
    image,
    character: { name: character, avatar: 'images/scene1.png' },
    text: texts,
  };
}

function writeStory(folderName, story, sourceImagesFolder) {
  const dest = path.join(UPLOADS, folderName);
  const destImages = path.join(dest, 'images');
  const srcImages = path.join(UPLOADS, sourceImagesFolder, 'images');

  fs.mkdirSync(destImages, { recursive: true });
  for (const file of fs.readdirSync(srcImages)) {
    fs.copyFileSync(path.join(srcImages, file), path.join(destImages, file));
  }
  fs.writeFileSync(path.join(dest, 'story.json'), JSON.stringify(story, null, 2), 'utf8');
  console.log('Créé:', folderName, '→', story.title);
}

function patchExistingAge() {
  for (const [folder, meta] of Object.entries(EXISTING)) {
    const jsonPath = path.join(UPLOADS, folder, 'story.json');
    if (!fs.existsSync(jsonPath)) continue;
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    data.ageCategory = meta.ageCategory;
    if (!data.title) data.title = meta.title;
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Étiqueté:', folder, meta.ageCategory);
  }
}

const STORIES = [
  {
    folder: 'story_chiots_sauveteurs',
    source: 'story_1772352220159',
    story: {
      id: 'chiots-sauveteurs',
      title: 'Les Chiots Sauveteurs',
      title_ar: 'الجراء المنقذون',
      ageCategory: 'petits',
      thumbnail: 'images/scene1.png',
      scenes: [
        scene(1, 'Rocky', {
          fr: 'Bonjour ! Je suis Rocky. Nous sommes les chiots sauveteurs.',
          en: 'Hello! I am Rocky. We are the rescue pups.',
          ar: 'مرحباً! أنا روكي. نحن الجراء المنقذون.',
        }),
        scene(2, 'Rocky', {
          fr: 'Un ballon est perdu dans le parc. Nous partons en mission !',
          en: 'A balloon is lost in the park. We go on a mission!',
          ar: 'بالون ضائع في الحديقة. ننطلق في مهمة!',
        }),
        scene(3, 'Skye', {
          fr: 'Skye regarde le ciel bleu. Elle cherche le ballon.',
          en: 'Skye looks at the blue sky. She looks for the balloon.',
          ar: 'سكاي تنظر إلى السماء الزرقاء. تبحث عن البالون.',
        }),
        scene(4, 'Rocky', {
          fr: 'Nous voyons une fleur jaune près du chemin.',
          en: 'We see a yellow flower near the path.',
          ar: 'نرى زهرة صفراء قرب الطريق.',
        }),
        scene(5, 'Marshall', {
          fr: 'Marshall trouve un petit chien triste. Il a perdu son jouet.',
          en: 'Marshall finds a sad little dog. He lost his toy.',
          ar: 'مارشال يجد كلباً صغيراً حزيناً. لقد فقد لعبته.',
        }),
        scene(6, 'Rocky', {
          fr: 'Nous partageons un biscuit. Tout le monde est content.',
          en: 'We share a biscuit. Everyone is happy.',
          ar: 'نشارك بسكويتة. الجميع سعداء.',
        }),
        scene(7, 'Skye', {
          fr: 'Le ballon est dans l’arbre ! Skye aide à le reprendre.',
          en: 'The balloon is in the tree! Skye helps to get it back.',
          ar: 'البالون على الشجرة! سكاي تساعد على استعادته.',
        }),
        scene(8, 'Rocky', {
          fr: 'Mission réussie ! Les chiots sauveteurs sont des héros.',
          en: 'Mission complete! The rescue pups are heroes.',
          ar: 'نجحت المهمة! الجراء المنقذون أبطال.',
        }),
      ],
    },
  },
  {
    folder: 'story_cendrillon',
    source: 'story_1772353919398',
    story: {
      id: 'cendrillon',
      title: 'Cendrillon',
      title_ar: 'سندريلا',
      ageCategory: 'moyens',
      thumbnail: 'images/scene1.png',
      scenes: [
        scene(1, 'Cendrillon', {
          fr: 'Il était une fois une douce fille nommée Cendrillon.',
          en: 'Once upon a time, there was a kind girl named Cinderella.',
          ar: 'كان يا مكان فتاة لطيفة اسمها سندريلا.',
        }),
        scene(2, 'Cendrillon', {
          fr: 'Elle rêve d’aller au bal du château ce soir.',
          en: 'She dreams of going to the castle ball tonight.',
          ar: 'تحلم بالذهاب إلى حفل القصر هذه الليلة.',
        }),
        scene(3, 'Fée', {
          fr: 'Une fée apparaît. Elle transforme une citrouille en carrosse.',
          en: 'A fairy appears. She turns a pumpkin into a coach.',
          ar: 'تظهر جنية. تحول يقطينة إلى عربة.',
        }),
        scene(4, 'Cendrillon', {
          fr: 'Cendrillon porte une belle robe et des souliers de verre.',
          en: 'Cinderella wears a beautiful dress and glass slippers.',
          ar: 'ترتدي سندريلا فستاناً جميلاً وحذاءً من زجاج.',
        }),
        scene(5, 'Prince', {
          fr: 'Au bal, le prince danse avec elle. Ils sont heureux.',
          en: 'At the ball, the prince dances with her. They are happy.',
          ar: 'في الحفل، يرقص الأمير معها. هما سعيدان.',
        }),
        scene(6, 'Cendrillon', {
          fr: 'À minuit, elle doit partir. Un soulier reste derrière elle.',
          en: 'At midnight, she must leave. One slipper stays behind.',
          ar: 'عند منتصف الليل، يجب أن تغادر. يبقى حذاء واحد.',
        }),
        scene(7, 'Prince', {
          fr: 'Le prince cherche la propriétaire du joli soulier.',
          en: 'The prince looks for the owner of the lovely slipper.',
          ar: 'يبحث الأمير عن صاحبة الحذاء الجميل.',
        }),
        scene(8, 'Cendrillon', {
          fr: 'Le soulier lui va parfaitement. Cendrillon est heureuse pour toujours.',
          en: 'The slipper fits perfectly. Cinderella is happy forever.',
          ar: 'الحذاء يناسبها تماماً. تعيش سندريلا سعيدة إلى الأبد.',
        }),
      ],
    },
  },
  {
    folder: 'story_batman_nuit',
    source: 'story_1773728612510',
    story: {
      id: 'batman-nuit',
      title: 'Batman et la Nuit Courageuse',
      title_ar: 'باتمان والليلة الشجاعة',
      ageCategory: 'grands',
      thumbnail: 'images/scene1.png',
      scenes: [
        scene(1, 'Batman', {
          fr: 'La ville est calme. Batman veille depuis le toit.',
          en: 'The city is quiet. Batman watches from the rooftop.',
          ar: 'المدينة هادئة. باتمان يراقب من السطح.',
        }),
        scene(2, 'Batman', {
          fr: 'Un signal apparaît dans le ciel. Quelqu’un a besoin d’aide.',
          en: 'A signal appears in the sky. Someone needs help.',
          ar: 'إشارة تظهر في السماء. شخص ما يحتاج إلى مساعدة.',
        }),
        scene(3, 'Robin', {
          fr: 'Robin arrive. Ensemble, ils partent protéger les enfants.',
          en: 'Robin arrives. Together, they go to protect the children.',
          ar: 'يصل روبن. معاً يذهبان لحماية الأطفال.',
        }),
        scene(4, 'Batman', {
          fr: 'Dans l’ombre, ils trouvent un chat perdu près du port.',
          en: 'In the shadows, they find a lost cat near the harbor.',
          ar: 'في الظل، يجدان قطة ضائعة قرب الميناء.',
        }),
        scene(5, 'Batman', {
          fr: 'Batman aide le chat. Le courage, c’est aussi être gentil.',
          en: 'Batman helps the cat. Courage is also being kind.',
          ar: 'باتمان يساعد القطة. الشجاعة تعني أيضاً أن تكون لطيفاً.',
        }),
        scene(6, 'Robin', {
          fr: 'Ils ramènent le chat à une petite fille. Elle sourit.',
          en: 'They bring the cat back to a little girl. She smiles.',
          ar: 'يعيدان القطة إلى فتاة صغيرة. تبتسم.',
        }),
        scene(7, 'Batman', {
          fr: 'La nuit devient paisible. Batman et Robin rentrent.',
          en: 'The night becomes peaceful. Batman and Robin head home.',
          ar: 'تصبح الليلة هادئة. يعود باتمان وروبن إلى المنزل.',
        }),
        scene(8, 'Batman', {
          fr: 'Être un héros, c’est aider les autres. Fin de la mission.',
          en: 'Being a hero means helping others. End of the mission.',
          ar: 'أن تكون بطلاً يعني مساعدة الآخرين. نهاية المهمة.',
        }),
      ],
    },
  },
  {
    folder: 'story_avatar_foret',
    source: 'story_1773728612510',
    story: {
      id: 'avatar-foret',
      title: 'Avatar : Les Enfants de la Forêt',
      title_ar: 'أفاتار: أطفال الغابة',
      ageCategory: 'grands',
      thumbnail: 'images/scene3.png',
      scenes: [
        scene(1, 'Ayo', {
          fr: 'Ayo vit dans une forêt lumineuse pleine de couleurs.',
          en: 'Ayo lives in a glowing forest full of colors.',
          ar: 'أيو يعيش في غابة مضيئة مليئة بالألوان.',
        }, 'images/scene3.png'),
        scene(2, 'Ayo', {
          fr: 'Il écoute les arbres. La nature parle doucement.',
          en: 'He listens to the trees. Nature speaks softly.',
          ar: 'يستمع إلى الأشجار. الطبيعة تتحدث بهدوء.',
        }, 'images/scene4.png'),
        scene(3, 'Lena', {
          fr: 'Lena, sa sœur, découvre une rivière bleue magique.',
          en: 'Lena, his sister, discovers a magical blue river.',
          ar: 'لينا، أخته، تكتشف نهراً أزرق سحرياً.',
        }, 'images/scene5.png'),
        scene(4, 'Ayo', {
          fr: 'Ils aident un oiseau blessé à retrouver son nid.',
          en: 'They help an injured bird find its nest again.',
          ar: 'يساعدان طائراً مصاباً على العودة إلى عشه.',
        }, 'images/scene6.png'),
        scene(5, 'Lena', {
          fr: 'La forêt leur offre une lumière douce en remerciement.',
          en: 'The forest gives them a gentle light as a thank-you.',
          ar: 'تهديهما الغابة ضوءاً لطيفاً عرفاناً بالجميل.',
        }, 'images/scene7.png'),
        scene(6, 'Ayo', {
          fr: 'Ayo apprend que protéger la planète, c’est être brave.',
          en: 'Ayo learns that protecting the planet is being brave.',
          ar: 'يتعلم أيو أن حماية الكوكب تعني أن تكون شجاعاً.',
        }, 'images/scene8.png'),
        scene(7, 'Lena', {
          fr: 'Ensemble, ils promettent de soigner la forêt chaque jour.',
          en: 'Together, they promise to care for the forest every day.',
          ar: 'معاً يعدان بالعناية بالغابة كل يوم.',
        }, 'images/scene9.png'),
        scene(8, 'Ayo', {
          fr: 'La forêt brille. Les enfants de la forêt sont heureux.',
          en: 'The forest shines. The children of the forest are happy.',
          ar: 'تتألق الغابة. أطفال الغابة سعداء.',
        }, 'images/scene10.png'),
      ],
    },
  },
];

patchExistingAge();
for (const item of STORIES) {
  writeStory(item.folder, item.story, item.source);
}
console.log('Terminé.');

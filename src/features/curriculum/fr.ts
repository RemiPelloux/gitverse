import type { CurriculumText } from "./localize";

/** French text for the curriculum. Same order as lessons.ts / index.ts. */
export const CURRICULUM_FR: CurriculumText = {
  tiers: { beginner: "Débutant", intermediate: "Intermédiaire", advanced: "Avancé", expert: "Expert" },
  chapters: {
    foundations: {
      title: "Les bases de Git",
      description: "Ce qu'est Git, et comment enregistrer ton tout premier instantané.",
      upcoming: [],
    },
    history: {
      title: "Comprendre l'historique",
      description: "Lire la chronologie, les identifiants de commit, HEAD et voyager dans le temps.",
      upcoming: ["Inspecter les changements entre deux commits"],
    },
    branching: {
      title: "Les branches",
      description: "Des chronologies parallèles pour expérimenter sans risque.",
      upcoming: ["Renommer et supprimer des branches"],
    },
    merging: {
      title: "La fusion",
      description: "Réunir des chronologies — et gérer les conflits.",
      upcoming: [],
    },
    rebase: {
      title: "Le rebase",
      description: "Rejouer des commits pour un historique propre et linéaire.",
      upcoming: ["Les bases du rebase", "Le rebase interactif", "Squash et fixup", "Merge ou rebase ?"],
    },
    undo: {
      title: "Annuler des changements",
      description: "Restore, revert, reset — et récupérer du travail « perdu ».",
      upcoming: ["Amend", "Les modes de reset en détail"],
    },
    github: {
      title: "Les bases de GitHub",
      description: "Dépôts distants, push, fetch et pull avec tes coéquipiers.",
      upcoming: [],
    },
    "pull-requests": {
      title: "Les pull requests",
      description: "Proposer, relire et fusionner des changements sur GitHub.",
      upcoming: ["Créer une pull request", "La revue de code", "Les stratégies de fusion", "La protection de branche"],
    },
    collaboration: {
      title: "Travailler en équipe",
      description: "Branches de fonctionnalité, GitHub Flow et trunk-based development.",
      upcoming: ["GitHub Flow", "Le trunk-based development", "La gestion des versions"],
    },
    advanced: {
      title: "Git avancé",
      description: "Cherry-pick, stash, tags, bisect et plus encore.",
      upcoming: ["Cherry-pick", "Stash", "Tags", "Bisect", ".gitignore", "Hooks"],
    },
    workflows: {
      title: "Les workflows des développeurs sur GitHub",
      description: "Issues, Actions, CI/CD et sécurité du dépôt.",
      upcoming: ["GitHub Actions", "CI/CD", "Les secrets", "Les permissions"],
    },
    scenarios: {
      title: "Missions de sauvetage réelles",
      description: "Un secret commité ? La mauvaise branche ? main cassée ? Répare tout ça.",
      upcoming: ["Commit sur la mauvaise branche", "main est cassée", "Un secret commité par accident"],
    },
  },
  lessons: {
    // ───────────────────────────────────────────── Chapitre 1 — Les bases
    "what-is-git": {
      title: "Git, c'est quoi ?",
      tagline: "Une machine à remonter le temps pour ton projet",
      concepts: ["gestion de versions", "dépôt", "instantanés"],
      recap: [
        "Git enregistre des instantanés de ton projet pour que tu puisses toujours revenir en arrière.",
        "Un dépôt, c'est ton dossier de projet plus un dossier caché .git où Git garde son historique.",
        "git init transforme n'importe quel dossier en dépôt.",
      ],
      steps: [
        {
          title: "Déjà enregistré « final_v2_VRAIMENT_final.html » ?",
          body: [
            "Quand tu travailles sur un projet, tu modifies des choses sans arrêt. Parfois tu casses quelque chose et tu aimerais revenir en arrière.",
            "Git est un outil qui prend des instantanés de ton projet quand tu le lui demandes. Chaque instantané se souvient exactement du contenu de chaque fichier.",
            "Appuie sur le bouton pour prendre quelques instantanés et regarde une chronologie se construire.",
          ],
        },
        {
          title: "Ton projet, avec une mémoire",
          body: [
            "Un dépôt (ou « repo ») est simplement ton dossier de projet avec un dossier caché .git à l'intérieur.",
            "Ce dossier .git, c'est la mémoire de Git : chaque instantané que tu prendras y est rangé. Tes fichiers restent exactement là où ils sont.",
          ],
        },
        {
          title: "Transforme ton dossier en dépôt",
          body: "Ton projet contient déjà un fichier index.html, mais Git ne le surveille pas encore. Tape la commande ci-dessous dans le terminal (ou appuie sur Exécuter) pour créer un dépôt.",
          success: "Ton dossier est maintenant un dépôt Git ! La zone du graphe est prête à afficher ton historique.",
          hint: "Tape exactement git init — « git » est le programme, « init » est l'abréviation de « initialize » (initialiser).",
        },
        {
          title: "Jette un œil",
          body: "Rien n'a changé dans tes fichiers — Git a seulement ajouté son dossier caché .git. Essaie ces commandes pour fouiller un peu. Ici, tu ne peux rien casser.",
        },
        null,
      ],
    },

    "first-commit": {
      title: "Ton premier commit",
      tagline: "Répertoire de travail → zone de staging → instantané",
      concepts: ["répertoire de travail", "zone de staging", "commit"],
      recap: [
        "Ton répertoire de travail, ce sont les fichiers que tu modifies.",
        "git add copie la version actuelle d'un fichier dans la zone de staging : le « prochain instantané » que tu prépares.",
        "git commit enregistre la zone de staging comme un instantané permanent, avec un message.",
      ],
      steps: [
        {
          title: "Trois endroits où vit ton travail",
          body: [
            "Git pense à tes fichiers à trois endroits. Ton répertoire de travail, c'est là où tu modifies les fichiers.",
            "La zone de staging est comme un cadre photo : tu choisis ce qui entrera dans le prochain instantané.",
            "Le dépôt conserve chaque instantané (appelé commit) pour toujours. Essaie de faire passer le fichier par chaque étape.",
          ],
        },
        {
          title: "Crée un fichier",
          body: "Un projet a besoin d'au moins un fichier. Crée README.md — un fichier qui décrit ton projet. Utilise le bouton, le panneau Fichiers, ou tape touch README.md.",
          success: "README.md existe maintenant dans ton répertoire de travail. Git le voit, mais ne le suit pas encore.",
          actionLabel: "Créer README.md",
        },
        {
          title: "Demande à Git ce qu'il voit",
          body: "git status est ton meilleur ami. Il te dit ce qui a changé et ce que Git va faire ensuite. Lance-le dès que tu as un doute.",
          success: "Tu vois « Untracked files » ? Git a remarqué README.md mais ne l'enregistre pas encore. « Untracked » (non suivi) veut dire que Git n'a jamais stocké ce fichier.",
        },
        {
          title: "Ajoute le fichier à la zone de staging",
          body: "Place README.md dans la zone de staging — le « cadre photo » de ton prochain instantané.",
          success: "README.md est dans la zone de staging. Regarde le panneau des étapes : le fichier est passé dans la zone de staging.",
          hint: "git add prend le nom du fichier que tu veux ajouter à la zone de staging.",
        },
        {
          title: "Prends l'instantané",
          body: "Maintenant, commite : enregistre la zone de staging comme un instantané. La partie -m ajoute un court message qui décrit ce que tu as fait. Les guillemets gardent le message d'un seul bloc.",
          success: "Ton premier commit ! Le cercle dans le graphe, C'EST ton instantané. « main » est le nom de la branche et HEAD veut dire « tu es ici ».",
          hint: `N'oublie pas les guillemets autour du message : git commit -m "Initial commit"`,
        },
        {
          title: "Défi : commite un deuxième fichier",
          body: "À toi de jouer : crée un fichier appelé hello.txt, ajoute-le à la zone de staging et commite-le. Utilise git status quand tu veux vérifier où tu en es.",
          objectives: [
            {
              label: "Crée hello.txt",
              hints: [
                "Les fichiers vivent dans ton répertoire de travail. Tu peux en créer un depuis le panneau Fichiers.",
                "Clique sur « Nouveau fichier » dans le panneau Fichiers, ou tape touch hello.txt",
                "Tape : touch hello.txt — puis appuie sur Entrée.",
              ],
            },
            {
              label: "Enregistre hello.txt dans un commit",
              hints: [
                "Un fichier entre dans un commit en deux temps : ajoute-le à la zone de staging, puis commite la zone de staging.",
                "Utilise git add, puis git commit -m avec un message.",
                `Tape : git add hello.txt — puis : git commit -m "Add hello.txt"`,
              ],
            },
            {
              label: "Avoir 2 commits dans ton historique",
              hints: [
                "Chaque commit apparaît comme un cercle dans le graphe.",
                "Fais un commit de plus après ton commit initial.",
                `Ajoute ton fichier à la zone de staging et lance git commit -m "Add hello.txt"`,
              ],
            },
          ],
        },
        null,
      ],
      feedback: [
        ["hello.txt is staged — now turn the staging area into a commit.", "hello.txt est dans la zone de staging — transforme maintenant la zone de staging en commit."],
        ["hello.txt exists but is untracked. Stage it with git add first.", "hello.txt existe mais n'est pas suivi. Ajoute-le d'abord à la zone de staging avec git add."],
      ],
    },

    "making-changes": {
      title: "Modifier des fichiers",
      tagline: "Modifier, inspecter, commiter à nouveau",
      concepts: ["fichiers modifiés", "diff", "l'historique grandit"],
      recap: [
        "Quand tu modifies un fichier suivi, Git le marque comme modifié.",
        "git diff montre exactement quelles lignes ont changé (+ ajoutées, − supprimées).",
        "Chaque commit ajoute un nouveau cercle à ta chronologie.",
      ],
      steps: [
        {
          title: "Modifie README.md",
          body: "Ouvre README.md dans l'éditeur et change quelque chose — ajoute une ligne sur toi. (Ou appuie sur le bouton pour qu'on fasse la modification pour toi.)",
          success: "README.md est maintenant modifié : il est différent du dernier instantané.",
          actionLabel: "Ajouter une ligne à README.md",
        },
        {
          title: "Regarde ce qui a changé",
          body: "git diff compare tes fichiers de travail avec ce qui est dans la zone de staging. Les lignes vertes + ont été ajoutées, les lignes rouges − ont été supprimées.",
          success: "Ça, c'est un diff — le changement exact que Git enregistrerait.",
        },
        {
          title: "Ajoute et commite",
          body: "Ajoute README.md à la zone de staging et commite-le. Astuce : tu peux lancer les deux d'un coup en les reliant avec &&.",
          success: "Un deuxième cercle ! Ton historique grandit.",
        },
        {
          title: "Défi : construis un mini site web",
          body: "Crée index.html avec le contenu de ton choix, commite-le, puis modifie-le et commite à nouveau. Tu finiras avec deux nouveaux commits et un répertoire de travail propre.",
          objectives: [
            {
              label: "Fais 2 nouveaux commits",
              hints: [
                "Chaque fois que tu commites, un nouvel instantané apparaît. Il t'en faut deux de plus après la mise à jour du README.",
                "Crée index.html, fais git add, puis git commit. Ensuite modifie-le et recommence.",
                `touch index.html → git add index.html → git commit -m "Add home page" → modifie-le → git commit -am "Improve home page"`,
              ],
            },
            {
              label: "index.html est dans ton dernier commit",
              hints: [
                "Les fichiers commités font partie de l'instantané.",
                "Ajoute index.html à la zone de staging, puis commite.",
                `git add index.html && git commit -m "Add home page"`,
              ],
            },
            {
              label: "Le répertoire de travail est propre",
              hints: [
                "« Propre » veut dire que chaque changement a été commité.",
                "Lance git status — tout ce qui est listé doit encore être ajouté et commité.",
                `git add . && git commit -m "Save my work"`,
              ],
            },
          ],
        },
        null,
      ],
    },

    // ───────────────────────────────────────────── Chapitre 2 — Historique
    "reading-history": {
      title: "Voyage dans l'historique",
      tagline: "log, identifiants de commit et HEAD",
      concepts: ["git log", "hash de commit", "HEAD", "HEAD détachée"],
      recap: [
        "Chaque commit a un identifiant unique (un hash). Les 7 premiers caractères suffisent en général.",
        "Chaque commit pointe vers son parent, ce qui forme une chaîne d'historique.",
        "HEAD indique où tu te trouves. Visiter un ancien commit te met en « HEAD détachée » — regarde autour de toi, puis reviens sur ta branche.",
      ],
      steps: [
        {
          title: "Une chaîne d'instantanés",
          body: [
            "Chaque commit se souvient de son parent — le commit juste avant lui. Ensemble, ils forment une chaîne.",
            "Chaque commit reçoit un identifiant unique comme a3f9c21 (un « hash »). HEAD est un pointeur qui veut dire « tu es ici ». Clique sur les cercles pour déplacer HEAD.",
          ],
        },
        {
          title: "Lis l'historique",
          body: "Ce projet a déjà 4 commits. Affiche-les, un par ligne.",
          success: "Le plus récent en premier. Le petit code au début de chaque ligne est l'identifiant du commit.",
        },
        {
          title: "Inspecte un commit",
          body: "git show affiche les détails d'un commit et ses changements. Sans identifiant, il montre le commit vers lequel pointe HEAD. Tu peux aussi cliquer sur un cercle dans le graphe.",
          success: "Voici le commit « Add contact page » : qui, quand, et exactement ce qui a changé.",
        },
        {
          title: "Défi : visite le passé",
          body: "Remonte jusqu'au commit « Add home page » pour voir le projet tel qu'il était à ce moment-là (remarque que style.css disparaît !). Puis reviens sur main.",
          objectives: [
            {
              label: "Va sur le commit « Add home page »",
              hints: [
                "Tu peux déplacer HEAD sur n'importe quel commit grâce à son identifiant. Trouve-le avec git log --oneline.",
                "Utilise git switch --detach <id> (ou git checkout <id>).",
                "Lance git log --oneline, copie l'identifiant à côté de « Add home page », puis : git switch --detach <cet-id>",
              ],
            },
            {
              label: "Reviens sur la branche main",
              hints: [
                "HEAD doit de nouveau être rattachée à une branche.",
                "Utilise git switch avec le nom de la branche.",
                "Tape : git switch main",
              ],
            },
          ],
        },
        null,
      ],
      feedback: [
        [
          "You're in detached HEAD: looking at an old snapshot, not on any branch. Look at the files, then git switch main to come back.",
          "Tu es en HEAD détachée : tu regardes un ancien instantané, tu n'es sur aucune branche. Jette un œil aux fichiers, puis fais git switch main pour revenir.",
        ],
      ],
    },

    // ───────────────────────────────────────────── Chapitre 3 — Branches
    branches: {
      title: "Les branches sont des chronologies",
      tagline: "Travaille sur tes idées sans casser main",
      concepts: ["branche", "switch", "travail en parallèle"],
      recap: [
        "Une branche est une étiquette mobile qui pointe vers un commit. En créer une est instantané et ne coûte rien.",
        "git switch déplace HEAD vers une autre branche et met tes fichiers à jour en conséquence.",
        "Les nouveaux commits ne font avancer que la branche sur laquelle tu es — main reste en sécurité.",
      ],
      steps: [
        {
          title: "Deux chronologies",
          body: [
            "Imagine que tu veux créer une page de connexion sans risquer la version qui fonctionne de ton site.",
            "Une branche est une chronologie séparée. Tu peux y expérimenter librement ; main reste intacte. Essaie de séparer la chronologie.",
          ],
        },
        {
          title: "Regarde : branch, switch, commit",
          body: "Avance pas à pas dans ces commandes et regarde les étiquettes bouger.",
          captions: [
            "Une nouvelle étiquette « idea » apparaît sur le même commit. Rien d'autre ne change — HEAD est toujours sur main.",
            "HEAD passe sur idea. Les nouveaux commits iront maintenant sur cette branche.",
            "Le commit fait avancer uniquement l'étiquette idea. main reste en arrière, en sécurité.",
            "De retour sur main : idea.txt disparaît de tes fichiers, car l'instantané de main ne le contient pas.",
          ],
        },
        {
          title: "Crée une branche",
          body: "Crée une branche appelée feature/hello.",
          success: "Nouvelle étiquette ! main et feature/hello pointent toutes les deux vers le même commit.",
        },
        {
          title: "Passe dessus",
          body: "Déplace HEAD sur ta nouvelle branche.",
          success: "HEAD a sauté sur feature/hello. Ton prochain commit fera grandir cette chronologie.",
        },
        {
          title: "Commite sur la branche",
          body: "Crée hello.txt et commite-le sur feature/hello.",
          success: "feature/hello a avancé ; main n'a pas bougé. Voilà une divergence en action.",
        },
        {
          title: "Défi : construis la page de connexion",
          body: "Crée une branche appelée feature/login, passe dessus, crée login.html et commite-le là. main ne doit pas contenir login.html.",
          objectives: [
            {
              label: "La branche feature/login existe",
              hints: [
                "Les branches sont créées à partir de l'endroit où se trouve HEAD.",
                "Utilise git branch <nom> ou git switch -c <nom>.",
                "Tape : git switch -c feature/login",
              ],
            },
            {
              label: "Tu es sur feature/login",
              hints: ["HEAD doit pointer vers ta nouvelle branche.", "Utilise git switch.", "Tape : git switch feature/login"],
            },
            {
              label: "login.html est commité sur feature/login",
              hints: [
                "Crée le fichier, ajoute-le à la zone de staging, commite-le — le tout en étant sur feature/login.",
                "touch login.html, git add, git commit -m",
                `touch login.html && git add login.html && git commit -m "Add login page"`,
              ],
            },
            {
              label: "main ne contient pas login.html",
              hints: [
                "Les commits ne font avancer que la branche où se trouve HEAD.",
                "Si tu as commité sur main par erreur, regarde le chapitre Annuler — ou recommence cette leçon.",
                "Recommence la leçon et assure-toi de passer sur feature/login avant de commiter.",
              ],
            },
          ],
        },
        null,
      ],
      feedback: [
        [
          "You created the branch correctly, but you're still on a detached HEAD. Use git switch to move to your feature branch.",
          "Tu as bien créé la branche, mais tu es encore en HEAD détachée. Utilise git switch pour passer sur ta branche de fonctionnalité.",
        ],
        [
          /^You created the branch correctly, but you're still on (.+)\. Use git switch to move to your feature branch\.$/,
          "Tu as bien créé la branche, mais tu es encore sur $1. Utilise git switch pour passer sur ta branche de fonctionnalité.",
        ],
      ],
    },

    // ───────────────────────────────────────────── Chapitre 4 — Fusion
    "fast-forward": {
      title: "Ta première fusion",
      tagline: "Ramène une branche terminée dans main",
      concepts: ["fusion (merge)", "fast-forward"],
      recap: [
        "Fusionner apporte les commits d'une autre branche dans celle où tu es.",
        "Si main n'a pas bougé depuis la création de la branche, Git fait simplement glisser main vers l'avant — c'est un fast-forward.",
        "Après la fusion, une branche de fonctionnalité peut être supprimée sans risque : ses commits vivent désormais dans main.",
      ],
      steps: [
        {
          title: "Ramener le travail à la maison",
          body: [
            "Ta fonctionnalité est terminée sur feature/hello. Maintenant, tu la veux dans main.",
            "Comme main n'a pas changé depuis que tu as créé ta branche, Git peut simplement faire glisser l'étiquette main vers l'avant. C'est ce qu'on appelle une fusion fast-forward.",
          ],
        },
        {
          title: "Va sur la branche qui reçoit",
          body: "Tu fusionnes toujours DANS la branche où tu es. Passe sur main — et regarde hello.txt disparaître de tes fichiers.",
          success: "Tu es sur main. hello.txt a disparu parce que l'instantané de main ne le contient pas… pas encore.",
        },
        {
          title: "Fusionne la fonctionnalité",
          body: "Apporte les commits de feature/hello dans main.",
          success: "Fast-forward ! main a glissé jusqu'au dernier commit de la fonctionnalité, et hello.txt est de retour.",
        },
        {
          title: "Défi : fais le ménage",
          body: "La branche de fonctionnalité a fait son travail. Supprime-la — ses commits font maintenant partie de main, en toute sécurité.",
          objectives: [
            {
              label: "main contient le message d'accueil",
              hints: ["Fusionne dans main.", "Passe sur main, puis git merge feature/hello.", "git switch main && git merge feature/hello"],
            },
            {
              label: "feature/hello est supprimée",
              hints: [
                "Supprimer une branche enlève seulement l'étiquette, pas les commits.",
                "Utilise git branch -d <nom>.",
                "Tape : git branch -d feature/hello",
              ],
            },
          ],
        },
        null,
      ],
    },

    "three-way": {
      title: "Quand les chronologies divergent",
      tagline: "Les commits de fusion réunissent deux historiques",
      concepts: ["divergence", "base de fusion", "commit de fusion"],
      recap: [
        "Quand les deux branches ont de nouveaux commits, elles ont divergé — un fast-forward n'est pas possible.",
        "Git trouve la base de fusion (le dernier commit en commun) et combine les deux ensembles de changements.",
        "Le résultat est un commit de fusion : un commit avec deux parents.",
      ],
      steps: [
        {
          title: "Les deux côtés ont bougé",
          body: [
            "Pendant que tu construisais un pied de page sur feature/footer, ta coéquipière Maya a ajouté une page « À propos » sur main. Les chronologies ont divergé.",
            "Git ne peut pas simplement faire glisser main vers l'avant. À la place, il crée un commit de fusion — un instantané avec DEUX parents qui combine les deux côtés.",
          ],
        },
        {
          title: "Fusionne le pied de page",
          body: "Tu es sur main. Fusionne feature/footer et regarde un commit de fusion apparaître là où les deux chemins se rejoignent.",
          success: "Un commit de fusion avec deux parents. La page « À propos » et le pied de page sont maintenant tous les deux dans main.",
        },
        {
          title: "Regarde la forme de l'historique",
          body: "Git sait aussi dessiner l'historique en texte.",
          success: "La même histoire que dans le graphe au-dessus, dessinée avec des caractères.",
        },
        {
          title: "Défi : fusionne la galerie",
          body: "feature/gallery est prête elle aussi. Fusionne-la également dans main.",
          objectives: [
            {
              label: "main contient gallery.html",
              hints: [
                "Fusionne dans main, depuis main.",
                "git merge feature/gallery",
                "Assure-toi d'être sur main (git switch main), puis : git merge feature/gallery",
              ],
            },
            {
              label: "main contient toujours footer.html",
              hints: [
                "Les deux fonctionnalités doivent se retrouver dans main.",
                "Fusionne aussi feature/footer si ce n'est pas déjà fait.",
                "git switch main && git merge feature/footer",
              ],
            },
          ],
        },
        null,
      ],
    },

    "merge-conflicts": {
      title: "Boss : le conflit de fusion",
      tagline: "Deux personnes ont modifié la même ligne",
      concepts: ["conflit de fusion", "marqueurs de conflit", "résolution"],
      recap: [
        "Un conflit arrive quand les deux branches ont modifié les mêmes lignes. Git ne peut pas deviner laquelle tu veux.",
        "Git marque l'endroit avec <<<<<<< (ta version), ======= et >>>>>>> (la leur).",
        "Tu décides du contenu final, tu supprimes les marqueurs, tu fais git add sur le fichier, puis git commit.",
        "Tu as changé d'avis ? git merge --abort remet tout comme avant.",
      ],
      steps: [
        {
          title: "Quand Git a besoin de toi",
          body: [
            "Tu as changé la couleur du texte en blanc sur feature/dark-mode. Maya a changé la même ligne en violet sur main.",
            "Git sait fusionner automatiquement des lignes différentes, mais la même ligne ? Seul un humain peut trancher. C'est un conflit de fusion — c'est tout à fait normal, et pas effrayant du tout.",
          ],
        },
        {
          title: "Lance la fusion",
          body: "Sur main, fusionne feature/dark-mode. Elle va s'arrêter sur un conflit — c'est prévu !",
          success: "Conflit ! style.css contient maintenant les deux versions entre des marqueurs. Ouvre-le dans l'éditeur.",
        },
        {
          title: "Résous-le",
          body: "Ouvre style.css. Choisis une version (ou combine les deux — un fond sombre avec un texte violet ?), vérifie qu'il ne reste aucun marqueur <<<<<<< ======= >>>>>>>, puis ajoute le fichier à la zone de staging et commite pour terminer la fusion.",
          objectives: [
            {
              label: "Supprime les marqueurs de conflit de style.css",
              hints: [
                "La partie entre <<<<<<< et ======= est la version de main ; celle entre ======= et >>>>>>> est celle de la fonctionnalité.",
                "Dans l'éditeur, utilise « Garder l'actuelle », « Garder l'entrante » ou « Garder les deux », ou modifie le texte à la main.",
                "Ouvre style.css dans le panneau Fichiers → clique sur « Garder les deux » → puis corrige la ligne de couleur pour qu'il n'y ait qu'une seule couleur.",
              ],
            },
            {
              label: "Marque-le comme résolu avec git add",
              hints: [
                "Ajouter un fichier en conflit à la zone de staging indique à Git que tu l'as résolu.",
                "git add style.css",
                "Tape : git add style.css",
              ],
            },
            {
              label: "Termine la fusion avec un commit",
              hints: [
                "Une fusion n'est pas finie tant que tu ne l'as pas commitée.",
                "git commit (le message est pré-rempli pour les fusions).",
                `Tape : git commit -m "Merge dark mode"`,
              ],
            },
          ],
        },
        null,
      ],
      feedback: [
        [
          "Markers are gone — now run git add style.css to tell Git it's resolved.",
          "Les marqueurs ont disparu — lance maintenant git add style.css pour dire à Git que c'est résolu.",
        ],
        [
          "No merge in progress. Run git merge feature/dark-mode to start it again.",
          "Aucune fusion en cours. Lance git merge feature/dark-mode pour la recommencer.",
        ],
      ],
    },

    // ───────────────────────────────────────────── Chapitre 6 — Annuler
    "undo-safely": {
      title: "Annuler sans réécrire",
      tagline: "restore et revert",
      concepts: ["restore", "revert", "sûr ou destructif"],
      recap: [
        "git restore <fichier> jette les modifications non commitées et ramène la dernière version commitée.",
        "git revert <commit> crée un NOUVEAU commit qui annule un ancien — l'historique reste intact, sans risque pour les branches partagées.",
      ],
      steps: [
        {
          title: "Jette une modification accidentelle",
          body: "README.md a été abîmé, mais le changement n'a jamais été commité. Restaure-le.",
          success: "README.md est revenu à sa version commitée.",
        },
        {
          title: "Annule la bannière moche",
          body: "Le commit « Add banner » de Maya est déjà partagé avec l'équipe, donc ne réécris pas l'historique. Crée un commit qui l'annule, en gardant la page de contact.",
          objectives: [
            {
              label: "La bannière a disparu de index.html",
              hints: [
                "git revert crée un nouveau commit qui fait l'inverse d'un ancien.",
                "Trouve l'identifiant de « Add banner » avec git log --oneline.",
                "git revert <id-de-Add-banner>",
              ],
            },
            {
              label: "L'historique n'a pas été réécrit",
              hints: ["Pas de reset — revert ajoute, il ne supprime rien.", "Utilise git revert.", "git revert <id-de-Add-banner>"],
            },
          ],
        },
        null,
      ],
    },

    "lost-commit": {
      title: "Boss : récupère le commit perdu",
      tagline: "reset, reflog et le filet de sécurité",
      concepts: ["reset --hard", "reflog", "récupération"],
      recap: [
        "git reset --hard ramène ta branche en arrière et fait disparaître de la vue les commits plus récents.",
        "Mais Git supprime rarement quoi que ce soit tout de suite : git reflog liste tous les endroits où HEAD est passée.",
        "Fais pointer une branche (ou un reset) vers l'ancien identifiant de commit pour récupérer le travail.",
      ],
      steps: [
        {
          title: "« J'ai supprimé mon travail ! »",
          body: [
            "Oh non. Un coéquipier a lancé git reset --hard HEAD~1 et le commit « Add pricing page » a disparu de main.",
            "Bonne nouvelle : Git tient un journal de tous les endroits où HEAD est passée — le reflog. Les commits qui semblent perdus sont généralement toujours là, simplement sans étiquette.",
          ],
        },
        {
          title: "Lis le journal",
          body: "Affiche le reflog.",
          success: "Tu vois la ligne « commit: Add pricing page » ? Cet identifiant, c'est ton commit perdu.",
        },
        {
          title: "Ramène-le",
          body: "Remets le commit « Add pricing page » sur main, pour que pricing.html revienne dans tes fichiers.",
          objectives: [
            {
              label: "main contient « Add pricing page »",
              hints: [
                "Ramène main sur l'identifiant du commit perdu.",
                "git reset --hard <id> déplace la branche courante sur n'importe quel commit.",
                "Copie l'identifiant à côté de « commit: Add pricing page » dans git reflog, puis : git reset --hard <id>",
              ],
            },
            {
              label: "pricing.html est de retour dans tes fichiers",
              hints: [
                "Un reset --hard met aussi tes fichiers à jour.",
                "Assure-toi d'être sur main.",
                "git switch main && git reset --hard <id>",
              ],
            },
          ],
        },
        null,
      ],
    },

    // ───────────────────────────────────────────── Chapitre 7 — GitHub
    "first-push": {
      title: "Envoie-le sur GitHub",
      tagline: "Dépôts distants, origin et git push",
      concepts: ["dépôt distant", "origin", "push", "upstream"],
      recap: [
        "Git est l'outil sur ton ordinateur. GitHub est un site web qui héberge des copies de dépôts.",
        "Un dépôt distant (remote) est un lien nommé vers un dépôt hébergé ; par convention, le principal s'appelle origin.",
        "git push envoie tes commits. La première fois, -u retient où faire le push.",
      ],
      steps: [
        {
          title: "Ton ordinateur ↔ GitHub",
          body: [
            "Jusqu'ici, tout vivait sur ton ordinateur. GitHub héberge une copie de ton dépôt en ligne pour que tu puisses la sauvegarder et collaborer.",
            "À noter : Git et GitHub sont deux choses différentes. Git est l'outil ; GitHub est un service. Gitverse simule GitHub en toute sécurité — rien ne quitte ton navigateur.",
          ],
        },
        {
          title: "Connecte-toi à GitHub",
          body: "On t'a créé un dépôt vide sur le GitHub (simulé). Relie-le et nomme ce lien origin.",
          success: "origin pointe maintenant vers ton dépôt GitHub. Il est vide pour l'instant — regarde l'onglet Distant.",
        },
        {
          title: "Pousse tes commits",
          body: "Envoie main vers origin. -u (upstream) dit à Git de s'en souvenir, pour que la prochaine fois un simple git push suffise.",
          success: "Tes commits se sont envolés vers GitHub ! Regarde l'étiquette origin/main : c'est la mémoire qu'a Git de l'endroit où se trouve le main de GitHub.",
        },
        {
          title: "Défi : publie une mise à jour",
          body: "Fais un nouveau commit (n'importe quel changement) et fais un push pour que GitHub soit à jour.",
          objectives: [
            {
              label: "Fais un nouveau commit",
              hints: [
                "Modifie ou ajoute un fichier, puis commite.",
                "Zone de staging + commit.",
                `echo "Hi" > about.txt && git add . && git commit -m "Add about"`,
              ],
            },
            {
              label: "GitHub a ton dernier commit",
              hints: ["Envoyer ton travail, c'est faire un push.", "Ta branche a déjà un upstream.", "Tape : git push"],
            },
          ],
        },
        null,
      ],
      feedback: [
        [
          "Your main is ahead of origin/main — GitHub doesn't have your latest commit yet.",
          "Ton main est en avance sur origin/main — GitHub n'a pas encore ton dernier commit.",
        ],
      ],
    },

    "clone-contribute": {
      title: "Cloner et contribuer",
      tagline: "clone, branches distantes, push d'une branche de fonctionnalité",
      concepts: ["clone", "origin", "branches de suivi distantes", "upstream"],
      recap: [
        "git clone télécharge un dépôt entier — chaque commit — et retient d'où il vient sous le nom origin.",
        "origin/main et origin/feature/blog sont des branches de suivi distantes : la mémoire qu'a Git de ce qui se trouve sur GitHub.",
        "Travaille sur ta propre branche, puis git push -u origin <branche> la publie et la définit comme upstream.",
        "C'est à partir de cette branche poussée qu'on crée une pull request sur GitHub.",
      ],
      steps: [
        {
          title: "Rejoindre un projet qui existe déjà",
          body: [
            "La plupart du temps, tu ne crées pas un dépôt — tu en rejoins un. Le site web de ton équipe est déjà sur GitHub.",
            "git clone copie le projet entier, avec tout son historique, sur ton ordinateur. Git retient aussi l'adresse sous le nom origin, pour que tu puisses faire un push plus tard.",
          ],
        },
        {
          title: "Clone le dépôt de l'équipe",
          body: "Télécharge le site web de l'équipe dans ce dossier. Le point à la fin veut dire « clone ici même ».",
          success: "Tu as tout le projet : chaque fichier et chaque commit. Remarque origin/main dans le graphe — c'est là où se trouve le main de GitHub.",
        },
        {
          title: "Vois toutes les branches, y compris celles de GitHub",
          body: "Un simple git branch ne liste que tes branches locales. Ajoute -a pour voir aussi celles qui sont sur GitHub.",
          success: "remotes/origin/feature/blog est la branche de Sam sur GitHub. Tu as ses commits, mais pas de branche locale pour elle — et tu n'en as pas besoin pour commencer ton propre travail.",
        },
        {
          title: "Défi : ajoute un pied de page",
          body: "Crée une branche appelée feature/footer, ajoute footer.html dans un commit, et publie ta branche sur GitHub pour qu'elle suive origin/feature/footer. Ne touche pas à main.",
          objectives: [
            {
              label: "Travaille sur une branche appelée feature/footer",
              hints: [
                "Ne commite jamais directement sur un main partagé — crée ta propre branche.",
                "git switch -c crée une branche et passe dessus.",
                "Tape : git switch -c feature/footer",
              ],
            },
            {
              label: "Commite footer.html sur feature/footer",
              hints: [
                "Crée le fichier, ajoute-le à la zone de staging, commite-le — en étant sur feature/footer.",
                "touch footer.html, git add, git commit -m",
                `echo "<footer>© Team</footer>" > footer.html && git add . && git commit -m "Add footer"`,
              ],
            },
            {
              label: "GitHub a ta branche, et elle suit origin/feature/footer",
              hints: [
                "Publier une nouvelle branche, c'est faire un push. La première fois, dis à Git où elle va.",
                "Utilise -u pour que Git retienne l'upstream.",
                "Tape : git push -u origin feature/footer",
              ],
            },
            {
              label: "main n'a pas changé sur GitHub",
              hints: [
                "Ton travail va sur ta branche, pas sur main.",
                "Si tu as fait un push sur main par accident, recommence la leçon.",
                "Recommence et assure-toi de passer sur feature/footer avant de commiter.",
              ],
            },
          ],
        },
        null,
      ],
      feedback: [
        [
          "You committed on main. Contributions go on their own branch — restart the lesson and create feature/footer first.",
          "Tu as commité sur main. Les contributions vont sur leur propre branche — recommence la leçon et crée d'abord feature/footer.",
        ],
        [
          "Your branch is on GitHub, but it doesn't track it yet. Push with -u so plain git push and git status know where it goes.",
          "Ta branche est sur GitHub, mais elle ne la suit pas encore. Fais un push avec -u pour qu'un simple git push et git status sachent où elle va.",
        ],
      ],
    },

    "fetch-pull": {
      title: "Reste synchronisé",
      tagline: "fetch, pull et coéquipiers",
      concepts: ["fetch", "pull", "branche de suivi distante"],
      recap: [
        "git fetch récupère les nouveaux commits depuis GitHub et déplace les étiquettes origin/* — tes fichiers ne changent pas.",
        "git pull = fetch + merge : il intègre ces commits dans ta branche.",
        "Fais un pull avant de faire un push pour éviter qu'il soit refusé.",
      ],
      steps: [
        {
          title: "Ta coéquipière a fait un push",
          body: [
            "Tu as cloné le livre de recettes de l'équipe. Depuis, Maya a poussé une nouvelle recette sur GitHub. Ton ordinateur ne le sait pas encore !",
            "git fetch récupère les nouveautés sans toucher à tes fichiers. git pull les récupère ET les fusionne dans ta branche.",
          ],
        },
        {
          title: "Récupère les nouveautés",
          body: "Fais un fetch depuis origin et regarde origin/main passer devant ton main.",
          success: "origin/main est passé sur le commit de Maya. Ton main et tes fichiers n'ont pas changé.",
        },
        {
          title: "Vérifie où tu en es",
          body: "Demande à Git comment ta branche se compare à celle de GitHub.",
          success: "« Your branch is behind 'origin/main' by 1 commit » (ta branche a 1 commit de retard sur origin/main) — c'est le moment de faire un pull.",
        },
        {
          title: "Défi : ajoute une recette",
          body: "Intègre le travail de Maya, ajoute ton propre fichier de recette, commite, et fais un push vers le dépôt de l'équipe.",
          objectives: [
            {
              label: "Ton main contient « Add pasta » de Maya",
              hints: ["Intègre les commits distants dans ta branche.", "git pull (ou git merge origin/main).", "Tape : git pull"],
            },
            {
              label: "Commite un nouveau fichier de recette",
              hints: [
                "N'importe quel nouveau fichier .md fera l'affaire.",
                "Crée, ajoute, commite.",
                `echo "# Tacos" > tacos.md && git add . && git commit -m "Add tacos"`,
              ],
            },
            {
              label: "GitHub a ton commit",
              hints: ["Envoie ton travail.", "git push", "Tape : git push (fais d'abord un pull s'il est refusé)"],
            },
          ],
        },
        null,
      ],
    },
  },
};

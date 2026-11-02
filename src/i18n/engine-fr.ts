import type { Locale } from "./locale";

/**
 * French versions of the beginner-friendly explanations the simulated Git engine
 * attaches to failures (`ctx.explain`, `fail(msg, explain)`, `ctx.error(text, explain)`).
 * Real Git output stays in English; only these plain-language hints are translated.
 */

const EXACT: Record<string, string> = {
  // shell.ts
  "This command is covered in a later chapter. Everything else you try here behaves like real Git.":
    "Cette commande est abordée dans un prochain chapitre. Tout le reste fonctionne ici comme dans le vrai Git.",
  "That isn't a Git command. Type help to see what you can use.":
    "Ce n'est pas une commande Git. Tape help pour voir ce que tu peux utiliser.",
  "Only Git and a few file commands work in this sandbox. Type help to see them.":
    "Seuls Git et quelques commandes de fichiers fonctionnent dans ce bac à sable. Tape help pour les voir.",

  // git/helpers.ts
  "This folder isn't a Git repository yet, so Git has nowhere to record history. Run `git init` first to create one.":
    "Ce dossier n'est pas encore un dépôt Git, donc Git n'a nulle part où enregistrer l'historique. Lance d'abord `git init` pour en créer un.",
  "You have uncommitted edits to files that are different on the other branch. Switching would erase them, so Git stops. Commit your work (git add + git commit) or put it aside with git stash, then switch.":
    "Tu as des modifications non commitées dans des fichiers qui sont différents sur l'autre branche. Changer de branche les effacerait, alors Git s'arrête. Fais un commit de ton travail (git add + git commit) ou mets-le de côté avec git stash, puis change de branche.",
  "A file you never added to Git has the same name as a file on the other branch. Git won't overwrite it. Rename, delete, or commit it first.":
    "Un fichier que tu n'as jamais ajouté à Git porte le même nom qu'un fichier de l'autre branche. Git refuse de l'écraser. Renomme-le, supprime-le ou fais-en un commit d'abord.",

  // git/basic.ts
  "`git add` needs to know which files to stage. Name a file (git add README.md) or use a dot to stage everything in this folder (git add .).":
    "`git add` doit savoir quels fichiers mettre dans la zone de staging. Donne un nom de fichier (git add README.md) ou utilise un point pour tout ajouter dans ce dossier (git add .).",
  'Did you forget quotes around your message? Use: git commit -m "your message"':
    'Tu as oublié les guillemets autour de ton message ? Utilise : git commit -m "ton message"',
  "During a rebase, Git makes the commits for you. After fixing conflicts and running git add, use git rebase --continue.":
    "Pendant un rebase, c'est Git qui crée les commits pour toi. Après avoir réglé les conflits et lancé git add, utilise git rebase --continue.",
  "Some files still have conflicts. Open them, choose the final content (remove the <<<<<<< ======= >>>>>>> markers), then run git add on each file.":
    "Certains fichiers ont encore des conflits. Ouvre-les, choisis le contenu final (supprime les marqueurs <<<<<<< ======= >>>>>>>), puis lance git add sur chaque fichier.",
  'Every commit needs a short message describing the change. Add one with -m, for example: git commit -m "Add README"':
    'Chaque commit a besoin d\'un court message qui décrit le changement. Ajoutes-en un avec -m, par exemple : git commit -m "Add README"',
  "There are no files to save yet. Create a file first, then stage it with git add.":
    "Il n'y a encore aucun fichier à enregistrer. Crée d'abord un fichier, puis ajoute-le à la zone de staging avec git add.",
  "A commit saves what is in the staging area, and the staging area has nothing new. Stage your changes first with git add <file> (or git add .), then commit.":
    "Un commit enregistre ce qui se trouve dans la zone de staging, et elle ne contient rien de nouveau. Ajoute d'abord tes changements avec git add <file> (ou git add .), puis fais ton commit.",
  "Everything is already saved in a commit. Change a file first, then stage and commit it.":
    "Tout est déjà enregistré dans un commit. Modifie d'abord un fichier, puis ajoute-le à la zone de staging et fais un commit.",
  "There's no history yet because you haven't made a commit. Stage a file and run git commit first.":
    "Il n'y a pas encore d'historique, car tu n'as fait aucun commit. Ajoute un fichier à la zone de staging et lance d'abord git commit.",
  "You need at least one commit before you can tag it.":
    "Il te faut au moins un commit avant de pouvoir poser un tag.",
  "git restore only works on files Git already tracks. This file has never been added.":
    "git restore ne fonctionne que sur les fichiers que Git suit déjà. Ce fichier n'a jamais été ajouté.",

  // git/branching.ts
  "Branch names can use letters, numbers, dashes, dots and slashes (like feature/login), but no spaces.":
    "Un nom de branche peut contenir des lettres, des chiffres, des tirets, des points et des barres obliques (comme feature/login), mais pas d'espaces.",
  "A branch is a label that points at a commit — and there are no commits yet. Make your first commit, then create the branch.":
    "Une branche est une étiquette qui pointe vers un commit — et il n'y a encore aucun commit. Fais ton premier commit, puis crée la branche.",
  "You can't delete the branch you're standing on. Switch to another branch first (e.g. git switch main).":
    "Tu ne peux pas supprimer la branche sur laquelle tu te trouves. Passe d'abord sur une autre branche (par ex. git switch main).",
  "This branch has commits that exist nowhere else. Deleting it would hide that work. Merge it first, or use -D if you really want to throw it away (you could still find it in git reflog).":
    "Cette branche contient des commits qui n'existent nulle part ailleurs. La supprimer ferait disparaître ce travail. Fusionne-la d'abord, ou utilise -D si tu veux vraiment t'en débarrasser (tu pourrais encore la retrouver dans git reflog).",
  "Tell git switch where to go, e.g. git switch main. To create a new branch use git switch -c <name>.":
    "Indique à git switch où aller, par ex. git switch main. Pour créer une nouvelle branche, utilise git switch -c <name>.",
  "git switch moves between branches. To visit an old commit directly, use git switch --detach <commit> (or git checkout <commit>).":
    "git switch sert à passer d'une branche à l'autre. Pour visiter directement un ancien commit, utilise git switch --detach <commit> (ou git checkout <commit>).",
  "You're in the middle of a merge already. Finish it (resolve, git add, git commit) or cancel it with git merge --abort.":
    "Tu es déjà en pleine fusion. Termine-la (résous les conflits, git add, git commit) ou annule-la avec git merge --abort.",
  "Tell git merge which branch to bring in, e.g. git merge feature/hello.":
    "Indique à git merge quelle branche fusionner, par ex. git merge feature/hello.",
  "Commit or stash your uncommitted work before merging, so Git can't overwrite it.":
    "Fais un commit ou un stash de ton travail non commité avant de fusionner, pour que Git ne puisse pas l'écraser.",
  "Both branches changed the same lines, so Git can't decide which version to keep. Open each conflicted file, pick the final content, remove the conflict markers, then run git add <file> and git commit.":
    "Les deux branches ont modifié les mêmes lignes, donc Git ne peut pas décider quelle version garder. Ouvre chaque fichier en conflit, choisis le contenu final, supprime les marqueurs de conflit, puis lance git add <file> et git commit.",
  "Reverting or cherry-picking a merge commit needs extra options that this simulator doesn't support yet.":
    "Faire un revert ou un cherry-pick d'un commit de fusion demande des options supplémentaires que ce simulateur ne gère pas encore.",
  "These changes are already in your branch, so there is nothing new to apply.":
    "Ces changements sont déjà dans ta branche, il n'y a donc rien de nouveau à appliquer.",
  "Name the commit to undo, e.g. git revert HEAD or git revert a1b2c3d.":
    "Indique le commit à annuler, par ex. git revert HEAD ou git revert a1b2c3d.",
  "Name the commit to copy onto this branch, e.g. git cherry-pick a1b2c3d.":
    "Indique le commit à copier sur cette branche, par ex. git cherry-pick a1b2c3d.",
  "Some files still have conflicts. Fix them and run git add <file> before continuing.":
    "Certains fichiers ont encore des conflits. Corrige-les et lance git add <file> avant de continuer.",
  "Interactive rebase lets you squash, reorder and reword commits. It's coming in the Rebase chapter. For now, try a regular git rebase <branch>.":
    "Le rebase interactif permet de regrouper, réordonner et reformuler des commits. Il arrive dans le chapitre Rebase. Pour l'instant, essaie un git rebase <branch> classique.",
  "Tell git rebase which branch to replay your work onto, e.g. git rebase main.":
    "Indique à git rebase sur quelle branche rejouer ton travail, par ex. git rebase main.",
  "Rebase rewrites your branch, so it needs a clean working tree. Commit or stash your edits first.":
    "Le rebase réécrit ta branche, il lui faut donc un répertoire de travail propre. Fais d'abord un commit ou un stash de tes modifications.",
  "While replaying one of your commits, Git hit a conflict. Fix the file, git add it, then run git rebase --continue.":
    "En rejouant l'un de tes commits, Git est tombé sur un conflit. Corrige le fichier, fais un git add dessus, puis lance git rebase --continue.",
  "The stashed changes touch files you've edited since. Commit or discard those edits, then try again.":
    "Les changements mis de côté touchent des fichiers que tu as modifiés depuis. Fais un commit de ces modifications ou abandonne-les, puis réessaie.",

  // git/remote.ts
  "That option isn't supported for git push here. Common ones: -u, --force, --delete, --tags.":
    "Cette option n'est pas prise en charge pour git push ici. Les plus courantes : -u, --force, --delete, --tags.",
  "Your repository isn't connected to GitHub yet. Add a remote with git remote add origin <url>.":
    "Ton dépôt n'est pas encore relié à GitHub. Ajoute un dépôt distant avec git remote add origin <url>.",
  "You're in detached HEAD, so there's no branch to push. Create one first with git switch -c <name>.":
    "Tu es en HEAD détachée, il n'y a donc aucune branche à pousser. Crées-en d'abord une avec git switch -c <name>.",
  "You're in detached HEAD. Create a branch first with git switch -c <name>, or push explicitly: git push origin HEAD:<branch>.":
    "Tu es en HEAD détachée. Crée d'abord une branche avec git switch -c <name>, ou fais un push explicite : git push origin HEAD:<branch>.",
  "Someone else pushed new commits to GitHub that you don't have. Git refuses to overwrite them. Run git pull to bring them in, then push again.":
    "Quelqu'un d'autre a envoyé sur GitHub de nouveaux commits que tu n'as pas. Git refuse de les écraser. Fais un git pull pour les récupérer, puis refais ton push.",
  "A tag with that name already exists on GitHub. Tags aren't supposed to move; delete it first or pick a new name.":
    "Un tag de ce nom existe déjà sur GitHub. Un tag n'est pas censé bouger : supprime-le d'abord ou choisis un autre nom.",
  "This repository isn't connected to GitHub yet. Add a remote with git remote add origin <url>.":
    "Ce dépôt n'est pas encore relié à GitHub. Ajoute un dépôt distant avec git remote add origin <url>.",
  "Give git clone the URL of a repository, e.g. git clone https://github.com/gitverse/hello-world.git":
    "Donne à git clone l'URL d'un dépôt, par ex. git clone https://github.com/gitverse/hello-world.git",
  "This workspace already has a repository. Start a fresh lesson or reset the sandbox to clone again.":
    "Cet espace de travail contient déjà un dépôt. Commence une nouvelle leçon ou réinitialise le bac à sable pour cloner à nouveau.",
  "You can't push yet because you have no commits. Make a commit first.":
    "Tu ne peux pas encore faire de push, car tu n'as aucun commit. Fais d'abord un commit.",
  "That repository doesn't exist on the simulated GitHub. Double-check the URL.":
    "Ce dépôt n'existe pas sur le GitHub simulé. Vérifie bien l'URL.",
};

type Rule = [RegExp, (m: RegExpMatchArray) => string];

/** Interpolated explanations. Anchored and ordered: more specific patterns first. */
const PATTERNS: Rule[] = [
  // shell.ts
  [/^Looks like a typo — did you mean git (.+)\?$/, (m) => `On dirait une faute de frappe — tu voulais dire git ${m[1]} ?`],
  [
    /^Did you mean (.+)\? \(Watch out for typos — the terminal is picky!\)$/,
    (m) => `Tu voulais dire ${m[1]} ? (Attention aux fautes de frappe — le terminal est pointilleux !)`,
  ],

  // git/basic.ts
  [
    /^There's no file called "(.*)" in your project\. Check the spelling, or look at the Files panel \/ run ls to see what exists\.$/,
    (m) => `Il n'y a aucun fichier nommé "${m[1]}" dans ton projet. Vérifie l'orthographe, ou regarde le panneau Fichiers / lance ls pour voir ce qui existe.`,
  ],

  // git/branching.ts
  [
    /^There's already a branch called (.+)\. Switch to it with git switch \1, or pick another name\.$/,
    (m) => `Il existe déjà une branche nommée ${m[1]}. Passe dessus avec git switch ${m[1]}, ou choisis un autre nom.`,
  ],
  [
    /^Git doesn't know a remote branch called (.+)\. Run git fetch first, or git branch -r to list remote branches\.$/,
    (m) => `Git ne connaît aucune branche distante nommée ${m[1]}. Fais d'abord un git fetch, ou lance git branch -r pour lister les branches distantes.`,
  ],
  [
    /^(.+) already exists\. To move onto it, run git switch \1 \(without -c\)\.$/,
    (m) => `${m[1]} existe déjà. Pour passer dessus, lance git switch ${m[1]} (sans -c).`,
  ],
  [
    /^There's no branch called "(.*)"\. Run git branch to list branches, or create it with git switch -c (.+)\.$/,
    (m) => `Il n'y a aucune branche nommée "${m[1]}". Lance git branch pour lister les branches, ou crée-la avec git switch -c ${m[2]}.`,
  ],
  [/^There's no branch called "(.*)"\.$/, (m) => `Il n'y a aucune branche nommée "${m[1]}".`],
  [
    /^Git doesn't know a branch, commit, or tracked file called "(.*)"\.$/,
    (m) => `Git ne connaît aucune branche, aucun commit ni aucun fichier suivi nommé "${m[1]}".`,
  ],
  [
    /^There's no branch or commit called "(.*)"\. Run git branch to see your branches\.$/,
    (m) => `Il n'y a aucune branche ni aucun commit nommé "${m[1]}". Lance git branch pour voir tes branches.`,
  ],
  [
    /^Save or stash your current edits before running git (.+)\.$/,
    (m) => `Enregistre (commit) ou mets de côté (stash) tes modifications en cours avant de lancer git ${m[1]}.`,
  ],

  // git/remote.ts
  [
    /^There's no remote called "(.*)"\. Run git remote -v to see configured remotes\.$/,
    (m) => `Il n'y a aucun dépôt distant nommé "${m[1]}". Lance git remote -v pour voir les dépôts distants configurés.`,
  ],
  [
    /^Git doesn't know where on GitHub this branch should go yet\. The first time, run git push -u origin (.+) — after that, plain git push works\.$/,
    (m) => `Git ne sait pas encore où envoyer cette branche sur GitHub. La première fois, lance git push -u origin ${m[1]} — ensuite, un simple git push suffit.`,
  ],
  [
    /^There's no local branch or tag called "(.*)"\.$/,
    (m) => `Il n'y a aucune branche locale ni aucun tag nommé "${m[1]}".`,
  ],
  [
    /^GitHub has no branch called "(.*)"\. Run git branch -r to see the remote branches you know about\.$/,
    (m) => `GitHub n'a aucune branche nommée "${m[1]}". Lance git branch -r pour voir les branches distantes que tu connais.`,
  ],
  [
    /^(.+) is the default branch on GitHub, so it can't be deleted from here\.$/,
    (m) => `${m[1]} est la branche par défaut sur GitHub, elle ne peut donc pas être supprimée d'ici.`,
  ],
  [
    /^Git doesn't know which GitHub branch to pull from\. Use git pull origin (.+)\.$/,
    (m) => `Git ne sait pas depuis quelle branche GitHub faire le pull. Utilise git pull origin ${m[1]}.`,
  ],
];

export function translateExplain(text: string | undefined, locale: Locale): string | undefined {
  if (text === undefined || locale === "en") return text;
  const exact = EXACT[text];
  if (exact !== undefined) return exact;
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(m);
  }
  return text;
}

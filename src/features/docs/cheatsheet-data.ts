import type { Locale } from "@/i18n/locale";

/** A string in every supported language. */
type L = Record<Locale, string>;

export interface SheetItem {
  /** The command exactly as typed. `<placeholders>` are highlighted. */
  cmd: string;
  desc: L;
  risk?: "careful" | "destructive";
}

export interface SheetSection {
  id: string;
  title: L;
  /** Lane color index (0-5), matching the git graph colors. */
  lane: number;
  intro?: L;
  items: SheetItem[];
}

export interface Recipe {
  problem: L;
  steps: string[];
  note?: L;
}

const i = (cmd: string, en: string, fr: string, risk?: SheetItem["risk"]): SheetItem => ({ cmd, desc: { en, fr }, risk });

export const SECTIONS: SheetSection[] = [
  {
    id: "setup",
    lane: 5,
    title: { en: "Setup", fr: "Configuration" },
    intro: { en: "Once per computer. Your name and email go into every commit.", fr: "Une fois par ordinateur. Ton nom et ton e-mail figurent dans chaque commit." },
    items: [
      i('git config --global user.name "<name>"', "Set the name shown on your commits", "Définir le nom affiché sur tes commits"),
      i('git config --global user.email "<email>"', "Set the email shown on your commits", "Définir l'e-mail affiché sur tes commits"),
      i("git config --global init.defaultBranch main", "Name the first branch main in new repos", "Nommer main la première branche des nouveaux dépôts"),
      i('git config --global core.editor "code --wait"', "Use VS Code for commit messages", "Utiliser VS Code pour les messages de commit"),
      i("git config --global alias.lg \"log --oneline --graph --all\"", "Create a shortcut: git lg", "Créer un raccourci : git lg"),
      i("git config --list --show-origin", "See every setting and where it comes from", "Voir chaque réglage et son origine"),
      i("git help <command>", "Open the manual for a command", "Ouvrir le manuel d'une commande"),
    ],
  },
  {
    id: "start",
    lane: 2,
    title: { en: "Start a project", fr: "Démarrer un projet" },
    items: [
      i("git init", "Turn the current folder into a repository", "Transformer le dossier courant en dépôt"),
      i("git init -b main", "…and name the first branch main", "…et nommer la première branche main"),
      i("git clone <url>", "Download a repository with its full history", "Télécharger un dépôt avec tout son historique"),
      i("git clone <url> <folder>", "Clone into a folder with another name", "Cloner dans un dossier d'un autre nom"),
      i("git clone --depth 1 <url>", "Shallow clone: only the latest snapshot", "Clone superficiel : seulement le dernier instantané"),
    ],
  },
  {
    id: "daily",
    lane: 0,
    title: { en: "Stage & commit", fr: "Indexer et valider" },
    intro: { en: "The everyday loop: edit → add → commit.", fr: "La boucle quotidienne : modifier → add → commit." },
    items: [
      i("git status", "What changed, what's staged, which branch", "Ce qui a changé, ce qui est indexé, sur quelle branche"),
      i("git status -s", "The same, in a compact two-letter format", "Pareil, en format compact à deux lettres"),
      i("git add <file>", "Stage one file for the next commit", "Indexer un fichier pour le prochain commit"),
      i("git add .", "Stage everything in this folder", "Indexer tout ce dossier"),
      i("git add -p", "Pick changes chunk by chunk", "Choisir les modifications morceau par morceau"),
      i("git diff", "Changes not staged yet", "Modifications pas encore indexées"),
      i("git diff --staged", "Changes that will go into the commit", "Modifications qui iront dans le commit"),
      i('git commit -m "<message>"', "Save the staged snapshot", "Enregistrer l'instantané indexé"),
      i('git commit -am "<message>"', "Stage tracked files and commit in one go", "Indexer les fichiers suivis et valider d'un coup"),
      i("git rm <file>", "Delete a file and stage the deletion", "Supprimer un fichier et indexer la suppression"),
      i("git mv <old> <new>", "Rename or move a file", "Renommer ou déplacer un fichier"),
    ],
  },
  {
    id: "history",
    lane: 4,
    title: { en: "Explore history", fr: "Explorer l'historique" },
    items: [
      i("git log", "List commits, newest first", "Lister les commits, du plus récent au plus ancien"),
      i("git log --oneline --graph --all", "Every branch as a compact graph", "Toutes les branches en graphe compact"),
      i("git log -p <file>", "Every change ever made to a file", "Toutes les modifications d'un fichier"),
      i('git log --author="<name>"', "Commits by one person", "Les commits d'une personne"),
      i('git log -S "<text>"', "Commits that added or removed some text", "Commits qui ont ajouté ou retiré un texte"),
      i("git show <commit>", "One commit: message and changes", "Un commit : message et modifications"),
      i("git diff <a>..<b>", "Compare two commits or branches", "Comparer deux commits ou branches"),
      i("git blame <file>", "Who last changed each line, and when", "Qui a modifié chaque ligne en dernier, et quand"),
      i("git reflog", "Everywhere HEAD has been — your safety net", "Tous les endroits où HEAD est passé — ton filet de sécurité"),
      i("git shortlog -sn", "Commit count per author", "Nombre de commits par auteur"),
    ],
  },
  {
    id: "branches",
    lane: 1,
    title: { en: "Branches", fr: "Branches" },
    intro: { en: "A branch is just a movable label on a commit. They're cheap — use lots.", fr: "Une branche n'est qu'une étiquette mobile sur un commit. Elles ne coûtent rien — utilise-les." },
    items: [
      i("git branch", "List local branches (* = current)", "Lister les branches locales (* = actuelle)"),
      i("git branch -a", "Include remote branches", "Inclure les branches distantes"),
      i("git switch <branch>", "Move to a branch", "Aller sur une branche"),
      i("git switch -c <branch>", "Create a branch and move to it", "Créer une branche et y aller"),
      i("git switch -", "Jump back to the previous branch", "Revenir à la branche précédente"),
      i("git checkout -b <branch>", "Older way to create and switch", "Ancienne façon de créer et changer"),
      i("git branch -m <new-name>", "Rename the current branch", "Renommer la branche actuelle"),
      i("git branch -d <branch>", "Delete a merged branch", "Supprimer une branche fusionnée"),
      i("git branch -D <branch>", "Force-delete, even unmerged work", "Forcer la suppression, même non fusionnée", "destructive"),
    ],
  },
  {
    id: "merge",
    lane: 3,
    title: { en: "Merge & rebase", fr: "Fusionner et rebaser" },
    items: [
      i("git merge <branch>", "Bring another branch into the current one", "Intégrer une autre branche dans l'actuelle"),
      i("git merge --no-ff <branch>", "Always create a merge commit", "Toujours créer un commit de fusion"),
      i("git merge --abort", "Give up a conflicted merge", "Abandonner une fusion en conflit"),
      i("git rebase <branch>", "Replay your commits on top of another branch", "Rejouer tes commits par-dessus une autre branche", "careful"),
      i("git rebase -i HEAD~<n>", "Reorder, squash or reword the last n commits", "Réordonner, fusionner ou renommer les n derniers commits", "careful"),
      i("git rebase --continue", "Carry on after fixing a conflict", "Continuer après avoir résolu un conflit"),
      i("git rebase --abort", "Cancel the rebase, back to how it was", "Annuler le rebase, retour à l'état initial"),
      i("git cherry-pick <commit>", "Copy one commit onto the current branch", "Copier un commit sur la branche actuelle"),
    ],
  },
  {
    id: "remote",
    lane: 2,
    title: { en: "Remotes & GitHub", fr: "Dépôts distants et GitHub" },
    items: [
      i("git remote -v", "List remotes and their URLs", "Lister les dépôts distants et leurs URL"),
      i("git remote add origin <url>", "Connect a local repo to GitHub", "Relier un dépôt local à GitHub"),
      i("git fetch", "Download new commits, change nothing locally", "Télécharger les nouveaux commits sans rien modifier"),
      i("git pull", "Fetch, then merge into your branch", "Récupérer, puis fusionner dans ta branche"),
      i("git pull --rebase", "Fetch, then replay your work on top", "Récupérer, puis rejouer ton travail par-dessus"),
      i("git push", "Upload your commits", "Envoyer tes commits"),
      i("git push -u origin <branch>", "First push of a new branch (sets upstream)", "Premier envoi d'une branche (définit l'amont)"),
      i("git push --force-with-lease", "Overwrite the remote, unless someone else pushed", "Écraser le distant, sauf si quelqu'un d'autre a poussé", "careful"),
      i("git push origin --delete <branch>", "Delete a branch on the remote", "Supprimer une branche sur le distant", "destructive"),
      i("git fetch --prune", "Forget remote branches that were deleted", "Oublier les branches distantes supprimées"),
    ],
  },
  {
    id: "undo",
    lane: 0,
    title: { en: "Undo", fr: "Annuler" },
    intro: {
      en: "Pushed already? Prefer revert. Only rewrite commits nobody else has.",
      fr: "Déjà poussé ? Préfère revert. Ne réécris que les commits que personne d'autre n'a.",
    },
    items: [
      i("git restore --staged <file>", "Unstage, keep your edits", "Désindexer, garder tes modifications"),
      i("git restore <file>", "Throw away unstaged edits to a file", "Jeter les modifications non indexées d'un fichier", "destructive"),
      i("git commit --amend", "Fix the last commit (message or content)", "Corriger le dernier commit (message ou contenu)", "careful"),
      i("git revert <commit>", "New commit that undoes an old one — safe when shared", "Nouveau commit qui annule un ancien — sûr si partagé"),
      i("git reset --soft HEAD~1", "Undo last commit, keep changes staged", "Annuler le dernier commit, garder les changements indexés", "careful"),
      i("git reset HEAD~1", "Undo last commit, keep changes unstaged", "Annuler le dernier commit, garder les changements non indexés", "careful"),
      i("git reset --hard HEAD~1", "Undo last commit and erase its changes", "Annuler le dernier commit et effacer ses changements", "destructive"),
      i("git clean -n", "Preview which untracked files would be deleted", "Voir quels fichiers non suivis seraient supprimés"),
      i("git clean -fd", "Delete untracked files and folders", "Supprimer les fichiers et dossiers non suivis", "destructive"),
    ],
  },
  {
    id: "stash",
    lane: 5,
    title: { en: "Stash", fr: "Remiser (stash)" },
    intro: { en: "A drawer for half-finished work when you need a clean folder.", fr: "Un tiroir pour le travail en cours quand il te faut un dossier propre." },
    items: [
      i("git stash", "Put away uncommitted changes", "Ranger les modifications non validées"),
      i("git stash -u", "…including untracked files", "…y compris les fichiers non suivis"),
      i('git stash push -m "<message>"', "Stash with a label", "Remiser avec une étiquette"),
      i("git stash list", "See everything in the drawer", "Voir tout le contenu du tiroir"),
      i("git stash pop", "Take the latest stash back out", "Ressortir la dernière remise"),
      i("git stash apply stash@{<n>}", "Apply a stash but keep it stored", "Appliquer une remise en la gardant"),
      i("git stash drop stash@{<n>}", "Delete one stash", "Supprimer une remise", "destructive"),
    ],
  },
  {
    id: "tags",
    lane: 3,
    title: { en: "Tags & releases", fr: "Tags et versions" },
    items: [
      i("git tag", "List tags", "Lister les tags"),
      i('git tag -a v1.0.0 -m "<message>"', "Mark this commit as a release", "Marquer ce commit comme une version"),
      i("git tag v1.0.0 <commit>", "Tag an older commit", "Étiqueter un commit plus ancien"),
      i("git push --tags", "Upload your tags", "Envoyer tes tags"),
      i("git tag -d v1.0.0", "Delete a local tag", "Supprimer un tag local"),
    ],
  },
];

/** Short names Git understands wherever it expects a commit. */
export const REFS: Array<{ ref: string; desc: L }> = [
  { ref: "HEAD", desc: { en: "Where you are now", fr: "Là où tu es" } },
  { ref: "HEAD~1", desc: { en: "One commit back (HEAD~3: three back)", fr: "Un commit en arrière (HEAD~3 : trois)" } },
  { ref: "HEAD^2", desc: { en: "Second parent of a merge commit", fr: "Second parent d'un commit de fusion" } },
  { ref: "a1b2c3d", desc: { en: "Any commit, by the start of its hash", fr: "N'importe quel commit, par le début de son hash" } },
  { ref: "main..feature", desc: { en: "Commits on feature that main lacks", fr: "Commits de feature absents de main" } },
  { ref: "origin/main", desc: { en: "Last known state of main on GitHub", fr: "Dernier état connu de main sur GitHub" } },
  { ref: "@{u}", desc: { en: "The upstream of the current branch", fr: "L'amont de la branche actuelle" } },
  { ref: "HEAD@{2}", desc: { en: "Where HEAD was two moves ago (reflog)", fr: "Où était HEAD il y a deux déplacements (reflog)" } },
];

export const IGNORE: Array<{ pattern: string; desc: L }> = [
  { pattern: "*.log", desc: { en: "Every .log file, anywhere", fr: "Tous les fichiers .log, partout" } },
  { pattern: "node_modules/", desc: { en: "A folder (trailing slash = folders only)", fr: "Un dossier (barre finale = dossiers seulement)" } },
  { pattern: "/build", desc: { en: "Only at the repository root", fr: "Seulement à la racine du dépôt" } },
  { pattern: "**/tmp", desc: { en: "tmp at any depth", fr: "tmp à n'importe quelle profondeur" } },
  { pattern: ".env", desc: { en: "Secrets — never commit them", fr: "Secrets — ne jamais les valider" } },
  { pattern: "!keep.log", desc: { en: "Exception: do track this one", fr: "Exception : suivre celui-ci quand même" } },
];

export const RECIPES: Recipe[] = [
  {
    problem: { en: "I committed to the wrong branch", fr: "J'ai validé sur la mauvaise branche" },
    steps: ["git switch -c <right-branch>", "git switch -", "git reset --hard HEAD~1"],
    note: { en: "Only if that commit isn't pushed yet.", fr: "Seulement si ce commit n'est pas encore poussé." },
  },
  {
    problem: { en: "Typo in my last commit message", fr: "Faute dans mon dernier message de commit" },
    steps: ['git commit --amend -m "<fixed message>"'],
  },
  {
    problem: { en: "I forgot a file in my last commit", fr: "J'ai oublié un fichier dans mon dernier commit" },
    steps: ["git add <file>", "git commit --amend --no-edit"],
  },
  {
    problem: { en: "Undo my last commit but keep the work", fr: "Annuler mon dernier commit sans perdre le travail" },
    steps: ["git reset --soft HEAD~1"],
  },
  {
    problem: { en: "I pushed a commit that broke things", fr: "J'ai poussé un commit qui casse tout" },
    steps: ["git revert <commit>", "git push"],
    note: { en: "Never rewrite history others already pulled.", fr: "Ne réécris jamais un historique que d'autres ont récupéré." },
  },
  {
    problem: { en: "I lost commits after a reset", fr: "J'ai perdu des commits après un reset" },
    steps: ["git reflog", "git switch -c rescue <hash>"],
    note: { en: "Git keeps them for about 90 days.", fr: "Git les garde environ 90 jours." },
  },
  {
    problem: { en: "This merge is a mess, get me out", fr: "Cette fusion est un désastre, sortez-moi de là" },
    steps: ["git merge --abort"],
  },
  {
    problem: { en: "“You are in 'detached HEAD' state”", fr: "« Vous êtes dans l'état 'HEAD détachée' »" },
    steps: ["git switch -c <new-branch>"],
    note: { en: "Keeps any commits you made there. Or just git switch main.", fr: "Garde tes commits faits là. Ou simplement git switch main." },
  },
  {
    problem: { en: "Push rejected: remote has new work", fr: "Push refusé : le distant a du nouveau" },
    steps: ["git pull --rebase", "git push"],
  },
];

export const RULES: L[] = [
  { en: "Commit small and often — one idea per commit.", fr: "Valide petit et souvent — une idée par commit." },
  { en: "Write messages in the imperative: “Add login form”.", fr: "Écris tes messages à l'impératif : « Ajoute le formulaire »." },
  { en: "Run git status before anything you're unsure about.", fr: "Lance git status avant tout ce dont tu n'es pas sûr." },
  { en: "Pull before you push.", fr: "Récupère (pull) avant d'envoyer (push)." },
  { en: "Never rewrite history that others already have.", fr: "Ne réécris jamais un historique que d'autres possèdent." },
  { en: "Work on a branch, not directly on main.", fr: "Travaille sur une branche, pas directement sur main." },
];

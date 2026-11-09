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

  // builtins.ts (grep, test, npm)
  "Supported grep options here: -q -i -n -r -l -v -c -E -e.":
    "Options de grep disponibles ici : -q -i -n -r -l -v -c -E -e.",
  "Supported grep options here: -q -i -n -r -l -v -c -E -w -F.":
    "Options de grep disponibles ici : -q -i -n -r -l -v -c -E -w -F.",
  'grep needs a pattern to search for, then the files to look in. Example: grep "TODO" app.js':
    'grep a besoin d\'un motif à chercher, puis des fichiers où chercher. Exemple : grep "TODO" app.js',
  'Tell grep which files to search, e.g. grep "TODO" app.js, or search the whole project with grep -r "TODO" .':
    'Indique à grep dans quels fichiers chercher, par ex. grep "TODO" app.js, ou cherche dans tout le projet avec grep -r "TODO" .',
  "The search pattern isn't a valid regular expression. Check unbalanced brackets or parentheses.":
    "Le motif de recherche n'est pas une expression régulière valide. Vérifie les crochets ou parenthèses mal fermés.",
  "Supported here: -f -e -d -s -n -z, = != and -eq -ne -lt -le -gt -ge.":
    "Disponible ici : -f -e -d -s -n -z, = != et -eq -ne -lt -le -gt -ge.",
  'Wrap values that contain spaces in quotes, e.g. test "$a" = "hello world".':
    'Mets entre guillemets les valeurs qui contiennent des espaces, par ex. test "$a" = "hello world".',
  "The [ command needs a closing ] with a space before it: [ -f README.md ]":
    "La commande [ a besoin d'un ] fermant, précédé d'une espace : [ -f README.md ]",
  "In this sandbox npm can run the scripts from package.json: npm test, npm start or npm run <name>.":
    "Dans ce bac à sable, npm peut lancer les scripts de package.json : npm test, npm start ou npm run <name>.",
  "npm reads its scripts from package.json, and this project doesn't have one.":
    "npm lit ses scripts dans package.json, et ce projet n'en a pas.",
  "package.json isn't valid JSON (check commas and quotes), so npm can't read it.":
    "package.json n'est pas du JSON valide (vérifie les virgules et les guillemets), donc npm ne peut pas le lire.",
  "An npm script keeps running npm again; check package.json for a loop.":
    "Un script npm relance npm sans fin ; cherche une boucle dans package.json.",

  // config.ts
  "Supported here: git config <key> [<value>], --list, --unset <key>, --get <key>, --global.":
    "Disponible ici : git config <key> [<value>], --list, --unset <key>, --get <key>, --global.",
  'Give a setting name, and a value to change it. Example: git config user.name "Ada Lovelace". Use git config --list to see everything.':
    'Donne le nom d\'un réglage, et une valeur pour le modifier. Exemple : git config user.name "Ada Lovelace". Utilise git config --list pour tout voir.',
  "Config keys look like section.name, for example core.hooksPath.":
    "Les clés de config ont la forme section.nom, par exemple core.hooksPath.",
  "This setting is stored inside a repository's .git/config, and there's no repository here yet. Run git init first, then set it.":
    "Ce réglage est stocké dans le fichier .git/config d'un dépôt, et il n'y a pas encore de dépôt ici. Lance d'abord git init, puis règle-le.",

  // gh.ts
  "gh works on the repository in the current folder, and this folder isn't a Git repository yet. Clone one or run git init first.":
    "gh travaille sur le dépôt du dossier courant, et ce dossier n'est pas encore un dépôt Git. Clone un dépôt ou lance d'abord git init.",
  "gh needs to know which GitHub repository you mean. Connect one with git remote add origin <url>, then push.":
    "gh doit savoir de quel dépôt GitHub tu parles. Connectes-en un avec git remote add origin <url>, puis fais un push.",
  "That remote doesn't point at a repository on the simulated GitHub.":
    "Ce dépôt distant ne pointe vers aucun dépôt du GitHub simulé.",
  "There's no pull request for the branch you're on. Give a number (gh pr view 3) or list them with gh pr list.":
    "Il n'y a aucune pull request pour la branche sur laquelle tu es. Donne un numéro (gh pr view 3) ou liste-les avec gh pr list.",
  "No pull request has that number. Run gh pr list --state all to see them.":
    "Aucune pull request ne porte ce numéro. Lance gh pr list --state all pour les voir.",
  "Tell gh which issue, e.g. gh issue view 2.":
    "Indique à gh quelle issue, par ex. gh issue view 2.",
  "No issue has that number. Run gh issue list --state all.":
    "Aucune issue ne porte ce numéro. Lance gh issue list --state all.",
  "Switch to the branch you want to propose, e.g. git switch my-feature.":
    "Passe sur la branche que tu veux proposer, par ex. git switch my-feature.",
  "A pull request proposes merging one branch into another. Create a branch for your change first: git switch -c my-change, commit, push it, then run gh pr create.":
    "Une pull request propose de fusionner une branche dans une autre. Crée d'abord une branche pour ton changement : git switch -c my-change, fais un commit, pousse-la, puis lance gh pr create.",
  'Give your pull request a title: gh pr create --title "Add login page" --body "What and why". Or use --fill to reuse your last commit message.':
    'Donne un titre à ta pull request : gh pr create --title "Add login page" --body "What and why". Ou utilise --fill pour reprendre le message de ton dernier commit.',
  "Tell gh which pull request to check out, e.g. gh pr checkout 3.":
    "Indique à gh quelle pull request récupérer, par ex. gh pr checkout 3.",
  'Pick one: gh pr review 3 --approve, gh pr review 3 --request-changes -b "Please rename x", or gh pr review 3 --comment -b "Nice!".':
    'Choisis-en un : gh pr review 3 --approve, gh pr review 3 --request-changes -b "Please rename x", ou gh pr review 3 --comment -b "Nice!".',
  'Explain what you think with -b "...". A review without words isn\'t much help.':
    'Explique ce que tu en penses avec -b "...". Une review sans un mot n\'aide pas beaucoup.',
  "On GitHub you can't approve or block your own pull request: reviews exist so that someone else checks your work. You can still --comment.":
    "Sur GitHub, tu ne peux pas approuver ni bloquer ta propre pull request : les reviews servent à ce que quelqu'un d'autre vérifie ton travail. Tu peux quand même utiliser --comment.",
  "Choose how GitHub combines the branch: --merge (keeps every commit plus a merge commit), --squash (one single commit) or --rebase (replays the commits on top, no merge commit).":
    "Choisis comment GitHub intègre la branche : --merge (garde chaque commit plus un commit de fusion), --squash (un seul commit) ou --rebase (rejoue les commits par-dessus, sans commit de fusion).",
  "It's already merged. Run git pull on the base branch to get the result locally.":
    "Elle est déjà fusionnée. Lance git pull sur la branche de base pour récupérer le résultat en local.",
  "Replaying these commits one by one on top of the base causes a conflict. Use --merge or --squash, or rebase locally and force-push the branch.":
    "Rejouer ces commits un par un sur la base provoque un conflit. Utilise --merge ou --squash, ou fais un rebase en local et un force-push de la branche.",
  'Describe the problem: gh issue create --title "Login button is broken" --body "Steps to reproduce..."':
    'Décris le problème : gh issue create --title "Login button is broken" --body "Steps to reproduce..."',
  "Name the version to release, e.g. gh release create v1.0.0 (the tag must be pushed first).":
    "Indique la version à publier, par ex. gh release create v1.0.0 (le tag doit d'abord être poussé).",
  "No release with that tag. Run gh release list.":
    "Aucune release n'a ce tag. Lance gh release list.",
  "No workflow has run yet. Add a workflow file under .github/workflows/ and push.":
    "Aucun workflow n'a encore tourné. Ajoute un fichier de workflow dans .github/workflows/ et fais un push.",
  "Run gh run list to see the run IDs.":
    "Lance gh run list pour voir les identifiants des exécutions.",
  'Usage: gh secret set NAME --body "value"':
    'Utilisation : gh secret set NAME --body "value"',
  "Use a name like API_TOKEN.":
    "Utilise un nom comme API_TOKEN.",
  "There's no secret with that name. Run gh secret list.":
    "Il n'y a aucun secret de ce nom. Lance gh secret list.",
  "gh talks to GitHub: pull requests (gh pr), issues, releases, Actions runs (gh run) and secrets. Type gh help.":
    "gh parle à GitHub : pull requests (gh pr), issues, releases, exécutions Actions (gh run) et secrets. Tape gh help.",

  // git/advanced.ts (bisect, check-ignore)
  "Bisect is a guided search for the commit that introduced a bug. Start it with git bisect start, then mark a commit where the bug exists (git bisect bad) and one where it didn't yet (git bisect good <commit>).":
    "Bisect est une recherche guidée du commit qui a introduit un bug. Démarre-la avec git bisect start, puis marque un commit où le bug existe (git bisect bad) et un où il n'existait pas encore (git bisect good <commit>).",
  "You marked the same commit as both good and bad. Each commit either has the bug or doesn't.":
    "Tu as marqué le même commit à la fois comme good et bad. Chaque commit a le bug, ou ne l'a pas.",
  "A 'good' commit must be older than the 'bad' one (an ancestor of it). Check that you didn't swap them: bad = has the bug (usually the newest), good = an older commit without it.":
    "Un commit 'good' doit être plus ancien que le 'bad' (un de ses ancêtres). Vérifie que tu ne les as pas inversés : bad = a le bug (en général le plus récent), good = un commit plus ancien sans le bug.",
  "Every commit left to check was skipped, so Git can't narrow it down further. The culprit is one of the commits listed.":
    "Tous les commits restant à vérifier ont été sautés (skip), donc Git ne peut pas affiner davantage. Le coupable est l'un des commits listés.",
  "Give the command that tests a commit, e.g. git bisect run npm test. Exit status 0 means good, anything else means bad.":
    "Donne la commande qui teste un commit, par ex. git bisect run npm test. Un code de sortie 0 signifie good, tout le reste signifie bad.",
  "git bisect run needs a starting range: mark one commit with the bug (git bisect bad) and one without it (git bisect good <commit>) first.":
    "git bisect run a besoin d'un intervalle de départ : marque d'abord un commit avec le bug (git bisect bad) et un sans (git bisect good <commit>).",
  "There are no commits yet, so there is no history to search. Make some commits first.":
    "Il n'y a encore aucun commit, donc aucun historique où chercher. Fais d'abord quelques commits.",
  "git bisect works in steps: start, then mark commits good or bad until Git finds the culprit, then reset.":
    "git bisect fonctionne par étapes : start, puis marque des commits good ou bad jusqu'à ce que Git trouve le coupable, puis reset.",
  "Name the file to check, e.g. git check-ignore -v debug.log. Git tells you which .gitignore line ignores it.":
    "Indique le fichier à vérifier, par ex. git check-ignore -v debug.log. Git te dit quelle ligne du .gitignore l'ignore.",

  // git/basic.ts (status, add, tag)
  "Use -uall (list every file), -unormal (the default: folders shown once) or -uno (hide untracked files).":
    "Utilise -uall (liste chaque fichier), -unormal (par défaut : chaque dossier affiché une seule fois) ou -uno (masque les fichiers non suivis).",
  "Your .gitignore says Git should not track these files (things like secrets, logs or build output usually shouldn't be committed). Git refused to stage them. If you really want this file in the repository, use git add -f <file>.":
    "Ton .gitignore indique que Git ne doit pas suivre ces fichiers (les secrets, les logs ou les fichiers de build ne devraient en général pas être commités). Git a refusé de les ajouter. Si tu veux vraiment ce fichier dans le dépôt, utilise git add -f <file>.",
  'Put the tag message right after -m, in quotes: git tag -a v1.0 -m "Release 1.0"':
    'Mets le message du tag juste après -m, entre guillemets : git tag -a v1.0 -m "Release 1.0"',
  'Common git tag options: -a (annotated) with -m "message", -l to list, -d to delete, -n to show messages.':
    'Options courantes de git tag : -a (annoté) avec -m "message", -l pour lister, -d pour supprimer, -n pour afficher les messages.',
  '-l only lists tags. To create an annotated tag, drop -l: git tag -a v1.0 -m "Release 1.0"':
    '-l ne fait que lister les tags. Pour créer un tag annoté, retire -l : git tag -a v1.0 -m "Release 1.0"',
  "Name the tag to delete, e.g. git tag -d v1.0. Run git tag to list them.":
    "Indique le tag à supprimer, par ex. git tag -d v1.0. Lance git tag pour les lister.",
  "There's no tag with that name. Run git tag to see the existing tags.":
    "Il n'y a aucun tag de ce nom. Lance git tag pour voir les tags existants.",
  'Give the tag a name, e.g. git tag -a v1.0 -m "Release 1.0".':
    'Donne un nom au tag, par ex. git tag -a v1.0 -m "Release 1.0".',
  "Tag names look like v1.0.0: letters, numbers, dots, dashes and slashes, no spaces.":
    "Un nom de tag ressemble à v1.0.0 : lettres, chiffres, points, tirets et barres obliques, sans espaces.",

  // git/branching.ts (stash)
  "There's nothing in the stash. git stash saves your uncommitted changes there first.":
    "Le stash est vide. git stash y range d'abord tes modifications non commitées.",
  "The stash is empty, so there's nothing to refer to.":
    "Le stash est vide, il n'y a donc rien à désigner.",
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

  // builtins.ts
  [
    /^package\.json has no "(.*)" entry under "scripts", so npm doesn't know what to run\.$/,
    (m) => `package.json n'a pas d'entrée "${m[1]}" dans "scripts", donc npm ne sait pas quoi lancer.`,
  ],
  [
    /^The "(.*)" script failed \(see its output above\)\. npm passes the failure on, so anything waiting for it \(a hook, CI\) fails too\.$/,
    (m) => `Le script "${m[1]}" a échoué (regarde sa sortie au-dessus). npm transmet l'échec, donc tout ce qui l'attend (un hook, la CI) échoue aussi.`,
  ],

  // config.ts
  [
    /^Config keys look like section\.name, for example user\.name or core\.hooksPath\. "(.*)" is missing the section part\.$/,
    (m) => `Les clés de config ont la forme section.nom, par exemple user.name ou core.hooksPath. Il manque la partie section à "${m[1]}".`,
  ],

  // hooks.ts
  [
    /^The (\S+) hook \(a script in your project, set up with core\.hooksPath\) checked your work and said no, so Git stopped before (.+)\. Read its message above, fix the problem, and try again\. You could skip hooks with --no-verify, but that's usually a bad idea: the hook exists to catch mistakes before they reach your history or your team\.$/,
    (m) => {
      const actions: Record<string, string> = {
        pushing: "de faire le push",
        "creating the commit (nothing was committed)": "de créer le commit (rien n'a été commité)",
        "creating the commit, because of the commit message (nothing was committed)": "de créer le commit, à cause du message de commit (rien n'a été commité)",
      };
      return `Le hook ${m[1]} (un script de ton projet, configuré avec core.hooksPath) a vérifié ton travail et a dit non, alors Git s'est arrêté avant ${actions[m[2]] ?? m[2]}. Lis son message au-dessus, corrige le problème et réessaie. Tu pourrais sauter les hooks avec --no-verify, mais c'est en général une mauvaise idée : le hook est là pour attraper les erreurs avant qu'elles n'arrivent dans ton historique ou chez ton équipe.`;
    },
  ],

  // gh.ts
  [/^(\S+) expects a value, e\.g\. \1 "something"\.$/, (m) => `${m[1]} attend une valeur, par ex. ${m[1]} "something".`],
  [
    /^gh (.+) doesn't understand (\S+)\. Run gh help to see what's supported here\.$/,
    (m) => `gh ${m[1]} ne comprend pas ${m[2]}. Lance gh help pour voir ce qui est disponible ici.`,
  ],
  [
    /^Pull requests and issues share numbers on GitHub\. Use gh pr view (.+)\.$/,
    (m) => `Sur GitHub, les pull requests et les issues partagent la même numérotation. Utilise gh pr view ${m[1]}.`,
  ],
  [
    /^(.+) asked for changes\. Make them on the (.+) branch, commit, and git push: the pull request updates itself and the reviewer looks again\.$/,
    (m) => `${m[1].replace(/ and /g, " et ")} a demandé des changements. Fais-les sur la branche ${m[2]}, commite, puis git push : la pull request se met à jour toute seule et la personne qui relit regarde à nouveau.`,
  ],
  [
    /^The (.+) branch is protected: a pull request needs (.+) from someone other than its author before it can be merged\.$/,
    (m) => {
      const n = /^(\d+) approving reviews?$/.exec(m[2]);
      const what = n ? (n[1] === "1" ? "1 approbation" : `${n[1]} approbations`) : m[2];
      return `La branche ${m[1]} est protégée : une pull request a besoin de ${what} de quelqu'un d'autre que son auteur avant de pouvoir être fusionnée.`;
    },
  ],
  [
    /^The "(.*)" check \(a GitHub Actions job\) failed on the latest commit\. Read why with gh run list and gh run view <id> --log, fix it on (.+), and push\.$/,
    (m) => `Le check "${m[1]}" (un job GitHub Actions) a échoué sur le dernier commit. Regarde pourquoi avec gh run list et gh run view <id> --log, corrige-le sur ${m[2]}, puis fais un push.`,
  ],
  [
    /^The "(.*)" check must pass before merging, but it hasn't run on the latest commit\. Make sure a workflow in \.github\/workflows has a job named (.+) that runs on pull_request\.$/,
    (m) => `Le check "${m[1]}" doit réussir avant la fusion, mais il n'a pas tourné sur le dernier commit. Vérifie qu'un workflow dans .github/workflows a un job nommé ${m[2]} qui se lance sur pull_request.`,
  ],
  [
    /^(.+) changed the same lines as your branch since you started\. Locally: git switch (.+), git pull, git merge origin\/(.+), fix the conflicts, commit, then git push\. The pull request updates itself\.$/,
    (m) => `${m[1]} a modifié les mêmes lignes que ta branche depuis que tu as commencé. En local : git switch ${m[2]}, git pull, git merge origin/${m[3]}, règle les conflits, commite, puis git push. La pull request se met à jour toute seule.`,
  ],
  [
    /^GitHub doesn't have the branch "(.*)" yet, so there's nothing to open a pull request from\. Push it first: git push -u origin (.+)$/,
    (m) => `GitHub n'a pas encore la branche "${m[1]}", il n'y a donc rien à partir de quoi ouvrir une pull request. Pousse-la d'abord : git push -u origin ${m[2]}`,
  ],
  [/^There's no branch called "(.*)" on GitHub\.$/, (m) => `Il n'y a aucune branche nommée "${m[1]}" sur GitHub.`],
  [
    /^(.+) has nothing that (.+) doesn't already have\. Commit your change on \1 and push it before opening the pull request\.$/,
    (m) => `${m[1]} ne contient rien que ${m[2]} n'ait déjà. Commite ton changement sur ${m[1]} et pousse-le avant d'ouvrir la pull request.`,
  ],
  [
    /^There's already an open pull request for (.+)\. New pushes to \1 update it automatically; no need for a new one\.$/,
    (m) => `Il y a déjà une pull request ouverte pour ${m[1]}. Les nouveaux push sur ${m[1]} la mettent à jour automatiquement ; pas besoin d'en créer une autre.`,
  ],
  [
    /^The branch behind #(.+) was deleted on GitHub, so there's nothing to check out\.$/,
    (m) => `La branche de la #${m[1]} a été supprimée sur GitHub, il n'y a donc rien à récupérer.`,
  ],
  [/^Reopen it first with gh pr reopen (.+)\.$/, (m) => `Rouvre-la d'abord avec gh pr reopen ${m[1]}.`],
  [
    /^Your tag only exists on your computer\. Publish it first: git push origin (.+), then create the release\.$/,
    (m) => `Ton tag n'existe que sur ton ordinateur. Publie-le d'abord : git push origin ${m[1]}, puis crée la release.`,
  ],
  [
    /^A release is attached to a tag\. Create and publish one first: git tag (.+) && git push origin \1$/,
    (m) => `Une release est rattachée à un tag. Crée-en un et publie-le d'abord : git tag ${m[1]} && git push origin ${m[1]}`,
  ],
  [
    /^Give the value with --body: gh secret set (.+) --body "s3cr3t"\. It's stored encrypted and never shown again\.$/,
    (m) => `Donne la valeur avec --body : gh secret set ${m[1]} --body "s3cr3t". Elle est stockée chiffrée et ne sera plus jamais affichée.`,
  ],
  [
    /^gh (\S+) needs a subcommand, for example gh \1 (\S+)\.$/,
    (m) => `gh ${m[1]} a besoin d'une sous-commande, par exemple gh ${m[1]} ${m[2]}.`,
  ],
  [/^Typo\? Try gh (.+)\.$/, (m) => `Faute de frappe ? Essaie gh ${m[1]}.`],
  [/^gh (\S+) supports: (.+)\.$/, (m) => `gh ${m[1]} accepte : ${m[2]}.`],

  // git/advanced.ts
  [
    /^Git can't find a commit called "(.*)"\. Use a commit id from git log --oneline, a branch, a tag, or HEAD~N\.$/,
    (m) => `Git ne trouve aucun commit nommé "${m[1]}". Utilise un identifiant de commit tiré de git log --oneline, une branche, un tag ou HEAD~N.`,
  ],
  [/^Finish or abort the (.+) before starting a bisect\.$/, (m) => `Termine ou annule le ${m[1]} avant de lancer un bisect.`],

  // git/basic.ts (tag)
  [
    /^There's no commit called "(.*)"\. Use a branch name, tag or commit id from git log --oneline\.$/,
    (m) => `Il n'y a aucun commit nommé "${m[1]}". Utilise un nom de branche, un tag ou un identifiant de commit tiré de git log --oneline.`,
  ],
  [
    /^A tag called (.+) already exists, and tags aren't supposed to move\. Pick a new name, or delete it first with git tag -d \1\.$/,
    (m) => `Un tag nommé ${m[1]} existe déjà, et un tag n'est pas censé bouger. Choisis un autre nom, ou supprime-le d'abord avec git tag -d ${m[1]}.`,
  ],
  [
    /^An annotated tag needs a message\. Real Git would open a text editor; here, give it with -m: (.+)$/,
    (m) => `Un tag annoté a besoin d'un message. Le vrai Git ouvrirait un éditeur de texte ; ici, donne-le avec -m : ${m[1]}`,
  ],

  // git/branching.ts (cherry-pick, revert, stash)
  [
    /^There's no commit called "(.*)"\. Copy an id from git log --oneline \(add --all to see other branches\)\.$/,
    (m) => `Il n'y a aucun commit nommé "${m[1]}". Copie un identifiant depuis git log --oneline (ajoute --all pour voir les autres branches).`,
  ],
  [
    /^Git can't (\S+) a merge commit without being told which parent to compare against, and this simulator doesn't support -m yet\. Pick the individual commits instead\.$/,
    (m) => `Git ne peut pas faire de ${m[1]} sur un commit de fusion sans savoir à quel parent le comparer, et ce simulateur ne gère pas encore -m. Choisis plutôt les commits un par un.`,
  ],
  [
    /^The commit changes lines that are also different on your branch, so Git can't apply it on its own\. Open each conflicted file, keep the right content \(remove the <<<<<<< ======= >>>>>>> markers\), git add it, then run git (\S+) --continue\. Or give up with git \1 --abort\.$/,
    (m) => `Ce commit modifie des lignes qui sont aussi différentes sur ta branche, donc Git ne peut pas l'appliquer tout seul. Ouvre chaque fichier en conflit, garde le bon contenu (supprime les marqueurs <<<<<<< ======= >>>>>>>), fais git add, puis lance git ${m[1]} --continue. Ou abandonne avec git ${m[1]} --abort.`,
  ],
  [
    /^These changes are already in your branch, so there is nothing new to apply\. Run git (\S+) --skip to move on \(or --abort to cancel\)\.$/,
    (m) => `Ces changements sont déjà dans ta branche, il n'y a donc rien de nouveau à appliquer. Lance git ${m[1]} --skip pour passer à la suite (ou --abort pour annuler).`,
  ],
  [
    /^There's no (\S+) waiting to be finished\. --continue and --skip only make sense after a \1 stopped on a conflict\.$/,
    (m) => `Il n'y a aucun ${m[1]} en attente. --continue et --skip n'ont de sens qu'après un ${m[1]} arrêté sur un conflit.`,
  ],
  [
    /^Some files still have conflicts: (.+)\. Fix each one \(remove the conflict markers\), run git add <file>, then git (\S+) --continue\.$/,
    (m) => `Certains fichiers ont encore des conflits : ${m[1]}. Corrige-les un par un (supprime les marqueurs de conflit), lance git add <file>, puis git ${m[2]} --continue.`,
  ],
  [
    /^After your resolution, the files are exactly the same as before, so there's nothing to commit\. Run git (\S+) --skip to move on\.$/,
    (m) => `Après ta résolution, les fichiers sont exactement les mêmes qu'avant, il n'y a donc rien à commiter. Lance git ${m[1]} --skip pour passer à la suite.`,
  ],
  [
    /^Finish the (\S+) that's in progress first \(fix conflicts, git add, then --continue\), or cancel it with git \1 --abort\.$/,
    (m) => `Termine d'abord le ${m[1]} en cours (règle les conflits, git add, puis --continue), ou annule-le avec git ${m[1]} --abort.`,
  ],
  [/^Make a first commit before running git (\S+)\.$/, (m) => `Fais un premier commit avant de lancer git ${m[1]}.`],
  [/^There's no (\S+) to cancel\.$/, (m) => `Il n'y a aucun ${m[1]} à annuler.`],
  [
    /^Pick one of the entries shown by git stash list: stash@\{0\} to stash@\{(.+)\}\.$/,
    (m) => `Choisis une des entrées affichées par git stash list : de stash@{0} à stash@{${m[1]}}.`,
  ],

  // git/remote.ts (GH006)
  [
    /^(.+) is a protected branch on GitHub, so it can't be deleted\. Protection keeps important branches like \1 safe from accidents\.$/,
    (m) => `${m[1]} est une branche protégée sur GitHub, elle ne peut donc pas être supprimée. La protection met les branches importantes comme ${m[1]} à l'abri des accidents.`,
  ],
  [
    /^(.+) is a protected branch on GitHub: nobody may push to it directly, every change has to arrive through a pull request\. Move your commit to a new branch \(git switch -c my-change\), push that branch \(git push -u origin my-change\) and open a pull request with gh pr create\. Then reset your local \1 to origin\/\1\.$/,
    (m) => `${m[1]} est une branche protégée sur GitHub : personne ne peut y faire de push directement, chaque changement doit passer par une pull request. Déplace ton commit sur une nouvelle branche (git switch -c my-change), pousse cette branche (git push -u origin my-change) et ouvre une pull request avec gh pr create. Ensuite, remets ta branche ${m[1]} locale sur origin/${m[1]}.`,
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
  // several explanations joined line by line (e.g. every reason a PR can't be merged)
  if (text.includes("\n")) return text.split("\n").map((l) => translateExplain(l, locale) ?? l).join("\n");
  return text;
}

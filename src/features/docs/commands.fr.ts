import type { CommandDoc } from "./commands";

export interface CommandDocFr {
  summary: string;
  plain: string;
  /** One French description per English flag, same order. */
  flags: string[];
  riskNote?: string;
}

export const CATEGORY_FR: Record<CommandDoc["category"], string> = {
  Basics: "Les bases",
  History: "Historique",
  Branches: "Branches",
  Undo: "Annuler",
  Remote: "Dépôt distant",
  Extras: "Bonus",
};

export const COMMAND_DOCS_FR: Record<string, CommandDocFr> = {
  init: {
    summary: "Créer un nouveau dépôt",
    plain: "Transforme le dossier actuel en dépôt Git en y ajoutant un dossier caché .git.",
    flags: ["Nommer la première branche (par défaut : main)"],
  },
  status: {
    summary: "Voir ce qui a changé",
    plain: "Liste les fichiers nouveaux, modifiés et dans la zone de staging, et la branche sur laquelle tu es. En lecture seule — toujours sans risque.",
    flags: ["Format compact sur deux lettres"],
  },
  add: {
    summary: "Préparer des changements pour le prochain commit",
    plain: "Copie la version actuelle des fichiers dans la zone de staging — le brouillon de ton prochain instantané.",
    flags: ["Tout ce qui est dans ce dossier", "Tous les changements, suppressions comprises"],
  },
  commit: {
    summary: "Enregistrer un instantané",
    plain: "Enregistre tout le contenu de la zone de staging comme un nouvel instantané permanent, avec un message.",
    flags: ["Le message du commit", "Ajouter automatiquement les fichiers suivis modifiés", "Remplacer le dernier commit"],
  },
  log: {
    summary: "Afficher l'historique des commits",
    plain: "Liste les commits passés, du plus récent au plus ancien.",
    flags: ["Un commit par ligne", "Dessiner les lignes des branches", "Inclure toutes les branches", "Seulement les N derniers commits"],
  },
  show: {
    summary: "Inspecter un commit",
    plain: "Affiche le message d'un commit, son auteur et exactement ce qu'il a changé.",
    flags: [],
  },
  diff: {
    summary: "Voir les changements ligne par ligne",
    plain: "Compare des versions de fichiers : les lignes + ont été ajoutées, les lignes − ont été supprimées.",
    flags: ["Changements en staging comparés au dernier commit", "Résumé seulement"],
  },
  branch: {
    summary: "Lister, créer ou supprimer des branches",
    plain: "Une branche est une étiquette mobile qui pointe vers un commit. Cette commande gère ces étiquettes.",
    flags: ["Supprimer une branche fusionnée", "Forcer la suppression d'une branche", "Renommer une branche", "Inclure les branches distantes"],
  },
  switch: {
    summary: "Passer sur une autre branche",
    plain: "Déplace HEAD sur une branche et met tes fichiers à jour pour qu'ils lui correspondent.",
    flags: ["Créer la branche et passer dessus", "Visiter un commit directement"],
  },
  checkout: {
    summary: "Changer de branche ou restaurer des fichiers (classique)",
    plain: "L'ancienne commande à tout faire. Aujourd'hui, switch et restore se partagent ses deux rôles.",
    flags: ["Créer la branche et passer dessus"],
    riskNote: "git checkout -- <file> efface les modifications non commitées de ce fichier.",
  },
  merge: {
    summary: "Fusionner une autre branche dans celle-ci",
    plain: "Ramène les commits d'une autre branche dans la branche sur laquelle tu es.",
    flags: ["Toujours créer un commit de fusion", "Annuler une fusion en conflit", "Combiner les changements sans commit de fusion"],
  },
  rebase: {
    summary: "Rejouer des commits au-dessus d'une autre branche",
    plain: "Déplace les commits de ta branche pour qu'ils partent du bout d'une autre branche, en créant de nouvelles copies.",
    flags: ["Continuer après avoir réglé un conflit", "Revenir à l'état d'avant le rebase"],
    riskNote: "Réécrit les identifiants des commits. Ne rebase pas des commits que d'autres ont déjà récupérés.",
  },
  restore: {
    summary: "Annuler des modifications ou retirer des fichiers du staging",
    plain: "Ramène un fichier à sa dernière version enregistrée, ou le retire de la zone de staging.",
    flags: ["Retirer du staging au lieu d'effacer", "Restaurer depuis un commit précis"],
    riskNote: "git restore <file> efface définitivement les modifications non commitées de ce fichier.",
  },
  reset: {
    summary: "Ramener la branche en arrière (et peut-être effacer du travail)",
    plain: "Déplace ta branche actuelle vers un autre commit. --hard écrase aussi tes fichiers.",
    flags: ["Garder les changements dans la zone de staging", "Garder les changements hors du staging (par défaut)", "Effacer complètement les changements"],
    riskNote: "--hard efface le travail non commité. Les commits, eux, se récupèrent en général avec git reflog.",
  },
  revert: {
    summary: "Annuler un commit avec un nouveau commit",
    plain: "Crée un nouveau commit qui fait l'inverse d'un ancien. L'historique est conservé — sans risque sur les branches partagées.",
    flags: ["Annuler un revert en conflit"],
  },
  reflog: {
    summary: "Là où HEAD est passé",
    plain: "Un journal de tous les commits vers lesquels HEAD a pointé. Ton filet de sécurité pour retrouver des commits « perdus ».",
    flags: [],
  },
  stash: {
    summary: "Mettre du travail de côté",
    plain: "Range tes modifications non commitées sur une étagère et nettoie ton répertoire de travail.",
    flags: ["Ressortir le dernier stash", "Inclure les fichiers non suivis"],
  },
  "cherry-pick": {
    summary: "Copier un commit sur cette branche",
    plain: "Applique les changements d'un commit précis sous forme d'un nouveau commit sur ta branche.",
    flags: ["Annuler un cherry-pick en conflit"],
  },
  tag: {
    summary: "Étiqueter un commit pour de bon",
    plain: "Les tags marquent les commits importants, comme les versions (v1.0). Contrairement aux branches, ils ne bougent pas.",
    flags: ["Supprimer un tag"],
  },
  remote: {
    summary: "Gérer les connexions à GitHub",
    plain: "Un dépôt distant (remote) est un surnom pour un dépôt hébergé ailleurs (en général « origin »).",
    flags: ["Afficher les URL"],
  },
  push: {
    summary: "Envoyer des commits sur GitHub",
    plain: "Envoie les nouveaux commits de ta branche vers le dépôt distant.",
    flags: ["Retenir la branche distante (upstream) pour la suite", "Écraser la branche distante"],
    riskNote: "--force peut effacer le travail de tes coéquipiers sur le dépôt distant.",
  },
  fetch: {
    summary: "Récupérer les nouveautés de GitHub",
    plain: "Télécharge les nouveaux commits et met à jour les étiquettes origin/*. Tes fichiers et tes branches ne changent pas.",
    flags: ["Tous les dépôts distants"],
  },
  pull: {
    summary: "Télécharger et fusionner",
    plain: "git fetch + git merge en une seule étape : ramène les commits distants dans ta branche.",
    flags: ["Faire un rebase au lieu d'une fusion"],
  },
  clone: {
    summary: "Copier un dépôt depuis GitHub",
    plain: "Télécharge un dépôt entier, avec tout son historique, sur ton ordinateur.",
    flags: [],
  },
};

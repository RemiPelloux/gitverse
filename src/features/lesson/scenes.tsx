"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Camera, Cloud, CloudDownload, CloudUpload, Eye, EyeOff, FileCode2, FileText, Folder, FolderLock, Laptop, RotateCcw } from "lucide-react";
import { execute, type World } from "@/engine";
import type { SceneId } from "@/features/curriculum/types";
import { scenario } from "@/features/curriculum/scenario";
import { GitGraph } from "@/features/lab/git-graph";
import { StagesVisualizer } from "@/features/lab/stages";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";

export function Scene({ id }: { id: SceneId }) {
  const t = useT();
  switch (id) {
    case "snapshots":
      return <SnapshotsScene />;
    case "repository":
      return <RepositoryScene />;
    case "conflict":
      return <ConflictScene />;
    case "three-areas":
      return (
        <EngineScene
          setup={() => scenario({ "README.md": "# My Project\n" }).run("git init").done()}
          stages
          actions={[
            { label: t("lab.scenes.threeAreas.edit"), run: (w) => ({ ...w, workdir: { ...w.workdir, "README.md": (w.workdir["README.md"] ?? "") + "More text!\n" } }), caption: t("lab.scenes.threeAreas.editCaption") },
            { label: "git add README.md", command: "git add README.md", caption: t("lab.scenes.threeAreas.addCaption") },
            { label: 'git commit -m "…"', command: 'git commit -m "Save README"', caption: t("lab.scenes.threeAreas.commitCaption") },
          ]}
          intro={t("lab.scenes.threeAreas.intro")}
        />
      );
    case "history":
      return <HistoryScene />;
    case "branch-split":
      return (
        <EngineScene
          setup={() => scenario().run("git init").commit("Home page", { "index.html": "home\n" }).commit("Styles", { "style.css": "css\n" }).done()}
          actions={[
            { label: t("lab.scenes.branchSplit.create"), command: "git switch -c login", caption: t("lab.scenes.branchSplit.createCaption") },
            { label: t("lab.scenes.branchSplit.commit"), command: 'echo "login" > login.html && git add . && git commit -m "Login page"', caption: t("lab.scenes.branchSplit.commitCaption") },
            { label: t("lab.scenes.branchSplit.meanwhile"), command: 'git switch main && echo "fix" > fix.txt && git add . && git commit -m "Fix typo"', caption: t("lab.scenes.branchSplit.meanwhileCaption") },
          ]}
          intro={t("lab.scenes.branchSplit.intro")}
        />
      );
    case "fast-forward":
      return (
        <EngineScene
          setup={() =>
            scenario().run("git init").commit("Home page", { "index.html": "home\n" }).run("git switch -c feature").commit("Greeting", { "hi.txt": "hi\n" }).commit("Polish", { "hi.txt": "hi!\n" }).run("git switch main").done()
          }
          actions={[{ label: "git merge feature", command: "git merge feature", caption: t("lab.scenes.fastForward.caption") }]}
          intro={t("lab.scenes.fastForward.intro")}
        />
      );
    case "three-way":
      return (
        <EngineScene
          setup={() =>
            scenario().run("git init").commit("Home page", { "index.html": "home\n" }).run("git switch -c feature").commit("Footer", { "footer.html": "f\n" }).run("git switch main").commit("About page", { "about.html": "a\n" }).done()
          }
          actions={[{ label: "git merge feature", command: "git merge feature", caption: t("lab.scenes.threeWay.caption") }]}
          intro={t("lab.scenes.threeWay.intro")}
        />
      );
    case "remote":
    case "fetch-pull":
      return <RemoteScene pull={id === "fetch-pull"} />;
    case "undo":
      return (
        <EngineScene
          setup={() => scenario().run("git init").commit("README", { "README.md": "r\n" }).commit("Home page", { "index.html": "h\n" }).commit("Pricing", { "pricing.html": "p\n" }).done()}
          actions={[
            { label: "git reset --hard HEAD~1", command: "git reset --hard HEAD~1", caption: t("lab.scenes.undo.resetCaption") },
            { label: t("lab.scenes.undo.recover"), command: "git reset --hard HEAD@{1}", caption: t("lab.scenes.undo.recoverCaption") },
          ]}
          intro={t("lab.scenes.undo.intro")}
          keepGhosts
        />
      );
    default:
      return null;
  }
}

interface SceneAction {
  label: string;
  command?: string;
  run?: (w: World) => World;
  caption: string;
}

/** A small, real repository the learner pokes with buttons — powered by the engine. */
function EngineScene({ setup, actions, intro, stages, keepGhosts }: { setup: () => World; actions: SceneAction[]; intro: string; stages?: boolean; keepGhosts?: boolean }) {
  const t = useT();
  const [initial] = useState(setup);
  const [world, setWorld] = useState(initial);
  const [step, setStep] = useState(0);
  const [key, setKey] = useState(0);
  const [ghosts, setGhosts] = useState<string[]>([]);
  const [events, setEvents] = useState<ReturnType<typeof execute>["events"]>([]);
  const doAction = (a: SceneAction) => {
    if (a.run) setWorld(a.run(world));
    else {
      const r = execute(world, a.command!);
      if (keepGhosts) {
        const before = new Set(Object.values(world.repo?.branches ?? {}));
        const lost = [...before].filter((id) => !Object.values(r.world.repo?.branches ?? {}).includes(id));
        setGhosts((g) => [...g, ...lost]);
      }
      setWorld(r.world);
      setEvents(r.events);
    }
    setStep((s) => s + 1);
    setKey((k) => k + 1);
  };
  const caption = step === 0 ? intro : actions[step - 1].caption;
  return (
    <div className="flex flex-col gap-4">
      {stages && <StagesVisualizer world={world} showRemote={false} />}
      {!stages && (
        <div className="h-64 overflow-hidden rounded-lg border border-line bg-surface-2/40 sm:h-72">
          <GitGraph world={world} events={events} eventKey={key} compact ghosts={ghosts} />
        </div>
      )}
      <AnimatePresence mode="wait">
        <motion.p key={step} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="min-h-10 text-sm text-fg-2" aria-live="polite">
          {caption}
        </motion.p>
      </AnimatePresence>
      <div className="flex flex-wrap items-center gap-2">
        {step < actions.length ? (
          <Button onClick={() => doAction(actions[step])} className="font-mono" size="md">
            {actions[step].label}
          </Button>
        ) : (
          <span className="text-sm font-medium text-ok">{t("lab.scenes.done")}</span>
        )}
        {step > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWorld(initial);
              setStep(0);
              setGhosts([]);
              setEvents([]);
            }}
          >
            <RotateCcw className="size-3.5" /> {t("lab.scenes.replay")}
          </Button>
        )}
        <span className="ml-auto text-xs text-fg-3">
          {Math.min(step, actions.length)}/{actions.length}
        </span>
      </div>
    </div>
  );
}

const VERSIONS = [
  { label: "monday", lines: ["<h1>Welcome</h1>"] },
  { label: "tuesday", lines: ["<h1>Welcome</h1>", "<p>About me</p>"] },
  { label: "wednesday", lines: ["<h1>Welcome!</h1>", "<p>About me</p>", "<img src=cat.png>"] },
  { label: "thursday", lines: ["<h1>Welcome!</h1>", "<p>About me</p>", "<img src=cat.png>", "<footer>©</footer>"] },
] as const;

function SnapshotsScene() {
  const t = useT();
  const [count, setCount] = useState(1);
  const [viewing, setViewing] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex items-start gap-3 overflow-x-auto pb-2">
        <div className="absolute top-[60px] right-6 left-6 h-0.5 bg-line-strong" aria-hidden />
        <AnimatePresence initial={false}>
          {VERSIONS.slice(0, count).map((v, i) => (
            <motion.button
              key={v.label}
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              onClick={() => setViewing(i)}
              className={clsx(
                "relative z-[1] flex w-28 shrink-0 flex-col items-center gap-2 rounded-lg border p-2 text-left transition-colors",
                viewing === i ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
              )}
              aria-label={t("lab.scenes.snapshots.snapshotFrom", { day: t(`lab.scenes.snapshots.days.${v.label}`) })}
            >
              <div className="h-20 w-full overflow-hidden rounded-lg bg-surface-2 p-1.5 font-mono text-[7px] leading-tight text-fg-3">
                {v.lines.map((l) => (
                  <div key={l} className="truncate">
                    {l}
                  </div>
                ))}
              </div>
              <span className="flex items-center gap-1 text-[11px] text-fg-2">
                <Camera className="size-3" />
                {t(`lab.scenes.snapshots.days.${v.label}`)}
              </span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      <div className="rounded-lg border border-line bg-surface-2/50 p-3">
        <p className="text-xs text-fg-3">
          {t("lab.scenes.snapshots.asItWas")} <span className="font-medium text-fg-2">{t(`lab.scenes.snapshots.days.${VERSIONS[viewing].label}`)}</span>
        </p>
        <pre className="mt-1 font-mono text-xs text-fg">{VERSIONS[viewing].lines.join("\n")}</pre>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {count < VERSIONS.length ? (
          <Button
            onClick={() => {
              setCount((c) => c + 1);
              setViewing(count);
            }}
          >
            <Camera className="size-4" /> {t("lab.scenes.snapshots.take")}
          </Button>
        ) : (
          <p className="text-sm text-ok">{t("lab.scenes.snapshots.done")}</p>
        )}
      </div>
    </div>
  );
}

function RepositoryScene() {
  const t = useT();
  const [show, setShow] = useState(false);
  const files = ["index.html", "style.css", "photo.png"];
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-line bg-surface-2/50 p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Folder className="size-4 text-info" /> my-website/
        </p>
        <ul className="mt-2 space-y-1.5 pl-6">
          <AnimatePresence>
            {show && (
              <motion.li initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 text-sm text-accent-fg">
                <FolderLock className="size-4" /> .git/ <span className="text-xs text-fg-3">{t("lab.scenes.repository.gitNote")}</span>
              </motion.li>
            )}
          </AnimatePresence>
          {files.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-fg-2">
              {f.endsWith(".html") ? <FileCode2 className="size-4" /> : <FileText className="size-4" />}
              {f}
            </li>
          ))}
        </ul>
      </div>
      <Button variant="secondary" onClick={() => setShow((s) => !s)} className="self-start">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {show ? t("lab.scenes.repository.hide") : t("lab.scenes.repository.show")}
      </Button>
    </div>
  );
}

function ConflictScene() {
  const t = useT();
  const [merged, setMerged] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: "main", who: "main (Maya)", line: "color: purple;", tone: "border-accent/50 bg-accent-soft" },
          { id: "feature", who: `feature/dark-mode ${t("lab.scenes.conflict.you")}`, line: "color: white;", tone: "border-ok/50 bg-ok-soft" },
        ].map((s, i) => (
          <motion.div
            key={s.id}
            animate={merged ? { x: i === 0 ? 12 : -12, scale: 0.97 } : { x: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={clsx("rounded-lg border p-3", s.tone)}
          >
            <p className="text-xs text-fg-2">{s.who}</p>
            <pre className="mt-1 font-mono text-xs">{`body {\n  font-family: sans-serif;\n  ${s.line}\n}`}</pre>
          </motion.div>
        ))}
      </div>
      <AnimatePresence>
        {merged && (
          <motion.pre
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-x-auto rounded-lg border border-bad/40 bg-surface-2 p-3 font-mono text-xs leading-5"
          >
            <span className="text-fg-2">{"body {\n  font-family: sans-serif;\n"}</span>
            <span className="text-bad">{"<<<<<<< HEAD\n"}</span>
            <span className="bg-accent-soft">{"  color: purple;\n"}</span>
            <span className="text-bad">{"=======\n"}</span>
            <span className="bg-ok-soft">{"  color: white;\n  background: #111;\n"}</span>
            <span className="text-bad">{">>>>>>> feature/dark-mode\n"}</span>
            <span className="text-fg-2">{"}"}</span>
          </motion.pre>
        )}
      </AnimatePresence>
      <div className="flex items-center gap-2">
        {!merged ? (
          <Button onClick={() => setMerged(true)}>{t("lab.scenes.conflict.tryMerge")}</Button>
        ) : (
          <p className="text-sm text-fg-2">{t("lab.scenes.conflict.result")}</p>
        )}
      </div>
    </div>
  );
}

function HistoryScene() {
  const t = useT();
  const initial = useMemo(
    () =>
      scenario()
        .run("git init")
        .commit("Add README", { "README.md": "readme\n" })
        .commit("Add home page", { "index.html": "home\n" })
        .commit("Add styles", { "style.css": "css\n" })
        .done(),
    [],
  );
  const [world, setWorld] = useState(initial);
  const select = (id: string | null) => {
    if (!id) return;
    const r = execute(world, id === initial.repo!.branches.main ? "git switch main" : `git switch --detach ${id.slice(0, 7)}`);
    setWorld(r.world);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="h-60 overflow-hidden rounded-lg border border-line bg-surface-2/40">
        <GitGraph world={world} onSelect={select} compact />
      </div>
      <p className="text-sm text-fg-2">
        {t("lab.scenes.history.hint")}{" "}
        <span className="font-mono text-fg">{Object.keys(world.workdir).sort().join(", ")}</span>
      </p>
      {world.repo?.head.kind === "detached" && (
        <p className="text-xs text-warn">{t("lab.scenes.history.detached")}</p>
      )}
    </div>
  );
}

function RemoteScene({ pull }: { pull: boolean }) {
  const t = useT();
  const [phase, setPhase] = useState(0);
  const local = pull ? ["Start", "Pancakes"] : ["README", "Home page"];
  const remoteInitial = pull ? ["Start", "Pancakes", "Pasta"] : [];
  const steps = pull
    ? [
        { label: "git fetch", icon: CloudDownload, caption: t("lab.scenes.remote.fetchCaption") },
        { label: "git pull", icon: CloudDownload, caption: t("lab.scenes.remote.pullCaption") },
      ]
    : [{ label: "git push", icon: CloudUpload, caption: t("lab.scenes.remote.pushCaption") }];
  const remote = pull ? remoteInitial : phase >= 1 ? local : remoteInitial;
  const localNow = pull && phase >= 2 ? remoteInitial : local;
  const tracking = pull ? (phase >= 1 ? "Pasta" : "Pancakes") : phase >= 1 ? "Home page" : null;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        <Machine icon={<Laptop className="size-4" />} title={t("lab.scenes.remote.yourComputer")} commits={localNow} tracking={tracking} />
        <div className="relative h-10 w-10 sm:w-16">
          <AnimatePresence>
            {phase > 0 && (
              <motion.span
                key={phase}
                initial={{ x: pull ? 40 : -10, opacity: 0 }}
                animate={{ x: pull ? -10 : 40, opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.9, ease: "easeInOut" }}
                className="absolute top-3 left-0 size-3 rounded-full bg-accent"
              />
            )}
          </AnimatePresence>
          <div className="absolute top-1/2 h-px w-full bg-line" />
        </div>
        <Machine icon={<Cloud className="size-4" />} title={t("lab.scenes.remote.github")} commits={remote} remote />
      </div>
      <p className="min-h-10 text-sm text-fg-2" aria-live="polite">
        {phase === 0 ? (pull ? t("lab.scenes.remote.pullIntro") : t("lab.scenes.remote.pushIntro")) : steps[phase - 1].caption}
      </p>
      <div className="flex gap-2">
        {phase < steps.length ? (
          <Button onClick={() => setPhase((p) => p + 1)} className="font-mono">
            {(() => {
              const I = steps[phase].icon;
              return <I className="size-4" />;
            })()}
            {steps[phase].label}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setPhase(0)}>
            <RotateCcw className="size-3.5" /> {t("lab.scenes.replay")}
          </Button>
        )}
      </div>
    </div>
  );
}

function Machine({ icon, title, commits, tracking, remote }: { icon: React.ReactNode; title: string; commits: string[]; tracking?: string | null; remote?: boolean }) {
  const t = useT();
  return (
    <div className={clsx("min-w-0 rounded-lg border p-3", remote ? "border-info/40 bg-info-soft" : "border-line bg-surface-2/50")}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
        {icon}
        {title}
      </p>
      <ol className="mt-2 space-y-1">
        <AnimatePresence initial={false}>
          {commits.map((c) => (
            <motion.li key={c} layout initial={{ opacity: 0, x: remote ? -8 : 8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1.5 text-xs">
              <span className={clsx("size-2.5 shrink-0 rounded-full", remote ? "bg-info" : "bg-accent-fg")} />
              <span className="truncate">{c}</span>
              {tracking === c && <span className="ml-auto shrink-0 rounded border border-dashed border-line-strong px-1 font-mono text-[11px] text-fg-3">origin/main</span>}
            </motion.li>
          ))}
        </AnimatePresence>
        {!commits.length && <li className="text-xs text-fg-3">{t("lab.scenes.remote.empty")}</li>}
      </ol>
    </div>
  );
}

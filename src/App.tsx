import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Flower2,
  Heart,
  Timer,
  Smartphone,
  Trophy,
  HeartCrack,
  ChevronLeft,
  ChevronRight,
  Zap,
  ArrowUp,
  Star,
} from "lucide-react";
import { GameEngine } from "./game/engine";
import { VIEW_W, VIEW_H, PHYS } from "./game/config";
import type { GamePhase, HudState } from "./game/events";

// ============================================================================
// ❤️  YOUR APLOGY GOES HERE — edit just these two lines
// ============================================================================
// `to`    : who this is for (her name, or "to the best girl").
// `message`: the real words you want her to read when she reaches the end.
// This is the payoff of the whole game — make it sound like *you*.
const LOVE_LETTER = {
  to: "my love",
  message:
    "I'm sorry, cuddles. I should have told you a long time ago how much you mean to me. This island is nothing without you — I just wanted to build you a little world where every step ends with me saying it out loud. I love you, and I'll make it right. Always.",
};


// Title card motion: enter = slow spring with a slight pop (weight),
// exit = fast ease-in (prompt). Kept as variants so each anim gets its own timing.
const titleCardVariants = {
  hidden: { scale: 0.88, y: 26, opacity: 0 },
  visible: {
    scale: 1,
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 300, damping: 20, delay: 0.12 },
  },
  exit: {
    scale: 0.95,
    y: 10,
    opacity: 0,
    transition: { duration: 0.18, ease: [0.7, 0, 0.84, 0] as const },
  },
};

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<GamePhase>("boot");
  const [hud, setHud] = useState<HudState>({
    score: 0,
    flowers: 0,
    love: 0,
    lives: PHYS.startLives,
    time: PHYS.timeLimit,
    mega: false,
    megaTimer: 0,
  });
  const [muted, setMuted] = useState(false);
  const [touch, setTouch] = useState(false);
  const [landscape, setLandscape] = useState(false);

  // touch device?
  useEffect(() => setTouch(!window.matchMedia("(pointer: fine)").matches), []);

  // landscape lock detection
  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // mount the PIXI game
  useEffect(() => {
    if (!hostRef.current) return;
    const engine = new GameEngine();
    engineRef.current = engine;
    engine.onHud = setHud;
    engine.onPhase = setPhase;
    const offReady = engine.bridge.on("evt:ready", () => setReady(true));

    engine.init(hostRef.current).catch((e) => console.error("[stitch] engine init failed", e));

    // pause / mute keys
    const onKey2 = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      if (e.code === "KeyP" || e.code === "Escape") {
        if (phaseRef.current === "playing") eng.pauseAll();
        else if (phaseRef.current === "paused") eng.resume();
      }
      if (e.code === "Enter") {
        if (phaseRef.current === "title") eng.start();
        else if (phaseRef.current === "gameover") eng.restart();
      }
      if (e.code === "KeyM") toggleMute();
    };
    window.addEventListener("keydown", onKey2);

    return () => {
      offReady();
      window.removeEventListener("keydown", onKey2);
      if (engineRef.current) engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep a ref to the latest phase for the key handler
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const toggleMute = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const m = !eng.audio.isMuted();
    eng.audio.setMuted(m);
    setMuted(m);
  };

  const press = (k: keyof GameEngine["input"]["touch"], v: boolean) => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.input.touch[k] = v;
    eng.input.recompute();
  };

  const inGame = ready && phase !== "title" && phase !== "gameover";

  return (
    <div className="stage">
      <div className="frame" style={{ aspectRatio: `${VIEW_W}/${VIEW_H}` }}>
        <div ref={hostRef} className="phaser-host" />

        {/* HUD */}
        {inGame && (
          <div className="hud">
            <div className="hud-item">
              <span className="hud-label">SCORE</span>
              <motion.span
                key={hud.score}
                initial={{ scale: 1.25 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                className="hud-value"
              >
                {hud.score.toString().padStart(6, "0")}
              </motion.span>
            </div>
            <div className="hud-item">
              <Flower2 size={16} className="hud-ico" />
              <span className="hud-value">{hud.flowers}</span>
            </div>
            <div className="hud-item love-meter" title="love">
              <Heart size={14} className="hud-ico love" />
              <span className="love-bar">
                <motion.span
                  className="love-fill"
                  style={{ width: `${hud.love}%` }}
                  animate={{ width: `${hud.love}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </span>
            </div>
            <div className="hud-item">
              <Timer size={14} className="hud-ico dim" />
              <span className={`hud-value ${hud.time <= 30 ? "low" : ""}`}>{hud.time}</span>
            </div>
            <div className="hud-item">
              <Heart size={14} className="hud-ico dim" />
              <span className="hud-value">{hud.lives}</span>
            </div>
            {hud.mega && (
              <motion.div
                className="hud-item mega"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                <Star size={14} className="hud-ico" />
                <span className="hud-value">{Math.ceil(hud.megaTimer)}</span>
              </motion.div>
            )}
            <button className="icon-btn" onClick={toggleMute} title="mute (M)">
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        )}

        {/* Touch controls */}
        {inGame && touch && landscape && (
          <div className="touch">
            <div className="touch-left">
              <button className="tbtn tdir" onPointerDown={() => press("left", true)} onPointerUp={() => press("left", false)} onPointerLeave={() => press("left", false)} aria-label="left">
                <ChevronLeft size={30} />
              </button>
              <button className="tbtn tdir" onPointerDown={() => press("right", true)} onPointerUp={() => press("right", false)} onPointerLeave={() => press("right", false)} aria-label="right">
                <ChevronRight size={30} />
              </button>
            </div>
            <div className="touch-right">
              <button className="tbtn taction" onPointerDown={() => press("a", true)} onPointerUp={() => press("a", false)} onPointerLeave={() => press("a", false)} aria-label="throw">
                <Zap size={26} />
              </button>
              <button className="tbtn tjump" onPointerDown={() => press("jump", true)} onPointerUp={() => press("jump", false)} onPointerLeave={() => press("jump", false)} aria-label="jump">
                <ArrowUp size={34} />
              </button>
            </div>
          </div>
        )}

        {/* Landscape prompt */}
        {touch && !landscape && inGame && (
          <div className="overlay landscape-prompt">
            <div className="card">
              <Smartphone size={44} className="big-ico" />
              <h2>Rotate your device</h2>
              <p>Stitch: Lilo's Island is played in landscape. Turn your phone sideways to continue.</p>
            </div>
          </div>
        )}

        {/* Animated overlay cards */}
        <AnimatePresence>
          {phase === "title" && ready && (
            <motion.div
              key="title"
              className="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                className="title-card"
                variants={titleCardVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="title-badge">A 626 ADVENTURE</div>
                <h1>
                  STITCH<span>Lilo's Island</span>
                </h1>
                <p className="sub">Run, jump & rescue on Lilo's Island. Ohana means family.</p>
                <div className="controls-legend">
                  <span><b>←→</b> / <b>A D</b> move</span>
                  <span><b>↑</b> / <b>Space</b> jump</span>
                  <span><b>Shift</b> / <b>K</b> throw (when mega)</span>
                  <span><b>P</b> pause · <b>M</b> mute</span>
                </div>
                <button className="btn primary" onClick={() => { engineRef.current?.audio.init(); engineRef.current?.audio.resume(); engineRef.current?.start(); }}>
                  <Play size={16} style={{ verticalAlign: "-2px" }} /> START ADVENTURE
                </button>
              </motion.div>
            </motion.div>
          )}

          {phase === "paused" && (
            <motion.div key="pause" className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                className="card"
                initial={{ scale: 0.85, y: 18 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.85, y: 18 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
              >
                <Pause size={36} className="big-ico" />
                <h2>Paused</h2>
                <p>Ohana takes a breather.</p>
                <div className="row">
                  <button className="btn primary" onClick={() => engineRef.current?.resume()}>
                    <Play size={14} style={{ verticalAlign: "-2px" }} /> Resume
                  </button>
                  <button className="btn" onClick={() => engineRef.current?.restart()}>
                    <RotateCcw size={14} style={{ verticalAlign: "-2px" }} /> Restart
                  </button>
                  <button className="btn" onClick={toggleMute}>
                    {muted ? <VolumeX size={14} style={{ verticalAlign: "-2px" }} /> : <Volume2 size={14} style={{ verticalAlign: "-2px" }} />}
                    {muted ? " Unmute" : " Mute"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {phase === "won" && (
            <motion.div key="won" className="overlay win-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 1.4, duration: 0.6 }}>
              <motion.div
                className="card love-card"
                initial={{ scale: 0.85, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 1.6 }}
              >
                <motion.div
                  className="love-heart"
                  initial={{ scale: 0, rotate: -12 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 14, delay: 1.9 }}
                >
                  <Heart size={44} fill="#f27bb8" className="big-ico" />
                </motion.div>
                <h2 className="win">for {LOVE_LETTER.to}</h2>
                <p className="love-msg">{LOVE_LETTER.message}</p>
                <div className="stats">
                  <span>Orchids <b>{hud.flowers}</b></span>
                  <span>Love <b>{hud.love}%</b></span>
                </div>
                <button className="btn primary" onClick={() => engineRef.current?.restart()}>
                  <RotateCcw size={14} style={{ verticalAlign: "-2px" }} /> Play It Again, Together
                </button>
              </motion.div>
            </motion.div>
          )}

          {phase === "gameover" && (
            <motion.div key="gameover" className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                className="card"
                initial={{ scale: 0.8, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                <HeartCrack size={40} className="big-ico" />
                <h2>Ohana got a little tough...</h2>
                <p>Stitch lost all his lives on the island. Don't give up — family sticks together.</p>
                <div className="stats">
                  <span>Score <b>{hud.score}</b></span>
                  <span>Orchids <b>{hud.flowers}</b></span>
                </div>
                <button className="btn primary" onClick={() => engineRef.current?.restart()}>
                  <RotateCcw size={14} style={{ verticalAlign: "-2px" }} /> Try Again
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLS,
  createGame,
  GameState,
  InputState,
  nextLevel,
  restartGame,
  ROWS,
  updateGame,
} from "@/lib/tank-game";
import { drawGame } from "@/lib/renderer";

type Hud = {
  score: number;
  lives: number;
  level: number;
  remaining: number;
  status: GameState["status"];
};

const KEY_MAP: Record<string, keyof InputState> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "fire",
  KeyJ: "fire",
  KeyK: "fire",
};

export default function TankGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({ up: false, down: false, left: false, right: false, fire: false });
  const pausedRef = useRef(false);
  const [hud, setHud] = useState<Hud>({ score: 0, lives: 3, level: 1, remaining: 10, status: "playing" });
  const [paused, setPaused] = useState(false);
  const [scale, setScale] = useState(1);

  // 初始化游戏
  useEffect(() => {
    stateRef.current = createGame(1);
  }, []);

  // 自适应尺寸
  useEffect(() => {
    const resize = () => {
      if (!wrapRef.current) return;
      const rect = wrapRef.current.getBoundingClientRect();
      const maxW = rect.width;
      const maxH = window.innerHeight - 190;
      const s = Math.max(0.5, Math.min(maxW / (COLS * 16), maxH / (ROWS * 16)));
      setScale(Math.floor(s * 100) / 100);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // 主循环
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let last = performance.now();
    let hudTick = 0;

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const state = stateRef.current;
      if (!state) {
        raf = requestAnimationFrame(loop);
        return;
      }

      if (!pausedRef.current) updateGame(state, inputRef.current, dt);
      drawGame(ctx, state, scale, dpr);

      hudTick += dt;
      if (hudTick > 0.1) {
        hudTick = 0;
        setHud((prev) => {
          const next = {
            score: state.score,
            lives: state.lives,
            level: state.level,
            remaining: Math.max(0, state.remaining),
            status: state.status,
          };
          if (
            prev.score === next.score &&
            prev.lives === next.lives &&
            prev.level === next.level &&
            prev.remaining === next.remaining &&
            prev.status === next.status
          )
            return prev;
          return next;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scale]);

  // canvas 尺寸
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = COLS * 16 * scale * dpr;
    canvas.height = ROWS * 16 * scale * dpr;
    canvas.style.width = `${COLS * 16 * scale}px`;
    canvas.style.height = `${ROWS * 16 * scale}px`;
  }, [scale]);

  // 键盘
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) {
        e.preventDefault();
        inputRef.current[key] = true;
      }
      if (e.code === "KeyP" || e.code === "Escape") {
        e.preventDefault();
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = KEY_MAP[e.code];
      if (key) {
        e.preventDefault();
        inputRef.current[key] = false;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);

  const onNextLevel = () => {
    const state = stateRef.current;
    if (!state) return;
    nextLevel(state);
    pausedRef.current = false;
    setPaused(false);
    inputRef.current = { up: false, down: false, left: false, right: false, fire: false };
  };

  const onRestart = () => {
    const state = stateRef.current;
    if (!state) return;
    restartGame(state);
    pausedRef.current = false;
    setPaused(false);
    inputRef.current = { up: false, down: false, left: false, right: false, fire: false };
  };

  const touchProps = (key: Exclude<keyof InputState, "fire">) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      inputRef.current[key] = true;
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      inputRef.current[key] = false;
    },
    onPointerLeave: () => {
      inputRef.current[key] = false;
    },
    onPointerCancel: () => {
      inputRef.current[key] = false;
    },
  });

  const fireProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      inputRef.current.fire = true;
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      inputRef.current.fire = false;
    },
    onPointerLeave: () => {
      inputRef.current.fire = false;
    },
  };

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* HUD */}
      <div className="flex w-full max-w-[720px] flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 font-mono text-sm shadow-lg backdrop-blur">
        <div className="flex items-center gap-4">
          <span className="text-amber-300">
            SCORE <b className="text-amber-100">{hud.score.toString().padStart(6, "0")}</b>
          </span>
          <span className="text-emerald-300">
            LEVEL <b className="text-emerald-100">{hud.level}</b>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sky-300">
            LIVES{" "}
            <b className="text-sky-100">
              {"♥".repeat(Math.max(0, hud.lives))}
              <span className="opacity-25">{"♡".repeat(Math.max(0, 3 - hud.lives))}</span>
            </b>
          </span>
          <span className="text-rose-300">
            ENEMY <b className="text-rose-100">{hud.remaining.toString().padStart(2, "0")}</b>
          </span>
        </div>
      </div>

      {/* 画布 */}
      <div ref={wrapRef} className="relative flex w-full max-w-[720px] justify-center">
        <div className="relative overflow-hidden rounded-xl border border-white/10 shadow-[0_0_60px_-10px_rgba(250,204,21,0.35)]">
          <canvas ref={canvasRef} className="block touch-none select-none" />

          {paused && hud.status === "playing" && (
            <Overlay>
              <h2 className="text-3xl font-black tracking-[0.3em] text-amber-200">PAUSED</h2>
              <button
                onClick={togglePause}
                className="mt-6 rounded-lg bg-amber-400 px-6 py-2.5 font-bold text-black transition hover:bg-amber-300 active:scale-95"
              >
                继续游戏
              </button>
            </Overlay>
          )}

          {hud.status === "won" && (
            <Overlay>
              <h2 className="text-4xl font-black tracking-[0.2em] text-emerald-300 drop-shadow-[0_0_20px_rgba(52,211,153,0.7)]">
                LEVEL CLEAR
              </h2>
              <p className="mt-3 font-mono text-lg text-emerald-100">得分 {hud.score}</p>
              <button
                onClick={onNextLevel}
                className="mt-6 rounded-lg bg-emerald-400 px-6 py-2.5 font-bold text-black transition hover:bg-emerald-300 active:scale-95"
              >
                进入第 {hud.level + 1} 关 →
              </button>
            </Overlay>
          )}

          {hud.status === "lost" && (
            <Overlay>
              <h2 className="text-4xl font-black tracking-[0.25em] text-rose-500 drop-shadow-[0_0_20px_rgba(244,63,94,0.7)]">
                GAME OVER
              </h2>
              <p className="mt-3 font-mono text-lg text-rose-100">最终得分 {hud.score}</p>
              <button
                onClick={onRestart}
                className="mt-6 rounded-lg bg-rose-500 px-6 py-2.5 font-bold text-white transition hover:bg-rose-400 active:scale-95"
              >
                重新开始
              </button>
            </Overlay>
          )}
        </div>
      </div>

      {/* 操作说明 */}
      <div className="flex w-full max-w-[720px] flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
          <span>
            <Kbd>W</Kbd>
            <Kbd>A</Kbd>
            <Kbd>S</Kbd>
            <Kbd>D</Kbd> / 方向键 移动
          </span>
          <span>
            <Kbd>Space</Kbd> 开火
          </span>
          <span>
            <Kbd>P</Kbd> 暂停
          </span>
        </div>
        <button
          onClick={togglePause}
          className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-slate-300 transition hover:bg-white/10"
        >
          {paused ? "▶ 继续" : "❚❚ 暂停"}
        </button>
      </div>

      {/* 移动端虚拟按键 */}
      <div className="mt-1 flex w-full max-w-[720px] items-end justify-between gap-6 md:hidden">
        <div className="grid grid-cols-3 grid-rows-3 gap-1.5">
          <div />
          <TouchBtn {...touchProps("up")}>▲</TouchBtn>
          <div />
          <TouchBtn {...touchProps("left")}>◀</TouchBtn>
          <div />
          <TouchBtn {...touchProps("right")}>▶</TouchBtn>
          <div />
          <TouchBtn {...touchProps("down")}>▼</TouchBtn>
          <div />
        </div>
        <button
          {...fireProps}
          className="h-20 w-20 touch-none select-none rounded-full border-2 border-amber-300/60 bg-amber-400/20 font-bold text-amber-200 shadow-lg backdrop-blur active:scale-95 active:bg-amber-400/40"
        >
          FIRE
        </button>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      {children}
    </div>
  );
}

function TouchBtn({ children, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      {...props}
      className="h-14 w-14 touch-none select-none rounded-lg border border-white/15 bg-white/10 font-bold text-slate-200 backdrop-blur active:scale-95 active:bg-white/25"
    >
      {children}
    </button>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-block rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">
      {children}
    </kbd>
  );
}

import TankGame from "@/components/TankGame";

export default function Home() {
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center gap-5 overflow-hidden bg-slate-950 px-4 py-6">
      {/* 背景光效 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-0 h-96 w-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-sky-500/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(148,163,184,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.6) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <header className="relative z-10 flex flex-col items-center">
        <h1 className="bg-gradient-to-r from-amber-200 via-yellow-400 to-orange-500 bg-clip-text text-4xl font-black tracking-[0.18em] text-transparent drop-shadow-[0_0_25px_rgba(250,204,21,0.35)] sm:text-5xl">
          坦克大战
        </h1>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.5em] text-slate-400">
          Next.js · Canvas · TANK BATTLE
        </p>
      </header>

      <div className="relative z-10 flex w-full justify-center">
        <TankGame />
      </div>
    </main>
  );
}

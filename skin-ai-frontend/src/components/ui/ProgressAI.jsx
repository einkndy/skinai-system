import { motion } from "framer-motion";

export default function ProgressAI({
  progress = 0,
  currentStep = "",
  estimatedTime = "",
}) {
  const value = Math.max(0, Math.min(100, Number(progress) || 0));

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-5 sm:p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]"
      initial={{
        opacity: 0,
        y: 14,
      }}
      animate={{
        opacity: 1,
        y: [0, -4, 0],
      }}
      transition={{
        opacity: {
          duration: 0.3,
        },
        y: {
          repeat: Infinity,
          duration: 4,
          ease: "easeInOut",
        },
      }}
    >
      <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
      <div className="absolute -bottom-16 left-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />

      <div className="relative">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)] animate-pulse" />
              Proses Analisis
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {currentStep || "Menyiapkan pemeriksaan..."}
            </p>
          </div>

          <div className="text-right">
            <p className="text-4xl sm:text-5xl font-bold tracking-normal">
              {value}%
            </p>
            <p className="mt-1 text-xs font-medium text-slate-400">
              {estimatedTime || "Estimasi berjalan"}
            </p>
          </div>
        </div>

        <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-blue-400 shadow-[0_0_24px_rgba(34,211,238,0.55)]"
            initial={{
              width: 0,
            }}
            animate={{
              width: `${value}%`,
            }}
            transition={{
              duration: 0.45,
              ease: "easeOut",
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}

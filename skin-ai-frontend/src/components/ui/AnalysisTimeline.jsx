import { motion } from "framer-motion";

const statusConfig = {
  completed: {
    icon: "✓",
    dot: "bg-emerald-500 text-white",
    text: "text-emerald-700",
    card: "border-emerald-100 bg-emerald-50",
  },
  processing: {
    icon: "↻",
    dot: "bg-blue-600 text-white",
    text: "text-blue-700",
    card: "border-blue-100 bg-blue-50",
  },
  waiting: {
    icon: "•",
    dot: "bg-slate-200 text-slate-500",
    text: "text-slate-500",
    card: "border-slate-100 bg-slate-50",
  },
};

export default function AnalysisTimeline({ steps = [] }) {
  return (
    <motion.div
      className="space-y-3"
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: 0.08,
          },
        },
      }}
    >
      {steps.map((step) => {
        const config = statusConfig[step.status] || statusConfig.waiting;

        return (
          <motion.div
            key={step.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 ${config.card}`}
            variants={{
              hidden: {
                opacity: 0,
                y: 10,
              },
              show: {
                opacity: 1,
                y: 0,
              },
            }}
            transition={{
              duration: 0.25,
            }}
          >
            <motion.span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${config.dot}`}
              animate={
                step.status === "processing"
                  ? {
                      scale: [1, 1.08, 1],
                    }
                  : {
                      scale: 1,
                    }
              }
              transition={{
                repeat: step.status === "processing" ? Infinity : 0,
                duration: 1.1,
              }}
            >
              {config.icon}
            </motion.span>

            <div className="min-w-0">
              <p className={`font-bold ${config.text}`}>
                {step.title}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {step.status}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

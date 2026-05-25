import { motion } from "framer-motion";
import ButtonSpinner from "./ButtonSpinner";

export default function LoadingScreen({
  title = "Memuat Sistem",
  subtitle = "Mohon tunggu sebentar...",
  compact = false,
}) {
  return (
    <div className={`flex w-full items-center justify-center px-4 text-center ${compact ? "min-h-[132px] py-5" : "min-h-[320px] py-10"}`}>
      <div className="flex flex-col items-center">
        <motion.div
          className={`flex items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ${compact ? "h-11 w-11" : "h-14 w-14"}`}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.22 }}
        >
          <ButtonSpinner className={compact ? "h-5 w-5" : "h-6 w-6"} />
        </motion.div>

        <h2 className={`${compact ? "mt-4 text-lg" : "mt-6 text-2xl"} font-bold text-slate-800`}>
          {title}
        </h2>

        <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

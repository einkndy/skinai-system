import { motion } from "framer-motion";

export default function AnimatedPage({ children }) {
  return (
    <motion.div
      className="min-w-0"
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -6,
      }}
      transition={{
        duration: 0.26,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}

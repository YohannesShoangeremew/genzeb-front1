import { ReactNode } from "react";
import { motion } from "framer-motion";
import { TabBar } from "./TabBar";

interface Props {
  children: ReactNode;
  /** Show the bottom tab bar (hidden in game room / card select). */
  tabs?: boolean;
}

export function ScreenShell({ children, tabs = true }: Props) {
  return (
    <div className="flex min-h-screen flex-col">
      <motion.main
        className="flex flex-1 flex-col px-4 pb-4 pt-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {children}
      </motion.main>
      {tabs && <TabBar />}
    </div>
  );
}

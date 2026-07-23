"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedThemeTogglerProps {
  className?: string;
  duration?: number;
}

export function AnimatedThemeToggler({
  className,
  duration = 400,
}: AnimatedThemeTogglerProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setMounted(true);
    // Ler do localStorage e HTML diretamente
    const storedTheme = localStorage.getItem("exgrow-theme") as "light" | "dark" | null;
    const htmlHasDark = document.documentElement.classList.contains("dark");
    const initialTheme = storedTheme || (htmlHasDark ? "dark" : "light");
    setCurrentTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (mounted && resolvedTheme) {
      setCurrentTheme(resolvedTheme as "light" | "dark");
    }
  }, [resolvedTheme, mounted]);

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background",
          className
        )}
      />
    );
  }

  const isDark = currentTheme === "dark";

  const handleToggle = () => {
    const newTheme = isDark ? "light" : "dark";
    
    // Atualizar localStorage
    localStorage.setItem("exgrow-theme", newTheme);
    
    // Atualizar HTML diretamente
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    // Atualizar estado local
    setCurrentTheme(newTheme);
    
    // Tentar usar setTheme se disponível
    if (setTheme) {
      setTheme(newTheme);
    }
  };

  return (
    <motion.button
      onClick={handleToggle}
      className={cn(
        "relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-accent",
        className
      )}
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? 180 : 0,
          scale: isDark ? 0 : 1,
          opacity: isDark ? 0 : 1,
        }}
        transition={{
          duration: duration / 1000,
          ease: "easeInOut",
        }}
        className="absolute"
      >
        <Sun className="h-5 w-5 text-foreground" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{
          rotate: isDark ? 0 : -180,
          scale: isDark ? 1 : 0,
          opacity: isDark ? 1 : 0,
        }}
        transition={{
          duration: duration / 1000,
          ease: "easeInOut",
        }}
        className="absolute"
      >
        <Moon className="h-5 w-5 text-foreground" />
      </motion.div>
    </motion.button>
  );
}

export default AnimatedThemeToggler;

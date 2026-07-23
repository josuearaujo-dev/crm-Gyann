"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AnimatedThemeTogglerProps {
  className?: string;
}

export function AnimatedThemeToggler({
  className,
}: AnimatedThemeTogglerProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Ler tema do localStorage ou DOM
    const storedTheme = localStorage.getItem("exgrow-theme");
    const htmlClass = document.documentElement.classList.contains("dark");
    const currentTheme = storedTheme || (htmlClass ? "dark" : "light");
    setIsDark(currentTheme === "dark");
    console.log("[v0] Theme Toggler mounted. Current theme from storage:", currentTheme, "HTML has dark class:", htmlClass);
  }, []);

  if (!mounted) {
    return (
      <div
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background",
          className
        )}
      />
    );
  }

  const handleThemeToggle = () => {
    const newTheme = isDark ? "light" : "dark";
    console.log("[v0] Toggling theme from", isDark ? "dark" : "light", "to", newTheme);
    
    // Atualizar localStorage
    localStorage.setItem("exgrow-theme", newTheme);
    
    // Atualizar classe do HTML diretamente
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    
    // Atualizar estado
    setIsDark(newTheme === "dark");
    
    console.log("[v0] Theme updated. HTML classList:", document.documentElement.className);
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleThemeToggle}
      className={cn(
        "relative h-10 w-10 transition-all duration-300",
        className
      )}
      aria-label="Toggle theme"
    >
      <Sun className={cn(
        "h-5 w-5 transition-all duration-300",
        isDark ? "rotate-90 scale-0" : "rotate-0 scale-100"
      )} />
      <Moon className={cn(
        "absolute h-5 w-5 transition-all duration-300",
        isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0"
      )} />
    </Button>
  );
}

export default AnimatedThemeToggler;

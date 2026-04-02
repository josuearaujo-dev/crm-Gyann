"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Home,
  Kanban,
  BarChart3,
  Settings,
  LogOut,
  CalendarClock,
  CalendarCheck,
  FileText,
  Webhook,
  Moon,
  Sun,
  Users,
  Upload,
  CheckSquare,
} from "lucide-react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { AnimatedThemeToggler } from "@/components/magicui/animated-theme-toggler";

const navItems = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/dashboard/leads", label: "Todos os Leads", icon: Users },
  { href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/dashboard/import", label: "Importar Leads", icon: Upload },
  { href: "/dashboard/timeline", label: "Agenda Tasks", icon: CalendarClock },
  { href: "/dashboard/meetings", label: "Agenda Reuniões", icon: CalendarCheck },
  { href: "/dashboard/analytics", label: "Dashboard", icon: BarChart3 },
  { href: "/dashboard/reports", label: "Relatorios", icon: FileText },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/dashboard/settings", label: "Configurações", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isHovered, setIsHovered] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    // Implement logout logic here
  };

  const isExpanded = isHovered;

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-out relative z-20",
          isExpanded ? "w-56" : "w-[68px]"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Logo Header */}
        <div className="p-3 border-b border-sidebar-border h-16 flex items-center">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center transition-transform duration-200 hover:scale-105 flex-shrink-0 relative overflow-hidden">
              <Image
                src="/logo-exgrow.png"
                alt="EX GROW"
                width={40}
                height={40}
                className="object-contain p-1"
                priority
              />
            </div>
            <span className={cn(
              "font-bold text-sidebar-foreground text-lg tracking-tight whitespace-nowrap transition-all duration-300",
              isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none absolute"
            )}>
              EX GROW
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            
            const NavLink = (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative overflow-hidden",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                  )}
                  <item.icon className={cn(
                    "w-5 h-5 flex-shrink-0 transition-transform duration-200 relative z-10",
                    !isActive && "group-hover:scale-110"
                  )} />
                  <span className={cn(
                    "text-sm font-medium relative z-10 whitespace-nowrap transition-all duration-300",
                    isExpanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
                  )}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );

            if (!isExpanded) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{NavLink}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium bg-popover border-border">
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return NavLink;
          })}
        </nav>

        {/* Theme Toggle & Logout */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          {/* Theme Toggle */}
          {mounted && (
            <>
              {!isExpanded ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex justify-center">
                      <AnimatedThemeToggler className="hover:bg-sidebar-accent" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-popover border-border">
                    Alternar Tema
                  </TooltipContent>
                </Tooltip>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2">
                  <AnimatedThemeToggler className="hover:bg-sidebar-accent" />
                  <span className={cn(
                    "text-sm font-medium text-sidebar-foreground/70 whitespace-nowrap transition-all duration-300",
                    isExpanded ? "opacity-100" : "opacity-0"
                  )}>
                    Tema
                  </span>
                </div>
              )}
            </>
          )}

          {/* Logout */}
          {!isExpanded ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="w-full h-10 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-popover border-border">Sair</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors px-3"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span className={cn(
                "whitespace-nowrap transition-all duration-300",
                isExpanded ? "opacity-100" : "opacity-0"
              )}>Sair</span>
            </Button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}

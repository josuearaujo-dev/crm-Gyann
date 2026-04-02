"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export function LoadingScreen() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in após montar
    setIsVisible(true);
  }, []);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a] transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Background effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[96px] animate-pulse" />
      
      {/* Logo container */}
      <div className="relative z-10 flex flex-col items-center gap-8 animate-in fade-in duration-500">
        <div className="animate-pulse">
          <Image
            src="/logo-exgrow.png"
            alt="EX GROW"
            width={80}
            height={80}
            className="object-contain"
            priority
          />
        </div>
        
        {/* Loading indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

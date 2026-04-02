"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/20 rounded-full blur-[96px]" />
        
        <div className="relative z-10 flex flex-col justify-center items-center p-12 w-full h-full">
          {/* Large centered logo */}
          <div className="mb-12">
            <Image
              src="/logo-exgrow-full.png"
              alt="EX GROW"
              width={320}
              height={100}
              className="object-contain"
              priority
            />
          </div>
          
          {/* Tagline */}
          <div className="text-center space-y-4 mb-16">
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
              The Biggest <span className="text-primary">Gastronomic</span><br />
              Marketing Experts In The U.S.
            </h1>
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-12">
            <div className="text-center">
              <p className="text-4xl font-bold text-primary">EX5</p>
              <p className="text-white/50 text-sm mt-1">Method</p>
            </div>
            <div className="w-px h-16 bg-white/20" />
            <div className="text-center">
              <p className="text-4xl font-bold text-white">+610</p>
              <p className="text-white/50 text-sm mt-1">Restaurants Validated</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <div className="bg-[#1a1a1a] rounded-2xl p-4">
              <Image
                src="/logo-exgrow-full.png"
                alt="EX GROW"
                width={160}
                height={50}
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-white">Bem-vindo de volta</h2>
            <p className="text-white/50">Entre na sua conta para continuar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl animate-scale-in">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/70 text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/70 text-sm font-medium">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-semibold rounded-xl transition-all duration-200 group glow-primary" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-white/50">
            Nao tem uma conta?{" "}
            <Link
              href="/auth/signup"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

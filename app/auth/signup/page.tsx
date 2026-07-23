"use client";

import React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRight, CheckCircle2, ArrowLeft } from "lucide-react";
import Image from "next/image";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo:
          process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
          `${window.location.origin}/dashboard`,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <div className="w-full max-w-md space-y-8 animate-scale-in">
          <div className="text-center space-y-6">
            <div className="mx-auto w-20 h-20 bg-success/20 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-white">Verifique seu email</h2>
              <p className="text-white/50">
                Enviamos um link de confirmacao para
              </p>
              <p className="text-primary font-medium">{email}</p>
            </div>
          </div>
          <Link href="/auth/login">
            <Button variant="outline" className="w-full h-12 bg-transparent border-white/10 text-white hover:bg-white/5 rounded-xl">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0a]">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent" />
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
        <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary/30 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/3 right-1/3 w-64 h-64 bg-primary/20 rounded-full blur-[96px]" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <div>
            <Image
              src="/logo-exgrow-full.png"
              alt="EX GROW"
              width={180}
              height={60}
              className="object-contain"
              priority
            />
          </div>
          
          <div className="space-y-6">
            <h1 className="text-5xl font-bold text-white leading-tight">
              Comece a<br />
              <span className="text-primary">crescer</span> seu<br />
              negocio hoje
            </h1>
            <p className="text-white/60 text-lg max-w-md">
              Crie sua conta e tenha acesso completo ao CRM mais poderoso para gestao de leads.
            </p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="text-white/70">Pipeline visual intuitivo</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="text-white/70">Integracao com Meta Ads</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="text-white/70">Webhooks personalizados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Sign Up Form */}
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
            <h2 className="text-3xl font-bold text-white">Criar conta</h2>
            <p className="text-white/50">Preencha seus dados para comecar</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
            {error && (
              <div className="p-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl animate-scale-in">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-white/70 text-sm font-medium">
                Nome completo
              </Label>
              <Input
                id="fullName"
                type="text"
                placeholder="Seu nome"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-12 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 rounded-xl transition-all"
              />
            </div>
            
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
                placeholder="Minimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
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
                  Criando conta...
                </>
              ) : (
                <>
                  Criar conta
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-white/50">
            Ja tem uma conta?{" "}
            <Link
              href="/auth/login"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

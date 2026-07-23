# Deploy manual — CRM Exgrow

Pacote gerado em: **20260723-005049**

## O que este zip inclui

Código completo do CRM (app, components, lib, scripts SQL, public, configs).

## O que foi excluído (não precisa no GitHub)

- `node_modules` — reinstale com `pnpm install` ou `npm install`
- `.next` / build
- `.env` — **não sobe secrets**; crie no destino/Vercel
- `export/` e `deploy-temp/` — pastas de artefato local
- logs/relatórios temporários

## Migrations SQL importantes (rodar no Supabase se ainda não rodou)

1. `scripts/027_fix_webhook_logs_rls.sql`
2. `scripts/028_webhook_logs_reprocess_and_won_at.sql`

## Como subir no GitHub (manual)

```bash
# 1. Descompactar o zip numa pasta limpa
unzip full-project-20260723-005049.zip -d crm-with-meta-api
cd crm-with-meta-api

# 2. Instalar dependências
pnpm install
# ou: npm install

# 3. Criar .env local (não commitar)
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...

# 4. Git + push
git init
git add .
git commit -m "chore: sync full CRM project (webhooks, logs, lead timeline)"
git branch -M main
git remote add origin <URL_DO_SEU_REPOSITORIO>
git push -u origin main --force
# (use --force só se for substituir o remoto de propósito)
```

## Variáveis de ambiente necessárias

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_ROLE_KEY`

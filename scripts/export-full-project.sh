#!/usr/bin/env bash
# Pacote completo do projeto para primeiro upload no Git (ou backup).
# Exclui: node_modules, .next, .git, .env*, artefatos de export zip.
# Após descompactar: npm install (ou pnpm install) e criar .env
#
# Uso: ./scripts/export-full-project.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y%m%d-%H%M%S)"
NAME="full-project-$STAMP"
OUT_DIR="$ROOT/export"
ZIP_PATH="$OUT_DIR/$NAME.zip"
README_PATH="$OUT_DIR/${NAME}-LEIA-ME.txt"

mkdir -p "$OUT_DIR"

EXCLUDES=(
  --exclude='node_modules'
  --exclude='.next'
  --exclude='out'
  --exclude='build'
  --exclude='.vercel'
  --exclude='.git'
  --exclude='.env'
  --exclude='.env.*'
  --exclude='.DS_Store'
  --exclude='*.tsbuildinfo'
  --exclude='export/*.zip'
)

if command -v rsync >/dev/null 2>&1; then
  STAGE="$OUT_DIR/$NAME-staging"
  rm -rf "$STAGE"
  mkdir -p "$STAGE"
  rsync -a "${EXCLUDES[@]}" "$ROOT/" "$STAGE/"
  rm -f "$ZIP_PATH"
  ( cd "$STAGE" && zip -r -q "$ZIP_PATH" . )
  rm -rf "$STAGE"
else
  echo "rsync não encontrado; gerando .tar.gz (mesmas exclusões)."
  TAR_PATH="$OUT_DIR/$NAME.tar.gz"
  rm -f "$TAR_PATH"
  tar -czf "$TAR_PATH" \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='out' \
    --exclude='build' \
    --exclude='.vercel' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='.env.*' \
    --exclude='.DS_Store' \
    --exclude='*.tsbuildinfo' \
    --exclude='export/*.zip' \
    -C "$ROOT" .
  ZIP_PATH="$TAR_PATH"
fi

cat > "$README_PATH" << EOF
Pacote gerado em: $STAMP
Origem: $ROOT

Inclui todo o código e configs do projeto, exceto:
  - node_modules (reinstale com npm install ou pnpm install)
  - .next / out / build
  - .git (faça git init no destino se for repositório novo)
  - .env (crie no destino com suas chaves Supabase etc.)
  - zips antigos em export/*.zip

Arquivo principal:
  $ZIP_PATH

Passos sugeridos após descompactar:
  1. npm install   ou   pnpm install
  2. Criar arquivo .env (variáveis do Supabase / Next)
  3. git init
  4. git add .
  5. git commit -m "Initial commit"
  6. git branch -M main
  7. git remote add origin <URL_DO_REPOSITORIO>
  8. git push -u origin main
EOF

echo ""
echo "Arquivo:  $ZIP_PATH"
echo "LEIA-ME:  $README_PATH"
if [[ -f "$ZIP_PATH" ]]; then
  echo "Tamanho:  $(du -h "$ZIP_PATH" | cut -f1)"
fi

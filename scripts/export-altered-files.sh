#!/usr/bin/env bash
# Empacota arquivos alterados nesta branch de trabalho (lista explícita + opcional git).
# Uso: ./scripts/export-altered-files.sh
# Saída: export/manual-git-upload-YYYYMMDD-HHMMSS/ e .zip na mesma pasta

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$ROOT/export/manual-git-upload-$STAMP"
ZIP_PATH="$ROOT/export/manual-git-upload-$STAMP.zip"

# Lista dos arquivos alterados nesta sessão de desenvolvimento (caminhos relativos à raiz do projeto).
# Adicione linhas aqui se mudar mais arquivos antes de exportar de novo.
MANIFEST_FILES=(
  ".gitignore"
  ".npmrc"
  "app/dashboard/page.tsx"
  "app/dashboard/reports/page.tsx"
  "components/crm/calendar-view.tsx"
  "components/crm/campaign-manager.tsx"
  "components/crm/home-content.tsx"
  "components/crm/lead-detail.tsx"
  "components/crm/leads-table.tsx"
  "components/crm/meeting-modal.tsx"
  "components/crm/meetings-calendar-view.tsx"
  "components/crm/pipeline-board.tsx"
  "components/crm/reports-dashboard.tsx"
  "lib/pipeline-utils.ts"
  "lib/report-finance.ts"
  "lib/types.ts"
  "package.json"
  "pnpm-lock.yaml"
  "scripts/024_add_lead_payment_fields.sql"
  "scripts/025_lead_installments.sql"
  "scripts/export-altered-files.sh"
  "scripts/export-full-project.sh"
)

mkdir -p "$OUT_DIR"

{
  echo "# Export manual Git — $STAMP"
  echo "# Raiz do projeto: $ROOT"
  echo ""
} > "$OUT_DIR/README-EXPORT.txt"

MISSING=0
for rel in "${MANIFEST_FILES[@]}"; do
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$OUT_DIR/$(dirname "$rel")"
    cp -p "$ROOT/$rel" "$OUT_DIR/$rel"
    echo "OK  $rel" >> "$OUT_DIR/README-EXPORT.txt"
  else
    echo "FALTANDO (não copiado): $rel" >> "$OUT_DIR/README-EXPORT.txt"
    MISSING=$((MISSING + 1))
  fi
done

# Se for repositório git, acrescenta ao README o que o git considera modificado (referência)
if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  {
    echo ""
    echo "--- git status --short (referência) ---"
    git -C "$ROOT" status --short || true
  } >> "$OUT_DIR/README-EXPORT.txt"
fi

mkdir -p "$ROOT/export"
( cd "$ROOT/export" && zip -r -q "manual-git-upload-$STAMP.zip" "manual-git-upload-$STAMP" )

echo ""
echo "Pasta: $OUT_DIR"
echo "Zip:   $ZIP_PATH"
if [[ "$MISSING" -gt 0 ]]; then
  echo "Aviso: $MISSING arquivo(s) da lista não existiam no disco — veja README-EXPORT.txt"
  exit 1
fi
echo "Pronto. Substitua os arquivos no repositório remoto/local e faça commit."

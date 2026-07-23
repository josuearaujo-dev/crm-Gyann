type LeadMetadata = Record<string, unknown> | null | undefined;

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/** Ignora índices numéricos de select do Elementor (ex.: "1", "2"). */
const LEGACY_REVENUE_OPTIONS = [
  "Até 20.000",
  "De 20.000 até 50.000",
  "De 60.000 +",
];

function resolveLegacyRevenueIndex(value: string): string | null {
  if (!/^\d+$/.test(value)) return null;
  const index = Number.parseInt(value, 10);
  if (index >= 1 && index <= LEGACY_REVENUE_OPTIONS.length) {
    return LEGACY_REVENUE_OPTIONS[index - 1];
  }
  return null;
}

function looksLikeRevenueLabel(value: string): boolean {
  return /(\d[\d.,]*|até|de\s+\d|up to|\+)/i.test(value);
}

function isLikelySelectIndex(value: string): boolean {
  return /^\d{1,2}$/.test(value);
}

function pickReadableMetadataValue(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text || isLikelySelectIndex(text) || isUuidLike(text)) return null;
  return text;
}

export function resolveElementorFieldValue(
  body: Record<string, string>,
  fieldId: string,
  value: string,
): string {
  const rawValue = normalizeText(body[`fields[${fieldId}][raw_value]`]);
  const normalizedValue = normalizeText(value);

  if (
    rawValue &&
    normalizedValue &&
    isLikelySelectIndex(normalizedValue) &&
    rawValue !== normalizedValue
  ) {
    return rawValue;
  }

  if (rawValue && !normalizedValue) return rawValue;
  return normalizedValue || rawValue;
}

export function getLeadFaturamentoDisplay(metadata: LeadMetadata): string | null {
  if (!metadata || typeof metadata !== "object") return null;

  const priorityKeys = [
    "faturamento_mensal_label",
    "monthly_revenue_label",
    "faturamento_mensal",
    "faturamento",
    "Monthly Revenue",
    "Monthly Revenue?",
    "Faturamento Mensal",
    "monthly_revenue",
    "Qual é o seu faturamento mensal?",
    "What is your monthly revenue?",
  ];

  for (const key of priorityKeys) {
    const label = pickReadableMetadataValue(metadata[key]);
    if (label) return label;
  }

  for (const [key, value] of Object.entries(metadata)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("revenue") || keyLower.includes("faturamento")) {
      const label = pickReadableMetadataValue(value);
      if (label) return label;
    }
  }

  const legacyFromFaturamento = resolveLegacyRevenueIndex(
    normalizeText(metadata.faturamento),
  );
  if (legacyFromFaturamento) return legacyFromFaturamento;

  for (const value of Object.values(metadata)) {
    const text = normalizeText(value);
    if (text && looksLikeRevenueLabel(text) && !isLikelySelectIndex(text) && !isUuidLike(text)) {
      return text;
    }
  }

  return null;
}

export function getLeadSegmentoDisplay(metadata: LeadMetadata): string | null {
  if (!metadata || typeof metadata !== "object") return null;

  const priorityKeys = [
    "segmento_label",
    "segmento",
    "Business Type?",
    "Business Type",
    "segment",
    "Segmento",
  ];

  for (const key of priorityKeys) {
    const label = pickReadableMetadataValue(metadata[key]);
    if (label) return label;
  }

  for (const [key, value] of Object.entries(metadata)) {
    const keyLower = key.toLowerCase();
    if (
      keyLower.includes("segment") ||
      keyLower.includes("segmento") ||
      keyLower.includes("business type")
    ) {
      const label = pickReadableMetadataValue(value);
      if (label) return label;
    }
  }

  return null;
}

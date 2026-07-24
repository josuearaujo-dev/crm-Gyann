import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveElementorFieldValue } from "@/lib/lead-metadata-display";

/** Aceita UUIDs gerados pelo Postgres (qualquer variante/versão). */
const UUID_LOOSE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return UUID_LOOSE_REGEX.test(trimmed);
}

function normalizeFieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

function isSegmentField(label: string): boolean {
  const lower = label.toLowerCase();
  const norm = normalizeFieldKey(label);
  return (
    lower.includes("segment") ||
    lower.includes("segmento") ||
    lower.includes("business type") ||
    norm === "businesstype" ||
    lower === "what is your segment?" ||
    lower === "qual é o seu segmento?"
  );
}

function isRevenueField(label: string): boolean {
  const lower = label.toLowerCase();
  const norm = normalizeFieldKey(label);
  return (
    lower.includes("revenue") ||
    lower.includes("faturamento") ||
    norm.includes("monthlyrevenue") ||
    lower === "what is your monthly revenue?" ||
    lower === "qual é o seu faturamento mensal?"
  );
}

export function extractElementorFields(body: Record<string, string>) {
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let company: string | null = null;
  let segment: string | null = null;
  let revenue: string | null = null;
  const metadata: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    const keyLower = key.toLowerCase();
    const keyNorm = normalizeFieldKey(key);
    const val = String(value).trim();

    if (!val) continue;

    if (keyNorm === "email" || keyNorm === "emailaddress" || keyNorm === "mail") {
      email = val;
      continue;
    }

    if (
      keyNorm === "telephone" ||
      keyNorm === "phone" ||
      keyNorm === "telefone" ||
      keyNorm === "phonenumber" ||
      keyNorm === "tel" ||
      keyNorm === "cellphone" ||
      keyNorm === "mobile" ||
      keyNorm.includes("whatsapp")
    ) {
      phone = val;
      continue;
    }

    if (
      keyNorm === "companyname" ||
      keyNorm === "nomedaempresa" ||
      keyNorm === "company" ||
      keyNorm === "empresa" ||
      keyNorm === "businessname"
    ) {
      company = val;
      continue;
    }

    if (
      !keyNorm.includes("company") &&
      !keyNorm.includes("empresa") &&
      (keyNorm === "name" ||
        keyNorm === "nome" ||
        keyNorm === "fullname" ||
        keyNorm === "yourname" ||
        keyNorm === "firstname" ||
        keyNorm === "lastname" ||
        keyNorm === "contactname")
    ) {
      if (keyNorm === "lastname" && name) {
        name = `${name} ${val}`.trim();
      } else if (keyNorm === "firstname" && name && !name.includes(val)) {
        name = `${val} ${name}`.trim();
      } else if (!name || keyNorm !== "lastname") {
        name = val;
      }
      continue;
    }

    if (isSegmentField(key)) {
      segment = val;
      continue;
    }

    if (isRevenueField(key)) {
      revenue = val;
      continue;
    }

    if (
      keyLower === "form_id" ||
      keyLower === "form_name" ||
      keyLower === "data" ||
      keyLower === "horário" ||
      keyLower === "url da página" ||
      keyLower === "ip remoto" ||
      keyLower.includes("desenvolvido por") ||
      keyLower.includes("agente de usuário")
    ) {
      metadata[key] = val;
    }
  }

  const needsNested =
    (!name && !email && !phone && !company) || !segment || !revenue;

  if (needsNested) {
    const fields: { id: string; title: string; value: string; type: string }[] =
      [];

    for (const key of Object.keys(body)) {
      const valueMatch = key.match(/^fields\[([^\]]+)\]\[value\]$/);
      if (valueMatch) {
        const fieldId = valueMatch[1];
        const title = body[`fields[${fieldId}][title]`] || "";
        const type = body[`fields[${fieldId}][type]`] || "";
        const value = resolveElementorFieldValue(body, fieldId, body[key] || "");
        fields.push({ id: fieldId, title, value, type });
      }
    }

    for (const field of fields) {
      const titleLower = field.title.toLowerCase();
      const titleNorm = normalizeFieldKey(field.title);
      const idNorm = normalizeFieldKey(field.id);

      if (
        !email &&
        (field.type === "email" ||
          titleNorm.includes("email") ||
          idNorm === "email" ||
          idNorm === "emailaddress")
      ) {
        email = field.value;
        continue;
      }

      if (
        !phone &&
        (field.type === "tel" ||
          titleNorm.includes("phone") ||
          titleNorm.includes("tel") ||
          titleNorm.includes("whatsapp") ||
          idNorm.includes("phone") ||
          idNorm.includes("tel") ||
          idNorm.includes("whatsapp"))
      ) {
        phone = field.value;
        continue;
      }

      if (
        !company &&
        (titleNorm.includes("company") ||
          titleNorm.includes("empresa") ||
          idNorm.includes("company"))
      ) {
        company = field.value;
        continue;
      }

      if (
        !name &&
        !titleNorm.includes("company") &&
        !titleNorm.includes("empresa") &&
        (idNorm === "name" ||
          titleNorm === "name" ||
          titleNorm === "nome" ||
          titleNorm === "fullname" ||
          titleNorm === "yourname" ||
          titleNorm.includes("fullname") ||
          titleLower === "name" ||
          titleLower === "nome")
      ) {
        name = field.value;
        continue;
      }

      if (!segment && isSegmentField(field.title)) {
        segment = field.value;
        continue;
      }

      if (!revenue && isRevenueField(field.title)) {
        revenue = field.value;
        continue;
      }

      if (field.value) {
        metadata[field.title || field.id] = field.value;
      }
    }

    if (body["form[name]"]) metadata.form_name = body["form[name]"];
    if (body["form[id]"]) metadata.form_id = body["form[id]"];
    if (body["meta[date][value]"])
      metadata.submission_date = body["meta[date][value]"];
    if (body["meta[time][value]"])
      metadata.submission_time = body["meta[time][value]"];
    if (body["meta[page_url][value]"])
      metadata.page_url = body["meta[page_url][value]"];
    if (body["meta[remote_ip][value]"])
      metadata.remote_ip = body["meta[remote_ip][value]"];
  }

  if (segment) {
    metadata.segmento = segment;
    metadata.segmento_label = segment;
  }
  if (revenue) {
    metadata.faturamento = revenue;
    metadata.faturamento_mensal = revenue;
    metadata.faturamento_mensal_label = revenue;
    metadata.monthly_revenue = revenue;
  }

  return { name, email, phone, company, segment, revenue, metadata };
}

export type CreateLeadResult =
  | {
      success: true;
      leadId: string;
      lead: { id: string; name: string; email: string | null };
    }
  | {
      success: false;
      error: string;
      code?: string;
      details?: string;
      existingLead?: { id: string; name: string; email: string | null };
    };

export interface CreateLeadOptions {
  columnId?: string | null;
  assignedTo?: string | null;
  forceDuplicate?: boolean;
  overrides?: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    company_name?: string;
    segmento?: string;
    faturamento_mensal?: string;
  };
  extraMetadata?: Record<string, unknown>;
}

export async function createLeadFromElementorBody(
  supabase: SupabaseClient,
  sourceId: string,
  body: Record<string, string>,
  options: CreateLeadOptions | Record<string, unknown> = {},
): Promise<CreateLeadResult> {
  const opts: CreateLeadOptions =
    options &&
    typeof options === "object" &&
    ("extraMetadata" in options ||
      "overrides" in options ||
      "columnId" in options ||
      "forceDuplicate" in options ||
      "assignedTo" in options)
      ? (options as CreateLeadOptions)
      : { extraMetadata: options as Record<string, unknown> };

  if (!isValidUuid(sourceId)) {
    return {
      success: false,
      error: `O parâmetro source recebido não é um UUID válido: "${sourceId}". Verifique se a URL do webhook está completa.`,
      code: "INVALID_SOURCE_UUID",
    };
  }

  const extracted = extractElementorFields(body);
  const overrides = opts.overrides || {};

  const name = overrides.name?.trim() || extracted.name;
  const email = overrides.email?.trim() || extracted.email;
  const phone = overrides.phone?.trim() || extracted.phone;
  const company =
    overrides.company?.trim() ||
    overrides.company_name?.trim() ||
    extracted.company;
  const segment = overrides.segmento?.trim() || extracted.segment;
  const revenue =
    overrides.faturamento_mensal?.trim() || extracted.revenue;

  if (!name && !email) {
    return {
      success: false,
      error: "Não foi possível extrair nome ou e-mail do payload do formulário",
      code: "LEAD_VALIDATION",
    };
  }

  const { data: source, error: sourceError } = await supabase
    .from("lead_sources")
    .select("id, created_by")
    .eq("id", sourceId)
    .single();

  if (sourceError || !source) {
    return {
      success: false,
      error: "Fonte de leads não encontrada no CRM",
      code: "SOURCE_NOT_FOUND",
      details: sourceError?.message,
    };
  }

  if (!opts.forceDuplicate && email) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id, name, email")
      .eq("email", email)
      .eq("source_id", sourceId)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: "Já existe um lead com este e-mail nesta fonte",
        code: "POSSIBLE_DUPLICATE",
        existingLead: existing,
      };
    }
  }

  let columnId: string | null = opts.columnId || null;

  if (columnId && !isValidUuid(columnId)) {
    columnId = null;
  }

  // Pipeline compartilhada: a maioria das colunas tem created_by = null.
  // Filtrar por created_by do usuário fazia cair em "Proposta feita" (única do user).
  // Preferir "Novo Lead" ou a menor position global.
  if (!columnId) {
    const { data: novoLeadCol } = await supabase
      .from("pipeline_columns")
      .select("id")
      .ilike("name", "novo lead")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();
    columnId = novoLeadCol?.id || null;
  }

  if (!columnId) {
    const { data: col } = await supabase
      .from("pipeline_columns")
      .select("id")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    columnId = col?.id || null;
  }

  // Sem coluna válida o lead existe mas some da pipeline (board filtra por column_id)
  if (!columnId) {
    return {
      success: false,
      error:
        "Nenhuma coluna de pipeline encontrada. Crie ao menos uma etapa no funil antes de recuperar o lead.",
      code: "NO_PIPELINE_COLUMN",
    };
  }

  // Confirmar que a coluna existe (evita FK inválida / hardcode morto)
  const { data: columnExists } = await supabase
    .from("pipeline_columns")
    .select("id")
    .eq("id", columnId)
    .maybeSingle();

  if (!columnExists) {
    return {
      success: false,
      error:
        "A coluna de pipeline selecionada não existe mais. Atualize o funil e tente novamente.",
      code: "PIPELINE_COLUMN_NOT_FOUND",
    };
  }

  const metadata: Record<string, unknown> = {
    ...extracted.metadata,
    ...(opts.extraMetadata || {}),
  };

  if (segment) {
    metadata.segmento = segment;
    metadata.segmento_label = segment;
  }
  if (revenue) {
    metadata.faturamento = revenue;
    metadata.faturamento_mensal = revenue;
    metadata.faturamento_mensal_label = revenue;
    metadata.monthly_revenue = revenue;
  }

  const leadData: Record<string, unknown> = {
    name: name || email,
    email: email || null,
    phone: phone || null,
    company: company || null,
    source_id: sourceId,
    column_id: columnId,
    assigned_to: opts.assignedTo ?? source.created_by ?? null,
    is_finished: false,
    is_lost: false,
    excluded_from_reports: false,
  };

  if (Object.keys(metadata).length > 0) {
    leadData.metadata = metadata;
  }

  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .insert(leadData)
    .select("id, name, email")
    .single();

  if (leadError) {
    return {
      success: false,
      error: leadError.message,
      code: leadError.code || "LEAD_INSERT",
      details: leadError.details,
    };
  }

  return {
    success: true,
    leadId: lead.id,
    lead,
  };
}

export function normalizeWebhookBody(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  const record: Record<string, string> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (value == null) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      record[key] = String(value);
    }
  }
  return record;
}

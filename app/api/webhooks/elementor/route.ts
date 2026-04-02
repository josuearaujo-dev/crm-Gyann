import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

/**
 * Extrai os campos do formulário Elementor do body.
 * O Elementor envia campos no formato:
 *   fields[name][value] = "João"
 *   fields[name][title] = "Name"
 *   fields[email][value] = "joao@email.com"
 *   fields[email][title] = "E-mail"
 *   fields[field_6345493][value] = "85981461450"
 *   fields[field_6345493][title] = "Telephone"
 */
function extractElementorFields(body: Record<string, string>) {
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let company: string | null = null;
  let segment: string | null = null;
  let revenue: string | null = null;
  const metadata: Record<string, any> = {};

  console.log("[v0] Extracting from body with keys:", Object.keys(body));

  // FORMATO 1: Chaves diretas (formato do WordPress via n8n)
  // Procura por chaves como "Name", "E-mail", "Telephone", "Company Name"
  for (const [key, value] of Object.entries(body)) {
    const keyLower = key.toLowerCase();
    const val = String(value).trim();
    
    if (!val) continue;

    // EMAIL
    if (keyLower === "e-mail" || keyLower === "email") {
      email = val;
      console.log("[v0] Found EMAIL (direct):", val);
      continue;
    }

    // TELEFONE
    if (keyLower === "telephone" || keyLower === "phone" || keyLower === "telefone" || keyLower.includes("whatsapp")) {
      phone = val;
      console.log("[v0] Found PHONE (direct):", val);
      continue;
    }

    // EMPRESA (verificar ANTES de name!)
    if (keyLower === "company name" || keyLower === "nome da empresa" || keyLower === "company" || keyLower === "empresa") {
      company = val;
      console.log("[v0] Found COMPANY (direct):", val);
      continue;
    }

    // NOME (só se não contiver "company")
    if ((keyLower === "name" || keyLower === "nome") && !keyLower.includes("company") && !keyLower.includes("empresa")) {
      name = val;
      console.log("[v0] Found NAME (direct):", val);
      continue;
    }

    // SEGMENTO
    if (keyLower.includes("segment") || keyLower.includes("segmento") || 
        keyLower === "what is your segment?" || keyLower === "qual é o seu segmento?") {
      segment = val;
      console.log("[v0] Found SEGMENT (direct):", val);
      continue;
    }

    // FATURAMENTO / RECEITA
    if (keyLower.includes("revenue") || keyLower.includes("faturamento") || 
        keyLower === "what is your monthly revenue?" || keyLower === "qual é o seu faturamento mensal?") {
      revenue = val;
      console.log("[v0] Found REVENUE (direct):", val);
      continue;
    }

    // Metadata para campos adicionais
    if (keyLower === "form_id" || keyLower === "form_name" || keyLower === "data" || 
        keyLower === "horário" || keyLower === "url da página" || keyLower === "ip remoto" ||
        keyLower.includes("desenvolvido por") || keyLower.includes("agente de usuário")) {
      metadata[key] = val;
    }
  }

  // FORMATO 2: Estrutura aninhada (formato antigo fields[id][value])
  // Só processar se não encontrou dados no formato direto
  if (!name && !email && !phone && !company) {
    const fields: { id: string; title: string; value: string; type: string }[] = [];

    for (const key of Object.keys(body)) {
      const valueMatch = key.match(/^fields\[([^\]]+)\]\[value\]$/);
      if (valueMatch) {
        const fieldId = valueMatch[1];
        const title = body[`fields[${fieldId}][title]`] || "";
        const type = body[`fields[${fieldId}][type]`] || "";
        const value = body[key] || "";
        fields.push({ id: fieldId, title, value, type });
      }
    }

    console.log("[v0] Found nested fields:", fields.length);

    for (const field of fields) {
      const titleLower = field.title.toLowerCase();
      const idLower = field.id.toLowerCase();

      if (!email && (field.type === "email" || titleLower.includes("email") || idLower === "email")) {
        email = field.value;
        console.log("[v0] Found EMAIL (nested):", field.value);
        continue;
      }

      if (!phone && (field.type === "tel" || titleLower.includes("phone") || titleLower.includes("tel"))) {
        phone = field.value;
        console.log("[v0] Found PHONE (nested):", field.value);
        continue;
      }

      if (!company && (titleLower.includes("company") || titleLower.includes("empresa"))) {
        company = field.value;
        console.log("[v0] Found COMPANY (nested):", field.value);
        continue;
      }

      if (!name && (idLower === "name" || titleLower === "name") && !titleLower.includes("company")) {
        name = field.value;
        console.log("[v0] Found NAME (nested):", field.value);
        continue;
      }

      if (field.value) {
        metadata[field.title || field.id] = field.value;
      }
    }

    // Meta do formulário (formato antigo)
    if (body["form[name]"]) metadata.form_name = body["form[name]"];
    if (body["form[id]"]) metadata.form_id = body["form[id]"];
    if (body["meta[date][value]"]) metadata.submission_date = body["meta[date][value]"];
    if (body["meta[time][value]"]) metadata.submission_time = body["meta[time][value]"];
    if (body["meta[page_url][value]"]) metadata.page_url = body["meta[page_url][value]"];
  }

  // Adicionar segmento e faturamento ao metadata se encontrados
  if (segment) metadata.segmento = segment;
  if (revenue) metadata.faturamento = revenue;

  console.log("[v0] Final extracted:", { name, email, phone, company, segment, revenue, metadataKeys: Object.keys(metadata) });
  
  return { name, email, phone, company, metadata };
}

export async function POST(request: NextRequest) {
  let sourceId: string | null = null;
  let rawBody: any = null;

  try {
    sourceId = request.nextUrl.searchParams.get("source");
    const contentType = request.headers.get("content-type") || "";

    console.log("[v0] ===== WEBHOOK ELEMENTOR =====");
    console.log("[v0] Source:", sourceId);
    console.log("[v0] Content-Type:", contentType);

    // Parse do body - pode vir como JSON (do n8n) ou form-urlencoded (do WordPress direto)
    let body: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      const jsonBody = await request.json();
      console.log("[v0] JSON body type:", typeof jsonBody, Array.isArray(jsonBody) ? "array" : "object");

      // n8n envia como array: [{ headers, body, ... }]
      if (Array.isArray(jsonBody) && jsonBody[0]?.body) {
        body = jsonBody[0].body;
      } else if (jsonBody.body && typeof jsonBody.body === "object") {
        body = jsonBody.body;
      } else {
        body = jsonBody;
      }
    } else {
      // form-urlencoded direto do WordPress
      const text = await request.text();
      console.log("[v0] Raw form-urlencoded text:", text.substring(0, 500));
      
      // Parse manualmente o URLSearchParams
      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        body[key] = value;
      });
    }

    rawBody = body;
    console.log("[v0] Body keys:", Object.keys(body));
    console.log("[v0] Full body:", JSON.stringify(body, null, 2).substring(0, 1000));

    if (!sourceId) {
      return respond(request, sourceId, rawBody, 200, {
        success: false,
        error: "Source ID is required: ?source=<id>",
      });
    }

    // Extrair campos do formulário Elementor
    const { name, email, phone, company, metadata } = extractElementorFields(body);

    console.log("[v0] Extracted:", { name, email, phone, company });

    if (!name && !email) {
      return respond(request, sourceId, rawBody, 200, {
        success: false,
        error: "Could not extract name or email from form data",
        bodyKeys: Object.keys(body),
      });
    }

    const supabase = createAdminClient();

    // Buscar o dono da fonte
    const { data: source } = await supabase
      .from("lead_sources")
      .select("created_by")
      .eq("id", sourceId)
      .single();

    console.log("[v0] Source owner:", source?.created_by);

    // Buscar primeira coluna do pipeline para o dono
    let columnId: string | null = null;
    if (source?.created_by) {
      const { data: col, error: colError } = await supabase
        .from("pipeline_columns")
        .select("id")
        .eq("created_by", source.created_by)
        .order("position", { ascending: true })
        .limit(1)
        .single();
      
      if (colError) {
        console.error("[v0] Error fetching user column:", colError);
      }
      columnId = col?.id || null;
    }

    if (!columnId) {
      // Fallback: buscar qualquer primeira coluna
      const { data: col, error: colError } = await supabase
        .from("pipeline_columns")
        .select("id")
        .order("position", { ascending: true })
        .limit(1)
        .single();
      
      if (colError) {
        console.error("[v0] Error fetching any column:", colError);
      }
      columnId = col?.id || null;
    }

    // Fallback final: coluna padrão hardcoded
    if (!columnId) {
      columnId = "87f7c397-8c2d-49ae-838d-d71cc1690c03";
      console.log("[v0] Using hardcoded default column");
    }

    console.log("[v0] Target column ID:", columnId);

    // Criar o lead
    const leadData: Record<string, any> = {
      name: name || email,
      email: email || null,
      phone: phone || null,
      company: company || null,
      source_id: sourceId,
      column_id: columnId,
      assigned_to: source?.created_by || null,
    };

    if (Object.keys(metadata).length > 0) {
      leadData.metadata = metadata;
    }

    console.log("[v0] Inserting lead:", JSON.stringify(leadData));

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert(leadData)
      .select("id, name, email")
      .single();

    if (leadError) {
      console.error("[v0] ===== LEAD INSERT ERROR =====");
      console.error("[v0] Error message:", leadError.message);
      console.error("[v0] Error code:", leadError.code);
      console.error("[v0] Error details:", leadError.details);
      console.error("[v0] Error hint:", leadError.hint);
      console.error("[v0] Lead data attempted:", JSON.stringify(leadData, null, 2));
      return respond(request, sourceId, rawBody, 200, {
        success: false,
        error: leadError.message,
        code: leadError.code,
        details: leadError.details,
      });
    }

    console.log("[v0] Lead created:", lead?.id);

    return respond(request, sourceId, rawBody, 200, {
      success: true,
      lead_id: lead?.id,
    });

  } catch (error: any) {
    console.error("[v0] Webhook crash:", error);
    return respond(request, sourceId, rawBody, 200, {
      success: false,
      error: error.message || String(error),
    });
  }
}

// Helper para responder e salvar log ao mesmo tempo
async function respond(
  request: NextRequest,
  sourceId: string | null,
  body: any,
  statusCode: number,
  response: any,
) {
  try {
    const supabase = createAdminClient();
    const headers: Record<string, string> = {};
    const queryParams: Record<string, string> = {};

    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    request.nextUrl.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    await supabase.from("webhook_logs").insert({
      source_id: sourceId,
      method: request.method,
      url: request.url,
      headers,
      query_params: queryParams,
      body,
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
      user_agent: request.headers.get("user-agent") || null,
      status_code: statusCode,
      response,
    });
  } catch (logErr) {
    console.error("[v0] Failed to save webhook log:", logErr);
  }

  // SEMPRE retornar 200 para que o WordPress/n8n não mostre erro
  return NextResponse.json(response, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get("source");

  const response = sourceId
    ? { status: "active", message: "Elementor webhook ready", source: sourceId }
    : { error: "Source ID required: ?source=<id>" };

  return NextResponse.json(response, { status: 200, headers: corsHeaders });
}

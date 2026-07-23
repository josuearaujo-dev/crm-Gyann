import { createAdminClient } from "@/lib/supabase/admin";
import {
  createLeadFromElementorBody,
  extractElementorFields,
  isValidUuid,
} from "@/lib/elementor-webhook";
import { NextRequest, NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  let rawSourceId: string | null = null;
  let sourceId: string | null = null;
  let rawBody: any = null;

  try {
    rawSourceId = request.nextUrl.searchParams.get("source");
    sourceId = rawSourceId?.trim() || null;
    const contentType = request.headers.get("content-type") || "";

    console.log("[v0] ===== WEBHOOK ELEMENTOR =====");
    console.log("[v0] Source:", sourceId);
    console.log("[v0] Content-Type:", contentType);

    let body: Record<string, string> = {};

    if (contentType.includes("application/json")) {
      const jsonBody = await request.json();
      console.log(
        "[v0] JSON body type:",
        typeof jsonBody,
        Array.isArray(jsonBody) ? "array" : "object",
      );

      if (Array.isArray(jsonBody) && jsonBody[0]?.body) {
        body = jsonBody[0].body;
      } else if (jsonBody.body && typeof jsonBody.body === "object") {
        body = jsonBody.body;
      } else {
        body = jsonBody;
      }
    } else {
      const text = await request.text();
      console.log("[v0] Raw form-urlencoded text:", text.substring(0, 500));

      const params = new URLSearchParams(text);
      params.forEach((value, key) => {
        body[key] = value;
      });
    }

    rawBody = body;
    console.log("[v0] Body keys:", Object.keys(body));

    if (!sourceId) {
      return respond(request, null, rawSourceId, rawBody, 200, {
        success: false,
        error: "Source ID is required: ?source=<id>",
        code: "SOURCE_MISSING",
        failure_stage: "source_validation",
        received_source: rawSourceId,
      });
    }

    if (!isValidUuid(sourceId)) {
      return respond(request, null, rawSourceId, rawBody, 200, {
        success: false,
        error:
          "O parâmetro source recebido não é um UUID válido. Verifique se a URL do webhook está completa.",
        code: "INVALID_SOURCE_UUID",
        failure_stage: "source_validation",
        received_source: sourceId,
      });
    }

    const { name, email, phone, company } = extractElementorFields(body);
    console.log("[v0] Extracted:", { name, email, phone, company });

    if (!name && !email) {
      return respond(request, sourceId, rawSourceId, rawBody, 200, {
        success: false,
        error: "Could not extract name or email from form data",
        code: "LEAD_VALIDATION",
        failure_stage: "lead_validation",
        bodyKeys: Object.keys(body),
        received_source: sourceId,
      });
    }

    const supabase = createAdminClient();
    const result = await createLeadFromElementorBody(supabase, sourceId, body);

    if (!result.success) {
      console.error("[v0] Lead insert failed:", result.error);
      const failureStage =
        result.code === "SOURCE_NOT_FOUND"
          ? "source_lookup"
          : result.code === "INVALID_SOURCE_UUID"
            ? "source_validation"
            : result.code === "LEAD_VALIDATION"
              ? "lead_validation"
              : "lead_insert";

      return respond(request, sourceId, rawSourceId, rawBody, 200, {
        success: false,
        error: result.error,
        code: result.code,
        details: result.details,
        failure_stage: failureStage,
        received_source: sourceId,
        existingLead: result.existingLead,
      });
    }

    console.log("[v0] Lead created:", result.leadId);

    return respond(request, sourceId, rawSourceId, rawBody, 200, {
      success: true,
      lead_id: result.leadId,
      received_source: sourceId,
    });
  } catch (error: any) {
    console.error("[v0] Webhook crash:", error);
    return respond(request, sourceId, rawSourceId, rawBody, 200, {
      success: false,
      error: error.message || String(error),
      code: "UNEXPECTED_ERROR",
      failure_stage: "unexpected_error",
      received_source: rawSourceId,
    });
  }
}

async function respond(
  request: NextRequest,
  sourceId: string | null,
  receivedSource: string | null,
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

    const validSourceId = isValidUuid(sourceId || "") ? sourceId : null;

    const logPayload: Record<string, unknown> = {
      source_id: validSourceId,
      method: request.method,
      url: request.url,
      headers,
      query_params: queryParams,
      body,
      ip_address:
        request.headers.get("x-forwarded-for") ||
        request.headers.get("x-real-ip") ||
        null,
      user_agent: request.headers.get("user-agent") || null,
      status_code: statusCode,
      response: {
        ...response,
        received_source: receivedSource ?? response.received_source ?? null,
      },
    };

    // Campos opcionais (após migration 028) — ignorados se a coluna não existir
    if (receivedSource) logPayload.received_source = receivedSource;
    if (response.failure_stage) logPayload.failure_stage = response.failure_stage;
    if (response.code) logPayload.error_code = response.code;
    if (response.lead_id && isValidUuid(response.lead_id)) {
      logPayload.lead_id = response.lead_id;
    }

    let { error: logError } = await supabase
      .from("webhook_logs")
      .insert(logPayload);

    // Se colunas novas ainda não existem, tenta de novo só com schema básico
    if (logError) {
      console.error(
        "[v0] webhook_logs insert failed, retrying base schema:",
        logError.message,
        logError.code,
      );
      ({ error: logError } = await supabase.from("webhook_logs").insert({
        source_id: validSourceId,
        method: request.method,
        url: request.url,
        headers,
        query_params: queryParams,
        body,
        ip_address:
          request.headers.get("x-forwarded-for") ||
          request.headers.get("x-real-ip") ||
          null,
        user_agent: request.headers.get("user-agent") || null,
        status_code: statusCode,
        response: {
          ...response,
          received_source: receivedSource ?? null,
        },
      }));
    }

    if (logError) {
      console.error("[v0] Failed to save webhook log:", logError);
    }
  } catch (logErr) {
    console.error("[v0] Failed to save webhook log:", logErr);
  }

  // Sempre 200 para WordPress/n8n não reiniciar o envio
  return NextResponse.json(response, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const sourceId = request.nextUrl.searchParams.get("source");

  const response = sourceId
    ? { status: "active", message: "Elementor webhook ready", source: sourceId }
    : { error: "Source ID required: ?source=<id>" };

  return NextResponse.json(response, { status: 200, headers: corsHeaders });
}

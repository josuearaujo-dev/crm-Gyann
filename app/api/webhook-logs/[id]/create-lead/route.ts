import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createLeadFromElementorBody,
  isValidUuid,
  normalizeWebhookBody,
} from "@/lib/elementor-webhook";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: logId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: {
    sourceId?: string;
    columnId?: string;
    forceDuplicate?: boolean;
    overrides?: Record<string, string>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sourceId = body.sourceId?.trim();
  if (!sourceId || !isValidUuid(sourceId)) {
    return NextResponse.json(
      { error: "Selecione uma fonte válida (UUID completo)" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: log, error: logError } = await admin
    .from("webhook_logs")
    .select("id, body, response, source_id")
    .eq("id", logId)
    .single();

  if (logError || !log) {
    return NextResponse.json({ error: "Log não encontrado" }, { status: 404 });
  }

  const previousResponse = (log.response || {}) as Record<string, unknown>;
  if (previousResponse.success === true && previousResponse.lead_id) {
    return NextResponse.json(
      {
        error: "Este log já gerou um lead",
        lead_id: previousResponse.lead_id,
        code: "ALREADY_PROCESSED",
      },
      { status: 409 },
    );
  }

  const payload = normalizeWebhookBody(log.body);
  if (Object.keys(payload).length === 0) {
    return NextResponse.json(
      { error: "Log sem body utilizável para criar lead" },
      { status: 400 },
    );
  }

  const result = await createLeadFromElementorBody(admin, sourceId, payload, {
    columnId: body.columnId || null,
    forceDuplicate: Boolean(body.forceDuplicate),
    overrides: body.overrides,
    extraMetadata: {
      reprocessed_from_webhook_log_id: logId,
      reprocessed_at: new Date().toISOString(),
      reprocessed_by: user.id,
      original_webhook_error: previousResponse.error || null,
      original_source_id: log.source_id || null,
      original_received_source: previousResponse.received_source || null,
    },
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        code: result.code,
        details: result.details,
        existingLead: result.existingLead,
      },
      { status: result.code === "POSSIBLE_DUPLICATE" ? 409 : 422 },
    );
  }

  const updatedResponse = {
    success: true,
    lead_id: result.leadId,
    reprocessed: true,
    reprocessed_at: new Date().toISOString(),
    reprocessed_by: user.id,
    source_id_used: sourceId,
    original_error: previousResponse.error || null,
    received_source: previousResponse.received_source || null,
  };

  const updatePayload: Record<string, unknown> = {
    source_id: sourceId,
    response: updatedResponse,
  };

  // Colunas opcionais da migration 028
  updatePayload.lead_id = result.leadId;
  updatePayload.reprocessed_at = new Date().toISOString();
  updatePayload.reprocessed_by = user.id;
  updatePayload.reprocessing_status = "success";
  updatePayload.selected_source_id = sourceId;
  updatePayload.failure_stage = null;
  updatePayload.error_code = null;

  let { error: updateError } = await admin
    .from("webhook_logs")
    .update(updatePayload)
    .eq("id", logId);

  if (updateError) {
    // Fallback se migration 028 ainda não rodou
    ({ error: updateError } = await admin
      .from("webhook_logs")
      .update({
        source_id: sourceId,
        response: updatedResponse,
      })
      .eq("id", logId));
  }

  if (updateError) {
    console.error("[v0] Failed to update webhook log after reprocess:", updateError);
  }

  return NextResponse.json({
    success: true,
    lead_id: result.leadId,
    lead: result.lead,
  });
}

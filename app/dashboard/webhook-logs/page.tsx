import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { WebhookLogsViewer } from "@/components/crm/webhook-logs-viewer";

export default async function WebhookLogsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Admin client: bypassa RLS restritiva antiga (só via created_by da fonte).
  // A página já exige login acima.
  const admin = createAdminClient();

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [{ data: logs, error: logsError }, { data: sources }, { data: columns }] =
    await Promise.all([
      admin
        .from("webhook_logs")
        .select(
          `
      *,
      lead_sources(name, type)
    `
        )
        .gte("created_at", ninetyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(500),
      admin
        .from("lead_sources")
        .select("id, name")
        .order("name", { ascending: true }),
      // Admin: lista o funil completo (colunas shared têm created_by null)
      admin
        .from("pipeline_columns")
        .select("id, name")
        .order("position", { ascending: true }),
    ]);

  if (logsError) {
    console.error("[v0] Failed to load webhook_logs:", logsError);
  }

  return (
    <WebhookLogsViewer
      logs={logs || []}
      sources={sources || []}
      columns={columns || []}
    />
  );
}

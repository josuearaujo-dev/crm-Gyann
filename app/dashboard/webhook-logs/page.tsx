import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { WebhookLogsViewer } from "@/components/crm/webhook-logs-viewer";

export default async function WebhookLogsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Buscar logs de webhook dos últimos 7 dias
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: logs } = await supabase
    .from("webhook_logs")
    .select(`
      *,
      lead_sources(name, type)
    `)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false })
    .limit(100);

  return <WebhookLogsViewer logs={logs || []} />;
}

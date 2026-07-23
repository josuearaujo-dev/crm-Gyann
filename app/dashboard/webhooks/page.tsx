import { createClient } from "@/lib/supabase/server";
import { WebhooksManager } from "@/components/crm/webhooks-manager";

export default async function WebhooksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: sources } = await supabase
    .from("lead_sources")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: columns } = await supabase
    .from("pipeline_columns")
    .select("*")
    .order("position", { ascending: true });

  return (
    <WebhooksManager
      sources={sources || []}
      columns={columns || []}
      userId={user?.id || ""}
    />
  );
}

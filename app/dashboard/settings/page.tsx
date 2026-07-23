import { createClient } from "@/lib/supabase/server";
import { SettingsManager } from "@/components/crm/settings-manager";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tags } = await supabase
    .from("tags")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user?.id)
    .single();

  const { data: sources, error: sourcesError } = await supabase
    .from("lead_sources")
    .select("*")
    .eq("created_by", user?.id)
    .order("created_at", { ascending: false });

  console.log("[v0] Settings - Sources loaded:", sources?.length || 0, "sources");
  if (sourcesError) {
    console.error("[v0] Settings - Error loading sources:", sourcesError);
  }

  const { data: lossReasons } = await supabase
    .from("loss_reasons")
    .select("*")
    .order("name", { ascending: true });

  const { data: tagCategories } = await supabase
    .from("tag_categories")
    .select("*")
    .order("name", { ascending: true });

  return (
    <SettingsManager
      tags={tags || []}
      profile={profile}
      sources={sources || []}
      lossReasons={lossReasons || []}
      tagCategories={tagCategories || []}
      userId={user?.id || ""}
    />
  );
}

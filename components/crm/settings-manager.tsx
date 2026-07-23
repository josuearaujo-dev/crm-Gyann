"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Tag as TagIcon, User, Loader2, Webhook, Copy, Check, RefreshCw, ClipboardList, XCircle } from "lucide-react";
import type { Tag, Profile, LeadSource } from "@/lib/types";
import { TaskTemplateManager } from "@/components/crm/task-template-manager";

interface LossReason {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface TagCategory {
  id: string;
  name: string;
  prefix: string;
  description: string | null;
}

interface SettingsManagerProps {
  tags: Tag[];
  profile: Profile | null;
  sources: LeadSource[];
  lossReasons: LossReason[];
  tagCategories: TagCategory[];
  userId: string;
}

export function SettingsManager({ tags, profile, sources, lossReasons, tagCategories, userId }: SettingsManagerProps) {
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [newTagCategoryId, setNewTagCategoryId] = useState(tagCategories[0]?.id || "");
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showTaskTemplates, setShowTaskTemplates] = useState(false);
  const [isAddingLossReason, setIsAddingLossReason] = useState(false);
  const [newLossReasonName, setNewLossReasonName] = useState("");
  const [newLossReasonDesc, setNewLossReasonDesc] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryPrefix, setNewCategoryPrefix] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleAddTag = async () => {
    if (!newTagName.trim() || !newTagCategoryId) return;

    const { error } = await supabase.from("tags").insert({
      name: newTagName,
      category_id: newTagCategoryId,
      color: newTagColor,
      created_by: userId,
    });

    if (!error) {
      setNewTagName("");
      setNewTagColor("#3b82f6");
      setNewTagCategoryId(tagCategories[0]?.id || "");
      setIsAddingTag(false);
      router.refresh();
    } else {
      console.error("[v0] Error adding tag:", error);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim() || !newCategoryPrefix.trim()) {
      alert("Por favor, preencha nome e prefixo da categoria");
      return;
    }

    const { error } = await supabase.from("tag_categories").insert({
      name: newCategoryName,
      prefix: newCategoryPrefix,
      description: newCategoryDesc || null,
      created_by: userId,
    });

    if (!error) {
      setNewCategoryName("");
      setNewCategoryPrefix("");
      setNewCategoryDesc("");
      setIsAddingCategory(false);
      router.refresh();
    } else {
      console.error("[v0] Error adding category:", error);
      alert(`Erro ao criar categoria: ${error.message}`);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const confirm = window.confirm("Deletar esta categoria? As tags desta categoria ficarão sem categoria.");
    if (!confirm) return;

    const { error } = await supabase.from("tag_categories").delete().eq("id", categoryId);

    if (!error) {
      router.refresh();
    } else {
      console.error("[v0] Error deleting category:", error);
      alert("Erro ao deletar categoria");
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const { error } = await supabase.from("tags").delete().eq("id", tagId);

    if (!error) {
      router.refresh();
    } else {
      console.error("[v0] Error deleting tag:", error);
      alert("Erro ao deletar tag. Apenas administradores podem deletar tags.");
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userId);

    if (!error) {
      router.refresh();
    }
    
    setSaving(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerateToken = async (sourceId: string) => {
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const { error } = await supabase
      .from("lead_sources")
      .update({ webhook_token: newToken })
      .eq("id", sourceId);

    if (!error) {
      router.refresh();
    } else {
      console.error("[v0] Error regenerating token:", error);
      alert("Erro ao regenerar token");
    }
  };

  const handleAddLossReason = async () => {
    if (!newLossReasonName.trim()) return;

    const { error } = await supabase.from("loss_reasons").insert({
      name: newLossReasonName,
      description: newLossReasonDesc || null,
    });

    if (!error) {
      setNewLossReasonName("");
      setNewLossReasonDesc("");
      setIsAddingLossReason(false);
      router.refresh();
    } else {
      console.error("[v0] Error adding loss reason:", error);
    }
  };

  const handleDeleteLossReason = async (reasonId: string) => {
    const { error } = await supabase.from("loss_reasons").delete().eq("id", reasonId);

    if (!error) {
      router.refresh();
    } else {
      console.error("[v0] Error deleting loss reason:", error);
      alert("Erro ao deletar motivo. Pode estar sendo usado por leads.");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuracoes</h1>
        <p className="text-muted-foreground mt-1">
          Gerencie seu perfil e configuracoes do CRM
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="w-4 h-4 mr-2" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="tasks">
            <ClipboardList className="w-4 h-4 mr-2" />
            Templates de Tasks
          </TabsTrigger>
          <TabsTrigger value="tags">
            <TagIcon className="w-4 h-4 mr-2" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="categories">
            <TagIcon className="w-4 h-4 mr-2" />
            Categorias de Tags
          </TabsTrigger>
          <TabsTrigger value="webhooks">
            <Webhook className="w-4 h-4 mr-2" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="loss-reasons">
            <XCircle className="w-4 h-4 mr-2" />
            Motivos de Perda
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Informacoes do Perfil</CardTitle>
              <CardDescription>
                Atualize suas informacoes pessoais
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  value={profile?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  O email nao pode ser alterado
                </p>
              </div>
              <Button onClick={handleUpdateProfile} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar alteracoes"
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Templates de Tasks</CardTitle>
              <CardDescription>
                Crie templates de tasks predefinidas para usar rapidamente ao gerenciar leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setShowTaskTemplates(true)}>
                <ClipboardList className="w-4 h-4 mr-2" />
                Gerenciar Templates
              </Button>
              <p className="text-sm text-muted-foreground mt-4">
                Templates de tasks ajudam a padronizar suas tarefas. Crie templates com nome, descrição e duração estimada para usar ao adicionar novas tasks aos leads.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Tags</CardTitle>
                  <CardDescription>
                    Gerencie as tags para categorizar seus leads
                  </CardDescription>
                </div>
                <Dialog open={isAddingTag} onOpenChange={setIsAddingTag}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Tag
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Tag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select value={newTagCategoryId} onValueChange={setNewTagCategoryId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma categoria" />
                          </SelectTrigger>
                          <SelectContent>
                            {tagCategories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Nome da tag</Label>
                        <Input
                          value={newTagName}
                          onChange={(e) => setNewTagName(e.target.value)}
                          placeholder="Ex: Interessado"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cor</Label>
                        <div className="flex gap-2">
                          <Input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="w-12 h-10 p-1 cursor-pointer"
                          />
                          <Input
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="flex-1"
                          />
                        </div>
                      </div>
                      <Button onClick={handleAddTag} className="w-full">
                        Criar Tag
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {tags.length > 0 ? (
                <div className="space-y-6">
                  {tagCategories.map((category) => {
                    const categoryTags = tags.filter(t => t.category_id === category.id);
                    if (categoryTags.length === 0) return null;
                    
                    return (
                      <div key={category.id} className="space-y-3">
                        <h3 className="text-sm font-semibold text-muted-foreground">
                          {category.name}
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {categoryTags.map((tag) => (
                            <div
                              key={tag.id}
                              className="flex items-center gap-2 p-2 rounded-lg border border-border"
                            >
                              <Badge
                                style={{
                                  backgroundColor: tag.color,
                                  color: "#fff",
                                }}
                              >
                                {tag.name}
                              </Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteTag(tag.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Tags sem categoria */}
                  {tags.filter(t => !t.category_id).length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        Sem Categoria
                      </h3>
                      <div className="flex flex-wrap gap-3">
                        {tags.filter(t => !t.category_id).map((tag) => (
                          <div
                            key={tag.id}
                            className="flex items-center gap-2 p-2 rounded-lg border border-border"
                          >
                            <Badge
                              style={{
                                backgroundColor: tag.color,
                                color: "#fff",
                              }}
                            >
                              {tag.name}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteTag(tag.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TagIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma tag cadastrada ainda
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Categorias de Tags</CardTitle>
                  <CardDescription>
                    Crie categorias personalizadas para organizar suas tags
                  </CardDescription>
                </div>
                <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Categoria
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Categoria de Tag</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Nome da Categoria</Label>
                        <Input
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="Ex: Idiomas"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Prefixo (opcional)</Label>
                        <Input
                          value={newCategoryPrefix}
                          onChange={(e) => setNewCategoryPrefix(e.target.value)}
                          placeholder="Ex: LANG_"
                        />
                        <p className="text-xs text-muted-foreground">
                          Prefixo ajuda a identificar tags desta categoria
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input
                          value={newCategoryDesc}
                          onChange={(e) => setNewCategoryDesc(e.target.value)}
                          placeholder="Ex: Tags relacionadas a idiomas"
                        />
                      </div>
                      <Button onClick={handleAddCategory} className="w-full">
                        Criar Categoria
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {tagCategories.length > 0 ? (
                <div className="space-y-3">
                  {tagCategories.map((category) => (
                    <Card key={category.id} className="border-border/50">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-foreground">{category.name}</h4>
                            {category.prefix && (
                              <p className="text-sm text-muted-foreground mt-1">
                                Prefixo: <code className="bg-muted px-1 py-0.5 rounded">{category.prefix}</code>
                              </p>
                            )}
                            {category.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {category.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteCategory(category.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TagIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma categoria cadastrada ainda
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração de Webhooks</CardTitle>
              <CardDescription>
                Gerencie os tokens de verificação para webhooks de fontes de leads (Meta, etc)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sources.length > 0 ? (
                <div className="space-y-4">
                  {sources.map((source) => (
                    <Card key={source.id} className="border-border/50">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-semibold text-foreground">{source.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                Tipo: {source.type === 'meta' ? 'Meta Lead Ads' : source.type === 'webhook' ? 'Webhook' : 'Manual'}
                              </p>
                            </div>
                            <Badge variant={source.is_active ? "default" : "secondary"}>
                              {source.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>

                          {source.type !== 'manual' && (
                            <>
                              <div className="space-y-2">
                                <Label className="text-sm font-medium">Webhook URL</Label>
                                <div className="flex gap-2">
                                  <Input
                                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/meta?source=${source.id}`}
                                    readOnly
                                    className="flex-1 font-mono text-xs bg-muted"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      copyToClipboard(
                                        `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/meta?source=${source.id}`,
                                        `url-${source.id}`
                                      )
                                    }
                                  >
                                    {copiedId === `url-${source.id}` ? (
                                      <Check className="w-4 h-4 text-success" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label className="text-sm font-medium">Token de Verificação</Label>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => regenerateToken(source.id)}
                                    className="h-8"
                                  >
                                    <RefreshCw className="w-3 h-3 mr-1" />
                                    Regenerar
                                  </Button>
                                </div>
                                <div className="flex gap-2">
                                  <Input
                                    value={source.webhook_token || ""}
                                    readOnly
                                    className="flex-1 font-mono text-xs bg-muted"
                                    type="text"
                                  />
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() =>
                                      copyToClipboard(source.webhook_token || "", `token-${source.id}`)
                                    }
                                  >
                                    {copiedId === `token-${source.id}` ? (
                                      <Check className="w-4 h-4 text-success" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Use este token como "Verify Token" ao configurar o webhook no Meta Business Manager
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Webhook className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhuma fonte de leads configurada ainda
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loss-reasons" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Motivos de Perda</CardTitle>
                  <CardDescription>
                    Gerencie os motivos pelos quais leads são marcados como perdidos
                  </CardDescription>
                </div>
                <Dialog open={isAddingLossReason} onOpenChange={setIsAddingLossReason}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Novo Motivo
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Motivo de Perda</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <Label>Nome do motivo</Label>
                        <Input
                          value={newLossReasonName}
                          onChange={(e) => setNewLossReasonName(e.target.value)}
                          placeholder="Ex: Preço muito alto"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input
                          value={newLossReasonDesc}
                          onChange={(e) => setNewLossReasonDesc(e.target.value)}
                          placeholder="Detalhes sobre este motivo"
                        />
                      </div>
                      <Button onClick={handleAddLossReason} className="w-full">
                        Criar Motivo
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {lossReasons.length > 0 ? (
                <div className="space-y-3">
                  {lossReasons.map((reason) => (
                    <div
                      key={reason.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border"
                    >
                      <div>
                        <h4 className="font-medium text-foreground">{reason.name}</h4>
                        {reason.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {reason.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteLossReason(reason.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <XCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Nenhum motivo de perda cadastrado ainda
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Task Templates Dialog */}
      <TaskTemplateManager
        open={showTaskTemplates}
        onOpenChange={setShowTaskTemplates}
      />
    </div>
  );
}

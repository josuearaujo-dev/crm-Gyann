"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Search, Filter, AlertCircle } from "lucide-react";
import type { Task } from "@/lib/types";
import { formatInAppTimezone } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import { TaskDetail } from "./task-detail";

interface TasksPageProps {
  initialTasks: (Task & { leads: { name: string; email: string; company: string | null } | null })[];
  userId: string;
}

export function TasksPage({ initialTasks, userId }: TasksPageProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const isTaskOverdue = (task: Task) => {
    if (task.completed) return false;
    const now = new Date();
    if (task.scheduled_at && new Date(task.scheduled_at) < now) return true;
    if (task.due_date && new Date(task.due_date) < now) return true;
    return false;
  };

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.leads?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false;

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "completed" && task.completed) ||
      (filterStatus === "pending" && !task.completed && !isTaskOverdue(task)) ||
      (filterStatus === "overdue" && isTaskOverdue(task));

    const matchesType =
      filterType === "all" || task.type === filterType;

    return matchesSearch && matchesStatus && matchesType;
  });

  const handleTaskToggle = async (taskId: string, completed: boolean) => {
    const { error } = await supabase
      .from("tasks")
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
        status: completed ? "done" : "pending",
        done_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", taskId);

    if (!error) {
      setTasks(
        tasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed,
                completed_at: completed ? new Date().toISOString() : null,
                status: completed ? ("done" as any) : ("pending" as any),
                done_at: completed ? new Date().toISOString() : null,
              }
            : t
        )
      );
      router.refresh();
    }
  };

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.completed).length,
    pending: tasks.filter((t) => !t.completed && !isTaskOverdue(t)).length,
    overdue: tasks.filter((t) => isTaskOverdue(t)).length,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Todas as Tasks</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie todas as suas tarefas e callbacks
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-success">{stats.completed}</div>
            <p className="text-xs text-muted-foreground mt-1">Concluídas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-primary">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground mt-1">Atrasadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
                <SelectItem value="overdue">Atrasadas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="callback">Callback</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Tasks ({filteredTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 mx-auto">
                <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhuma task encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const isOverdue = isTaskOverdue(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 cursor-pointer group",
                      task.completed
                        ? "bg-muted/30 border-transparent"
                        : isOverdue
                        ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10 hover:border-destructive/30 animate-pulse"
                        : "bg-muted/50 hover:bg-muted hover:border-border/50 border-transparent"
                    )}
                  >
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={(checked) => {
                        handleTaskToggle(task.id, checked as boolean);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        "mt-1",
                        isOverdue && !task.completed && "border-destructive"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={cn(
                            "font-medium transition-all duration-200",
                            task.completed
                              ? "line-through text-muted-foreground"
                              : isOverdue
                              ? "text-destructive"
                              : "text-foreground"
                          )}
                        >
                          {task.title}
                        </p>
                        {isOverdue && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Atrasada
                          </Badge>
                        )}
                        {task.type === "callback" && (
                          <Badge variant="secondary">Callback</Badge>
                        )}
                      </div>
                      {task.leads && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {task.leads.name}
                          {task.leads.company && ` - ${task.leads.company}`}
                        </p>
                      )}
                      {task.description && (
                        <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      {task.scheduled_at && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {formatInAppTimezone(task.scheduled_at, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Badge>
                      )}
                      {task.start_time && (
                        <Badge variant="outline" className="text-xs font-mono">
                          {task.start_time}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetail
        taskId={selectedTaskId || ""}
        open={selectedTaskId !== null}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        onUpdate={() => router.refresh()}
      />
    </div>
  );
}

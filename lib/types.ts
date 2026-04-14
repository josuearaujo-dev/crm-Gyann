export interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'user'
  created_at: string
  updated_at: string
}

export interface USState {
  id: string
  name: string
  abbreviation: string
  created_at: string
}

export interface Nationality {
  id: string
  country: string
  nationality: string
  masculine: string | null
  feminine: string | null
  created_at: string
}

export interface PipelineColumn {
  id: string
  name: string
  color: string
  position: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LeadSource {
  id: string
  name: string
  type: 'meta' | 'webhook' | 'manual'
  webhook_key: string | null
  webhook_token: string | null
  meta_config: Record<string, unknown> | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  user_id: string | null
  default_column_id: string | null
}

export interface Lead {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  nationality_id: string | null
  source_id: string | null
  column_id: string | null
  state_id: string | null
  assigned_to: string | null
  position: number
  deal_value: number
  payment_model: 'full' | 'installments' | 'entry_plus_installments' | null
  amount_received: number | null
  installments_count: number | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
  /** Lead sem resposta no primeiro contato — sai do funil, continua nas métricas de relatório. */
  is_finished?: boolean | null
  finished_at?: string | null
  finished_notes?: string | null
  is_lost?: boolean | null
  /** Removido do funil e excluído das contagens de relatórios. */
  excluded_from_reports?: boolean | null
  // Relations
  source?: LeadSource | null
  column?: PipelineColumn | null
  state?: USState | null
  nationality?: Nationality | null
  assigned_user?: Profile | null
  tags?: Tag[]
  notes?: LeadNote[]
  tasks?: Task[]
}

/** Parcelas cadastradas no lead (vencimento + pagamento) — usado em relatórios por período. */
export interface LeadInstallment {
  id: string
  lead_id: string
  sort_order: number
  amount: number
  due_date: string
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface LeadNote {
  id: string
  lead_id: string
  content: string
  created_by: string | null
  created_at: string
  updated_at: string
  // Relations
  author?: Profile | null
}

export interface Tag {
  id: string
  name: string
  color: string
  type: 'QUALIFICACAO' | 'TEMPERATURA' | 'TENTATIVA_CONTATO' | 'FOLLOW_UP' | null
  created_by: string | null
  created_at: string
}

export interface Task {
  id: string
  lead_id: string | null
  title: string
  description: string | null
  due_date: string | null
  start_time: string | null
  end_time: string | null
  completed: boolean
  completed_at: string | null
  assigned_to: string | null
  created_by: string | null
  type: 'manual' | 'callback'
  scheduled_at: string | null
  status: 'pending' | 'scheduled' | 'overdue' | 'done'
  note: string | null
  done_at: string | null
  created_at: string
  updated_at: string
  // Relations
  lead?: Lead | null
  assigned_user?: Profile | null
  tags?: Tag[]
}

export interface TaskTag {
  task_id: string
  tag_id: string
}

export interface LeadTag {
  lead_id: string
  tag_id: string
}

export interface Meeting {
  id: string
  lead_id: string | null
  scheduled_at: string
  duration_minutes: number | null
  meeting_type: 'zoom' | 'phone' | 'in_person' | 'google_meet' | 'other' | null
  meeting_link: string | null
  status: 'scheduled' | 'done' | 'no_show' | 'cancelled'
  notes: string | null
  created_at: string
  updated_at: string
  // Relations
  lead?: Lead | null
}

export interface TaskTemplate {
  id: string
  name: string
  description: string | null
  duration_minutes: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

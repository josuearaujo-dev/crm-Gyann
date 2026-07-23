export interface Tenant {
  id: string
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  tenant_id: string | null
  full_name: string | null
  id_mktzap?: string | null
  role: "admin" | "manager" | "user"
  is_super_admin: boolean
  created_at: string
  updated_at: string
  tenant?: Tenant
}

export interface ApiCredential {
  id: string
  tenant_id: string
  name: string
  base_url: string
  username: string
  password: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ClientApiCredential {
  id: string
  tenant_id: string
  name: string
  client_id: string
  secret_hash: string
  secret_prefix: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
  updated_at: string
}

export interface ClientApiMessageLog {
  id: string
  tenant_id: string
  credential_id: string | null
  credential_name: string | null
  template_id: string | null
  template_name: string | null
  external_id: string | null
  recipient_phone: string | null
  parameters: Record<string, string>
  status: "success" | "failed" | "validation_error"
  error_message: string | null
  error_details: Record<string, unknown> | null
  whatsapp_message_id: string | null
  message_id: string | null
  payload: Record<string, unknown> | null
  http_status: number | null
  request_ip: string | null
  user_agent: string | null
  created_at: string
}

export type WhatsAppConnectionMode = "manual" | "coexistence"

export type WhatsAppConnectionStatus = "pending" | "connected" | "disconnected" | "expired" | "error"

export type MessageSource = "cloud_api" | "whatsapp_business_app" | "customer"

export interface WhatsAppCredential {
  id: string
  tenant_id: string
  phone_number_id: string
  access_token: string
  access_token_encrypted?: string | null
  business_account_id: string | null
  business_id?: string | null
  display_phone_number?: string | null
  webhook_verify_token?: string | null
  verify_token?: string | null
  connection_mode?: WhatsAppConnectionMode
  connection_status?: WhatsAppConnectionStatus
  coexistence_enabled?: boolean
  history_sync_status?: string | null
  token_expires_at?: string | null
  connected_at?: string | null
  disconnected_at?: string | null
  last_webhook_at?: string | null
  last_error?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface WhatsAppOAuthSession {
  id: string
  tenant_id: string
  user_id: string
  state: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface MessageTemplate {
  id: string
  tenant_id: string
  name: string
  language_code: string
  description: string | null
  template_text?: string | null
  parameter_mapping: Record<string, string>
  category?: string | null
  meta_template_id?: string | null
  meta_status?: string | null
  meta_response?: Record<string, unknown> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  tenant_id: string
  template_id: string | null
  whatsapp_message_id: string | null
  recipient_phone: string
  recipient_wa_id: string | null
  template_name: string
  payload: Record<string, unknown>
  status: "pending" | "sent" | "delivered" | "read" | "failed"
  status_updated_at: string | null
  error_message: string | null
  metadata?: Record<string, unknown> | null
  message_source?: MessageSource | null
  direction?: "inbound" | "outbound" | null
  sent_by: string | null
  created_at: string
  updated_at: string
}

export interface MessageStatusHistory {
  id: string
  message_id: string
  status: string
  timestamp: string
  raw_payload: Record<string, unknown> | null
}

export interface MktzapCredential {
  id: string
  tenant_id: string
  company_id: string
  client_key: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MktzapTemplate {
  id: string
  tenant_id: string
  mktzap_id: number
  name: string
  language: string
  template: string
  header_template: string | null
  broker_phone: string | null
  updated_at_mktzap: string | null
  parameter_mapping: Record<string, string>
  dynamic_parameter_flags: Record<string, boolean>
  is_passeio: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MktzapMessage {
  id: string
  tenant_id: string
  sent_by: string | null
  mktzap_template_id: string | null
  id_pax_servico: string | null
  id_file: string | null
  service_date: string | null
  broker_phone: string
  phone_ddi: string | null
  phone_number: string
  recipient_phone: string
  recipient_name: string | null
  lead_id: number | null
  mktzap_message_id: string | null
  payload: Record<string, unknown>
  response: Record<string, unknown> | null
  status: "pending" | "sent" | "failed"
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface WhatsAppTemplatePayload {
  messaging_product: "whatsapp"
  recipient_type: "individual"
  to: string
  type: "template"
  template: {
    name: string
    language: { code: string }
    components: Array<{
      type: "body"
      parameters: Array<{
        type: "text"
        parameter_name: string
        text: string
      }>
    }>
  }
}

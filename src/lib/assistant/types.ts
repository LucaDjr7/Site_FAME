export interface SourceRef { source_type: string; source_id: string; labo: string | null; subject_id?: string; file_name?: string }
export interface ChatUiMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceRef[]
  unanswered?: boolean
  proposeQuestion?: string
}
export type AssistantStatus = 'idle' | 'streaming' | 'degraded' | 'error' | 'rate_limited'

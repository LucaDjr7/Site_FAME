export interface SourceRef { source_type: string; source_id: string; labo: string | null }
export interface ChatUiMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: SourceRef[]
  unanswered?: boolean
  proposeQuestion?: string
}
export type AssistantStatus = 'idle' | 'streaming' | 'degraded' | 'error'

// Shared TypeScript types for all FAME data models.
// Mirrors supabase/migrations/001_initial_schema.sql (Task 2).
// Note: `Member` intentionally omits `password_hash` — it is server-only and
// must never reach the client bundle.

// ─── Enums / string unions ──────────────────────────────────────────────────

export type Lab = 'paris' | 'montreal'
export type Role = 'direction' | 'researcher' | 'phd' | 'engineering'
export type SubjectStatus = 'active' | 'done' | 'on-hold'
export type TaskStatus = 'to-do' | 'in-progress' | 'done'
export type Difficulty = 'easy' | 'intermediate' | 'advanced'
export type PromptTarget = 'subject' | 'publication' | 'data' | 'member' | 'task'
export type ProposalStatus = 'pending' | 'accepted' | 'rejected'
export type PublicationType = 'article' | 'preprint' | 'conference' | 'working-paper'
export type DateBucket = '2025' | '2024' | 'older'

// ─── Members ─────────────────────────────────────────────────────────────────

export interface Member {
  id: string
  prenom: string
  nom: string
  email: string
  role: Role
  labo: Lab
  domaines: string[]
  photo_url: string | null
  is_admin: boolean
  activated_at: string | null
  created_at: string
}

// A trimmed member shape used wherever we only render an avatar + name.
export type MemberRef = Pick<Member, 'id' | 'prenom' | 'nom' | 'photo_url'>

// ─── Subjects ────────────────────────────────────────────────────────────────

export type Locale2 = 'en' | 'fr'

export interface SubjectI18nFields {
  titre: string
  question: string
  accroche: string
  context: string
  method: string
  results: string
  keywords: string[]
  dimensions: { method: string; data: string; theory: string; writing: string }
}

export type SubjectI18n = Partial<Record<Locale2, Partial<SubjectI18nFields>>>

export interface Subject {
  id: string
  labo: Lab
  titre: string
  kicker: string
  question: string   // titre-question accrocheur (gros titre de la vitrine)
  accroche: string   // phrase d'accroche (bloc navy)
  periode: string    // ex. "2025–2027"
  statut: SubjectStatus
  context: string
  method: string
  results: string
  keywords: string[]
  auteurs: string[] // array of member IDs
  difficulte: Difficulty   // 'easy' | 'intermediate' | 'advanced'
  dimensions: {
    method: string
    data: string
    theory: string
    writing: string
  }
  ordre: number
  is_transversal: boolean
  confidentiel: boolean
  show_in_tasks: boolean
  i18n: SubjectI18n
  inherits: Partial<Record<InheritableField, string>>
  created_at: string
  updated_at: string
}

export const INHERITABLE_FIELDS = ['context','method','results','dimensions','keywords','auteurs','kicker','periode'] as const
export type InheritableField = typeof INHERITABLE_FIELDS[number]
export type RelationKind = 'parent' | 'assoc'

export interface SubjectRelation {
  id: string
  source_id: string
  target_id: string
  kind: RelationKind
  label: string
  label_i18n: Partial<Record<Locale2, { label: string }>>
  created_at: string
}

export interface RelationGraphNode { id: string; titre: string; kicker: string; labo: Lab; statut: SubjectStatus; is_transversal: boolean }
export interface RelationGraphEdge { id: string; source: string; target: string; kind: RelationKind; label: string }

export interface SubjectWithProgress extends Subject {
  tasks_total: number
  tasks_done: number
  members: MemberRef[]
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface TaskI18nFields {
  titre: string
  description: string
  subtasks: string[]
}

export type TaskI18n = Partial<Record<Locale2, Partial<TaskI18nFields>>>

export interface Task {
  id: string
  labo: Lab
  titre: string
  description: string
  statut: TaskStatus
  difficulte: Difficulty
  sujet_id: string
  date_creation: string
  date_echeance: string | null
  i18n: TaskI18n
}

export interface TaskWithRelations extends Task {
  assignees: MemberRef[]
  subtasks: Subtask[]
  subject_titre?: string
}

export interface Subtask {
  id: string
  task_id: string
  label: string
  done: boolean
  ordre: number
  i18n: Partial<Record<Locale2, { label: string }>>
  assignees: MemberRef[]
}

// ─── Join tables (raw rows) ──────────────────────────────────────────────────

export interface TaskAssignee {
  task_id: string
  member_id: string
}

export interface SubtaskAssignee {
  subtask_id: string
  member_id: string
}

export interface TaskSubject {
  task_id: string
  subject_id: string
}

// ─── Task history ────────────────────────────────────────────────────────────

export interface TaskHistory {
  id: string
  task_id: string
  auteur_id: string | null // FK on delete set null — preserved row keeps auteur_nom
  auteur_nom: string
  champ: string
  valeur_avant: unknown
  valeur_apres: unknown
  created_at: string
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface Comment {
  id: string
  sujet_id: string
  auteur_type: 'visitor' | 'member'
  auteur_nom: string
  membre_id: string | null
  texte: string
  created_at: string
}

// ─── Publications ────────────────────────────────────────────────────────────

export interface Publication {
  id: string
  labo: Lab
  titre: string
  auteurs: string[]
  annee: number
  type: PublicationType
  revue_ou_conf: string | null
  lien: string | null
  created_at: string
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

export interface Prompt {
  id: string
  labo: Lab
  titre: string
  type_cible: PromptTarget
  texte: string
  is_transversal: boolean
  created_by: string | null // FK on delete set null
  created_at: string
}

// ─── Proposals ───────────────────────────────────────────────────────────────

export interface Proposal {
  id: string
  labo: Lab
  titre: string
  domaine: string
  difficulte: Difficulty
  description: string
  proposant_prenom: string
  proposant_nom: string
  proposant_email: string | null
  statut: ProposalStatus
  commentaire_admin: string | null
  created_at: string
  traitee_at: string | null
  traitee_par: string | null
  subject_id: string | null
}

// ─── Dropbox ─────────────────────────────────────────────────────────────────

export interface DropboxLink {
  id: string
  node_id: string
  node_path: string
  node_name: string
  labo: Lab
  subject_id: string | null
  task_id: string | null
  created_at: string
}

export interface SubjectFile {
  id: string
  subject_id: string
  labo: Lab
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  confidentiel: boolean
  uploaded_by: string | null
  created_at: string
}

export interface DropboxNode {
  id: string
  name: string
  path_lower: string
  is_folder: boolean
  children?: DropboxNode[]
  linked?: boolean
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface Invitation {
  id: string
  email: string
  token: string
  member_id: string
  expires_at: string
  created_at: string
}

export interface Session {
  user: {
    id: string
    email: string
  }
  member: Member | null
}

// ── Assistant RAG ────────────────────────────────────────────────────────
export type RagSourceType = 'subject' | 'task' | 'publication' | 'prompt' | 'member' | 'kb' | 'subject_file'
export type RagVisibility = 'public' | 'member'

export interface RagChunkRow {
  id: string
  source_type: RagSourceType
  source_id: string
  labo: 'paris' | 'montreal' | null
  is_transversal: boolean
  confidentiel: boolean
  visibility: RagVisibility
  lang: string
  content: string
  embedding: number[] | null
  token_count: number
  embedding_stale: boolean
  metadata: Record<string, unknown>
}

export interface ChatUsageRow {
  month: string
  tokens_in: number
  tokens_out: number
  est_cost_usd: number
}

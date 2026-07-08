export type Action =
  | { kind: 'goto'; path: string }                       // ex. '/fr/paris/tasks' — '{locale}' substitué à la capture
  | { kind: 'click'; selector: string }
  | { kind: 'type'; selector: string; text: string }
  | { kind: 'hover'; selector: string }
  | { kind: 'scroll'; y: number }
  | { kind: 'pause'; ms: number }

export interface Beat { line: string; actions: Action[] }
export type ChapterId = 'welcome' | 'tour' | 'subject' | 'daily' | 'reflexes' | 'outro'
export interface Chapter { id: ChapterId; beats: Beat[] }

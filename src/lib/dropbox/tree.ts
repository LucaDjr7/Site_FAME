import { getDropboxClient } from './client'
import type { DropboxNode } from '@/types'

export async function buildTree(path: string = ''): Promise<DropboxNode[]> {
  const dbx = getDropboxClient()
  const res = await dbx.filesListFolder({ path, recursive: false })
  const nodes: DropboxNode[] = res.result.entries.map(entry => ({
    id: (entry as { id?: string }).id ?? entry.path_lower!,
    name: entry.name,
    path_lower: entry.path_lower!,
    is_folder: entry['.tag'] === 'folder',
  }))
  return nodes.sort((a, b) =>
    a.is_folder === b.is_folder ? a.name.localeCompare(b.name) : a.is_folder ? -1 : 1
  )
}

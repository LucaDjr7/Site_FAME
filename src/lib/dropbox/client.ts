import { Dropbox } from 'dropbox'

let _client: Dropbox | null = null

export function getDropboxClient(): Dropbox {
  if (!_client) {
    const token = process.env.DROPBOX_ACCESS_TOKEN
    if (!token) throw new Error('DROPBOX_ACCESS_TOKEN not configured')
    _client = new Dropbox({ accessToken: token })
  }
  return _client
}

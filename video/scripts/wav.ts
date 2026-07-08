// Durée d'un WAV PCM : data size / byteRate. Le chunk `data` est cherché par
// balayage (certains encodeurs insèrent LIST/INFO avant).
export function wavDurationMs(buf: Buffer): number {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE buffer')
  }
  const byteRate = buf.readUInt32LE(28)
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    let size = buf.readUInt32LE(off + 4)
    if (id === 'data') {
      // Certains encodeurs streaming (dont l'API TTS d'OpenAI) écrivent une
      // taille sentinelle (0xFFFFFFFF) pour le chunk `data` car la longueur
      // finale n'est pas connue au moment d'écrire le header. Dans ce cas,
      // ou si la taille déclarée dépasse le buffer, on se rabat sur le
      // nombre d'octets réellement présents après le header du chunk.
      const remaining = buf.length - off - 8
      if (size === 0xffffffff || size > remaining) size = remaining
      return Math.round((size / byteRate) * 1000)
    }
    off += 8 + size + (size % 2)
  }
  throw new Error('No data chunk found')
}

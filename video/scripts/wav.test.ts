import { describe, it, expect } from 'vitest'
import { wavDurationMs } from './wav'

function makeWav(dataBytes: number, byteRate: number): Buffer {
  const buf = Buffer.alloc(44 + dataBytes)
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + dataBytes, 4); buf.write('WAVE', 8)
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(byteRate, 24); buf.writeUInt32LE(byteRate, 28)
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34)
  buf.write('data', 36); buf.writeUInt32LE(dataBytes, 40)
  return buf
}

describe('wavDurationMs', () => {
  it('calcule la durée depuis byteRate et data size', () => {
    // 48000 B/s, 96000 octets de data → 2000 ms
    expect(wavDurationMs(makeWav(96000, 48000))).toBe(2000)
  })
  it('rejette un buffer non-RIFF', () => {
    expect(() => wavDurationMs(Buffer.from('not a wav file at all'))).toThrow()
  })
  it('retombe sur la taille réelle du buffer quand la taille du chunk data est une sentinelle 0xFFFFFFFF (streaming)', () => {
    // L'API TTS streaming d'OpenAI écrit ce marqueur car la taille finale
    // n'est pas connue au moment de l'écriture du header.
    const buf = makeWav(96000, 48000)
    buf.writeUInt32LE(0xffffffff, 40)
    expect(wavDurationMs(buf)).toBe(2000)
  })
})

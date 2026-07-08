import { describe, it, expect } from 'vitest'
import { CHAPTERS } from './scenario'
import { NARRATION as FR } from './narration.fr'
import { NARRATION as EN } from './narration.en'

describe('scenario', () => {
  it('mêmes clés de narration en FR et EN, aucune vide', () => {
    expect(Object.keys(FR).sort()).toEqual(Object.keys(EN).sort())
    for (const rec of [FR, EN]) for (const [k, v] of Object.entries(rec)) {
      expect(v.trim(), k).not.toBe('')
    }
  })
  it('chaque beat référence une ligne de narration existante', () => {
    for (const ch of CHAPTERS) for (const beat of ch.beats) {
      expect(FR[beat.line], beat.line).toBeTruthy()
    }
  })
  it('chaque chapitre a un titre de carte', () => {
    for (const ch of CHAPTERS) expect(FR[`chapter.${ch.id}.title`]).toBeTruthy()
  })
  it('ids de chapitres uniques et dans l\'ordre du spec', () => {
    expect(CHAPTERS.map(c => c.id)).toEqual(['welcome', 'tour', 'subject', 'daily', 'reflexes', 'outro'])
  })
})

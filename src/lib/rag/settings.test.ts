import { describe, it, expect, afterEach } from 'vitest'
import { isAssistantEnabled } from './settings'

function service(enabled: boolean) {
  return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { value: enabled }, error: null }) }) }) }) }
}
afterEach(() => { delete process.env.ASSISTANT_DISABLED })

describe('isAssistantEnabled', () => {
  it('false si ASSISTANT_DISABLED=1', async () => {
    process.env.ASSISTANT_DISABLED = '1'
    expect(await isAssistantEnabled({ service: service(true) as never })).toBe(false)
  })
  it('false si ASSISTANT_DISABLED=true', async () => {
    process.env.ASSISTANT_DISABLED = 'true'
    expect(await isAssistantEnabled({ service: service(true) as never })).toBe(false)
  })
  it('reflète app_settings sinon', async () => {
    expect(await isAssistantEnabled({ service: service(true) as never })).toBe(true)
    expect(await isAssistantEnabled({ service: service(false) as never })).toBe(false)
  })
})

// Builder chaînable : chaque méthode renvoie le même proxy (chaînable) ET est
// thenable (await renvoie `result`). Couvre les chaînes Supabase utilisées par
// les routes : from/select/insert/update/delete/eq/order/limit/single/maybeSingle.
export type ServiceResult = { data?: unknown; error?: unknown }

export function makeServiceMock(result: ServiceResult = { data: [], error: null }) {
  const calls: { method: string; args: unknown[] }[] = []
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop: string) {
      if (prop === 'then') {
        // rend l'objet awaitable → résout vers `result`
        return (resolve: (v: ServiceResult) => void) => resolve(result)
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args })
        return chain
      }
    },
  }
  const chain = new Proxy({}, handler)
  // `client` est un objet non-thenable (pas de prop `then`) dont les méthodes
  // délèguent vers `chain`. Cela évite qu'un `await createServiceClient()` ne
  // résolve le proxy lui-même au lieu de le renvoyer en tant que client.
  const clientHandler: ProxyHandler<Record<string, unknown>> = {
    get(_t, prop: string) {
      if (prop === 'then') return undefined
      return (...args: unknown[]) => {
        calls.push({ method: prop, args })
        return chain
      }
    },
  }
  const client = new Proxy({}, clientHandler)
  return { client: client as unknown, calls, result }
}

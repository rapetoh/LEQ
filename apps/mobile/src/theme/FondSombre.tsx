import { createContext, useContext, type ReactNode } from 'react'

// Whether what renders here sits on bleu nuit. A button, a title or a door on a dark ground has
// to draw itself light, and until now every caller had to remember to say so: three buttons drew
// bleu nuit on bleu nuit on 2026-09-17, three more on 2026-09-19, each time a `surFondSombre`
// that nobody passed. The ground answers the question itself now, so the omission cannot happen.

const ContexteFond = createContext(false)

/** Wraps a dark surface: everything inside it reads `useFondSombre()` as true. */
export function FondSombre({ sombre = true, children }: { sombre?: boolean; children: ReactNode }) {
  return <ContexteFond.Provider value={sombre}>{children}</ContexteFond.Provider>
}

export function useFondSombre(): boolean {
  return useContext(ContexteFond)
}

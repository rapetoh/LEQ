import { useMemo, useState } from 'react'

/**
 * Search over a list, on the fields a person would actually type. Kept here because every bank
 * page needs it and none of them should grow past a screen without one.
 */
export function useRecherche<T>(
  elements: readonly T[] | undefined,
  champs: (element: T) => ReadonlyArray<string | null | undefined>,
) {
  const [recherche, setRecherche] = useState('')
  const resultats = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    if (terme === '') return [...(elements ?? [])]
    return (elements ?? []).filter((element) =>
      champs(element).some((champ) => (champ ?? '').toLowerCase().includes(terme)),
    )
    // `champs` is written inline at the call site, so it is new on every render; the list and
    // the term are what actually decide the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, recherche])

  return { recherche, setRecherche, resultats, actif: recherche.trim() !== '' }
}

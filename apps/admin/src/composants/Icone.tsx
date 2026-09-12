/**
 * The icons of the space. Drawn here rather than pulled from a set, so each one is chosen for
 * what its page actually does and they share one stroke weight, one grid and one visual family.
 *
 * The rule they follow: the icon says the thing, not the category. "Défis" is the path through
 * the acts, so it is a path. "Grille" is the criteria a take is read against, so it is a
 * checklist. "Thèses" is two positions facing each other, so it is two bubbles. Nothing here is
 * a generic document or a generic gear.
 */
export type NomIcone =
  | 'accueil'
  | 'configuration'
  | 'drapeaux'
  | 'defis'
  | 'exercices'
  | 'recompenses'
  | 'echanges'
  | 'grille'
  | 'annonces'
  | 'ateliers'
  | 'sujets'
  | 'theses'
  | 'moderation'
  | 'utilisateurs'
  | 'exports'

const CHEMINS: Record<NomIcone, React.ReactNode> = {
  // A dashboard: the panels of what is going on.
  accueil: (
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.6" />
      <rect x="14" y="3" width="7" height="5" rx="1.6" />
      <rect x="3" y="15" width="7" height="6" rx="1.6" />
      <rect x="14" y="12" width="7" height="9" rx="1.6" />
    </>
  ),
  // Sliders, because this page is values being set, not a machine being configured.
  configuration: (
    <>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="10" cy="17" r="2.2" />
    </>
  ),
  // A flag, the page's own name: what is raised and what is not.
  drapeaux: (
    <>
      <path d="M6 21V4" />
      <path d="M6 4.5h11l-2.2 3.6L17 11.7H6" />
    </>
  ),
  // The path through the acts, step after step.
  defis: (
    <>
      <path d="M5 19c4 0 4-6 8-6s4-6 6-6" />
      <circle cx="5" cy="19" r="1.8" />
      <circle cx="13" cy="13" r="1.8" />
      <circle cx="19" cy="7" r="1.8" />
    </>
  ),
  // A stopwatch: a remediation exercise is thirty seconds.
  exercices: (
    <>
      <circle cx="12" cy="13.5" r="7" />
      <path d="M12 10v3.5l2.2 2.2M9.5 3h5M12 3v3.5" />
    </>
  ),
  // A gift.
  recompenses: (
    <>
      <rect x="3.5" y="10" width="17" height="10.5" rx="1.6" />
      <path d="M3.5 10h17M12 10v10.5" />
      <path d="M12 10S9.5 4.5 7 5.6 9.6 10 12 10zM12 10s2.5-5.5 5-4.4S14.4 10 12 10z" />
    </>
  ),
  // Two arrows: points go one way, a reward comes back.
  echanges: (
    <>
      <path d="M4 9h13l-3.2-3.4M20 15H7l3.2 3.4" />
    </>
  ),
  // The criteria a take is read against.
  grille: (
    <>
      <path d="M4 6.5h2l1.4 1.6L10 5.5M13 7h7" />
      <path d="M4 12.5h2l1.4 1.6L10 11.5M13 13h7" />
      <path d="M4 18.5h2l1.4 1.6L10 17.5M13 19h7" />
    </>
  ),
  // A megaphone: one message, pushed out, once.
  annonces: (
    <>
      <path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H8l8 4.5V5.5L8 10H5.5A1.5 1.5 0 0 0 4 11.5z" />
      <path d="M19 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  // People in a room: a workshop is a group with Rebecca.
  ateliers: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <circle cx="16.5" cy="9.5" r="2.3" />
      <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M16 14.2c2.6.2 4.5 2 4.5 4.8" />
    </>
  ),
  // The subject everyone speaks on this week.
  sujets: (
    <>
      <path d="M20 13.5a3 3 0 0 1-3 3H9l-4 3.5V7a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3z" />
      <path d="M8.5 8.5h7M8.5 12h4.5" />
    </>
  ),
  // Two positions facing each other: the debate.
  theses: (
    <>
      <path d="M3.5 11.5a2.5 2.5 0 0 1 2.5-2.5h4.5a2.5 2.5 0 0 1 2.5 2.5v2A2.5 2.5 0 0 1 10.5 16H8l-3 2.5V16a2.5 2.5 0 0 1-1.5-2.3z" />
      <path d="M10.5 6.5A2.5 2.5 0 0 1 13 4h5a2.5 2.5 0 0 1 2.5 2.5v2A2.5 2.5 0 0 1 18 11" />
    </>
  ),
  // A shield: what is kept out.
  moderation: (
    <>
      <path d="M12 3.2 19.5 6v5.5c0 4.4-3 7.7-7.5 9.3-4.5-1.6-7.5-4.9-7.5-9.3V6z" />
      <path d="M9.2 12.2l2 2 3.6-3.9" />
    </>
  ),
  utilisateurs: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c0-3.6 3-6.2 7-6.2s7 2.6 7 6.2" />
    </>
  ),
  // A page leaving: a copy of someone's data, asked for and sent.
  exports: (
    <>
      <path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19v-8" />
      <path d="M13.5 3.5V10H18" />
      <path d="M12 13.5v5M9.6 16.2 12 18.6l2.4-2.4" />
    </>
  ),
}

export function Icone({
  nom,
  taille = 18,
  className,
}: {
  nom: NomIcone
  taille?: number
  className?: string
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {CHEMINS[nom]}
    </svg>
  )
}

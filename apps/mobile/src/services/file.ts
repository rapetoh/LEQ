// The local queue of takes: persistence, files, network, and the send loop.
// Every dependency is injected so the loop is testable without a phone.
import {
  aEnvoyer,
  abandonnerEnregistrementInterrompu,
  annuler as annulerEntree,
  creerEntree,
  estExpiree,
  expirer,
  marquerEchecEnvoi,
  marquerEnvoi,
  marquerEnvoyee,
  nettoyer,
  remplacer,
  reprendreEnvoiInterrompu,
  terminerEnregistrement,
  type DemarragePrise,
  type EntreeFile,
} from './fileMachine'

export interface DependancesFile {
  lireIndex(): Promise<EntreeFile[]>
  ecrireIndex(entrees: EntreeFile[]): Promise<void>
  supprimerFichier(chemin: string): Promise<void>
  estEnLigne(): Promise<boolean>
  /** Uploads the file and inserts the row; must be idempotent by entry id. */
  televerser(entree: EntreeFile): Promise<void>
  maintenant(): Date
  joursExpiration(): number
}

export type EcouteurFile = (entrees: readonly EntreeFile[]) => void

export class FileLocale {
  private entrees: EntreeFile[] = []
  private chargee = false
  private verrou: Promise<unknown> = Promise.resolve()
  private ecouteurs = new Set<EcouteurFile>()
  private envoiEnCours = false

  constructor(private readonly deps: DependancesFile) {}

  /** Serialises every mutation of the index. */
  private async exclusif<T>(travail: () => Promise<T>): Promise<T> {
    const precedent = this.verrou
    let liberer!: () => void
    this.verrou = new Promise<void>((resolve) => {
      liberer = resolve
    })
    await precedent
    try {
      return await travail()
    } finally {
      liberer()
    }
  }

  private async sauver(entrees: EntreeFile[]): Promise<void> {
    this.entrees = entrees
    await this.deps.ecrireIndex(entrees)
    for (const ecouteur of this.ecouteurs) ecouteur(this.entrees)
  }

  abonner(ecouteur: EcouteurFile): () => void {
    this.ecouteurs.add(ecouteur)
    ecouteur(this.entrees)
    return () => this.ecouteurs.delete(ecouteur)
  }

  lire(): readonly EntreeFile[] {
    return this.entrees
  }

  /**
   * Loads the index and repairs it: interrupted takes are dropped (their file too),
   * interrupted sends go back to waiting, expired takes lose their file, old terminal
   * entries leave.
   */
  async charger(): Promise<void> {
    await this.exclusif(async () => {
      const maintenant = this.deps.maintenant()
      const jours = this.deps.joursExpiration()
      let entrees = await this.deps.lireIndex()
      const reparees: EntreeFile[] = []
      for (const brute of entrees) {
        let entree = reprendreEnvoiInterrompu(abandonnerEnregistrementInterrompu(brute, maintenant))
        if (estExpiree(entree, maintenant, jours)) entree = expirer(entree, maintenant)
        if (
          entree.etat !== brute.etat &&
          (entree.etat === 'annulee' || entree.etat === 'expiree') &&
          entree.chemin
        ) {
          await this.supprimerSansEchouer(entree.chemin)
          entree = { ...entree, chemin: null }
        }
        reparees.push(entree)
      }
      entrees = nettoyer(reparees, maintenant)
      this.chargee = true
      await this.sauver(entrees)
    })
  }

  private exigerChargee(): void {
    if (!this.chargee)
      throw new Error('FileLocale.charger() doit être appelé avant toute opération.')
  }

  async commencer(demarrage: DemarragePrise): Promise<EntreeFile> {
    this.exigerChargee()
    return this.exclusif(async () => {
      const entree = creerEntree(demarrage)
      await this.sauver(remplacer(this.entrees, entree))
      return entree
    })
  }

  async terminer(id: string, prise: { chemin: string; duree_s: number }): Promise<EntreeFile> {
    this.exigerChargee()
    return this.exclusif(async () => {
      const entree = terminerEnregistrement(this.trouver(id), prise)
      await this.sauver(remplacer(this.entrees, entree))
      return entree
    })
  }

  async annuler(id: string): Promise<void> {
    this.exigerChargee()
    await this.exclusif(async () => {
      const courante = this.trouver(id)
      const entree = annulerEntree(courante, this.deps.maintenant())
      if (courante.chemin) await this.supprimerSansEchouer(courante.chemin)
      await this.sauver(remplacer(this.entrees, { ...entree, chemin: null }))
    })
  }

  /** Sends what can be sent. Safe to call from every trigger; runs once at a time. */
  async envoyerEnAttente(): Promise<{ envoyees: number; echecs: number; horsLigne: boolean }> {
    this.exigerChargee()
    if (this.envoiEnCours) return { envoyees: 0, echecs: 0, horsLigne: false }
    this.envoiEnCours = true
    try {
      if (!(await this.deps.estEnLigne())) return { envoyees: 0, echecs: 0, horsLigne: true }
      let envoyees = 0
      let echecs = 0
      for (const candidate of aEnvoyer(this.entrees, this.deps.maintenant())) {
        const enEnvoi = await this.exclusif(async () => {
          const entree = marquerEnvoi(this.trouver(candidate.id))
          await this.sauver(remplacer(this.entrees, entree))
          return entree
        })
        try {
          await this.deps.televerser(enEnvoi)
          await this.exclusif(async () => {
            if (enEnvoi.chemin) await this.supprimerSansEchouer(enEnvoi.chemin)
            await this.sauver(
              remplacer(
                this.entrees,
                marquerEnvoyee(this.trouver(enEnvoi.id), this.deps.maintenant()),
              ),
            )
          })
          envoyees += 1
        } catch (erreur) {
          echecs += 1
          const message = erreur instanceof Error ? erreur.message : String(erreur)
          await this.exclusif(async () => {
            await this.sauver(
              remplacer(
                this.entrees,
                marquerEchecEnvoi(this.trouver(enEnvoi.id), message, this.deps.maintenant()),
              ),
            )
          })
        }
      }
      return { envoyees, echecs, horsLigne: false }
    } finally {
      this.envoiEnCours = false
    }
  }

  private trouver(id: string): EntreeFile {
    const entree = this.entrees.find((e) => e.id === id)
    if (!entree) throw new Error(`Prise inconnue dans la file : ${id}`)
    return entree
  }

  private async supprimerSansEchouer(chemin: string): Promise<void> {
    try {
      await this.deps.supprimerFichier(chemin)
    } catch (erreur) {
      console.warn('file: fichier non supprimé', chemin, erreur)
    }
  }
}

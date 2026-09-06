// Runs one or more transcribers over the corpus and writes a Markdown report.
//   node dist/bench/src/cli.js --fournisseurs stub,deepgram --corpus bench/corpus --sortie bench/rapports
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { calculerWer } from '../../src/wer.js'
import { ADAPTATEURS, ErreurCleManquante } from './adaptateurs/index.js'
import { chargerCorpus } from './corpus.js'
import { rendreRapport, type ResultatFournisseur } from './rapport.js'

function lireOption(args: string[], nom: string, defaut: string): string {
  const index = args.indexOf(`--${nom}`)
  const valeur = index >= 0 ? args[index + 1] : undefined
  return valeur ?? defaut
}

export async function executerBench(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const noms = lireOption(args, 'fournisseurs', 'stub')
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)
  const dossierCorpus = path.resolve(lireOption(args, 'corpus', 'bench/corpus'))
  const dossierSortie = path.resolve(lireOption(args, 'sortie', 'bench/rapports'))
  const corpus = await chargerCorpus(dossierCorpus)
  if (corpus.length === 0)
    throw new Error(
      `Corpus vide dans ${dossierCorpus} : ajoute des enregistrements (voir bench/README.md).`,
    )

  const fournisseurs: ResultatFournisseur[] = []
  for (const nom of noms) {
    const adaptateur = ADAPTATEURS[nom]
    if (!adaptateur) {
      console.error(`Fournisseur inconnu : ${nom}`)
      continue
    }
    let transcripteur
    try {
      transcripteur = adaptateur.creer(env)
    } catch (erreur) {
      const message =
        erreur instanceof ErreurCleManquante ? 'clé API manquante' : (erreur as Error).message
      fournisseurs.push({ fiche: adaptateur.fiche, indisponible: message, resultats: [] })
      console.error(`${nom} : ${message}`)
      continue
    }
    const resultat: ResultatFournisseur = {
      fiche: adaptateur.fiche,
      indisponible: null,
      resultats: [],
    }
    for (const enregistrement of corpus) {
      const debut = performance.now()
      const transcription = await transcripteur.transcrireFichier(enregistrement.audio, {
        mime: 'audio/wav',
        langue: 'fr',
      })
      const latence_ms = performance.now() - debut
      const { wer } = calculerWer(enregistrement.reference, transcription.texte)
      resultat.resultats.push({
        id: enregistrement.id,
        accent: enregistrement.accent,
        debit: enregistrement.debit,
        bruit: enregistrement.bruit,
        duree_s: enregistrement.duree_s,
        wer,
        latence_ms,
      })
      console.error(
        `${nom} ${enregistrement.id} WER ${(wer * 100).toFixed(1)} % en ${Math.round(latence_ms)} ms`,
      )
    }
    fournisseurs.push(resultat)
  }

  const date = new Date().toISOString().slice(0, 10)
  const rapport = rendreRapport(date, dossierCorpus, fournisseurs)
  await mkdir(dossierSortie, { recursive: true })
  const chemin = path.join(dossierSortie, `bench-stt-${date}.md`)
  await writeFile(chemin, rapport, 'utf8')
  return chemin
}

const estPrincipal =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (estPrincipal) {
  executerBench(process.argv.slice(2))
    .then((chemin) => console.error(`Rapport écrit : ${chemin}`))
    .catch((erreur: unknown) => {
      console.error(erreur instanceof Error ? erreur.message : erreur)
      process.exit(1)
    })
}

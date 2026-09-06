import { useRouter } from 'expo-router'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { CartePlaceholder } from '@/components/CartePlaceholder'
import { EnteteDefi } from '@/components/EnteteDefi'
import { EnteteEcran } from '@/components/EnteteEcran'
import { Bouton } from '@/components/ui/Bouton'
import { Carte } from '@/components/ui/Carte'
import { Titre } from '@/components/ui/Titre'
import { t } from '@/i18n/fr'
import { useDrapeaux } from '@/services/configuration'
import { useEtapeDuJour } from '@/services/parcours'
import { etatAujourdhui, minutesDe, positionDefi, rythmeDeFormule } from '@/services/rythme'
import { useTheme } from '@/theme/ThemeProvider'
import { espaces, typographie } from '@/theme/tokens'

// B1 · Aujourd'hui (C0 variant while the Arena is off). The step of the day IS the next
// step of the path: title, act, position, points, and the rhythm of the formula. The tip,
// the points, the week's subject and Rebecca's offers arrive with Phases 5 to 7.

function dateDuJour(): string {
  const brut = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return brut.charAt(0).toUpperCase() + brut.slice(1)
}

export default function Aujourdhui() {
  const theme = useTheme()
  const drapeaux = useDrapeaux()
  const areneActive = drapeaux.data?.arene === true

  return (
    <ScrollView style={{ backgroundColor: theme.fond }} contentContainerStyle={styles.contenu}>
      <EnteteEcran surtitre={dateDuJour()} titre={t('aujourdhui.salutationSansPrenom')} />

      <View style={styles.sections}>
        <CarteDuJour />

        <View style={styles.section}>
          <Titre niveau="section">{t('aujourdhui.conseilDuJour')}</Titre>
          <CartePlaceholder phrase={t('aujourdhui.placeholderConseil')} />
        </View>

        <CartePlaceholder
          titre={t('aujourdhui.pointsLibelle')}
          phrase={t('aujourdhui.placeholderPoints')}
        />

        {areneActive ? (
          <CartePlaceholder
            titre={t('aujourdhui.sujetSemaine')}
            phrase={t('aujourdhui.placeholderSujet')}
          />
        ) : (
          <Carte teinte="douce">
            <Text style={[typographie.titreCarte, { color: theme.texte }]}>
              {t('aujourdhui.areneBientotTitre')}
            </Text>
            <Text style={[typographie.corps, styles.espaceHaut, { color: theme.texteSecondaire }]}>
              {t('aujourdhui.areneBientot')}
            </Text>
          </Carte>
        )}

        <View style={styles.section}>
          <Titre niveau="section">{t('aujourdhui.avecRebecca')}</Titre>
          <CartePlaceholder phrase={t('aujourdhui.placeholderRebecca')} />
        </View>
      </View>
    </ScrollView>
  )
}

/** The orange card: the step of the day in its five states. */
export function CarteDuJour() {
  const theme = useTheme()
  const router = useRouter()
  const jour = useEtapeDuJour()

  if (jour.isPending) {
    return (
      <Carte teinte="orange" style={styles.defi}>
        <Text style={[typographie.etiquette, { color: theme.texteSecondaire }]}>
          {t('aujourdhui.defiDuJour', { minutes: 2 })}
        </Text>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('commun.chargement')}
        </Text>
      </Carte>
    )
  }

  if (jour.isError || !jour.data) {
    return (
      <Carte teinte="orange" style={styles.defi}>
        <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>
          {t('aujourdhui.erreurParcours')}
        </Text>
        <Bouton
          libelle={t('commun.reessayer')}
          variante="secondaire"
          onPress={() => void jour.refetch()}
        />
      </Carte>
    )
  }

  const donnees = jour.data
  const etat = etatAujourdhui(donnees)
  const rythme = t(`defi.${rythmeDeFormule(donnees.formule, donnees.rythme.limite_etapes)}`)
  const formule = t('defi.formule', {
    formule: donnees.formule === 'complet' ? 'Complet' : 'Gratuit',
    rythme,
  })

  if (etat.etat === 'defi' && donnees.etape && donnees.defi && donnees.acte) {
    const { etape, defi, acte } = donnees
    const position = positionDefi(acte, etape.ordre, etape.nb_etapes_acte)
    const cible = etat.rattrapage ? `/defi/${etape.id}/rattrapage` : `/defi/${etape.id}`
    return (
      <Carte teinte="orange" style={styles.defi}>
        <EnteteDefi
          surtitre={t('aujourdhui.defiDuJour', { minutes: minutesDe(defi.duree_max_s) })}
          points={t('aujourdhui.points', { points: defi.points })}
          titre={defi.titre}
          position={
            position.genre === 'derniere'
              ? t('defi.dernier', { acte: position.acte })
              : t('defi.positionCourte', position)
          }
        />
        <Bouton
          libelle={t('aujourdhui.jeMeLance')}
          onPress={() => router.push(cible)}
          accessibilityHint={defi.titre}
        />
        <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{formule}</Text>
      </Carte>
    )
  }

  const textes = {
    limite_jour: { titre: t('defi.termine.titre'), corps: t('defi.termine.corps') },
    limite_essais: { titre: t('defi.essaisEpuises.titre'), corps: t('defi.essaisEpuises.corps') },
    parcours_termine: {
      titre: t('defi.parcoursTermine.titre'),
      corps: t('defi.parcoursTermine.corps'),
    },
    aucune_etape: { titre: t('defi.aucuneEtape.titre'), corps: t('defi.aucuneEtape.corps') },
  } as const
  const cle = etat.etat === 'defi' ? 'aucune_etape' : etat.etat
  const texte = textes[cle]

  return (
    <Carte teinte={cle === 'aucune_etape' ? 'douce' : 'orange'} style={styles.defi}>
      <Text style={[typographie.titreCarte, { color: theme.texte }]}>{texte.titre}</Text>
      <Text style={[typographie.corps, { color: theme.texteSecondaire }]}>{texte.corps}</Text>
      {cle === 'limite_jour' ? (
        <Bouton
          libelle={t('defi.enchainer')}
          variante="secondaire"
          onPress={() => router.push('/defi/limite')}
        />
      ) : null}
      {cle === 'limite_jour' || cle === 'limite_essais' ? (
        <Bouton
          libelle={t('aujourdhui.voirCarte')}
          variante="texte"
          onPress={() => router.push('/(onglets)/defis')}
        />
      ) : null}
      <Text style={[typographie.petit, { color: theme.texteTertiaire }]}>{formule}</Text>
    </Carte>
  )
}

const styles = StyleSheet.create({
  contenu: { paddingBottom: espaces.xxl },
  sections: { paddingHorizontal: espaces.xl, gap: espaces.l },
  section: { gap: espaces.s },
  defi: { gap: espaces.m },
  espaceHaut: { marginTop: espaces.xs },
})

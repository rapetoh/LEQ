// The microphone permission, behind one function so the screens never depend on the
// audio library. react-native-audio-api owns the microphone (ADR-007); nothing else in
// the app may ask for it.
import { AudioManager, type PermissionStatus } from 'react-native-audio-api'

export type EtatMicro = 'accorde' | 'refuse' | 'indetermine'

function versEtat(statut: PermissionStatus): EtatMicro {
  if (statut === 'Granted') return 'accorde'
  if (statut === 'Denied') return 'refuse'
  return 'indetermine'
}

/** Current state without prompting. */
export async function lireEtatMicro(): Promise<EtatMicro> {
  return versEtat(await AudioManager.checkRecordingPermissions())
}

/** Shows the system prompt when the system still allows it; otherwise returns the current state. */
export async function demanderMicro(): Promise<EtatMicro> {
  return versEtat(await AudioManager.requestRecordingPermissions())
}

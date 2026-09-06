// The microphone permission, behind one function so the screens never depend on the
// audio library. Phase 0 asks through expo-audio, the first-party module, because the
// shell must run in a plain development build. Phase 1 brings the capture stack decided
// in docs/decisions/ADR-007-capture-audio.md (react-native-audio-api); this file then
// calls its requestRecordingPermissions() and expo-audio leaves the project. Nothing
// else in the app may import expo-audio.
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio'

export type EtatMicro = 'accorde' | 'refuse' | 'indetermine'

function versEtat(reponse: { granted: boolean; canAskAgain: boolean }): EtatMicro {
  if (reponse.granted) return 'accorde'
  return reponse.canAskAgain ? 'indetermine' : 'refuse'
}

/** Current state without prompting. */
export async function lireEtatMicro(): Promise<EtatMicro> {
  return versEtat(await getRecordingPermissionsAsync())
}

/** Shows the system prompt when the system still allows it; otherwise returns the current state. */
export async function demanderMicro(): Promise<EtatMicro> {
  return versEtat(await requestRecordingPermissionsAsync())
}

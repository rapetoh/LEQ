// The audio session belongs to the phone, not to a screen. Recording a take and holding a
// face-à-face both claim it, and leaving one screen for another put the teardown of the first
// after the startup of the second: `setAudioSessionActivity(false)` landed inside the new
// screen's startup, and the new recording began on a session that was no longer active. It gave
// back a file of silence, which looks exactly like someone who did not speak.
//
// So there is one door, and it opens and closes in order. A claim is a number; a release only
// applies when nobody has claimed the session since.
import { AudioManager } from 'react-native-audio-api'

export type OptionsSessionAudio = Parameters<typeof AudioManager.setAudioSessionOptions>[0]

/** A claim, to be given back to `rendreSessionAudio`. */
export type ReclamationAudio = number

let file: Promise<unknown> = Promise.resolve()
let derniere: ReclamationAudio = 0

function enfiler<T>(travail: () => Promise<T>): Promise<T> {
  const suite = file.then(travail, travail)
  file = suite.then(
    () => undefined,
    () => undefined,
  )
  return suite
}

/** Opens the session with these options and answers the claim that will have to release it. */
export function prendreSessionAudio(options: OptionsSessionAudio): Promise<ReclamationAudio> {
  return enfiler(async () => {
    derniere += 1
    const mienne = derniere
    AudioManager.setAudioSessionOptions(options)
    await AudioManager.setAudioSessionActivity(true)
    return mienne
  })
}

/** Gives the session back, unless someone has claimed it since. */
export function rendreSessionAudio(reclamation: ReclamationAudio | null): Promise<void> {
  return enfiler(async () => {
    if (reclamation === null || reclamation !== derniere) return
    await AudioManager.setAudioSessionActivity(false)
  })
}

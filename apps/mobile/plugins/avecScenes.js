// iOS 27 refuses to launch an app that has not adopted the scene life cycle: UIKit traps in
// `_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption` before anything is drawn. That
// is what closed LEQ on Roch's iPhone on 2026-10-10, on build 42, the day his phone ran 27.0.1.
//
// Expo 57.0.27 ships the scene delegate (`EXExpoAppSceneDelegate`) but the SDK 57 template does
// not wire it, so this plugin does, on every prebuild:
//   - Info.plist declares one window scene whose delegate is Expo's;
//   - the app delegate still creates React Native's factory, declares itself the provider the
//     scene delegate reads, and no longer opens a window of its own (the scene does).
// Links keep working: the scene delegate forwards URLs and activities to the app delegate.
//
// Each change is anchored on the template's own text and throws if the anchor is gone, so a new
// template fails the prebuild loudly instead of shipping an app that does not start.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

function remplacer(source, ancre, remplacement, quoi) {
  if (typeof ancre === 'string' ? !source.includes(ancre) : !ancre.test(source)) {
    throw new Error(`avecScenes : ${quoi} introuvable dans AppDelegate.swift, le modèle a changé`)
  }
  return source.replace(ancre, remplacement)
}

module.exports = function avecScenes(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
          },
        ],
      },
    }
    return c
  })

  config = withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('avecScenes : AppDelegate attendu en Swift')
    }
    let source = c.modResults.contents
    if (source.includes('ExpoReactNativeFactoryProvider')) return c
    source = remplacer(
      source,
      'class AppDelegate: ExpoAppDelegate {',
      'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {',
      'la déclaration de la classe',
    )
    source = remplacer(
      source,
      /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/,
      '    // The window and React Native are started by the scene delegate (plugins/avecScenes.js).\n',
      "l'ouverture de la fenêtre",
    )
    c.modResults.contents = source
    return c
  })

  return config
}

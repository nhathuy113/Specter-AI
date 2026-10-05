/** Game Mode — detect foreground games; profiles extensible per title. */

export interface GameProfile {
  id: string
  label: string
  /** Match process / app name (case-insensitive) */
  appPattern: RegExp
  /** Optional window title match */
  windowPattern?: RegExp
  /**
   * When false (default): pause 1s capture on alt-tab.
   * When true: keep capturing while this game session is active (future titles).
   */
  watchWhileBackground: boolean
}

export interface DetectedGame {
  profile: GameProfile
  appName: string
  windowTitle: string
}

/** Productivity / non-game — never start game capture. */
const NON_GAME_APP =
  /^(cursor|google chrome|chrome|brave browser|brave|safari|firefox|electron|specter|finder|system settings|code|visual studio|slack|discord|zoom|microsoft teams|zalo|telegram|whatsapp|mail|notes|terminal|iterm|activity monitor|steam|steam helper|steamhelper)$/i

const BROWSER_TITLE = /\b(google|youtube|facebook|gmail|http|www\.|\.com\b|search)\b/i

export const DEFAULT_GAME_PROFILES: GameProfile[] = [
  {
    id: 'hoi4',
    label: 'Hearts of Iron IV',
    appPattern: /^hoi4$/i,
    windowPattern: /hearts of iron/i,
    watchWhileBackground: false
  },
  {
    id: 'stellaris',
    label: 'Stellaris',
    appPattern: /^stellaris$/i,
    windowPattern: /stellaris/i,
    watchWhileBackground: false
  },
  {
    id: 'eu4',
    label: 'Europa Universalis IV',
    appPattern: /^(eu4|europa universalis)/i,
    watchWhileBackground: false
  },
  {
    id: 'ck3',
    label: 'Crusader Kings III',
    appPattern: /^ck3$/i,
    windowPattern: /crusader kings/i,
    watchWhileBackground: false
  }
]

const GENERIC_GAME_PROFILE: GameProfile = {
  id: 'generic',
  label: 'Game',
  appPattern: /.+/,
  watchWhileBackground: false
}

export function slugifyGameId(appName: string): string {
  return appName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'game'
}

export function matchGameProfile(
  appName: string,
  windowTitle: string,
  profiles: GameProfile[] = DEFAULT_GAME_PROFILES
): GameProfile | null {
  const app = appName.trim()
  const win = windowTitle.trim()
  if (!app) return null

  for (const p of profiles) {
    if (p.appPattern.test(app) || (p.windowPattern && p.windowPattern.test(win))) {
      return p
    }
  }
  return null
}

export function detectGame(
  appName: string,
  windowTitle: string,
  profiles: GameProfile[] = DEFAULT_GAME_PROFILES
): DetectedGame | null {
  const app = appName.trim()
  const win = windowTitle.trim()
  if (!app || NON_GAME_APP.test(app)) return null
  if (win && BROWSER_TITLE.test(win) && /chrome|brave|safari|firefox/i.test(app)) return null

  const matched = matchGameProfile(app, win, profiles)
  if (matched) {
    return { profile: matched, appName: app, windowTitle: win }
  }

  // Generic fallback: unknown app that isn't denylisted → treat as game
  if (IDE_LIKE.test(app)) return null
  return { profile: { ...GENERIC_GAME_PROFILE, id: slugifyGameId(app) }, appName: app, windowTitle: win }
}

const IDE_LIKE = /cursor|vscode|xcode|intellij|webstorm|pycharm/i

/** True when capture metadata shows the game is still the focused window. */
export function isGameStillForeground(
  session: DetectedGame,
  appName: string,
  windowTitle: string
): boolean {
  if (session.profile.watchWhileBackground) return true
  const app = appName.trim()
  const win = windowTitle.trim()
  if (session.profile.id !== 'generic') {
    return (
      session.profile.appPattern.test(app) ||
      (!!session.profile.windowPattern && session.profile.windowPattern.test(win))
    )
  }
  return slugifyGameId(app) === session.profile.id || app === session.appName
}

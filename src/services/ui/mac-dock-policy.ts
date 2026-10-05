export type MacActivation = 'regular' | 'accessory'

export interface MacDockPolicy {
  activation: MacActivation
  showDock: boolean
}

export function isLiveDevRenderer(rendererUrl: string | undefined): boolean {
  return !!rendererUrl
}

/** Prod stays out of the Dock. Live dev stays a normal Dock app. */
export function macDockPolicy(liveDev: boolean): MacDockPolicy {
  if (liveDev) return { activation: 'regular', showDock: true }
  return { activation: 'accessory', showDock: false }
}

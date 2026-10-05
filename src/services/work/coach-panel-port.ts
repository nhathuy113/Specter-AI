export interface CoachPanelSink {
  isDisposed(): boolean
  start(labels: string[]): void
  update(index: number, content: string, done: boolean): void
  done(model: string): void
}

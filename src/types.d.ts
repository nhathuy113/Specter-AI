// Type declarations for modules without @types packages

declare module 'screenshot-desktop' {
  interface ScreenshotDisplay {
    id: number
    name: string
    primary?: boolean
  }

  interface ScreenshotOptions {
    format?: 'png' | 'jpg'
    screen?: number
    filename?: string
  }

  function screenshot(options?: ScreenshotOptions): Promise<Buffer>
  namespace screenshot {
    function listDisplays(): Promise<ScreenshotDisplay[]>
  }
  export = screenshot
}

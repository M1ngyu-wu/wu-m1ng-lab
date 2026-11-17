/// <reference types="astro/client" />
declare module '@pagefind/default-ui' {
  export class PagefindUI {
    constructor(options: {
      element: string;
      bundlePath?: string;
      baseUrl?: string;
      showSubResults?: boolean;
      showImages?: boolean;
      translations?: Record<string, string>;
    });
  }
}

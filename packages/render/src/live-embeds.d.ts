/** What a live frame may do: scripts, its own origin, pop-ups and forms; no camera, microphone or location. */
export declare const LIVE_EMBED_SANDBOX: string;

/**
 * Whether an address is on the origin of the page that presents it. Such a page is never shown live, whatever the host's `embeds`
 * option says: a sandbox that allows scripts and its own origin does not contain a page of the host's own origin.
 */
export declare function isSameOriginPage(src: string, origin: string | undefined): boolean;

/** An embed a slide's SVG draws (the renderer marks it with `data-opf-embed*`): its path, address, title and the element whose box is the frame. */
export interface DrawnEmbed { path: string; src: string; title: string; area: Element }

/** The embeds an SVG slide draws. */
export declare function embedsOf(svg: Element | null | undefined): DrawnEmbed[];

export interface MountLiveEmbedsOptions {
  /** The element that holds the slide's SVG; the frames go in a layer appended to it. */
  host: HTMLElement;
  svg: Element;
  /** The host's answer for an address: true shows that page live. Absent: no page is shown live. */
  embeds?: (src: string) => boolean;
  /** The presenting page's origin. Default: the document's. */
  origin?: string;
  document?: Document;
}

export interface LiveEmbeds {
  frames: HTMLIFrameElement[];
  /** Remove the layer and its frames. */
  destroy(): void;
}

/**
 * Put a sandboxed frame (`sandbox`, `referrerpolicy="no-referrer"`, `loading="lazy"`, no `allow`) over each embed of `svg` that the host
 * allows. The static form stays under it until the frame loads. A click on a live frame never changes the slide; Tab enters a frame
 * only after a click on it.
 */
export declare function mountLiveEmbeds(options: MountLiveEmbedsOptions): LiveEmbeds;

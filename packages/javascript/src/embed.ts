/**
 * The `embed` content kind (FR-08): a live web page that a web presenter may show when its host allows, and a linked picture
 * everywhere else. Engines never load `src`; these helpers only read the authored value, so every engine names, proportions and
 * links an embed the same way.
 */

/** A frame with no `aspectRatio` is 16:9, as a video's is. */
export const EMBED_DEFAULT_ASPECT = 16 / 9;

/** An embed as authored in object form (a string is `{ src }`). */
export interface EmbedValue {
  src: string;
  title?: string;
  aspectRatio?: number;
  preview?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The object form of an embed value (the string shorthand is `{ src }`), or undefined when the value is neither. */
export function embedValue(value: unknown): EmbedValue | undefined {
  if (typeof value === 'string') return { src: value };
  if (!isRecord(value) || typeof value.src !== 'string') return undefined;
  return {
    src: value.src,
    ...(typeof value.title === 'string' && value.title !== '' ? { title: value.title } : {}),
    ...(typeof value.aspectRatio === 'number' && value.aspectRatio > 0 ? { aspectRatio: value.aspectRatio } : {}),
    ...(typeof value.preview === 'string' && value.preview !== '' ? { preview: value.preview } : {}),
  };
}

/** The site an address names: its host without a leading `www.`; the address itself when it does not parse. */
export function embedSite(src: string): string {
  try { return new URL(src).host.replace(/^www\./i, ''); } catch { return src; }
}

/** What the page is called: the authored `title`, else the site name. */
export function embedTitle(value: unknown): string {
  const embed = embedValue(value);
  return embed ? embed.title ?? embedSite(embed.src) : '';
}

/** Width to height of the frame: the authored `aspectRatio`, else 16:9. */
export function embedAspect(value: unknown): number {
  return embedValue(value)?.aspectRatio ?? EMBED_DEFAULT_ASPECT;
}

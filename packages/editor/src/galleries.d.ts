export interface GalleryOptions {
  fetch?: typeof fetch;
  signal?: AbortSignal;
  base?: string;
  origin?: string;
}
export interface GalleryItem {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
  url?: string;
  raw?: unknown;
}
export interface OpfGallery {
  name: string;
  url: string;
  items: GalleryItem[];
}
export declare function galleryUrl(input: string, base?: string): URL;
export declare function normalizeGalleryUrl(
  input: string,
  base?: string,
): string;
export declare function galleryItemUrl(input: string, base?: string): string;
export declare function fetchGalleryJson(
  input: string,
  options?: GalleryOptions,
): Promise<any>;
export declare function loadOpfGallery(
  input: string,
  options?: GalleryOptions,
): Promise<OpfGallery>;
export declare function loadOpfGalleryItem(
  item: GalleryItem,
  options?: GalleryOptions & { gallery?: string },
): Promise<any>;

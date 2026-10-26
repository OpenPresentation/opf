/** CE-18 studio kit (internal): the selection model (an ordered list of sibling keys; the last is the primary). */
export interface KitSelectionAdapter<Key> {
  equals?(a: Key, b: Key): boolean;
  copy?(key: Key): Key;
  exists(key: Key): boolean;
  parent(key: Key): Key | null;
  firstChild(key: Key): Key | null;
  sibling(key: Key, delta: number): Key | null;
  first(): Key | null;
  siblings?(key: Key): Key[];
}
export interface KitSelection<Key> {
  readonly items: Key[];
  readonly primary: Key | null;
  has(key: Key): boolean;
  existing(keys: Key[]): Key[];
  set(keys: Key[], options?: { source?: string }): boolean;
  replace(keys: Key[]): void;
  prune(): void;
  snapshot(): Key[];
  add(key: Key, options?: { source?: string }): boolean;
  toggle(key: Key, options?: { source?: string }): boolean;
  range(key: Key, options?: { source?: string }): boolean;
  selectParent(options?: { source?: string }): boolean;
  selectChild(options?: { source?: string }): boolean;
  selectSibling(delta: number, options?: { source?: string }): boolean;
  selectSiblings(options?: { source?: string }): boolean;
}
export declare function createSelection<Key>(adapter: KitSelectionAdapter<Key>, options?: { onChange?(event: { source?: string }): void }): KitSelection<Key>;
export declare function clickTarget<Node, Key>(chain: Node[], primary: Key | null, options?: { shift?: boolean; equals?(a: Key, b: Key): boolean; keyOf?(node: Node): Key; isContainer?(node: Node): boolean }): Node | null;

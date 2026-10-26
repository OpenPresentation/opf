/** CE-18 studio kit (internal): gesture history (drafts while a gesture runs, one step at its end) and a snapshot history. */
export interface KitGestureAdapter<Snapshot, Draft> {
  snapshot(): Snapshot;
  preview(draft: Draft, message?: string): void;
  commit(start: Snapshot, info: { label: string; message: string }): boolean;
  restore(start: Snapshot): void;
}
export interface KitGesture<Draft> {
  readonly active: boolean;
  readonly label: string | null;
  begin(label: string): boolean;
  update(draft: Draft, message?: string): boolean;
  end(message?: string): boolean;
  cancel(): boolean;
  reset(): void;
}
export declare function createGesture<Snapshot, Draft>(adapter: KitGestureAdapter<Snapshot, Draft>): KitGesture<Draft>;
export interface KitHistory<Snapshot extends object> {
  readonly index: number;
  readonly size: number;
  readonly head: (Snapshot & { coalesce?: string | null; time?: number }) | undefined;
  reset(snapshot: Snapshot): void;
  push(snapshot: Snapshot, coalesce?: string | null): void;
  append(snapshot: Snapshot): void;
  canUndo(): boolean;
  canRedo(): boolean;
  go(step: number): (Snapshot & { coalesce?: string | null; time?: number }) | null;
}
export declare function createHistory<Snapshot extends object>(options?: { limit?: number; coalesceMs?: number; now?(): number }): KitHistory<Snapshot>;

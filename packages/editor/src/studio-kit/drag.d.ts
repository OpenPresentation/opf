/** CE-18 studio kit (internal): the drag controller (threshold, touch hold, trial drop, Escape), pointer tracking and the drag label. */
import type { KitDom } from "./dom.js";
export interface KitPress<Payload> { x: number; y: number; id: number; type: string; time: number; payload: Payload }
export interface KitDragOptions<Payload, Session> {
  doc?: Document;
  threshold?: number;
  holdMs?: number;
  now?(): number;
  onStart?(press: KitPress<Payload>): Session | null | undefined;
  onStarted?(session: Session): void;
  onMove?(session: Session, event: PointerEvent): void;
  onEnd?(session: Session, info: { cancelled: boolean }): void;
  onDrop?(session: Session, event: PointerEvent): void;
  onEscape?(session: Session): void;
}
export interface KitDragController<Payload, Session> {
  readonly active: Session | null;
  readonly pending: KitPress<Payload> | null;
  press(event: PointerEvent, payload: Payload): void;
  move(event: PointerEvent): boolean;
  release(event: PointerEvent): boolean;
  cancel(): boolean;
}
export declare function createDragController<Payload, Session>(options?: KitDragOptions<Payload, Session>): KitDragController<Payload, Session>;
export declare function trackPointer(node: HTMLElement, options: { doc?: Document; onMove(event: PointerEvent): void; onEnd(commit: boolean): void }): { cancel(): void };
export declare function dragGhost(dom: KitDom, host: HTMLElement, text: string): { element: HTMLElement; moveTo(event: { clientX: number; clientY: number }): void; remove(): void };

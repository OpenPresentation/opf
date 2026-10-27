/** CE-20 (internal): the Studio's command registry (STUDIO-SPEC sections 6 and 14). */
import type { KitCommand, KitCommandRegistry } from "./studio-kit/commands.js";

export declare const STUDIO_INSERT_KINDS: readonly string[];
export declare const STUDIO_INSERT_LABELS: Readonly<Record<string, string>>;
export declare const STUDIO_INSERT_HINTS: Readonly<Record<string, string>>;
export declare const STUDIO_DOWNLOAD_FORMATS: readonly ("json" | "yaml" | "markdown")[];
/** Every command id the Studio registers, in registration order. */
export declare const STUDIO_COMMAND_IDS: readonly string[];
/** The Studio's command definitions; `when` and `run` take the Studio controller (src/studio.js). */
export declare function studioCommandDefinitions(): KitCommand<any>[];
/** A registry of the Studio's commands, then the host's `extra` ones, with the host's keymap overrides. */
export declare function createStudioCommands(options?: { extra?: KitCommand<any>[]; keymap?: Record<string, string | string[] | null> }): KitCommandRegistry<any>;
/** The context menu's groups of command ids (STUDIO-SPEC 4.7). */
export declare function contextMenuGroups(options?: { slide?: boolean }): string[][];

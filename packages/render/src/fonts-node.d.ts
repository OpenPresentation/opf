import type {FontRegistry,FontRegistryOptions} from "./fonts.js";
export declare function loadBundledFontRegistry(options?: FontRegistryOptions): Promise<FontRegistry & {fontFiles:string[]}>;

export declare function loadOfficeFontRegistry(options?: FontRegistryOptions & {includeBaseFonts?:boolean}): Promise<FontRegistry & {fontFiles:string[]}>;

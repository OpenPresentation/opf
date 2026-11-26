// #1408: the declarations a host compiles against when it hands core's script profile to the renderer
// (pnpm --filter @openpresentation/integration typecheck).
import type { Catalog } from "@openpresentation/opf";
import { resolveScriptFonts, type ScriptMeasurementProfile, type TextMeasurement } from "@openpresentation/opf/composition";
import { gallery } from "@openpresentation/gallery";
import { createScriptFonts, createScriptTextMeasurement, detectScripts, glyphFallbackFamilies, itemizeScripts, type ScriptFontProfile } from "@openpresentation/opf-render/fonts";
import { autoScriptSelection, detectPresentationScripts } from "@openpresentation/opf-render/fonts-node";

declare const measurement: TextMeasurement;
declare const slideProfile: ScriptMeasurementProfile;
const catalogs: readonly Catalog[] = [gallery];
const deck = { language: "ar", slides: [{ title: "مرحبا" }] };
const resolved = resolveScriptFonts(deck, { catalogs });

// Every renderer entry point that takes a ScriptFontProfile accepts core's result as it is.
const scriptMeasurement: TextMeasurement = createScriptTextMeasurement(measurement, resolved);
const scriptFonts = createScriptFonts(resolved, measurement);
const runs = itemizeScripts("مرحبا", resolved);
const scripts: string[] = detectScripts(deck, resolved);
const families: string[] = glyphFallbackFamilies("م", resolved);
const presentationScripts: string[] = detectPresentationScripts(deck, { profile: resolved, catalogs });
const selection = autoScriptSelection(deck, { profile: resolved, catalogs });
// The profile core passes to `TextMeasurement.forScripts`, which the renderer's measurement plans with.
const planned = createScriptFonts(slideProfile, measurement);

// @ts-expect-error The member is core's union: a value core cannot return is rejected, so the line above is not vacuous.
const unknownSource: ScriptFontProfile["languageSource"] = "theme";
export { families, planned, presentationScripts, runs, scriptFonts, scriptMeasurement, scripts, selection, unknownSource };

// FR-08: the embed's static form is core's geometry, and the web player takes the host's `embeds` option (the editor's presenter takes the same one).
import { embedCardLayout, embedValue, type EmbedCardLayout } from "@openpresentation/opf";
import type { PresentOptions } from "@openpresentation/opf-render/player";
import { mountLiveEmbeds, type LiveEmbeds } from "@openpresentation/opf-render/live-embeds";

const embedCard: EmbedCardLayout = embedCardLayout({ frame: { x: 0, y: 0, width: 800, height: 450 }, title: "Dashboard", site: "app.example.com", headingFamily: "Roboto", bodyFamily: "Roboto", scale: 1 });
const embedSrc: string | undefined = embedValue("https://app.example.com/")?.src;
const playerOptions: PresentOptions = { embeds: (src) => src.startsWith("https://app.example.com/") };
declare const slideHost: HTMLElement;
declare const slideSvg: Element;
const live: LiveEmbeds = mountLiveEmbeds({ host: slideHost, svg: slideSvg, embeds: playerOptions.embeds });
// @ts-expect-error The host's list answers with a boolean.
const badList: PresentOptions = { embeds: (src: string) => src };
export { badList, embedCard, embedSrc, live };

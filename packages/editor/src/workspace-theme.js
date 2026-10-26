// CE-06: theming of the editor chrome. The chrome reads `--opf-ui-*` CSS custom properties (src/styles/tokens.css). Every component root
// carries the class `opf-ui` and declares the defaults itself, so a value set on an ancestor never reaches it: a host overrides the
// tokens on `.opf-ui`. `createThemeController` does that for one editor: it writes a rule, scoped to the editor's root, with enough
// specificity to win over the package's light, dark and touch rules whichever stylesheet loads last. The rule is built with the CSSOM
// (`insertRule`, `setProperty`), never from text, so a value cannot close the rule or add another, and an invalid value is dropped.

/** The short names of a theme: each maps to one `--opf-ui-*` custom property. The full names are accepted too. */
export const THEME_TOKENS = Object.freeze({
  background: "--opf-ui-bg",
  surface: "--opf-ui-surface",
  muted: "--opf-ui-muted",
  mutedAlt: "--opf-ui-muted-2",
  text: "--opf-ui-fg",
  textMuted: "--opf-ui-muted-fg",
  accent: "--opf-ui-accent",
  accentText: "--opf-ui-accent-fg",
  accentStrong: "--opf-ui-accent-strong",
  border: "--opf-ui-border",
  borderStrong: "--opf-ui-border-strong",
  focus: "--opf-ui-ring",
  danger: "--opf-ui-danger",
  warning: "--opf-ui-warn",
  success: "--opf-ui-success",
  codeBackground: "--opf-ui-code-bg",
  codeBorder: "--opf-ui-code-border",
  font: "--opf-ui-font",
  mono: "--opf-ui-mono",
  radiusSmall: "--opf-ui-radius-sm",
  radius: "--opf-ui-radius",
  radiusMedium: "--opf-ui-radius-md",
  radiusLarge: "--opf-ui-radius-lg",
  controlHeight: "--opf-ui-control-h",
  shadow: "--opf-ui-shadow-pop",
  motion: "--opf-ui-ease",
});

const FULL_NAMES = new Set(Object.values(THEME_TOKENS));
const SCHEMES = new Set(["light", "dark", "auto", "inherit"]);

/**
 * A map of short or full token names to values, as `{ "--opf-ui-name": "value" }`. A name that is neither a short name nor a
 * `--opf-ui-*` token of the contract throws, so a typo does not silently do nothing.
 */
export function normalizeThemeTokens(map, label = "theme.tokens") {
  if (map === undefined || map === null) return {};
  if (typeof map !== "object" || Array.isArray(map)) throw new TypeError(`${label} must be an object of token names and values.`);
  const out = {};
  for (const [name, value] of Object.entries(map)) {
    const full = THEME_TOKENS[name] ?? (FULL_NAMES.has(name) ? name : undefined);
    if (!full) throw new RangeError(`${label}: "${name}" is not an editor token. Use one of ${Object.keys(THEME_TOKENS).join(", ")} or a full --opf-ui-* name.`);
    if (value === undefined || value === null) continue;
    out[full] = String(value);
  }
  return out;
}

/** The theme as the controller applies it: validated, with defaults. Throws on a bad scheme or token name. */
export function normalizeTheme(theme) {
  if (theme === undefined || theme === null) return { colorScheme: "inherit", tokens: {}, dark: {} };
  if (typeof theme !== "object" || Array.isArray(theme)) throw new TypeError("theme must be an object.");
  const colorScheme = theme.colorScheme ?? "inherit";
  if (!SCHEMES.has(colorScheme)) throw new RangeError('theme.colorScheme must be "light", "dark", "auto" or "inherit".');
  return { colorScheme, tokens: normalizeThemeTokens(theme.tokens, "theme.tokens"), dark: normalizeThemeTokens(theme.dark, "theme.dark") };
}

let themeCounter = 0;

const apply = (rule, tokens) => { for (const [name, value] of Object.entries(tokens)) rule.style.setProperty(name, value); };

/**
 * Apply a theme to the editor mounted in `root` (the element the host gave `createOpfEditor`; the chrome inside it, and `root` itself, take the values). `update(theme)` replaces it; `destroy()` removes the
 * rule and the attributes. The scheme: `light` and `dark` force it for this editor, `auto` follows `prefers-color-scheme`, and `inherit` (the
 * default) leaves it to the host page, which marks dark with `.dark` or `[data-theme="dark"]` on the page, as the stylesheet expects.
 */
export function createThemeController(root, initial) {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const id = `opf-theme-${++themeCounter}`;
  const before = { theme: root.getAttribute("data-opf-theme"), scheme: root.getAttribute("data-theme") };
  const style = doc.createElement("style");
  style.setAttribute("data-opf-theme-style", "");
  root.append(style);
  let media;
  let onMedia;
  const detach = () => { if (media && onMedia) media.removeEventListener?.("change", onMedia); media = undefined; onMedia = undefined; };
  const clearRules = () => { const sheet = style.sheet; while (sheet && sheet.cssRules.length) sheet.deleteRule(0); };

  function write(theme) {
    clearRules();
    const sheet = style.sheet;
    if (!sheet) return;
    // Three copies of the attribute selector lift the rule over the package's own `.dark .opf-ui`, `[data-theme="dark"] .opf-ui`, forced-light and
    // touch rules, whichever stylesheet loads last. The element itself is in the rule, so the host's own chrome inside it inherits the tokens.
    const scope = `[data-opf-theme="${id}"][data-opf-theme="${id}"][data-opf-theme="${id}"]`;
    const notLight = `${scope}:not([data-theme="light"])`;
    if (Object.keys(theme.tokens).length) {
      sheet.insertRule(`${scope}, ${scope} .opf-ui {}`, sheet.cssRules.length);
      apply(sheet.cssRules[sheet.cssRules.length - 1], theme.tokens);
    }
    if (Object.keys(theme.dark).length) {
      // The same dark scopes tokens.css uses, so a host that marks dark on the page, on an ancestor or on the editor itself is followed.
      const selectors = [];
      for (const target of [notLight, `${notLight} .opf-ui`]) selectors.push(`.dark ${target}`, `[data-theme="dark"] ${target}`);
      selectors.push(`${scope}[data-theme="dark"]`, `${scope}[data-theme="dark"] .opf-ui`, `${scope}.dark`, `${scope}.dark .opf-ui`);
      sheet.insertRule(`${selectors.join(", ")} {}`, sheet.cssRules.length);
      apply(sheet.cssRules[sheet.cssRules.length - 1], theme.dark);
    }
  }

  const restoreScheme = () => {
    if (before.scheme === null) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", before.scheme);
  };

  function update(next) {
    const theme = normalizeTheme(next);
    detach();
    root.setAttribute("data-opf-theme", id);
    if (theme.colorScheme === "light" || theme.colorScheme === "dark") root.setAttribute("data-theme", theme.colorScheme);
    else if (theme.colorScheme === "auto" && typeof win?.matchMedia === "function") {
      media = win.matchMedia("(prefers-color-scheme: dark)");
      onMedia = () => root.setAttribute("data-theme", media.matches ? "dark" : "light");
      onMedia();
      media.addEventListener?.("change", onMedia);
    } else restoreScheme();
    write(theme);
    return theme;
  }

  let current = update(initial);
  return {
    get theme() { return current; },
    update(next) { current = update(next); return current; },
    destroy() {
      detach();
      style.remove();
      restoreScheme();
      if (before.theme === null) root.removeAttribute("data-opf-theme");
      else root.setAttribute("data-opf-theme", before.theme);
    },
  };
}

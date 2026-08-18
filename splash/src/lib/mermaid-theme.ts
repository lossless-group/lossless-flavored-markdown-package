/**
 * Make Mermaid look like it belongs to the site.
 *
 * ## Why this file exists
 *
 * Mermaid is not unstyled out of the box — the CDN build injects a `<style>`
 * block *inside every generated `<svg>`*, driven by the `theme` you pass to
 * `initialize()`. The problem is that its built-in themes (`default`,
 * `neutral`, `dark`, `forest`) carry Mermaid's palette, not yours, so a
 * diagram lands on the page looking like a screenshot from another website.
 *
 * That inlined `<style>` is also why **an external mermaid.css is the weaker
 * half of the fix**: you are fighting per-SVG rules with a stylesheet, so every
 * override needs to out-specify them and stays fragile across Mermaid versions.
 * The strong lever is `themeVariables` with `theme: 'base'` — Mermaid then
 * *generates* its stylesheet from your values instead of its own.
 *
 * So the split is:
 *
 *   themeVariables (here)  colors, fonts — anything Mermaid derives its
 *                          generated stylesheet from. Do this first.
 *   a real .css file       anything Mermaid has no variable for: drop shadows,
 *                          dashes, hover states, print rules. Scope it under a
 *                          wrapper class and expect to use `:global()`.
 *
 * ## Consuming this in your own site
 *
 * LFM ships no CSS by design — it hands you an AST and stops — so this is a
 * pattern to copy rather than an import. Point `read()` at whatever your design
 * tokens are called and the rest follows. If your site has one mode, drop the
 * mode plumbing; if it has three like this one, keep it.
 */

/** The subset of Mermaid's theme variables worth wiring to design tokens. */
export interface MermaidThemeVars {
  darkMode: boolean;
  fontFamily: string;
  fontSize: string;
  background: string;
  primaryColor: string;
  primaryTextColor: string;
  primaryBorderColor: string;
  secondaryColor: string;
  tertiaryColor: string;
  lineColor: string;
  textColor: string;
  mainBkg: string;
  nodeBorder: string;
  clusterBkg: string;
  clusterBorder: string;
  edgeLabelBackground: string;
  /* sequence diagrams */
  actorBkg: string;
  actorBorder: string;
  actorTextColor: string;
  signalColor: string;
  signalTextColor: string;
  labelBoxBkgColor: string;
  labelBoxBorderColor: string;
  noteBkgColor: string;
  noteTextColor: string;
  noteBorderColor: string;
}

/**
 * Build Mermaid theme variables from the CSS custom properties currently in
 * effect on `<html>`.
 *
 * Reading them at runtime rather than hardcoding is what makes this survive a
 * mode switch *and* a palette change — the tokens are the single source of
 * truth, exactly as the theme-system convention intends.
 */
export function mermaidThemeVariables(root: HTMLElement = document.documentElement): MermaidThemeVars {
  const style = getComputedStyle(root);
  const read = (token: string, fallback: string): string =>
    style.getPropertyValue(token).trim() || fallback;

  // `vibrant` is dark-based in this theme, so it groups with dark rather than
  // light. Getting this wrong is what made diagrams look broken: Mermaid's
  // light palette on a dark ground reads as "no styles applied".
  const mode = root.getAttribute('data-mode');
  const darkMode = mode === 'dark' || mode === 'vibrant'
    || (mode === null && matchMedia('(prefers-color-scheme: dark)').matches);

  const bg = read('--color-bg', darkMode ? '#0f1115' : '#ffffff');
  const surface = read('--color-bg-elevated', read('--color-bg-card', bg));
  const soft = read('--color-bg-soft', surface);
  const text = read('--color-text', darkMode ? '#e8e8ea' : '#1a1a1a');
  const dim = read('--color-text-dim', text);
  const border = read('--color-border-accent', read('--color-border', dim));
  const accent = read('--color-accent', border);
  const font = read('--font', 'system-ui, sans-serif');

  return {
    darkMode,
    fontFamily: font,
    fontSize: '15px',

    background: bg,
    primaryColor: surface,
    primaryTextColor: text,
    primaryBorderColor: border,
    secondaryColor: soft,
    tertiaryColor: bg,
    lineColor: dim,
    textColor: text,

    mainBkg: surface,
    nodeBorder: border,
    clusterBkg: soft,
    clusterBorder: border,
    // Edge labels sit on top of the line; without an opaque background the
    // line strikes through the text.
    edgeLabelBackground: bg,

    actorBkg: surface,
    actorBorder: accent,
    actorTextColor: text,
    signalColor: dim,
    signalTextColor: text,
    labelBoxBkgColor: soft,
    labelBoxBorderColor: border,
    noteBkgColor: soft,
    noteTextColor: text,
    noteBorderColor: border,
  };
}

/** The full config object to hand `mermaid.initialize()`. */
export function mermaidConfig(root?: HTMLElement) {
  return {
    startOnLoad: false,
    // `base` is the only theme that actually honours themeVariables. The named
    // themes ignore most of them.
    theme: 'base' as const,
    // Diagram source on this site comes from authored markdown, which is
    // trusted — but `strict` costs nothing and keeps foreign HTML out.
    securityLevel: 'strict' as const,
    themeVariables: mermaidThemeVariables(root),
  };
}

/**
 * Re-run `render` whenever the site's mode changes.
 *
 * Mermaid bakes its stylesheet into the SVG at render time, so a mode toggle
 * cannot be handled by CSS alone — the diagram has to be drawn again. Returns
 * a disposer.
 */
export function onModeChange(render: () => void, root: HTMLElement = document.documentElement): () => void {
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === 'data-mode')) render();
  });
  observer.observe(root, { attributes: true, attributeFilter: ['data-mode'] });

  const media = matchMedia('(prefers-color-scheme: dark)');
  const onMedia = () => { if (!root.hasAttribute('data-mode')) render(); };
  media.addEventListener('change', onMedia);

  return () => {
    observer.disconnect();
    media.removeEventListener('change', onMedia);
  };
}

/**
 * Syntax highlighting for code blocks, themed by the site it renders on.
 *
 * Shiki does the tokenizing, but its output carries CSS variables rather than
 * colors. Every site gets a default palette that follows its modes. To match a
 * site's brand, set any of these in its theme CSS, per mode if needed:
 * `--lfm-code-token-keyword`, `-string`, `-function`, `-constant`, `-comment`,
 * `-punctuation`, `-parameter`, `-link`, and `--lfm-code-foreground`.
 *
 * It's a separate subpath so that importing the parser doesn't load Shiki.
 *
 * @example
 * ```ts
 * import { highlightCode } from '@lossless-group/lfm/highlight';
 *
 * const html = await highlightCode('const a = 1;', 'ts');
 * // <pre><code set:html={html} /></pre>
 * ```
 *
 * @module
 */
import {
  bundledLanguages,
  createCssVariablesTheme,
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
} from 'shiki';

const TEXT = 'var(--color-text)';

/**
 * The default palette: fixed hues, with lightness taken from the site's text
 * color. Dark text gives deep colors and light text gives pastels, so one palette
 * stays legible in every mode without knowing how a site switches modes.
 */
const hue = (degrees: number, chroma = 0.16) =>
  `oklch(from ${TEXT} calc(l * 0.62 + 0.25) ${chroma} ${degrees})`;

const theme = createCssVariablesTheme({
  name: 'lfm-site',
  variablePrefix: '--lfm-code-',
  variableDefaults: {
    foreground: TEXT,
    background: 'transparent',
    'token-keyword': hue(305),
    'token-string': hue(150),
    'token-string-expression': hue(150),
    'token-function': hue(250),
    'token-constant': hue(55),
    'token-parameter': TEXT,
    'token-comment': `color-mix(in oklab, var(--color-text-dim, ${TEXT}) 60%, ${TEXT})`,
    'token-punctuation': `var(--color-text-soft, ${TEXT})`,
    'token-link': hue(250),
  },
  fontStyle: true,
});

let highlighter: Promise<Highlighter> | undefined;

/**
 * HTML for the inside of a `<code>` element. Text is always escaped, and a
 * missing or unknown language returns it uncolored rather than throwing.
 */
export async function highlightCode(code: string, language?: string): Promise<string> {
  highlighter ??= createHighlighter({ themes: [theme], langs: [] });
  const shiki = await highlighter;

  const lang = language?.toLowerCase();
  const known = lang !== undefined && lang in bundledLanguages;
  if (known) await shiki.loadLanguage(lang as BundledLanguage);

  return shiki.codeToHtml(code, {
    lang: known ? lang : 'text',
    theme: 'lfm-site',
    structure: 'inline',
  });
}

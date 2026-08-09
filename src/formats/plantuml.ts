/**
 * PlantUML fence format — the actual UML answer.
 *
 * PlantUML covers the full UML surface (class, sequence, activity, component,
 * deployment, state, use-case) which Mermaid does not. Rendering it normally
 * means running Java, but it doesn't have to: a PlantUML server accepts the
 * diagram source deflated and encoded into the URL path, and returns an image.
 * So this handler renders nothing — it produces a URL.
 *
 *   ```plantuml
 *   @startuml
 *   Alice -> Bob: Authenticate
 *   @enduml
 *   ```
 *
 * → `https://www.plantuml.com/plantuml/svg/SoWkIImgAStDuNBAJrBGjLDmpCbCJbMmKiX8pSd9…`
 *
 * The only dependency is `node:zlib`, a runtime builtin — so no package lands
 * on any consuming site's install graph. This module is deliberately NOT
 * re-exported from `formats/index.ts`: importing it pulls in a node builtin,
 * which would make the whole barrel file unusable in a browser context. Import
 * it by subpath.
 *
 * NOTE: the default server is the public plantuml.com instance, which means
 * your diagram source travels to a third party as part of the URL. For
 * anything non-public, self-host and pass `server`.
 */

import { deflateRawSync } from 'node:zlib';
import type { FenceFormat } from '../types/index.js';

/** PlantUML's custom base64 alphabet — NOT standard base64. */
function encode6bit(b: number): string {
  if (b < 10) return String.fromCharCode(48 + b);       // 0-9
  b -= 10;
  if (b < 26) return String.fromCharCode(65 + b);       // A-Z
  b -= 26;
  if (b < 26) return String.fromCharCode(97 + b);       // a-z
  b -= 26;
  if (b === 0) return '-';
  if (b === 1) return '_';
  return '?';
}

/** Pack three bytes into four 6-bit characters. */
function append3bytes(b1: number, b2: number, b3: number): string {
  return (
    encode6bit((b1 >> 2) & 0x3f) +
    encode6bit((((b1 & 0x3) << 4) | ((b2 >> 4) & 0xf)) & 0x3f) +
    encode6bit((((b2 & 0xf) << 2) | ((b3 >> 6) & 0x3)) & 0x3f) +
    encode6bit(b3 & 0x3f)
  );
}

/** Encode raw bytes using PlantUML's alphabet. */
function encode64(data: Uint8Array): string {
  let out = '';
  for (let i = 0; i < data.length; i += 3) {
    const b1 = data[i]!;
    const b2 = i + 1 < data.length ? data[i + 1]! : 0;
    const b3 = i + 2 < data.length ? data[i + 2]! : 0;
    out += append3bytes(b1, b2, b3);
  }
  return out;
}

/**
 * Encode PlantUML source into the path segment a PlantUML server expects.
 * Deflate (raw, no zlib header) then PlantUML's base64 variant.
 */
export function encodePlantUml(source: string): string {
  const deflated = deflateRawSync(Buffer.from(source, 'utf8'), { level: 9 });
  return encode64(new Uint8Array(deflated));
}

export interface PlantUmlOptions {
  /** Server base, no trailing slash. Default: the public plantuml.com instance. */
  server?: string;
}

export interface PlantUmlFenceResult {
  /** The encoded path segment. */
  encoded: string;
  /** Ready-to-use image URLs. */
  svg: string;
  png: string;
  /** Editable-on-the-server link, handy in docs. */
  editor: string;
  /** `@startuml`/`@enduml` were present in the source. */
  wrapped: boolean;
  /** Best-effort diagram kind, from the first meaningful directive. */
  kind?: string;
}

const DEFAULT_SERVER = 'https://www.plantuml.com/plantuml';

/** Heuristic: what sort of PlantUML diagram is this? Used for alt text. */
function detectKind(src: string): string | undefined {
  const body = src.replace(/^\s*@start\w+.*$/m, '');
  if (/^\s*(class|interface|abstract)\s/m.test(body)) return 'class';
  if (/-{1,2}>{1,2}|<-{1,2}/.test(body) && /:\s/.test(body)) return 'sequence';
  if (/^\s*(start|stop|:.*;)\s*$/m.test(body)) return 'activity';
  if (/^\s*state\s/m.test(body)) return 'state';
  if (/^\s*(component|\[.+\])/m.test(body)) return 'component';
  if (/^\s*(usecase|\(.+\))/m.test(body)) return 'use-case';
  if (/^\s*entity\s/m.test(body)) return 'entity-relationship';
  return undefined;
}

/** Build a PlantUML handler bound to a particular server. */
export function createPlantUml(options: PlantUmlOptions = {}): FenceFormat<PlantUmlFenceResult> {
  const server = (options.server ?? DEFAULT_SERVER).replace(/\/+$/, '');

  return {
    name: 'plantuml',
    match: ['plantuml', 'puml', 'uml'],
    parse(raw) {
      const trimmed = raw.trim();
      if (!trimmed) throw new Error('Empty PlantUML source');

      const wrapped = /^@start\w+/m.test(trimmed);
      // The server requires the @start/@end wrapper; add it when the author
      // left it off, which is common when the fence language already says it.
      const source = wrapped ? trimmed : `@startuml\n${trimmed}\n@enduml`;
      const encoded = encodePlantUml(source);

      return {
        encoded,
        svg: `${server}/svg/${encoded}`,
        png: `${server}/png/${encoded}`,
        editor: `${server}/uml/${encoded}`,
        wrapped,
        kind: detectKind(trimmed),
      };
    },
  };
}

/** The `plantuml` handler pointed at the public server. */
export const plantuml: FenceFormat<PlantUmlFenceResult> = createPlantUml();

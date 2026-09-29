import type { Plugin } from 'vite';

/** Import `*.yaml` as a raw string, matching wrangler's `Text` module rule. */
export function yamlText(): Plugin {
  return {
    name: 'clearsignal-yaml-text',
    transform(code, id) {
      if (!id.endsWith('.yaml')) return null;
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
  };
}

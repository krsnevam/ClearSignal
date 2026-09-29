// Node module hook: import *.yaml as a text default export (matches Vite + wrangler).
// Usage: node --import tsx --import ./scripts/register-yaml.mjs file.ts
import { register } from 'node:module';

register('./yaml-hooks.mjs', import.meta.url);

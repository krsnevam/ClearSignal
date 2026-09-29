import { defineConfig } from 'vitest/config';
import { yamlText } from './vite-yaml';

export default defineConfig({ plugins: [yamlText()] });

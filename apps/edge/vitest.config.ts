import { defineConfig } from 'vitest/config';
import { yamlText } from '../../packages/fusion/vite-yaml';

export default defineConfig({ plugins: [yamlText()] });

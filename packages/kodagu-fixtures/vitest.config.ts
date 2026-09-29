import { defineConfig } from 'vitest/config';
import { yamlText } from '../fusion/vite-yaml';

export default defineConfig({ plugins: [yamlText()] });

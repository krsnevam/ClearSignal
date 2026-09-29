// .yaml files are imported as raw text (Vite plugin in web/vitest, Text rule in wrangler).
declare module '*.yaml' {
  const text: string;
  export default text;
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { loadLocale } from './i18n';
import { useApp } from './state';

// Capture the install prompt so Options → Install works.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  useApp.getState().set({ installPrompt: e as never });
});

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
// Load the saved language's dictionary first (a small local chunk) so the first paint is already translated.
void loadLocale(useApp.getState().prefs.locale)
  .catch(() => {})
  .then(() =>
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  );

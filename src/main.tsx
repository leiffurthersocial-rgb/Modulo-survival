import { createRoot } from 'react-dom/client';
import '@fontsource/vt323/400.css';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/500.css';
import './ui/styles.css';
import { App } from './ui/App';
import { log } from './core/logger';

window.addEventListener('error', (e) => log.error('window', e.message, e.error));
window.addEventListener('unhandledrejection', (e) => log.error('promise', String(e.reason), e.reason));

createRoot(document.getElementById('root')!).render(<App />);

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react';
import { processWordleData } from './utils/processWordleData';

// Both are needed by the first screen, but sit behind React mounting + effects.
// Kicking them off at module scope downloads them alongside the entry bundle
// instead of one round-trip after it.
processWordleData().catch(() => {}); // the hook surfaces the real error
import('./components/WordleCharts');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Analytics />
    </BrowserRouter>
  </StrictMode>,
)

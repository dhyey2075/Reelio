import React from 'react';
import ReactDOM from 'react-dom/client';
import { ensureReelApiReady } from './services/reelApi';
import App from './App';
import './index.css';

async function bootstrap() {
  await ensureReelApiReady();

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error('Failed to start Reelio player:', err);
  document.body.innerHTML = `<pre style="padding:1rem;color:#f88;">${err.message}</pre>`;
});

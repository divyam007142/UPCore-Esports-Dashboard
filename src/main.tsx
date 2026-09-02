import { createRoot } from 'react-dom/client';
import './index.css';

const root = document.getElementById('root')!;

root.innerHTML = `
  <div style="color:white;background:#111;min-height:100vh;padding:40px;font-family:Arial">
    Loading React app...
  </div>
`;

import('./App')
  .then(({ default: App }) => {
    root.innerHTML = '';

    createRoot(root).render(<App />);
  })
  .catch((error) => {
    console.error('APP LOAD ERROR:', error);

    root.innerHTML = `
      <div style="color:#ff5555;background:#111;min-height:100vh;padding:40px;font-family:Arial">
        <h1>App failed to load</h1>
        <pre style="white-space:pre-wrap;margin-top:20px;color:white">${String(error?.stack || error)}</pre>
      </div>
    `;
  });

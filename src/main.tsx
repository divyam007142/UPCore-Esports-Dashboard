import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');

if (root) {
  root.innerHTML = `
    <div style="
      color: white;
      background: #111;
      min-height: 100vh;
      padding: 40px;
      font-family: Arial;
      font-size: 24px;
    ">
      MAIN.TSX IS RUNNING
    </div>
  `;
}

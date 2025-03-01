import { createRoot } from 'react-dom/client';
import './assets/scss/index.scss';
import App from './src/app.tsx';

createRoot(document.getElementById('root')!).render(
  <App />
)

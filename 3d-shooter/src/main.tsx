import { createRoot } from 'react-dom/client';
import './assets/scss/index.scss';
import App from './app.tsx';

createRoot(document.getElementById('root')!).render(
  <App />
)

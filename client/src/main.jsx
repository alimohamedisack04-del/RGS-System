import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './lib/app';
import './styles.css';
import './lib/tip.js';

createRoot(document.getElementById('root')).render(<AppProvider><App /></AppProvider>);

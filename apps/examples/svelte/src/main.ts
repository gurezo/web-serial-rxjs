import App from './App.svelte';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}
const app = new App({
  target: rootElement,
});

export default app;

import { ARApp } from './ARApp.js';

const app = new ARApp(document.getElementById('scene'), document.getElementById('ui'));
window.app = app; // для отладки из консоли браузера
app.init().catch((e) => console.error(e));

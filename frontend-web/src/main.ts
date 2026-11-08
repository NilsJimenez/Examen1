import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .then(() => {
    // Registro del Service Worker para PWA (Desafío II)
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then((registration) => {
            console.log('[PWA] Service Worker registrado exitosamente con scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('[PWA] Fallo el registro del Service Worker:', error);
          });
      });
    }
  })
  .catch((err) => console.error(err));

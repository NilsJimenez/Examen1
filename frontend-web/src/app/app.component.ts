import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar.component';
import { ToastComponent } from './components/toast/toast.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, ToastComponent],
  template: `
    <div class="flex flex-col" style="min-height: 100vh;">
      <app-navbar></app-navbar>
      <app-toast></app-toast>

      <main style="flex: 1; padding-bottom: 4rem;">
        <router-outlet></router-outlet>
      </main>

      <footer class="bg-zinc-900 text-white py-8 border-t border-zinc-800 text-center text-sm" style="background-color: #18181b; color: #a1a1aa; padding: 2.5rem 0;">
        <div class="container">
          <p class="font-serif text-lg text-white font-bold mb-1" style="color: #ffffff;">FashionStore</p>
          <p class="text-xs text-zinc-400 mb-2">Plataforma Inteligente de Moda con Vestidores Virtuales AR y Experiencia Omnicanal</p>
          <p class="text-xs text-zinc-500">© 2026 FashionStore S.R.L. — Calidad, Elegancia y Tecnología. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  `
})
export class AppComponent {
  title = 'FashionStore';
}

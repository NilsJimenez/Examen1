import { Routes } from '@angular/router';
import { CatalogoComponent } from './pages/catalogo/catalogo.component';
import { ProductoDetalleComponent } from './pages/producto-detalle/producto-detalle.component';
import { LoginComponent } from './pages/login/login.component';
import { RegistroComponent } from './pages/registro/registro.component';
import { SucursalesComponent } from './pages/sucursales/sucursales.component';
import { AdminPanelComponent } from './pages/admin/admin-panel.component';
import { CarritoComponent } from './pages/carrito/carrito.component';
import { MisReservasComponent } from './pages/mis-reservas/mis-reservas.component';
import { PagoComponent } from './pages/pago/pago.component';
import { MisComprasComponent } from './pages/mis-compras/mis-compras.component';
import { EncargadoComponent } from './pages/encargado/encargado.component';

export const routes: Routes = [
  { path: '', redirectTo: 'catalogo', pathMatch: 'full' },
  { path: 'catalogo', component: CatalogoComponent },
  { path: 'producto/:id', component: ProductoDetalleComponent },
  { path: 'sucursales', component: SucursalesComponent },
  { path: 'login', component: LoginComponent },
  { path: 'registro', component: RegistroComponent },
  { path: 'admin', component: AdminPanelComponent },
  { path: 'carrito', component: CarritoComponent },
  { path: 'mis-reservas', component: MisReservasComponent },
  { path: 'pago/:id', component: PagoComponent },
  { path: 'mis-compras', component: MisComprasComponent },
  { path: 'encargado', component: EncargadoComponent },
  { path: '**', redirectTo: 'catalogo' }
];


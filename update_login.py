def modify_login_component():
    with open('frontend-web/src/app/pages/login/login.component.ts', 'r', encoding='utf-8') as f:
        content = f.read()

    # Define the new template containing the auth states
    import re
    # We will replace the form template
    # Instead of replacing the whole string which is risky, we will replace the `template: ` and `export class LoginComponent` entirely using a quick replacement logic.

    # First, split at export class LoginComponent
    parts = content.split("export class LoginComponent implements OnInit {")
    if len(parts) < 2:
        parts = content.split("export class LoginComponent {")
    
    top_part = parts[0]
    
    new_template = """
  template: `
    <div class="auth-page-wrapper">
      <div class="auth-split-card animate-fade-in">
        
        <!-- COLUMNA IZQUIERDA: FORMULARIOS -->
        <div class="auth-form-column">
          
          <div class="auth-header">
            <h2 class="auth-title">
              <ng-container *ngIf="viewState === 'login'">INICIAR SESIÓN</ng-container>
              <ng-container *ngIf="viewState === 'forgot_email'">RECUPERAR CONTRASEÑA</ng-container>
              <ng-container *ngIf="viewState === 'forgot_code'">CÓDIGO DE VERIFICACIÓN</ng-container>
              <ng-container *ngIf="viewState === 'forgot_password'">NUEVA CONTRASEÑA</ng-container>
            </h2>
            <div class="auth-title-line"></div>
          </div>

          <div *ngIf="errorMessage" class="auth-alert-error">
            <i class="fa-solid fa-circle-exclamation mr-2"></i>
            <span>{{ errorMessage }}</span>
          </div>
          
          <div *ngIf="successMessage" class="auth-alert-success" style="background-color: rgba(34, 197, 94, 0.1); border-left: 4px solid #22c55e; color: #22c55e; padding: 12px; margin-bottom: 20px; border-radius: 4px; display: flex; align-items: center;">
            <i class="fa-solid fa-check-circle mr-2"></i>
            <span>{{ successMessage }}</span>
          </div>

          <!-- ESTADO: LOGIN -->
          <form *ngIf="viewState === 'login'" (ngSubmit)="onSubmit()" class="auth-form">
            <div class="auth-field-group">
              <label class="auth-label">CORREO ELECTRÓNICO <span class="required-star">*</span></label>
              <input type="email" name="email" [(ngModel)]="email" required placeholder="ejemplo@fashionstore.com" class="auth-input" />
            </div>

            <div class="auth-field-group">
              <label class="auth-label">CONTRASEÑA <span class="required-star">*</span></label>
              <div class="password-input-wrapper">
                <input [type]="mostrarPassword ? 'text' : 'password'" name="password" [(ngModel)]="password" required placeholder="••••••••" class="auth-input pr-10" />
                <button type="button" class="password-eye-btn" (click)="togglePasswordVisibility()">
                  <i class="fa-solid" [class.fa-eye]="!mostrarPassword" [class.fa-eye-slash]="mostrarPassword"></i>
                </button>
              </div>
            </div>

            <div class="auth-form-footer">
              <a href="javascript:void(0)" (click)="setViewState('forgot_email')" class="forgot-link">¿Olvidaste tu contraseña?</a>
            </div>

            <button type="submit" [disabled]="isLoading" class="auth-submit-btn">
              <span *ngIf="!isLoading">Ingresar <i class="fa-solid fa-arrow-right ml-2"></i></span>
              <span *ngIf="isLoading"><i class="fa-solid fa-circle-notch fa-spin"></i> Validando...</span>
            </button>
            
            <div class="auth-register-prompt">
              <span class="auth-prompt-text">¿No tienes una cuenta?</span>
              <a routerLink="/registro" class="auth-register-link">Regístrate ahora</a>
            </div>
          </form>

          <!-- ESTADO: FORGOT EMAIL -->
          <form *ngIf="viewState === 'forgot_email'" (ngSubmit)="onSendResetCode()" class="auth-form">
            <p style="color: #9ca3af; font-size: 0.9rem; margin-bottom: 1.5rem;">Ingresa tu correo electrónico y te enviaremos un código de 6 dígitos para restablecer tu contraseña.</p>
            <div class="auth-field-group">
              <label class="auth-label">CORREO ELECTRÓNICO <span class="required-star">*</span></label>
              <input type="email" name="resetEmail" [(ngModel)]="resetEmail" required placeholder="ejemplo@fashionstore.com" class="auth-input" />
            </div>
            
            <button type="submit" [disabled]="isLoading" class="auth-submit-btn">
              <span *ngIf="!isLoading">Enviar Código</span>
              <span *ngIf="isLoading"><i class="fa-solid fa-circle-notch fa-spin"></i> Enviando...</span>
            </button>
            <button type="button" (click)="setViewState('login')" class="btn-cancelar" style="width: 100%; margin-top: 10px; background: transparent; border: 1px solid var(--border-color); color: white; padding: 12px; border-radius: 4px; cursor: pointer; text-transform: uppercase; font-size: 0.85rem; font-weight: bold;">Cancelar</button>
          </form>

          <!-- ESTADO: FORGOT CODE -->
          <form *ngIf="viewState === 'forgot_code'" (ngSubmit)="onVerifyCode()" class="auth-form">
            <p style="color: #9ca3af; font-size: 0.9rem; margin-bottom: 1.5rem;">Hemos enviado un código a <strong>{{resetEmail}}</strong>. Ingrésalo a continuación (expira en 15 min).</p>
            <div class="auth-field-group">
              <label class="auth-label">CÓDIGO DE 6 DÍGITOS <span class="required-star">*</span></label>
              <input type="text" name="resetCode" [(ngModel)]="resetCode" required placeholder="123456" class="auth-input" style="text-align: center; letter-spacing: 5px; font-size: 1.2rem; font-weight: bold;" maxlength="6" />
            </div>
            
            <button type="submit" [disabled]="isLoading" class="auth-submit-btn">
              <span *ngIf="!isLoading">Verificar Código</span>
              <span *ngIf="isLoading"><i class="fa-solid fa-circle-notch fa-spin"></i> Verificando...</span>
            </button>
            <button type="button" (click)="setViewState('forgot_email')" class="btn-cancelar" style="width: 100%; margin-top: 10px; background: transparent; border: none; color: var(--accent); cursor: pointer; text-decoration: underline; font-size: 0.85rem;">Ingresé mal mi correo</button>
          </form>

          <!-- ESTADO: FORGOT PASSWORD -->
          <form *ngIf="viewState === 'forgot_password'" (ngSubmit)="onResetPassword()" class="auth-form">
            <p style="color: #9ca3af; font-size: 0.9rem; margin-bottom: 1.5rem;">Crea una nueva contraseña segura para tu cuenta.</p>
            <div class="auth-field-group">
              <label class="auth-label">NUEVA CONTRASEÑA <span class="required-star">*</span></label>
              <div class="password-input-wrapper">
                <input [type]="mostrarPassword ? 'text' : 'password'" name="newPassword" [(ngModel)]="newPassword" required placeholder="••••••••" class="auth-input pr-10" />
                <button type="button" class="password-eye-btn" (click)="togglePasswordVisibility()"><i class="fa-solid" [class.fa-eye]="!mostrarPassword" [class.fa-eye-slash]="mostrarPassword"></i></button>
              </div>
            </div>
            
            <button type="submit" [disabled]="isLoading" class="auth-submit-btn">
              <span *ngIf="!isLoading">Actualizar Contraseña</span>
              <span *ngIf="isLoading"><i class="fa-solid fa-circle-notch fa-spin"></i> Actualizando...</span>
            </button>
          </form>

        </div>

        <!-- COLUMNA DERECHA: IMAGEN / BRANDING -->
        <div class="auth-image-column" style="background-image: url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=2070&auto=format&fit=crop');">
          <div class="auth-image-overlay">
            <h1 class="brand-logo-large">
              <i class="fa-solid fa-vest-patches"></i> FashionStore
            </h1>
            <p class="brand-tagline">Descubre tu propio estilo.<br>Vístete para el éxito.</p>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [
"""

    bottom_part = """
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private toastService = inject(ToastService);

  // General States
  viewState: 'login' | 'forgot_email' | 'forgot_code' | 'forgot_password' = 'login';
  isLoading = false;
  errorMessage = '';
  successMessage = '';
  mostrarPassword = false;

  // Login Form
  email = '';
  password = '';

  // Reset Form
  resetEmail = '';
  resetCode = '';
  newPassword = '';

  setViewState(state: 'login' | 'forgot_email' | 'forgot_code' | 'forgot_password') {
    this.viewState = state;
    this.errorMessage = '';
    this.successMessage = '';
  }

  togglePasswordVisibility() {
    this.mostrarPassword = !this.mostrarPassword;
  }

  onSubmit() {
    if (!this.email || !this.password) {
      this.errorMessage = 'Por favor, completa todos los campos requeridos.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.toastService.success('¡Bienvenido!', `Has iniciado sesión correctamente.`);
        // Redirigir según el rol
        const rol = res.user.rol?.toLowerCase() || '';
        if (rol === 'admin') {
          this.router.navigate(['/admin']);
        } else if (rol === 'encargado_sucursal') {
          this.router.navigate(['/encargado']);
        } else if (rol === 'cajero') {
          this.router.navigate(['/cajero']);
        } else {
          this.router.navigate(['/catalogo']);
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Credenciales inválidas. Por favor, intenta nuevamente.';
      }
    });
  }

  onSendResetCode() {
    if (!this.resetEmail) {
      this.errorMessage = 'Ingresa tu correo.'; return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    this.authService.forgotPassword(this.resetEmail).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.successMessage = res.message || 'Código enviado.';
        setTimeout(() => this.setViewState('forgot_code'), 1500);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Error al enviar código.';
      }
    });
  }

  onVerifyCode() {
    if (!this.resetCode || this.resetCode.length !== 6) {
      this.errorMessage = 'Ingresa el código de 6 dígitos.'; return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    
    this.authService.verifyCode(this.resetEmail, this.resetCode).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Código correcto. Ahora ingresa tu nueva contraseña.';
        setTimeout(() => this.setViewState('forgot_password'), 1500);
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Código inválido.';
      }
    });
  }

  onResetPassword() {
    if (!this.newPassword) {
      this.errorMessage = 'Ingresa la nueva contraseña.'; return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    
    this.authService.resetPassword(this.resetEmail, this.resetCode, this.newPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.toastService.success('¡Contraseña actualizada!', 'Ya puedes iniciar sesión.');
        this.setViewState('login');
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.detail || 'Error al actualizar contraseña.';
      }
    });
  }
}
"""

    # find styles start
    styles_start = top_part.split("styles: [")[1]
    
    with open('frontend-web/src/app/pages/login/login.component.ts', 'w', encoding='utf-8') as f:
        f.write(top_part.split("template: `")[0] + new_template + styles_start + bottom_part)

modify_login_component()

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from '../../services/chatbot.service';
import { AuthService } from '../../services/auth.service';

interface Mensaje {
  texto: string;
  esUsuario: boolean;
  fecha: Date;
}

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="authService.isLoggedIn && authService.currentUserValue?.role === 'cliente'">
      <!-- Botón Flotante -->
      <button 
        *ngIf="!abierto"
        (click)="abrirChat()"
        style="position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #d4af37, #b5952f); color: black; border: none; box-shadow: 0 4px 15px rgba(0,0,0,0.5); cursor: pointer; z-index: 9999; display: flex; align-items: center; justify-content: center; transition: transform 0.3s;"
        onmouseover="this.style.transform='scale(1.1)'"
        onmouseout="this.style.transform='scale(1)'">
        <i class="fa-solid fa-robot" style="font-size: 1.5rem;"></i>
      </button>

      <!-- Ventana de Chat -->
      <div 
        *ngIf="abierto"
        style="position: fixed; bottom: 20px; right: 20px; width: 350px; height: 500px; background-color: #1e1e24; border: 1px solid #d4af37; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.7); display: flex; flex-direction: column; z-index: 9999; overflow: hidden;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #18181b, #27272a); border-bottom: 1px solid #d4af37; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-robot" style="color: #d4af37; font-size: 1.2rem;"></i>
            <h3 style="margin: 0; color: #fff; font-size: 1rem; font-weight: bold; font-family: serif;">FashionBot IA</h3>
          </div>
          <button (click)="cerrarChat()" style="background: none; border: none; color: #a1a1aa; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <!-- Área de Mensajes -->
        <div style="flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background-color: #121214;" id="chat-messages">
          
          <div *ngIf="mensajes.length === 0" style="text-align: center; color: #a1a1aa; margin-top: 20px; font-size: 0.9rem;">
            <p>¡Hola! Soy tu asistente virtual.</p>
            <p>Pregúntame sobre nuestro catálogo, tallas, sucursales o proceso de compra.</p>
          </div>

          <div *ngFor="let m of mensajes" 
               [ngStyle]="{'align-self': m.esUsuario ? 'flex-end' : 'flex-start', 'background-color': m.esUsuario ? '#d4af37' : '#27272a', 'color': m.esUsuario ? '#000' : '#fff', 'border-radius': m.esUsuario ? '15px 15px 0 15px' : '15px 15px 15px 0'}" 
               style="padding: 10px 14px; max-width: 80%; font-size: 0.9rem; word-wrap: break-word;">
            {{ m.texto }}
          </div>

          <!-- Loading Indicator -->
          <div *ngIf="cargando" style="align-self: flex-start; background-color: #27272a; color: #a1a1aa; border-radius: 15px 15px 15px 0; padding: 10px 14px; font-size: 0.9rem;">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Escribiendo...
          </div>
        </div>

        <!-- Input -->
        <div style="padding: 10px; border-top: 1px solid #3f3f46; background-color: #18181b; display: flex; gap: 8px;">
          <input 
            type="text" 
            [(ngModel)]="nuevoMensaje" 
            (keyup.enter)="enviar()"
            placeholder="Escribe tu consulta..."
            [disabled]="cargando"
            style="flex: 1; padding: 10px; border-radius: 20px; border: 1px solid #3f3f46; background-color: #27272a; color: #fff; font-size: 0.9rem; outline: none;" />
          <button 
            (click)="enviar()"
            [disabled]="!nuevoMensaje.trim() || cargando"
            style="background: #d4af37; color: black; border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: nuevoMensaje.trim() && !cargando ? 1 : 0.5;">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  `
})
export class ChatbotComponent {
  authService = inject(AuthService);
  private chatbotService = inject(ChatbotService);

  abierto = false;
  cargando = false;
  nuevoMensaje = '';
  mensajes: Mensaje[] = [];

  abrirChat() {
    this.abierto = true;
  }

  cerrarChat() {
    this.abierto = false;
  }

  enviar() {
    const texto = this.nuevoMensaje.trim();
    if (!texto) return;

    // Agregar mensaje del usuario
    this.mensajes.push({ texto, esUsuario: true, fecha: new Date() });
    this.nuevoMensaje = '';
    this.cargando = true;
    this.scrollToBottom();

    this.chatbotService.enviarMensaje(texto).subscribe({
      next: (res) => {
        this.mensajes.push({ texto: res.respuesta, esUsuario: false, fecha: new Date() });
        this.cargando = false;
        this.scrollToBottom();
      },
      error: (err) => {
        this.mensajes.push({ texto: "Error de conexión con el servidor. Intente más tarde.", esUsuario: false, fecha: new Date() });
        this.cargando = false;
        this.scrollToBottom();
      }
    });
  }

  private scrollToBottom() {
    setTimeout(() => {
      const container = document.getElementById('chat-messages');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 100);
  }
}

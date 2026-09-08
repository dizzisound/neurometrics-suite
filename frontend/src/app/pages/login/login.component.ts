/**
 * Componente per la pagina di login
 * Gestisce l'autenticazione dell'utente tramite il servizio AuthService
 * Utilizza Reactive Forms per la gestione del form di login
 * Mostra messaggi di errore reattivi utilizzando i Signals
 *
 */

import { Component, inject, signal } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div
      class="login-wrapper"
      style="display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f4f6f9; font-family: sans-serif;"
    >
      <div
        class="login-card"
        style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 100%; max-width: 400px;"
      >
        <h2 style="margin-bottom: 10px; color: #333; text-align: center;">NeuroMetrics Platform</h2>
        <p style="color: #666; text-align: center; font-size: 0.9rem; margin-bottom: 30px;">
          Accesso riservato al personale clinico autorizzato
        </p>

        <!-- Messaggio di errore reattivo con i Signals -->
        @if (errorMessage()) {
          <div
            style="background-color: #f8d7da; color: #721c24; padding: 12px; border-radius: 4px; margin-bottom: 20px; font-size: 0.9rem; border: 1px solid #f5c6cb;"
          >
            {{ errorMessage() }}
          </div>
        }

        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="form-group" style="margin-bottom: 20px;">
            <label for="login-username" style="display: block; margin-bottom: 6px; font-weight: 600; color: #444;"
              >Username</label
            >
            <input
              id="login-username"
              type="text"
              formControlName="username"
              style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1rem;"
            />
          </div>

          <div class="form-group" style="margin-bottom: 25px;">
            <label for="login-password" style="display: block; margin-bottom: 6px; font-weight: 600; color: #444;"
              >Password</label
            >
            <input
              id="login-password"
              type="password"
              formControlName="password"
              style="width: 100%; padding: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1rem;"
            />
          </div>

          <button
            type="submit"
            [disabled]="loginForm.invalid || isLoading()"
            style="width: 100%; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; font-size: 1rem; font-weight: bold; cursor: pointer; transition: background 0.2s;"
          >
            {{ isLoading() ? 'Autenticazione in corso...' : 'Accedi' }}
          </button>
        </form>

        <p style="text-align: center; margin-top: 20px; font-size: 0.9rem; color: #666;">
          Non hai un account?
          <a routerLink="/register" style="color: #007bff; text-decoration: none;">Registrati</a>
        </p>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  // Local UI state gestito con i Signals
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  loginForm = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null); // Resetta errori precedenti

    const { username, password } = this.loginForm.value;

    this.authService.login(username!, password!).subscribe({
      next: () => {
        // Successo: reindirizzamento immediato alla Dashboard
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        // Gestione dell'errore centralizzata dall'HTTP
        this.errorMessage.set(
          err.message || 'Impossibile connettersi al servizio di autenticazione.',
        );
      },
    });
  }
}

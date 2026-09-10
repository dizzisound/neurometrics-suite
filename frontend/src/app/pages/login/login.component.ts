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
  templateUrl: './login.component.html',
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

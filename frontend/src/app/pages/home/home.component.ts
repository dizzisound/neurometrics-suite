/**
 * Pagina di copertina/intro dell'applicazione
 * Punto d'ingresso pubblico (rotta ''): presenta la piattaforma e invita
 * l'utente ad accedere. Se già autenticato, la call to action punta
 * direttamente alla dashboard invece che al login.
 */
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  authService = inject(AuthService);
}

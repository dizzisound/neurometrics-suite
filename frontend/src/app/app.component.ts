/**
 * Componente principale dell'applicazione frontend Angular
 * Fornisce il guscio radice (navbar + router-outlet) condiviso da tutte le pagine
 */

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavbarComponent, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected readonly title = signal('neurometrics-frontend');
}

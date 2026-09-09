/**
 * Componente principale dell'applicazione frontend Angular
 * Gestisce l'inizializzazione e la comunicazione con il backend tramite DataService
 * Fornisce il template principale e gestisce lo stato globale dell'applicazione
 * Contiene anche la logica per la gestione dei messaggi provenienti dal backend.
 *
 */

import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { routes } from './app.routes';
import { DataService } from './core/services/data.service'; // <-- Importa il servizio
// <-- Utile per le pipe o direttive nei template
import { NavbarComponent } from './components/navbar.component'; // <-- Importa il componente NavbarComponent

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavbarComponent, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private dataService = inject(DataService);

  protected readonly title = signal('neurometrics-frontend');
  public messaggioDalBackend = signal<string>('Caricamento in corso...');

  // Inietta il servizio nel costruttore
  constructor() {
    console.log(routes); // <-- Utilizzo della costante routes per evitare warning di import non utilizzato
  }

  ngOnInit(): void {
    // Esegui la chiamata HTTP all'avvio del componente
    this.dataService.getTestData().subscribe({
      next: (response) => {
        this.messaggioDalBackend.set(response.messaggio);
      },
      error: (err) => {
        console.error('Errore durante la chiamata HTTP:', err);
        this.messaggioDalBackend.set('Impossibile connettersi al backend.');
      },
    });
  }
}

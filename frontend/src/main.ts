/**
 * Punto di ingresso principale dell'applicazione frontend Angular
 * Esegue il bootstrap del componente principale AppComponent con la configurazione globale
 * 
 */

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));

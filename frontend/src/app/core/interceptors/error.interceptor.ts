/**
 * Interceptor HTTP per la gestione degli errori
 * Intercetta le risposte HTTP con errori e personalizza i messaggi di errore
 * Gestisce automaticamente il logout in caso di errori di autenticazione (401/403)
 * Propaga gli errori personalizzati ai componenti che effettuano le richieste HTTP
 * 
 */

import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            let errorMessage: string;

            // Gestione degli errori in base al codice di stato HTTP
            switch (error.status) {
                case 401: // Unauthorized (Token mancante o non valido)
                case 403: // Forbidden (Token scaduto o permessi insufficienti)
                    if (req.url.includes('/auth/login') || req.url.includes('/auth/register')) {
                        // Errore di credenziali sul login stesso: nessuna sessione da invalidare.
                        errorMessage = error.error?.error || 'Credenziali non valide.';
                    } else {
                        errorMessage = 'Sessione scaduta o non autorizzata. Effettua nuovamente l\'accesso.';
                        // Forziamo il logout automatico per motivi di sicurezza e GDPR
                        authService.logout();
                    }
                    break;

                case 404:
                    errorMessage = 'Risorsa clinica non trovata sul server.';
                    break;

                case 500:
                    errorMessage = 'Errore interno del server durante l\'elaborazione statistica.';
                    break;

                case 0: // Errore di rete (es. Server spento o mancanza di internet)
                    errorMessage = 'Impossibile connettersi al server. Controlla la tua connessione di rete.';
                    break;

                default:
                    errorMessage = error.error?.error || `Errore [Codice ${error.status}]`;
            }

            // Arricchiamo l'oggetto errore prima di propagarlo al componente
            const customizedError = {
                status: error.status,
                message: errorMessage,
                originalError: error
            };

            return throwError(() => customizedError);
        })
    );
};
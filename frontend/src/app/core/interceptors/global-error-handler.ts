import { ErrorHandler, Injectable, NgZone, inject } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
    private zone = inject(NgZone);

    handleError(error: unknown): void {
        // 1. Log dell'errore nella console dello sviluppatore
        console.error('*** ErrorHandler Globale Catturato ***', error);

        // Eseguiamo la UI di notifica all'interno della zona di Angular per aggiornare il DOM
        this.zone.run(() => {
            // In un'app reale, qui puoi aprire una libreria di notifiche come Angular Material SnackBar o Toastr
            // Evitiamo i crash silenziosi mostrando un avviso generico e pulito all'utente
            const message = error instanceof Error ? error.message : 'Si è verificato un errore interno nell\'applicazione.';
            alert(`Avviso di Sistema: ${message}\nSe il problema persiste, contatta l'assistenza tecnica.`);
        });

        // 2. Opzione avanzata per la ricerca clinica:
        // Inviare i log di errore a un endpoint del server Node.js (es. /api/logs)
        // per monitorare se l'algoritmo Ex-Gaussiano fallisce con dataset estremi.
    }
}
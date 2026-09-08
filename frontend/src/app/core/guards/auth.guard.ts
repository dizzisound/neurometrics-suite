/**
 * Guard di autenticazione per le rotte protette
 * Controlla la presenza di un token JWT nel localStorage
 * Se il token è presente, permette l'accesso alla rotta
 * Altrimenti, reindirizza alla pagina di login
 * Utilizza il router per il reindirizzamento in caso di mancata autenticazione
 * 
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = () => {
    const router = inject(Router);
    const token = localStorage.getItem('neuro_token');

    if (token) {
        // Nota avanzata: Qui potresti anche decodificare il JWT lato client 
        // per controllare la scadenza o i ruoli (es. route.data['role'])
        return true;
    }

    // Se non autenticato, reindirizza alla pagina di login
    router.navigate(['/login']);
    return false;
};
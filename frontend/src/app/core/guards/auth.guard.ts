/**
 * Guard di autenticazione per le rotte protette
 * Controlla la presenza di un token JWT nel localStorage
 * Se il token è presente, permette l'accesso alla rotta
 * Altrimenti, reindirizza alla pagina di login
 *
 * Supporta anche un controllo di ruolo opzionale tramite i dati della rotta:
 * `data: { deniedRoles: ['RESEARCHER'] }` nega l'accesso a quel ruolo e
 * reindirizza alla dashboard invece che al login (l'utente è comunque
 * autenticato, solo non autorizzato a quella specifica rotta).
 */

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route) => {
    const router = inject(Router);
    const token = localStorage.getItem('neuro_token');

    if (!token) {
        router.navigate(['/login']);
        return false;
    }

    const deniedRoles = route.data['deniedRoles'] as string[] | undefined;
    const role = localStorage.getItem('neuro_role');
    if (deniedRoles && role && deniedRoles.includes(role)) {
        router.navigate(['/dashboard']);
        return false;
    }

    return true;
};

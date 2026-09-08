/**
 * Interceptor HTTP per l'autenticazione
 * Aggiunge l'header Authorization con il token JWT se presente nel localStorage
 * Se il token non è presente, la richiesta viene inviata senza l'header Authorization.
 * Gestisce automaticamente l'inserimento del token nelle richieste HTTP verso il backend.
 * Utilizzato come parte della configurazione globale degli interceptor HTTP.
 * 
 */

import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const token = localStorage.getItem('neuro_token');

    // Se il token esiste, clona la richiesta e inieta l'header di autorizzazione
    if (token) {
        const clonedRequest = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
        return next(clonedRequest);
    }

    return next(req);
};
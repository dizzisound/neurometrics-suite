/*
 * Verifica e decodifica del Token JWT per proteggere le rotte dell'applicazione
 * Assicura che solo utenti autenticati possano accedere a determinate risorse del backend
 * Utilizza il middleware per intercettare le richieste e verificare la validità del token JWT prima di consentire l'accesso alle rotte protette.
 * In caso di token mancante o non valido, restituisce un errore di autorizzazione. 
 *
 */
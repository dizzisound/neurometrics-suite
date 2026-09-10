/*
 * Verifica e decodifica del Token JWT per proteggere le rotte dell'applicazione
 * Assicura che solo utenti autenticati possano accedere a determinate risorse del backend
 * Utilizza il middleware per intercettare le richieste e verificare la validità del token JWT prima di consentire l'accesso alle rotte protette.
 * In caso di token mancante o non valido, restituisce un errore di autorizzazione.
 *
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Config } from '../config/env.config';

export interface AuthenticatedRequest extends Request {
    userContext?: { id: string; role: string };
}

export const verifyJwt = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Estrae il token dall'header 'Bearer <TOKEN>'

    if (!token) return res.status(401).json({ error: 'Accesso negato. Token mancante.' });

    jwt.verify(token, Config.JWT_SECRET, (err, decoded: any) => {
        if (err) return res.status(403).json({ error: 'Token scaduto o non valido.' });
        req.userContext = { id: decoded.id, role: decoded.role };
        next();
    });
};

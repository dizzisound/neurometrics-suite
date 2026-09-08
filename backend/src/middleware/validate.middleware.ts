/*
 * Middleware per la validazione dei dati delle richieste HTTP utilizzando Zod
 * Intercetta le richieste e verifica che il corpo della richiesta rispetti lo schema definito
 * In caso di errori di validazione, restituisce un errore 400 con i dettagli degli errori
 * In caso di errore interno durante la validazione, restituisce un errore 500
 *
 */

import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodError } from 'zod';

export const validateBody = (schema: ZodObject) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // parseAsync valida il corpo della richiesta e rimuove eventuali proprietà extra non definite nello schema (stripping)
            req.body = await schema.parseAsync(req.body);
            return next();
        } catch (error) {
            if (error instanceof ZodError) {
                // Formattiamo gli errori di Zod per renderli facilmente leggibili dal nostro ErrorInterceptor su Angular
                const formattedErrors = error.issues.map(err => ({
                    campo: err.path.join('.'),
                    messaggio: err.message
                }));

                return res.status(400).json({
                    error: 'Validazione dei dati fallita.',
                    details: formattedErrors
                });
            }

            return res.status(500).json({ error: 'Errore interno durante la validazione.' });
        }
    };
};
/*
 * Controller per l'autenticazione degli utenti
 * Gestisce la registrazione, il login e la protezione delle rotte tramite JWT
 *
 */

import { Request, Response, Router, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User } from '../../database/models/user.schema';

// Sostituisci il vecchio riferimento statico a JWT_SECRET con:
import { Config } from '../../config/env.config';

const authRouter = Router();

// Genera un token valido per 30 minuti
const generateToken = (userId: string, role: string) => {
    return jwt.sign({ id: userId, role }, Config.JWT_SECRET, { expiresIn: '30m' });
};

/**
 * POST /api/auth/register (Inizializzazione account clinico)
 */
authRouter.post('/auth/register', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ error: 'Username già in uso.' });

        const passwordHash = await bcrypt.hash(password, Config.BCRYPT_SALT_ROUNDS);
        const newUser = new User({ username, passwordHash });
        await newUser.save();

        return res.status(201).json({ message: 'Utente clinico registrato con successo.' });
    } catch (error) {
        console.error('Errore durante la registrazione:', error);
        return res.status(500).json({ error: 'Errore durante la registrazione.' });
    }
});

/**
 * POST /api/auth/login (Rilascio del Token JWT)
 */
authRouter.post('/auth/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Credenziali non valide.' });
        }

        const token = generateToken(user._id.toString(), user.role);
        return res.status(200).json({ token, role: user.role, username: user.username });
    } catch (error) {
        console.error('Errore durante il login:', error);
        return res.status(500).json({ error: 'Errore durante il login.' });
    }
});

/**
 * MIDDLEWARE di protezione degli endpoint clinici
 */
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

export default authRouter;
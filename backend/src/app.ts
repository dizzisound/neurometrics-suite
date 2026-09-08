/**
 * Entry point dell'applicazione backend per la gestione dei test neuropsicologici
 * Configura Express, connessione a MongoDB e registrazione delle rotte API
 */

import express from 'express';
import cors from 'cors';
import { Config } from './config/env.config';
import { connectDB } from './database/connect';
import authRouter from './modules/auth/auth.controller';
import sessionRouter from './modules/sessions/sessions.controller';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connessione al Database tramite variabile d'ambiente
connectDB().catch((err) => console.error('Errore di connessione a DB:', err));

// Registrazione Rotte
app.use('/api', authRouter);
app.use('/api', sessionRouter);

// Rotta di test
app.get('/api/test', (req, res) => {
    res.json({ messaggio: 'Backend Node.js funzionante!' });
});

// Avvio Server sulla porta configurata
app.listen(Config.PORT, () => {
    console.log(`🚀 Server neuropsicologico attivo in modalità [${Config.NODE_ENV}] sulla porta ${Config.PORT}`);
});
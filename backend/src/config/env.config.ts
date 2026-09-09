/*
 * Configurazione delle variabili d'ambiente e validazione tramite Zod
 *
 */

import dotenv from 'dotenv';
import { z } from 'zod';

// Carica i dati dal file .env nella memoria di processo
// quiet: true evita che dotenv stampi un suo tip/annuncio casuale ad ogni avvio
dotenv.config({ quiet: true });

// Definiamo uno schema Zod per assicurarci che il backend non parta nemmeno 
// se manca una variabile fondamentale (Fail-Fast Pattern)
const envSchema = z.object({
    PORT: z.string().transform(Number).default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    MONGODB_USERNAME: z.string().min(1, { message: "La variabile MONGODB_USERNAME è obbligatoria" }),
    MONGODB_PASSWORD: z.string().min(1, { message: "La variabile MONGODB_PASSWORD è obbligatoria" }),
    MONGODB_URI: z.string().url({ message: "La stringa MONGODB_URI deve essere un URL valido" }),
    JWT_SECRET: z.string().min(32, { message: "Il JWT_SECRET deve essere lungo almeno 32 caratteri per sicurezza" }),
    BCRYPT_SALT_ROUNDS: z.string().transform(Number).default(12),
    DEFAULT_CSV_DELIMITER: z.string().max(1).default(';')
});

// Validiamo process.env rispetto allo schema
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('❌ Errore critico nella configurazione delle variabili d\'ambiente:');
    console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
    process.exit(1); // Interrompe immediatamente l'esecuzione dell'applicazione
}

// Esportiamo l'oggetto validato e fortemente tipizzato
export const Config = parsedEnv.data;
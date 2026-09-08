/*
 * Connessione al database MongoDB
 *
 */

import mongoose from 'mongoose';
import { Config } from '../config/env.config';

export async function connectDB(): Promise<void> {
    await mongoose.connect(Config.MONGODB_URI);
    console.log('💾 Connessione a MongoDB stabilita con successo.');
}

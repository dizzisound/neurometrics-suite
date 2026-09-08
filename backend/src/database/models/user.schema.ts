/*
 * Definizione dello schema Mongoose per gli utenti del sistema
 *
 */

import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
    username: string;
    passwordHash: string;
    role: 'CLINICIAN' | 'RESEARCHER' | 'ADMIN';
}

const UserSchema = new Schema<IUser>({
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['CLINICIAN', 'RESEARCHER', 'ADMIN'], default: 'CLINICIAN' }
});

export const User = model<IUser>('User', UserSchema);
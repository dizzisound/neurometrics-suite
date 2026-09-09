/*
 * Definizione dello schema Mongoose per il paziente
 *
 */

import { Schema, model, Document } from 'mongoose';

export interface PatientDocument extends Document {
    patientCode: string; // ID anonimizzato per privacy (es. "PAZ_2026_001")
    clinicianId: Schema.Types.ObjectId;
    birthDate: Date;
    educationYears: number; // Fondamentale per la correzione statistica futura
    gender: 'M' | 'F' | 'O';
    createdAt: Date;
}

const PatientSchema = new Schema<PatientDocument>({
    patientCode: { type: String, required: true, unique: true },
    clinicianId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    birthDate: { type: Date, required: true },
    educationYears: { type: Number, required: true, min: 1 },
    gender: { type: String, enum: ['M', 'F', 'O'], required: true },
    createdAt: { type: Date, default: Date.now }
});

export const Patient = model<PatientDocument>('Patient', PatientSchema);

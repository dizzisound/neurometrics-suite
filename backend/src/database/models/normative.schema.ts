/**
 * Schema Mongoose per i dati normativi dei test cognitivi.
 * Contiene informazioni su testType, metricName, fasce di età e anni di istruzione,
 * nonché parametri statistici della popolazione di riferimento.
 * 
 */

import { Schema, model, Document } from 'mongoose';

export interface INormativeData extends Document {
    testType: 'STROOP' | 'GO_NO_GO' | 'FLANKER';
    metricName: 'INTERFERENCE_EFFECT' | 'FALSE_ALARMS_RATE' | 'TAU';
    ageRange: {
        min: number;
        max: number;
    };
    educationYearsRange: {
        min: number;
        max: number;
    };
    // Parametri della popolazione di riferimento per quella specifica fascia
    populationMean: number;   // μ (Mu) della popolazione sana
    populationStdDev: number; // σ (Sigma) della popolazione sana
    createdAt: Date;
}

const NormativeDataSchema = new Schema<INormativeData>({
    testType: { type: String, enum: ['STROOP', 'GO_NO_GO', 'FLANKER'], required: true },
    metricName: { type: String, enum: ['INTERFERENCE_EFFECT', 'FALSE_ALARMS_RATE', 'TAU'], required: true },
    ageRange: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
    },
    educationYearsRange: {
        min: { type: Number, required: true },
        max: { type: Number, required: true }
    },
    populationMean: { type: Number, required: true },
    populationStdDev: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Indice composto per velocizzare le query di calcolo clinico
NormativeDataSchema.index({ testType: 1, metricName: 1, 'ageRange.min': 1, 'educationYearsRange.min': 1 });

export const NormativeData = model<INormativeData>('NormativeData', NormativeDataSchema);
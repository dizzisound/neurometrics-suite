/*
 * Definizione degli schemi Mongoose per i trial e le sessioni di test.
 * Lo schema del paziente vive in patient.schema.ts.
 *
 */

import { Schema, model, Document } from 'mongoose';

// 1. SCHEMA DEL SINGOLO TRIAL (Sotto-documento incorporato)
// stimulus/stimulusColor/isCongruent/correctResponse/userResponse: solo Stroop/Flanker; stimulusType/actionTaken: solo Go/No-Go
interface Trial {
    trialNumber: number;
    stimulus?: string;       // es. "ROSSO"
    stimulusColor?: string;  // es. "VERDE"
    isCongruent?: boolean;   // Proprietà statistica del trial
    stimulusType?: 'GO' | 'NO_GO';  // Solo per test Go/No-Go
    actionTaken?: 'PRESS' | 'NONE'; // Solo per test Go/No-Go
    correctResponse?: string;// es. "v"
    userResponse?: string;   // es. "v" o "r"
    isCorrect: boolean;
    reactionTimeMs: number; // Tempo catturato da Angular
}

const TrialSchema = new Schema<Trial>({
    trialNumber: { type: Number, required: true },
    stimulus: { type: String },
    stimulusColor: { type: String },
    isCongruent: { type: Boolean },
    stimulusType: { type: String, enum: ['GO', 'NO_GO'] },
    actionTaken: { type: String, enum: ['PRESS', 'NONE'] },
    correctResponse: { type: String },
    userResponse: { type: String },
    isCorrect: { type: Boolean, required: true },
    reactionTimeMs: { type: Number, required: true }
});

// 2. INTERFACCIA E SCHEMA SESSIONE DI TEST
export interface TestSessionDocument extends Document {
    patientId: Schema.Types.ObjectId; // Riferimento al paziente
    testType: 'STROOP' | 'GO_NO_GO' | 'FLANKER';
    sessionDate: Date;
    trials: Trial[]; // Array di tutti i trial eseguiti
    // Campi calcolati dal backend a fine test (evitano ricalcoli continui)
    summaryStats?: {
        accuracyRate: number;      // Percentuale risposte corrette
        meanRtCongruent?: number;   // Media tempi condizioni facili (Stroop/Flanker)
        meanRtIncongruent?: number; // Media tempi condizioni difficili (Stroop/Flanker)
        interferenceEffect?: number;// Differenza statistica Incongruent - Congruent (Stroop/Flanker)
        omissionRate?: number;     // Percentuale di trial Go mancati (Go/No-Go)
        falseAlarmRate?: number;   // Percentuale di pressioni su stimoli No-Go (Go/No-Go)
        meanHitRt?: number;        // Media RT delle risposte corrette a stimoli Go (Go/No-Go)
        postErrorSlowingEffect?: number; // Rallentamento dopo un errore (PES)
        fatigueIndex?: number;            // Variazione RT tra prima e seconda metà del test
        postErrorTimes?: number[];        // RT dei trial corretti successivi a un errore
        postCorrectTimes?: number[];      // RT dei trial corretti successivi a un altro successo
        exGaussian?: {             // Parametri stimati dal nostro algoritmo da zero
            mu: number;
            sigma: number;
            tau: number;
        }
        // Confronto con la popolazione di controllo (NormativeData): null se non c'è una fascia
        // normativa corrispondente (età/scolarità fuori standardizzazione) o campione insufficiente
        zScorePrimary?: number | null;  // Metrica principale del paradigma (interferenza o falsi allarmi)
        zScoreTau?: number | null;      // Parametro Tau ex-Gaussiano
    }
}

const TestSessionSchema = new Schema<TestSessionDocument>({
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    testType: { type: String, enum: ['STROOP', 'GO_NO_GO', 'FLANKER'], required: true },
    sessionDate: { type: Date, default: Date.now },
    trials: [TrialSchema], // Embedding dei trial per performance ottimali in lettura
    summaryStats: {
        accuracyRate: Number,
        meanRtCongruent: Number,
        meanRtIncongruent: Number,
        interferenceEffect: Number,
        omissionRate: Number,
        falseAlarmRate: Number,
        meanHitRt: Number,
        postErrorSlowingEffect: Number,
        fatigueIndex: Number,
        postErrorTimes: [Number],
        postCorrectTimes: [Number],
        exGaussian: {
            mu: Number,
            sigma: Number,
            tau: Number
        },
        zScorePrimary: { type: Number, default: null },
        zScoreTau: { type: Number, default: null }
    }
});

export const TestSession = model<TestSessionDocument>('TestSession', TestSessionSchema);

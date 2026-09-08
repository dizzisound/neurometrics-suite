/**
 * Schema di validazione per le sessioni e i trial dei test neuropsicologici
 * Utilizza Zod per garantire la correttezza dei dati in ingresso
 */

import { z } from 'zod';

// Schema di validazione per il singolo trial
// Stimulus/isCongruent/response sono richiesti solo per Stroop e Flanker; stimulusType/actionTaken solo per Go/No-Go
export const TrialValidationSchema = z.object({
    trialNumber: z.number().int().positive({ message: "Il numero del trial deve essere un intero positivo" }),
    stimulus: z.string().min(1, { message: "Lo stimolo testuale è obbligatorio" }).optional(),
    stimulusColor: z.string().min(1, { message: "Il colore dello stimolo è obbligatorio" }).optional(),
    isCongruent: z.boolean().optional(),
    stimulusType: z.enum(['GO', 'NO_GO']).optional(), // Per Go/No-Go
    actionTaken: z.enum(['PRESS', 'NONE']).optional(), // Per Go/No-Go
    // Stroop usa 'r'/'v', Flanker usa 'ArrowLeft'/'ArrowRight': il valore ammesso viene verificato in superRefine in base alla forma del trial
    correctResponse: z.string().min(1).optional(),
    userResponse: z.string().min(1).optional(),
    isCorrect: z.boolean({ message: "Il flag isCorrect è obbligatorio" }),
    // I trial omessi (Go/No-Go, actionTaken 'NONE') non hanno un tempo di reazione fisiologico: consentiamo 0.
    // Stroop e Flanker non hanno una finestra di risposta con timeout lato client: un paziente distratto può
    // legittimamente impiegare diversi secondi. Il limite superiore serve solo a scartare valori palesemente
    // corrotti (es. bug del client), non a rigettare trial lenti ma reali: quelli restano nel dataset e vengono
    // esclusi dalle statistiche cliniche dal filtro robusto MAD (NeuroDataCleaner), non dalla validazione di ingresso.
    reactionTimeMs: z.number()
        .min(0, { message: "Il tempo di reazione non può essere negativo" })
        .max(60000, { message: "Tempo di reazione oltre la soglia massima di tolleranza" })
}).superRefine((trial, ctx) => {
    if (trial.stimulusType) {
        // Trial Go/No-Go: la risposta assente deve avere reactionTimeMs 0, quella data deve essere fisiologica
        if (!trial.actionTaken) {
            ctx.addIssue({ code: 'custom', path: ['actionTaken'], message: "Il campo actionTaken è obbligatorio per i trial Go/No-Go" });
        } else if (trial.actionTaken === 'NONE' && trial.reactionTimeMs !== 0) {
            ctx.addIssue({ code: 'custom', path: ['reactionTimeMs'], message: "Un trial omesso (actionTaken NONE) deve avere reactionTimeMs pari a 0" });
        } else if (trial.actionTaken === 'PRESS' && trial.reactionTimeMs < 50) {
            ctx.addIssue({ code: 'custom', path: ['reactionTimeMs'], message: "Tempo di reazione fisiologicamente impossibile (<50ms)" });
        }
    } else if (trial.stimulusColor !== undefined) {
        // Trial Stroop: parola colorata, risposta 'r' o 'v'
        if (!trial.stimulus || !trial.stimulusColor || trial.isCongruent === undefined || !trial.correctResponse || !trial.userResponse) {
            ctx.addIssue({ code: 'custom', message: "stimulus, stimulusColor, isCongruent, correctResponse e userResponse sono obbligatori per i trial Stroop" });
        } else if (!['r', 'v'].includes(trial.correctResponse) || !['r', 'v'].includes(trial.userResponse)) {
            ctx.addIssue({ code: 'custom', path: ['correctResponse'], message: "La risposta per i trial Stroop può essere solo 'r' o 'v'" });
        }
        if (trial.reactionTimeMs < 50) {
            ctx.addIssue({ code: 'custom', path: ['reactionTimeMs'], message: "Tempo di reazione fisiologicamente impossibile (<50ms)" });
        }
    } else {
        // Trial Flanker: stimolo a frecce, risposta 'ArrowLeft' o 'ArrowRight'
        if (!trial.stimulus || trial.isCongruent === undefined || !trial.correctResponse || !trial.userResponse) {
            ctx.addIssue({ code: 'custom', message: "stimulus, isCongruent, correctResponse e userResponse sono obbligatori per i trial Flanker" });
        } else if (!['ArrowLeft', 'ArrowRight'].includes(trial.correctResponse) || !['ArrowLeft', 'ArrowRight'].includes(trial.userResponse)) {
            ctx.addIssue({ code: 'custom', path: ['correctResponse'], message: "La risposta per i trial Flanker può essere solo 'ArrowLeft' o 'ArrowRight'" });
        }
        if (trial.reactionTimeMs < 50) {
            ctx.addIssue({ code: 'custom', path: ['reactionTimeMs'], message: "Tempo di reazione fisiologicamente impossibile (<50ms)" });
        }
    }
});

// Schema di validazione per l'intero payload della sessione
export const CreateSessionValidationSchema = z.object({
    patientId: z.string().regex(/^[0-9a-fA-F]{24}$/, { message: "L'ID del paziente deve essere un ObjectId MongoDB valido" }),
    testType: z.enum(['STROOP', 'GO_NO_GO', 'FLANKER'], { message: "Tipo di test non supportato" }),
    trials: z.array(TrialValidationSchema).min(4, { message: "Una sessione valida deve contenere almeno 4 trial per l'elaborazione statistica" })
}).superRefine((session, ctx) => {
    // Impedisce trial di forma incoerente o mista rispetto al testType dichiarato
    session.trials.forEach((trial, index) => {
        const isGoNoGoShaped = trial.stimulusType !== undefined;
        if (session.testType === 'GO_NO_GO' && !isGoNoGoShaped) {
            ctx.addIssue({ code: 'custom', path: ['trials', index, 'stimulusType'], message: "Ogni trial di una sessione GO_NO_GO deve indicare stimulusType" });
        }
        if (session.testType !== 'GO_NO_GO' && isGoNoGoShaped) {
            ctx.addIssue({ code: 'custom', path: ['trials', index, 'stimulusType'], message: `Un trial Go/No-Go non è valido in una sessione di tipo ${session.testType}` });
        }
    });
});

// Inferiamo automaticamente i tipi TypeScript dagli schemi Zod (Zero duplicazione di codice)
export type CreateSessionInput = z.infer<typeof CreateSessionValidationSchema>;
export type TrialInput = z.infer<typeof TrialValidationSchema>;
/**
 * Script di seeding per popolare il database con dati fittizi
 * Include la creazione di un utente clinico di test, un paziente anonimizzato
 * e sessioni simulate con tempi di reazione generati secondo una distribuzione Ex-Gaussian
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { Config } from './config/env.config';
import { User } from './database/models/user.schema';
import { Patient, TestSession } from './database/models/session.schema';
import { estimateExGaussianParams } from './modules/sessions/exgaussian';

/**
 * Helper per generare tempi di reazione simulati.
 * Genera dati asimmetrici sommando una componente normale (Gaussiana) e una esponenziale.
 */
function generateFakeRt(mu: number, sigma: number, tau: number): number {
    // Trasformazione Box-Muller per la componente normale
    const u1 = Math.random();
    const u2 = Math.random();
    const normal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    const gaussianComponent = mu + sigma * normal;

    // Componente esponenziale
    const exponentialComponent = -tau * Math.log(Math.random());

    const totalRt = gaussianComponent + exponentialComponent;
    // Limite fisiologico minimo
    return totalRt < 150 ? 150 : parseFloat(totalRt.toFixed(2));
}

async function runSeed() {
    try {
        console.log('🔄 Connessione al database per il seeding...');
        await mongoose.connect(Config.MONGODB_URI);

        // 1. Svuotamento dei dati esistenti per garantire la riproducibilità dello script
        console.log('🧹 Pulizia delle collezioni esistenti...');
        await User.deleteMany({});
        await Patient.deleteMany({});
        await TestSession.deleteMany({});

        // 2. Creazione dell'Utente Clinico di Test
        console.log('👤 Creazione dell\'utente clinico di test...');
        const passwordHash = await bcrypt.hash('password123', Config.BCRYPT_SALT_ROUNDS);
        const defaultClinician = new User({
            username: 'dott.rossi',
            passwordHash: passwordHash,
            role: 'CLINICIAN'
        });
        await defaultClinician.save();

        // 3. Creazione del Paziente Anonimizzato
        console.log('📋 Creazione del profilo paziente fittizio...');
        const fakePatient = new Patient({
            // ID fisso per allinearsi alla costante CURRENT_PATIENT_ID nel frontend Angular
            _id: new mongoose.Types.ObjectId('6a9aaea19523c4213352fadc'),
            patientCode: 'PAZ_2026_MCI', // Sospetto decadimento cognitivo lieve (MCI)
            clinicianId: defaultClinician._id,
            birthDate: new Date('1956-04-12'),
            educationYears: 5, // Bassa scolarità, influisce sui cut-off clinici
            gender: 'M'
        });
        await fakePatient.save();

        // 4. Generazione Storico Sessioni (Trend di deterioramento su 3 visite distanziate nel tempo)
        console.log('📊 Generazione di 3 sessioni longitudinali simulate...');

        // Configurazione dei parametri Ex-Gaussiani che peggiorano nel tempo (aumento di Tau = vuoti attentivi)
        const sessionConfigs = [
            { date: new Date('2025-01-15'), mu: 400, sigma: 40, tau: 80 },  // T0: Prestazione basale
            { date: new Date('2025-07-15'), mu: 410, sigma: 45, tau: 130 }, // T1: Primi segnali di rallentamento esecutivo
            { date: new Date('2026-01-15'), mu: 430, sigma: 50, tau: 210 }  // T2: Forte aumento dei crolli attentivi (Tau alto)
        ];

        for (let sIndex = 0; sIndex < sessionConfigs.length; sIndex++) {
            const config = sessionConfigs[sIndex];
            const trialsPool: any[] = [];
            const totalTrials = 20;

            for (let i = 0; i < totalTrials; i++) {
                const isCongruent = i % 2 === 0;
                // L'effetto interferenza dello Stroop aumenta il tempo nelle prove incongruenti
                const interferencePremium = isCongruent ? 0 : 120;

                // 5% di probabilità di errore fisiologico nelle prove facili, 15% nelle difficili
                const isCorrect = Math.random() > (isCongruent ? 0.05 : 0.15);

                // Generiamo il tempo aggregando la nostra funzione psicofisica
                const finalRt = generateFakeRt(config.mu + interferencePremium, config.sigma, config.tau);

                trialsPool.push({
                    trialNumber: i + 1,
                    stimulus: isCongruent ? 'ROSSO' : 'VERDE',
                    stimulusColor: isCongruent ? 'ROSSO' : 'ROSSO', // Incongruente se la parola VERDE è scritta in ROSSO
                    isCongruent,
                    correctResponse: isCongruent ? 'r' : 'r',
                    userResponse: isCorrect ? 'r' : 'v',
                    isCorrect,
                    reactionTimeMs: finalRt
                });
            }

            // Estraiamo i dati puliti (solo trial corretti) per calcolare le summaryStats nel seed
            const correctTimes = trialsPool.filter(t => t.isCorrect).map(t => t.reactionTimeMs);
            const congruentClean = trialsPool.filter(t => t.isCorrect && t.isCongruent).map(t => t.reactionTimeMs);
            const incongruentClean = trialsPool.filter(t => t.isCorrect && !t.isCongruent).map(t => t.reactionTimeMs);

            const meanCongruent = congruentClean.reduce((a, b) => a + b, 0) / congruentClean.length;
            const meanIncongruent = incongruentClean.reduce((a, b) => a + b, 0) / incongruentClean.length;

            // Stimiamo i parametri ex-gaussiani aggregati usando l'algoritmo scritto da zero nei primi passaggi
            const exGStats = estimateExGaussianParams(correctTimes);

            const sessionDoc = new TestSession({
                patientId: fakePatient._id,
                testType: 'STROOP',
                sessionDate: config.date,
                trials: trialsPool,
                summaryStats: {
                    accuracyRate: parseFloat(((trialsPool.filter(t => t.isCorrect).length / totalTrials) * 100).toFixed(2)),
                    meanRtCongruent: parseFloat(meanCongruent.toFixed(2)),
                    meanRtIncongruent: parseFloat(meanIncongruent.toFixed(2)),
                    interferenceEffect: parseFloat((meanIncongruent - meanCongruent).toFixed(2)),
                    exGaussian: exGStats
                }
            });

            await sessionDoc.save();
        }

        console.log('✅ Database popolato correttamente con dati clinici conformi!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore durante la procedura di seeding:', error);
        process.exit(1);
    }
}

// Esecuzione dello script
runSeed();
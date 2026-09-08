/**
 * Controller per la gestione delle sessioni dei test neuropsicologici
 * Include endpoint per la creazione e l'elaborazione delle sessioni
 * Applica protezione JWT, validazione Zod e logica di business avanzata
 */

import { Response, Router } from 'express';
import mongoose from 'mongoose';
import { TestSession, Patient } from '../../database/models/session.schema';
import { validateBody } from '../../middleware/validate.middleware';
import { CreateSessionValidationSchema, CreateSessionInput } from './session.validator';
import { CreatePatientValidationSchema, CreatePatientInput } from './patient.validator';
import * as ss from 'simple-statistics';
import { estimateExGaussianParams } from './exgaussian'; // Funzione scritta da zero
import { NeuroDataCleaner } from './data-cleaner'; // Utilità per la pulizia dei dati neuropsicologici
import { AuthenticatedRequest, verifyJwt } from '../auth/auth.controller';
// Se usi la libreria esterna: npm install @json2csv/plainjs

const router = Router();

async function authorizePatientAccess(req: AuthenticatedRequest, res: Response, patientId: string | string[] | undefined, options: { allowDeidentifiedResearch?: boolean } = {}) {
  if (typeof patientId !== 'string' || !mongoose.isObjectIdOrHexString(patientId)) {
    res.status(400).json({ error: 'ID paziente non valido.' });
    return false;
  }

  const userContext = req.userContext;
  if (!userContext) {
    res.status(401).json({ error: 'Accesso negato. Token mancante.' });
    return false;
  }

  const patient = await Patient.findById(patientId);
  if (!patient) {
    res.status(404).json({ error: 'Paziente non trovato nei registri clinici.' });
    return false;
  }

  if (userContext.role === 'RESEARCHER') {
    if (!options.allowDeidentifiedResearch) {
      res.status(403).json({ error: 'Ruolo non autorizzato a inserire o modificare dati clinici.' });
      return false;
    }
    return true; // Accesso di sola lettura a dati de-identificati, non vincolato al clinico proprietario
  }

  if (userContext.role !== 'ADMIN' && (!patient.clinicianId || patient.clinicianId.toString() !== userContext.id)) {
    res.status(403).json({ error: 'Non sei autorizzato ad accedere ai dati di questo paziente.' });
    return false;
  }

  return true;
}

/**
 * GET /api/patients
 * Restituisce l'elenco dei pazienti visibili all'utente autenticato:
 * - CLINICIAN: solo i propri pazienti (in base a clinicianId)
 * - ADMIN: tutti i pazienti
 * - RESEARCHER: tutti i pazienti, con codice paziente de-identificato
 */
router.get('/patients', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userContext = req.userContext;
    if (!userContext) {
      return res.status(401).json({ error: 'Accesso negato. Token mancante.' });
    }

    const patientsQuery = Patient.find();
    if (userContext.role === 'CLINICIAN') {
      patientsQuery.where('clinicianId').equals(new mongoose.Types.ObjectId(userContext.id));
    }
    const patients = await patientsQuery
      .select('patientCode birthDate educationYears gender')
      .sort({ createdAt: 1 });

    const useDeidentifiedCode = userContext.role === 'RESEARCHER';

    return res.status(200).json(patients.map(p => ({
      _id: p._id,
      patientCode: useDeidentifiedCode ? `Paziente ${String(p._id).slice(-6)}` : p.patientCode,
      birthDate: p.birthDate,
      educationYears: p.educationYears,
      gender: p.gender
    })));
  } catch (error) {
    console.error('Errore nel recupero dei pazienti:', error);
    return res.status(500).json({ error: 'Errore durante il recupero dei pazienti.' });
  }
});

/**
 * POST /api/patients
 * Crea un nuovo paziente assegnato al clinico autenticato.
 * I RESEARCHER hanno accesso di sola lettura e non possono creare pazienti.
 */
router.post('/patients', verifyJwt, validateBody(CreatePatientValidationSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userContext = req.userContext;
    if (!userContext) {
      return res.status(401).json({ error: 'Accesso negato. Token mancante.' });
    }
    if (userContext.role === 'RESEARCHER') {
      return res.status(403).json({ error: 'Ruolo non autorizzato a creare pazienti.' });
    }

    const { patientCode, birthDate, educationYears, gender }: CreatePatientInput = req.body;

    const existingPatient = await Patient.findOne({ patientCode });
    if (existingPatient) {
      return res.status(400).json({ error: 'Codice paziente già in uso.' });
    }

    const newPatient = new Patient({
      patientCode,
      birthDate,
      educationYears,
      gender,
      clinicianId: userContext.id
    });
    await newPatient.save();

    return res.status(201).json({
      _id: newPatient._id,
      patientCode: newPatient.patientCode,
      birthDate: newPatient.birthDate,
      educationYears: newPatient.educationYears,
      gender: newPatient.gender
    });
  } catch (error) {
    console.error('Errore nella creazione del paziente:', error);
    return res.status(500).json({ error: 'Errore durante la creazione del paziente.' });
  }
});

// Applichiamo in cascata: Protezione JWT -> Validazione Zod -> Logica di Business
router.post('/sessions', verifyJwt, validateBody(CreateSessionValidationSchema), async (req: AuthenticatedRequest, res) => {
  try {
    // Grazie a Zod, req.body è fortemente tipizzato come CreateSessionInput
    const { patientId, testType, trials }: CreateSessionInput = req.body;

    if (!await authorizePatientAccess(req, res, patientId)) return;

    // Da qui in poi la pipeline esegue i calcoli (MAD, Ex-Gaussiana, Effetto Interferenza)
    // con la garanzia che trials sia un array sano, non vuoto e contenente solo numeri validi.

    // 2. Estrazione e pre-elaborazione statistica dei dati grezzi
    const correctTrials = trials.filter((t: any) => t.isCorrect === true);
    const accuracyRate = parseFloat(((correctTrials.length / trials.length) * 100).toFixed(2));

    // Estrazione vettori grezzi cronologici
    const rtCongruentRaw = correctTrials.filter((t: any) => t.isCongruent === true).map((t: any) => t.reactionTimeMs);
    const rtIncongruentRaw = correctTrials.filter((t: any) => t.isCongruent === false).map((t: any) => t.reactionTimeMs);
    const allCorrectRtRaw = correctTrials.map((t: any) => t.reactionTimeMs);

    // APPLICAZIONE DEI NUOVI CRITERI DI RAFFINAMENTO AVANZATI
    const rtCongruentClean = NeuroDataCleaner.cleanByRobustMAD(rtCongruentRaw, 2.5);
    const rtIncongruentClean = NeuroDataCleaner.cleanByRobustMAD(rtIncongruentRaw, 2.5);
    const allCorrectRtClean = NeuroDataCleaner.cleanByRobustMAD(allCorrectRtRaw, 2.5);

    // Calcolo dell'Indice di Fatica Cognitiva sul flusso totale
    const fatigueIndex = NeuroDataCleaner.calculateFatigueIndex(allCorrectRtRaw);

    const meanRtCongruent = rtCongruentClean.length > 0 ? ss.mean(rtCongruentClean) : 0;
    const meanRtIncongruent = rtIncongruentClean.length > 0 ? ss.mean(rtIncongruentClean) : 0;
    const interferenceEffect = meanRtIncongruent - meanRtCongruent;

    // 5. Calcolo dei parametri Ex-Gaussiani avanzati tramite l'algoritmo sviluppato da zero
    let exGaussianStats = { mu: 0, sigma: 0, tau: 0 };
    if (allCorrectRtClean.length >= 5) { // Un campione minimo è necessario per stimare i momenti
      exGaussianStats = estimateExGaussianParams(allCorrectRtClean);
    }

    // 6. Calcolo dell'indice PES (Post-Error Slowing) per l'analisi del controllo esecutivo
    //const trials = req.body.trials; // Array ordinato dei trial eseguiti
    const postErrorTimes: number[] = [];
    const postCorrectTimes: number[] = [];

    for (let i = 1; i < trials.length; i++) {
      const previousTrial = trials[i - 1];
      const currentTrial = trials[i];

      // Prendiamo in considerazione solo le risposte correnti corrette per evitare rumore accoppiato
      if (currentTrial.isCorrect) {
        if (previousTrial.isCorrect === false) {
          // Il tempo del trial corrente, eseguito SUBITO DOPO un errore
          postErrorTimes.push(currentTrial.reactionTimeMs);
        } else {
          // Il tempo del trial corrente, eseguito dopo una risposta già corretta
          postCorrectTimes.push(currentTrial.reactionTimeMs);
        }
      }
    }

    // Calcolo dell'indice PES (Differenza delle medie)
    const meanPostError = postErrorTimes.length > 0 ? ss.mean(postErrorTimes) : 0;
    const meanPostCorrect = postCorrectTimes.length > 0 ? ss.mean(postCorrectTimes) : 0;
    const postErrorSlowingEffect = meanPostError - meanPostCorrect;

    // Questo valore (es. +45ms) indica quanto il paziente rallenta per riprendere il controllo esecutivo.
    // Può essere salvato nel campo `summaryStats` del database e inviato alla Dashboard.

    let summaryStats: any = {
      accuracyRate,
      meanRtCongruent: parseFloat(meanRtCongruent.toFixed(2)),
      meanRtIncongruent: parseFloat(meanRtIncongruent.toFixed(2)),
      interferenceEffect: parseFloat(interferenceEffect.toFixed(2)),
      postErrorSlowingEffect: parseFloat(postErrorSlowingEffect.toFixed(2)),
      fatigueIndex: parseFloat(fatigueIndex.toFixed(2)),
      postErrorTimes: postErrorTimes,
      postCorrectTimes: postCorrectTimes,
      exGaussian: exGaussianStats
    };

    if (testType === 'GO_NO_GO') {
      const totalGo = trials.filter(t => t.stimulusType === 'GO').length;
      const totalNoGo = trials.filter(t => t.stimulusType === 'NO_GO').length;

      const hits = trials.filter(t => t.stimulusType === 'GO' && t.actionTaken === 'PRESS');
      const omissions = trials.filter(t => t.stimulusType === 'GO' && t.actionTaken === 'NONE').length;
      const falseAlarms = trials.filter(t => t.stimulusType === 'NO_GO' && t.actionTaken === 'PRESS').length;

      // Calcolo delle metriche psicometriche per il controllo inibitorio
      const omissionRate = totalGo > 0 ? parseFloat(((omissions / totalGo) * 100).toFixed(2)) : 0;
      const falseAlarmRate = totalNoGo > 0 ? parseFloat(((falseAlarms / totalNoGo) * 100).toFixed(2)) : 0;

      // Calcoliamo la media dei tempi di reazione SOLO per i successi (Hit) puliti da outlier MAD
      const hitReactionTimes = hits.map(t => t.reactionTimeMs);
      const cleanHitTimes = NeuroDataCleaner.cleanByRobustMAD(hitReactionTimes, 2.5);
      const meanHitRt = cleanHitTimes.length > 0 ? ss.mean(cleanHitTimes) : 0;

      summaryStats = {
        accuracyRate: parseFloat(((trials.filter(t => t.isCorrect).length / trials.length) * 100).toFixed(2)),
        meanHitRt: parseFloat(meanHitRt.toFixed(2)),
        falseAlarmRate,
        omissionRate,
        // Stima Ex-Gaussiana focalizzata solo sulla velocità dei processi di Hit positivi
        exGaussian: cleanHitTimes.length >= 5 ? estimateExGaussianParams(cleanHitTimes) : { mu: 0, sigma: 0, tau: 0 }
      };
    }

    if (testType === 'FLANKER') {
      // Filtriamo solo i trial corretti ed eliminiamo gli outlier visivi con la nostra pipeline robusta MAD
      const correctTrials = trials.filter((t: any) => t.isCorrect === true);

      const rtCongruentRaw = correctTrials.filter((t: any) => t.isCongruent === true).map((t: any) => t.reactionTimeMs);
      const rtIncongruentRaw = correctTrials.filter((t: any) => t.isCongruent === false).map((t: any) => t.reactionTimeMs);
      const allCorrectRtRaw = correctTrials.map((t: any) => t.reactionTimeMs);

      const rtCongruentClean = NeuroDataCleaner.cleanByRobustMAD(rtCongruentRaw, 2.5);
      const rtIncongruentClean = NeuroDataCleaner.cleanByRobustMAD(rtIncongruentRaw, 2.5);
      const allCorrectRtClean = NeuroDataCleaner.cleanByRobustMAD(allCorrectRtRaw, 2.5);

      const meanCongruent = rtCongruentClean.length > 0 ? ss.mean(rtCongruentClean) : 0;
      const meanIncongruent = rtIncongruentClean.length > 0 ? ss.mean(rtIncongruentClean) : 0;

      // Calcolo dell'effetto di interferenza spaziale (Costo di Flanker)
      const flankerCostEffect = meanIncongruent - meanCongruent;

      summaryStats = {
        accuracyRate: parseFloat(((correctTrials.length / trials.length) * 100).toFixed(2)),
        meanRtCongruent: parseFloat(meanCongruent.toFixed(2)),
        meanRtIncongruent: parseFloat(meanIncongruent.toFixed(2)),
        interferenceEffect: parseFloat(flankerCostEffect.toFixed(2)), // Salvato nel campo generalizzato del DB
        // Pipeline Ex-Gaussiana per studiare la distribuzione visuo-spaziale
        exGaussian: allCorrectRtClean.length >= 5 ? estimateExGaussianParams(allCorrectRtClean) : { mu: 0, sigma: 0, tau: 0 }
      };
    }

    // 7. Assemblaggio del documento finale e persistenza su DB
    const newSession = new TestSession({
      patientId,
      testType,
      trials, // Manteniamo la traccia di ogni singolo trial originale
      summaryStats: summaryStats
    });

    await newSession.save();

    // 8. Risposta HTTP di successo al frontend Angular
    return res.status(201).json({
      message: 'Sessione validata, elaborata e salvata con successo.',
      sessionId: newSession._id,
      summaryStats: newSession.summaryStats
    });

  } catch (error) {
    console.error('Errore durante l\'elaborazione dell\'endpoint:', error);
    return res.status(500).json({ error: 'Errore interno del server durante il calcolo statistico.' });
  }
});

/**
 * GET /api/patients/:patientId/sessions
 * Recupera la cronologia di tutte le sessioni di un paziente con le statistiche già calcolate.
 * Utile per alimentare i grafici di trend in Angular.
 */
router.get('/patients/:patientId/sessions', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!await authorizePatientAccess(req, res, patientId, { allowDeidentifiedResearch: true })) return;

    const sessions = await TestSession.find().where('patientId').equals(patientId)
      .sort({ sessionDate: 1 }) // Ordine cronologico dal più vecchio al più recente
      .select('-trials'); // Escludiamo i singoli trial per alleggerire la risposta JSON per i grafici

    return res.status(200).json(sessions);
  } catch (error) {
    console.error('Errore nel recupero delle sessioni:', error);
    return res.status(500).json({ error: 'Errore durante il recupero dei dati storici.' });
  }
});

/**
 * GET /api/patients/:patientId/export-csv
 * Estrae TUTTI i singoli trial di tutte le sessioni del paziente e li trasforma in un file CSV.
 * Struttura di tipo "Long Format", la più amata dagli statistici.
 */
router.get('/patients/:patientId/export-csv', verifyJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    if (!await authorizePatientAccess(req, res, patientId, { allowDeidentifiedResearch: true })) return;

    // Recuperiamo le sessioni includendo l'anagrafica del paziente per arricchire il CSV
    const sessions = await TestSession.find().where('patientId').equals(patientId)
      .select('patientId testType sessionDate trials summaryStats')
      .populate('patientId', 'patientCode educationYears gender')
      .sort({ sessionDate: 1 });

    if (!sessions || sessions.length === 0) {
      return res.status(404).json({ error: 'Nessun dato disponibile per l\'esportazione.' });
    }

    // Costruiamo una struttura "appiattita" (Flattening) adatta al formato tabellare
    const csvRows: any[] = [];

    // I ricercatori vedono solo un identificativo pseudonimo, mai il codice paziente clinico
    const useDeidentifiedCode = req.userContext?.role === 'RESEARCHER';

    sessions.forEach((session: any) => {
      const patient = session.patientId;

      if (!patient) return;

      if (!Array.isArray(session.trials)) return;

      session.trials.forEach((trial: any) => {
        csvRows.push({
          CodicePaziente: useDeidentifiedCode ? String(patient._id) : patient.patientCode,
          Genere: patient.gender,
          AnniScolarita: patient.educationYears,
          DataSessione: new Date(session.sessionDate).toISOString().split('T')[0],
          TipoTest: session.testType,
          NumeroTrial: trial.trialNumber,
          Stimolo: trial.stimulus,
          ColoreStimolo: trial.stimulusColor,
          Congruente: trial.isCongruent ? 1 : 0, // Codifica binaria statistica
          TipoStimoloGoNoGo: trial.stimulusType ?? '',
          AzioneCompiuta: trial.actionTaken ?? '',
          RispostaCorretta: trial.isCorrect ? 1 : 0,
          TempoReazioneMs: trial.reactionTimeMs,
          // Includiamo anche i parametri globali della sessione come contesto
          Sessione_EffettoInterferenza: session.summaryStats?.interferenceEffect || 0,
          Sessione_Tau: session.summaryStats?.exGaussian?.tau || 0
        });
      });
    });

    // OPZIONE A: Generazione CSV manuale (Zero dipendenze)
    const csvContent = generateManualCsv(csvRows);

    // Configurazione degli Header HTTP per forzare il browser a scaricare il file
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=export_neuro_sessions.csv');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.status(200).send(csvContent);

  } catch (error) {
    console.error('Errore durante l\'esportazione CSV:', error);
    return res.status(500).json({ error: 'Errore interno durante la generazione del file di esportazione.' });
  }
});

/**
 * Funzione Helper per convertire un array di oggetti in stringa CSV senza librerie.
 * Gestisce i delimitatori standard occidentali (punto e virgola per compatibilità Excel IT).
 */
function generateManualCsv(data: any[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvLines = [];

  // Aggiungi la riga di intestazione
  csvLines.push(headers.join(';'));

  // Aggiungi le righe dei dati
  for (const row of data) {
    const values = headers.map(header => {
      const rawValue = row[header];
      const val = rawValue == null ? '' : String(rawValue);
      const safeValue = typeof rawValue === 'string' && /^[=+\-@]/.test(val) ? `'${val}` : val;
      return `"${safeValue.replace(/"/g, '""')}"`;
    });
    csvLines.push(values.join(';'));
  }

  return csvLines.join('\n');
}

export default router;
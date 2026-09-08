/**
 * Servizio per la gestione delle statistiche neuropsicologiche
 * Fornisce metodi per inviare i risultati dei test, recuperare lo storico dei pazienti
 * e gestire l'esportazione dei dati in formato CSV.
 * Include anche funzionalità di backup locale per le sessioni fallite.
 * Chiamate API (Submit, History, Csv, PDF)
 * Gestisce anche la persistenza locale dei dati in caso di errori di rete.
 * 
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';

// Interfacce allineate ai modelli dati del backend per forte tipizzazione
export interface TrialData {
    trialNumber: number;
    isCorrect: boolean;
    reactionTimeMs: number;
    // Campi specifici Stroop/Flanker
    stimulus?: string;
    stimulusColor?: string;
    isCongruent?: boolean;
    correctResponse?: string;
    userResponse?: string;
    // Campi specifici Go/No-Go
    stimulusType?: 'GO' | 'NO_GO';
    actionTaken?: 'PRESS' | 'NONE';
}

export interface SessionPayload {
    patientId: string;
    testType: 'STROOP' | 'GO_NO_GO' | 'FLANKER';
    trials: TrialData[];
}

export interface BackedUpSession extends SessionPayload {
    savedAt: string;
}

export interface SessionSubmitResponse {
    message: string;
    sessionId: string;
    summaryStats: SessionSummary['summaryStats'];
}

export interface SessionSummary {
    _id: string;
    patientId: string;
    testType: string;
    sessionDate: string;
    summaryStats: {
        accuracyRate: number;
        meanRtCongruent?: number;   // Stroop/Flanker
        meanRtIncongruent?: number; // Stroop/Flanker
        interferenceEffect?: number;// Stroop/Flanker
        omissionRate?: number;      // Go/No-Go
        falseAlarmRate?: number;    // Go/No-Go
        meanHitRt?: number;         // Go/No-Go
        exGaussian: {
            mu: number;
            sigma: number;
            tau: number;
        };
    };
}

@Injectable({
    providedIn: 'root'
})
export class NeuroStatsService {
    // Utilizziamo la Dependency Injection moderna tramite la funzione inject()
    private http = inject(HttpClient);
    private apiUrl = 'http://localhost:3000/api'; // Modificare con l'URL del backend reale

    /**
     * Invia i risultati del test a fine somministrazione
     * Attiva la pipeline statistica nel backend Node.js
     */
    submitSession(payload: SessionPayload): Observable<SessionSubmitResponse> {
        return this.http.post<SessionSubmitResponse>(
            `${this.apiUrl}/sessions`,
            payload
        );
    }

    /**
     * Recupera lo storico dei riassunti statistici di un paziente
     * Ideale per grafici longitudinali (es. andamento di Tau nel tempo)
     */
    getPatientHistory(patientId: string): Observable<SessionSummary[]> {
        return this.http.get<SessionSummary[]>(`${this.apiUrl}/patients/${patientId}/sessions`);
    }

    /**
     * Scarica il file CSV in Long Format per SPSS/R
     * Gestisce lo stream binario tramite l'oggetto Blob del browser
     */
    downloadCsvExport(patientId: string): void {
        this.http.get(`${`${this.apiUrl}/patients/${patientId}/export-csv`}`, {
            responseType: 'blob' // Indica ad Angular di trattare la risposta come file binario/raw text
        }).subscribe({
            next: (blob: Blob) => {
                // Creazione di un URL temporaneo per il file scaricato
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `export_neuro_paziente_${patientId}.csv`;

                // Simula il click invisibile per far partire il download nativo del browser
                document.body.appendChild(a);
                a.click();

                // Pulizia del DOM e della memoria allocata
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            },
            error: (err) => console.error('Errore durante il download del CSV:', err)
        });
    }

    // Metodi per la gestione dei backup locali delle sessioni fallite
    private readonly BACKUP_KEY = 'backup_neuro_sessions';

    /**
     * Salva una sessione fallita nel localStorage all'interno di una coda (array)
     */
    saveSessionToLocalBackup(payload: SessionPayload): void {
        const existingBackups = this.getLocalBackups();
        existingBackups.push({
            ...payload,
            savedAt: new Date().toISOString() // Aggiungiamo un timestamp di controllo
        });
        localStorage.setItem(this.BACKUP_KEY, JSON.stringify(existingBackups));
    }

    /**
     * Recupera l'elenco di tutte le sessioni salvate localmente
     */
    getLocalBackups(): BackedUpSession[] {
        const data = localStorage.getItem(this.BACKUP_KEY);
        return data ? JSON.parse(data) : [];
    }

    /**
     * Pulisce la coda dei backup locali dopo una sincronizzazione riuscita
     */
    clearLocalBackups(): void {
        localStorage.removeItem(this.BACKUP_KEY);
    }

    /**
     * Esegue la sincronizzazione inviando al server tutti i test in coda.
     * Utilizza ForkJoin per sparare le richieste in parallelo e attendere l'esito di tutte.
     */
    syncLocalDataToServer(): Observable<SessionSubmitResponse[]> {
        const backups = this.getLocalBackups();
        if (backups.length === 0) return of([]); // Se non c'è nulla, restituisce un flusso vuoto

        // Creiamo un array di Observable (uno per ogni sessione da salvare)
        const requests = backups.map(session => this.submitSession(session));

        // forkJoin funziona come Promise.all: si attiva solo quando tutte le POST vanno a buon fine
        return forkJoin(requests);
    }

    /**
     * Scarica il Report Clinico in PDF generato dal server
     */
    downloadPdfReport(patientId: string): void {
        this.http.get(`${this.apiUrl}/patients/${patientId}/report-pdf`, {
            responseType: 'blob' // Trattiamo la risposta come file binario PDF raw
        }).subscribe({
            next: (blob: Blob) => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Report_Clinico_Paziente_${patientId}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            },
            error: (err) => console.error('Errore durante lo scaricamento del PDF:', err)
        });
    }
}
/**
 * Servizio di contesto paziente
 * Mantiene l'elenco dei pazienti visibili al clinico autenticato e il paziente
 * attualmente selezionato, condiviso tra la dashboard e i test neuropsicologici.
 */

import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface PatientSummary {
    _id: string;
    patientCode: string;
    birthDate: string;
    educationYears: number;
    gender: 'M' | 'F' | 'O';
}

export interface NewPatientInput {
    patientCode: string;
    birthDate: string;
    educationYears: number;
    gender: 'M' | 'F' | 'O';
}

@Injectable({
    providedIn: 'root'
})
export class PatientContextService {
    private http = inject(HttpClient);
    private apiUrl = 'http://localhost:3000/api/patients';

    patients = signal<PatientSummary[]>([]);
    selectedPatientId = signal<string | null>(null);
    isLoading = signal<boolean>(false);

    /**
     * Carica i pazienti del clinico autenticato. Se nessun paziente è ancora
     * selezionato, seleziona automaticamente il primo della lista.
     */
    loadPatients() {
        this.isLoading.set(true);
        return this.http.get<PatientSummary[]>(this.apiUrl).pipe(
            tap(patients => {
                this.patients.set(patients);
                this.isLoading.set(false);
                const currentSelection = this.selectedPatientId();
                const stillValid = currentSelection && patients.some(p => p._id === currentSelection);
                if (!stillValid) {
                    this.selectedPatientId.set(patients.length > 0 ? patients[0]._id : null);
                }
            })
        );
    }

    selectPatient(patientId: string): void {
        this.selectedPatientId.set(patientId);
    }

    /**
     * Crea un nuovo paziente assegnato al clinico autenticato e lo seleziona automaticamente.
     */
    createPatient(input: NewPatientInput): Observable<PatientSummary> {
        return this.http.post<PatientSummary>(this.apiUrl, input).pipe(
            tap(patient => {
                this.patients.update(current => [...current, patient]);
                this.selectedPatientId.set(patient._id);
            })
        );
    }
}

/**
 * Servizio per la gestione dei dati di test
 * Fornisce metodi per interagire con l'endpoint di test del backend
 * Utilizza HttpClient per effettuare le richieste HTTP
 * Contiene metodi per operazioni CRUD e query sui dati di test
 *
 */

import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TestDataResponse {
  messaggio: string;
}

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);

  // Il proxy reindirizzerà automaticamente "/api/test" a "http://localhost:3000/api/test"
  private apiUrl = '/api/test';

  // Metodo per recuperare il messaggio dal backend
  getTestData(): Observable<TestDataResponse> {
    return this.http.get<TestDataResponse>(this.apiUrl);
  }

  // Metodo per inviare dati di test al backend
  postTestData(payload: unknown): Observable<unknown> {
    return this.http.post<unknown>(this.apiUrl, payload);
  }

  // Metodo per aggiornare dati di test esistenti nel backend
  updateTestData(payload: unknown): Observable<unknown> {
    return this.http.put<unknown>(this.apiUrl, payload);
  }

  // Metodo per eliminare dati di test esistenti nel backend
  deleteTestData(payload: unknown): Observable<unknown> {
    return this.http.delete<unknown>(this.apiUrl, { body: payload });
  }

  // Metodo per recuperare un singolo dato di test per ID
  getTestDataById(id: string): Observable<unknown> {
    return this.http.get<unknown>(`${this.apiUrl}/${id}`);
  }

  // Metodo per recuperare tutti i dati di test con parametri di query opzionali
  getTestDataWithQuery(params: Record<string, string | number | boolean>): Observable<unknown> {
    return this.http.get<unknown>(this.apiUrl, { params });
  }

  // Metodo per recuperare il conteggio totale dei dati di test
  getTestDataCount(): Observable<unknown> {
    return this.http.get<unknown>(`${this.apiUrl}/count`);
  }

  // Metodo per recuperare i dati di test più recenti
  getLatestTestData(): Observable<unknown> {
    return this.http.get<unknown>(`${this.apiUrl}/latest`);
  }
}

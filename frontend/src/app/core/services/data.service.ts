/**
 * Servizio per la verifica di connessione al backend
 * Interroga l'endpoint demo /api/test tramite HttpClient
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
}

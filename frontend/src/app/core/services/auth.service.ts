/**
 * Servizio di autenticazione
 * Gestisce il login, il logout e lo stato reattivo dell'utente
 * Utilizza Signals per mantenere lo stato dell'autenticazione e dei dati dell'utente
 * Interagisce con il localStorage per la persistenza dei token e delle informazioni dell'utente
 * 
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

export interface AuthResponse {
    token: string;
    role: 'CLINICIAN' | 'RESEARCHER' | 'ADMIN';
    username: string;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private http = inject(HttpClient);
    private router = inject(Router);
    private apiUrl = 'http://localhost:3000/api/auth';

    // State Signal (Privato per incapsulamento)
    private authState = signal<{ token: string | null; role: string | null; username: string | null }>({
        token: localStorage.getItem('neuro_token'),
        role: localStorage.getItem('neuro_role'),
        username: localStorage.getItem('neuro_username')
    });

    // Computed Signals (Pubblici, in sola lettura per i componenti)
    isAuthenticated = computed(() => this.authState().token !== null);
    userRole = computed(() => this.authState().role);
    currentUser = computed(() => this.authState().username);

    /**
     * Esegue il login e aggiorna lo stato reattivo dei Signals
     */
    login(username: string, password: string): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${this.apiUrl}/login`, { username, password }).pipe(
            tap(response => {
                // Persistenza locale per i reload della pagina
                localStorage.setItem('neuro_token', response.token);
                localStorage.setItem('neuro_role', response.role);
                localStorage.setItem('neuro_username', response.username);

                // Aggiornamento dello stato del Signal
                this.authState.set({
                    token: response.token,
                    role: response.role,
                    username: response.username
                });
            })
        );
    }

    /**
     * Registra un nuovo utente clinico (il ruolo viene sempre assegnato dal backend)
     */
    register(username: string, password: string): Observable<{ message: string }> {
        return this.http.post<{ message: string }>(`${this.apiUrl}/register`, { username, password });
    }

    /**
     * Sbianca i token e resetta lo stato riallineando la UI
     */
    logout(): void {
        localStorage.removeItem('neuro_token');
        localStorage.removeItem('neuro_role');
        localStorage.removeItem('neuro_username');

        this.authState.set({ token: null, role: null, username: null });
        this.router.navigate(['/login']);
    }
}
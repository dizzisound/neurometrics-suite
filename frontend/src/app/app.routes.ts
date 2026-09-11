/**
 * Configurazione delle rotte dell'applicazione frontend Angular
 * Include le rotte per il login, la dashboard del paziente e i test neuropsicologici
 * Le rotte protette richiedono l'autenticazione tramite authGuard
 * 
 */

import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { PatientDashboardComponent } from './pages/dashboard/patient-dashboard.component';
import { StroopGameComponent } from './pages/experiments/stroop/stroop-game.component';
import { GoNoGoGameComponent } from './pages/experiments/gonogo/gonogo-game.component';
import { FlankerGameComponent } from './pages/experiments/flanker/flanker-game.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
    { path: 'test', redirectTo: '/test-stroop', pathMatch: 'full' },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent, pathMatch: 'full' },
    {
        path: 'dashboard',
        component: PatientDashboardComponent,
        canActivate: [authGuard] // Rotta protetta
    },
    {
        path: 'test-stroop',
        component: StroopGameComponent,
        canActivate: [authGuard], // Rotta protetta
        data: { deniedRoles: ['RESEARCHER'] } // Sola lettura: non può avviare sessioni di test
    },
    {
        path: 'test-gonogo',
        component: GoNoGoGameComponent,
        canActivate: [authGuard], // Rotta protetta
        data: { deniedRoles: ['RESEARCHER'] }
    },
    {
        path: 'test-flanker',
        component: FlankerGameComponent,
        canActivate: [authGuard], // Rotta protetta
        data: { deniedRoles: ['RESEARCHER'] }
    },
    { path: '', component: HomeComponent, pathMatch: 'full' }
];

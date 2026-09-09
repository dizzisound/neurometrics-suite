/**
 * Componente per il pannello di monitoraggio longitudinale del paziente
 * Mostra grafici e statistiche basate sui test cognitivi selezionati
 * Permette l'esportazione dei dati raw e dei report clinici in PDF
 * Gestisce lo stato locale dei segnali e aggiorna automaticamente i grafici quando cambiano i dati
 *
 */

import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NeuroStatsService, SessionSummary } from '../../core/services/neuro-stats.service';
import { PatientContextService, TestParadigm } from '../../core/services/patient-context.service';
import {
  TrendChartComponent,
  TrendChartPoint,
  TrendSeriesColor,
} from '../../components/trend-chart/trend-chart.component';

type SelectedTest = TestParadigm;

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [FormsModule, TrendChartComponent],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss',
})
export class PatientDashboardComponent implements OnInit {
  private statsService = inject(NeuroStatsService);
  private router = inject(Router);
  protected patientContext = inject(PatientContextService);

  // 1. SIGNALS DI STATO
  // Inizializziamo dal paradigma su cui il clinico ha lavorato per ultimo (dashboard o
  // pagina di test), così tornando da un test la visualizzazione è già quella corretta.
  selectedTest = signal<SelectedTest>(this.patientContext.lastTestType());
  private rawSessionsData = signal<SessionSummary[]>([]); // Cache locale dei dati del DB

  // Stato del modulo "Nuovo Paziente"
  showNewPatientForm = signal<boolean>(false);
  newPatientCode = signal<string>('');
  newPatientBirthDate = signal<string>('');
  newPatientEducationYears = signal<number | null>(null);
  newPatientGender = signal<'M' | 'F' | 'O'>('M');
  newPatientError = signal<string | null>(null);
  isCreatingPatient = signal<boolean>(false);

  // 2. COMPUTED SIGNALS (Si aggiornano automaticamente quando cambia selectedTest o rawSessionsData)
  filteredSessions = computed(() => {
    return this.rawSessionsData().filter((session) => session.testType === this.selectedTest());
  });

  activeTestLabel = computed(() => {
    switch (this.selectedTest()) {
      case 'STROOP':
        return 'Effetto Stroop Clinico';
      case 'GO_NO_GO':
        return "Controllo dell'Impulsività (Go/No-Go)";
      case 'FLANKER':
        return "Controllo dell'Inibizione Attentiva (Flanker)";
      default:
        return 'Test non supportato';
    }
  });

  chart1Title = computed(() => {
    switch (this.selectedTest()) {
      case 'STROOP':
        return 'Effetto Interferenza (ms) - [Incongruenti - Congruenti]';
      case 'GO_NO_GO':
        return 'Tasso di Falsi Allarmi (%) - [Impulsività Comportamentale]';
      case 'FLANKER':
        return "Costo d'Interferenza (ms) - [Incongruenti - Congruenti]";
      default:
        return 'Metriche del test';
    }
  });

  chart1Unit = computed(() => (this.selectedTest() === 'GO_NO_GO' ? '%' : 'ms'));

  chart1SeriesLabel = computed(() => {
    switch (this.selectedTest()) {
      case 'STROOP':
        return 'Effetto Interferenza';
      case 'GO_NO_GO':
        return 'Tasso Falsi Allarmi';
      case 'FLANKER':
        return "Costo d'Interferenza";
      default:
        return 'Valore';
    }
  });

  // Ogni paradigma occupa uno slot fisso e mai ciclico della palette categoriale validata
  chart1Color = computed<TrendSeriesColor>(() => {
    switch (this.selectedTest()) {
      case 'GO_NO_GO':
        return 'gonogo';
      case 'FLANKER':
        return 'flanker';
      default:
        return 'stroop';
    }
  });

  chart1Points = computed<TrendChartPoint[]>(() =>
    this.filteredSessions().map((s) => ({
      date: s.sessionDate,
      value:
        this.selectedTest() === 'GO_NO_GO'
          ? (s.summaryStats.falseAlarmRate ?? 0)
          : (s.summaryStats.interferenceEffect ?? 0),
    })),
  );

  chart2Points = computed<TrendChartPoint[]>(() =>
    this.filteredSessions().map((s) => ({
      date: s.sessionDate,
      value: s.summaryStats.exGaussian?.tau ?? 0,
    })),
  );

  // Ultima sessione del paradigma selezionato: fonte per il confronto con la popolazione di controllo
  latestSession = computed<SessionSummary | null>(() => {
    const sessions = this.filteredSessions();
    return sessions.length > 0 ? sessions[sessions.length - 1] : null;
  });

  constructor() {
    // Ricarica lo storico ogni volta che cambia il paziente selezionato (incluso il primo auto-selezionato)
    effect(() => {
      const patientId = this.patientContext.selectedPatientId();
      if (patientId) {
        this.loadAllPatientData(patientId);
      } else {
        this.rawSessionsData.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.patientContext.loadPatients().subscribe({
      error: (err) => console.error('Errore nel caricamento dei pazienti:', err),
    });
  }

  /**
   * Scarica tutto lo storico del paziente in un unico colpo dal server Node.js
   */
  private loadAllPatientData(patientId: string): void {
    this.statsService.getPatientHistory(patientId).subscribe({
      next: (data) => this.rawSessionsData.set(data), // Popola il Signal sorgente
      error: (err) => console.error('Errore nel caricamento storico clinico:', err),
    });
  }

  downloadData(): void {
    const patientId = this.patientContext.selectedPatientId();
    if (patientId) this.statsService.downloadCsvExport(patientId);
  }

  downloadPdfReport(): void {
    const patientId = this.patientContext.selectedPatientId();
    if (patientId) this.statsService.downloadPdfReport(patientId);
  }

  onParadigmChange(testType: SelectedTest): void {
    this.selectedTest.set(testType);
    this.patientContext.lastTestType.set(testType);
  }

  startTest(testType: SelectedTest): void {
    const routeByTest: Record<SelectedTest, string> = {
      STROOP: '/test-stroop',
      GO_NO_GO: '/test-gonogo',
      FLANKER: '/test-flanker',
    };
    this.router.navigate([routeByTest[testType]]);
  }

  submitNewPatient(): void {
    const patientCode = this.newPatientCode().trim();
    const birthDate = this.newPatientBirthDate();
    const educationYears = this.newPatientEducationYears();

    if (!patientCode || !birthDate || educationYears === null || educationYears < 0) {
      this.newPatientError.set('Compila tutti i campi correttamente.');
      return;
    }

    this.isCreatingPatient.set(true);
    this.newPatientError.set(null);

    this.patientContext
      .createPatient({
        patientCode,
        birthDate,
        educationYears,
        gender: this.newPatientGender(),
      })
      .subscribe({
        next: () => {
          this.isCreatingPatient.set(false);
          this.showNewPatientForm.set(false);
          this.newPatientCode.set('');
          this.newPatientBirthDate.set('');
          this.newPatientEducationYears.set(null);
          this.newPatientGender.set('M');
        },
        error: (err) => {
          this.isCreatingPatient.set(false);
          this.newPatientError.set(err.message || 'Impossibile creare il paziente.');
        },
      });
  }

  getZScoreClass(zScore: number): string {
    if (zScore <= -2.0) return 'critical-deficit'; // Colore di sfondo rosso intenso
    if (zScore <= -1.5) return 'borderline-warning'; // Colore di sfondo giallo/arancione
    return 'normal-performance'; // Colore di sfondo verde
  }

  getZScoreInterpretation(zScore: number): string {
    if (zScore <= -2.0) return 'Deficit Critico';
    if (zScore <= -1.5) return 'Prestazione Borderline';
    return 'Nella Norma';
  }
}

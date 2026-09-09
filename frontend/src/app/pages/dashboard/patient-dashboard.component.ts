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
  template: `
    <div
      class="dashboard-container"
      style="padding: 20px; font-family: sans-serif; background: #f8f9fa; min-height: 100vh;"
    >
      <!-- HEADER E SELETTORE PAZIENTE -->
      <div
        style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;"
      >
        <div>
          <h2 style="margin: 0; color: #2c3e50;">Pannello di Monitoraggio Longitudinale</h2>

          @if (patientContext.patients().length > 0) {
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
              <label for="patient-select" style="font-weight: bold; color: #34495e;">Paziente:</label>
              <select
                id="patient-select"
                [ngModel]="patientContext.selectedPatientId()"
                (ngModelChange)="patientContext.selectPatient($event)"
                style="padding: 8px; font-size: 0.95rem; border-radius: 4px; border: 1px solid #ccc; background: white; cursor: pointer; color: #2c3e50;"
              >
                @for (p of patientContext.patients(); track p._id) {
                  <option [value]="p._id">{{ p.patientCode }}</option>
                }
              </select>
            </div>
          }

          @if (!patientContext.isLoading() && patientContext.patients().length === 0) {
            <p style="margin: 10px 0 0 0; color: #e74c3c; font-weight: 600;">
              Nessun paziente assegnato al tuo account.
            </p>
          }

          <div style="margin-top: 12px;">
            <button
              (click)="showNewPatientForm.set(!showNewPatientForm())"
              style="padding: 6px 14px; font-size: 0.85rem; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px;"
            >
              {{ showNewPatientForm() ? 'Annulla' : '+ Nuovo Paziente' }}
            </button>

            @if (showNewPatientForm()) {
              <div
                style="margin-top: 12px; padding: 15px; background: #f8f9fa; border-radius: 6px; border: 1px solid #dee2e6; max-width: 320px;"
              >
                @if (newPatientError()) {
                  <div
                    style="background: #f8d7da; color: #721c24; padding: 8px; border-radius: 4px; margin-bottom: 10px; font-size: 0.85rem;"
                  >
                    {{ newPatientError() }}
                  </div>
                }
                <div style="margin-bottom: 10px;">
                  <label
                    for="new-patient-code"
                    style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #444;"
                    >Codice Paziente</label
                  >
                  <input
                    id="new-patient-code"
                    type="text"
                    [ngModel]="newPatientCode()"
                    (ngModelChange)="newPatientCode.set($event)"
                    style="width: 100%; padding: 6px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;"
                  />
                </div>
                <div style="margin-bottom: 10px;">
                  <label
                    for="new-patient-birthdate"
                    style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #444;"
                    >Data di Nascita</label
                  >
                  <input
                    id="new-patient-birthdate"
                    type="date"
                    [ngModel]="newPatientBirthDate()"
                    (ngModelChange)="newPatientBirthDate.set($event)"
                    style="width: 100%; padding: 6px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;"
                  />
                </div>
                <div style="margin-bottom: 10px;">
                  <label
                    for="new-patient-education-years"
                    style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #444;"
                    >Anni di Scolarità</label
                  >
                  <input
                    id="new-patient-education-years"
                    type="number"
                    min="0"
                    [ngModel]="newPatientEducationYears()"
                    (ngModelChange)="newPatientEducationYears.set($event)"
                    style="width: 100%; padding: 6px; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px;"
                  />
                </div>
                <div style="margin-bottom: 12px;">
                  <label
                    for="new-patient-gender"
                    style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 4px; color: #444;"
                    >Genere</label
                  >
                  <select
                    id="new-patient-gender"
                    [ngModel]="newPatientGender()"
                    (ngModelChange)="newPatientGender.set($event)"
                    style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px;"
                  >
                    <option value="M">M</option>
                    <option value="F">F</option>
                    <option value="O">O</option>
                  </select>
                </div>
                <button
                  (click)="submitNewPatient()"
                  [disabled]="isCreatingPatient()"
                  style="width: 100%; padding: 8px; background: #007bff; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer;"
                >
                  {{ isCreatingPatient() ? 'Creazione in corso...' : 'Crea Paziente' }}
                </button>
              </div>
            }
          </div>
        </div>

        <!-- Menu a tendina legato bidirezionalmente al Signal del Test Attivo -->
        @if (patientContext.selectedPatientId()) {
          <div style="display: flex; align-items: center; gap: 10px;">
            <label for="paradigm-select" style="font-weight: bold; color: #34495e;">Seleziona Paradigma:</label>
            <select
              id="paradigm-select"
              [ngModel]="selectedTest()"
              (ngModelChange)="onParadigmChange($event)"
              style="padding: 10px; font-size: 1rem; border-radius: 4px; border: 1px solid #ccc; background: white; cursor: pointer; font-weight: 600; color: #2c3e50;"
            >
              <option value="STROOP">Test di Stroop (Inibizione Cognitiva)</option>
              <option value="GO_NO_GO">Test Go/No-Go (Inibizione Motoria)</option>
              <option value="FLANKER">Test di Flanker (Inibizione Attentiva)</option>
            </select>
          </div>
        }
      </div>

      @if (patientContext.selectedPatientId()) {
        <!-- AVVIO TEST -->
        <div style="margin-bottom: 25px; display: flex; gap: 12px; flex-wrap: wrap;">
          <button
            (click)="startTest('STROOP')"
            style="padding: 10px 20px; font-weight: bold; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(40,167,69,0.2);"
          >
            Avvia Test di Stroop
          </button>
          <button
            (click)="startTest('GO_NO_GO')"
            style="padding: 10px 20px; font-weight: bold; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(40,167,69,0.2);"
          >
            Avvia Test Go/No-Go
          </button>
          <button
            (click)="startTest('FLANKER')"
            style="padding: 10px 20px; font-weight: bold; cursor: pointer; background: #28a745; color: white; border: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(40,167,69,0.2);"
          >
            Avvia Test di Flanker
          </button>
        </div>
        <!-- BOTTONE ESPORTAZIONE -->
        <div style="margin-bottom: 25px;">
          <button
            (click)="downloadData()"
            style="padding: 10px 20px; font-weight: bold; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,123,255,0.2);"
          >
            Esporta Dati Raw per SPSS / R
          </button>
        </div>
        <!-- BOTTONE DOWNLOAD REPORT PDF -->
        <div style="margin-bottom: 25px;">
          <button
            (click)="downloadPdfReport()"
            style="padding: 10px 20px; font-weight: bold; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,123,255,0.2);"
          >
            Download PDF Report Clinico
          </button>
        </div>
        <!-- TITOLO DINAMICO GRAFICI -->
        <h3 style="color: #34495e; margin-bottom: 15px;">
          Visualizzazione Attiva: {{ activeTestLabel() }}
        </h3>

        <!-- Confronto con la Popolazione di Controllo (Z-Score dell'ultima sessione) -->
        @if (latestSession(); as s) {
          <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
            @if (s.summaryStats.zScorePrimary !== null && s.summaryStats.zScorePrimary !== undefined) {
              <div
                [class]="getZScoreClass(s.summaryStats.zScorePrimary)"
                style="padding: 8px 14px; border-radius: 4px; font-weight: bold; font-size: 0.9rem;"
              >
                {{ chart1SeriesLabel() }} — Z: {{ s.summaryStats.zScorePrimary }} ({{
                  getZScoreInterpretation(s.summaryStats.zScorePrimary)
                }})
              </div>
            }
            @if (s.summaryStats.zScoreTau !== null && s.summaryStats.zScoreTau !== undefined) {
              <div
                [class]="getZScoreClass(s.summaryStats.zScoreTau)"
                style="padding: 8px 14px; border-radius: 4px; font-weight: bold; font-size: 0.9rem;"
              >
                Tau — Z: {{ s.summaryStats.zScoreTau }} ({{ getZScoreInterpretation(s.summaryStats.zScoreTau) }})
              </div>
            }
            @if (
              (s.summaryStats.zScorePrimary === null || s.summaryStats.zScorePrimary === undefined) &&
              (s.summaryStats.zScoreTau === null || s.summaryStats.zScoreTau === undefined)
            ) {
              <div style="padding: 8px 14px; border-radius: 4px; font-size: 0.85rem; color: #6c757d; background: #f1f1f1;">
                Confronto con la popolazione di controllo non disponibile per età/scolarità di questo paziente.
              </div>
            }
          </div>
        }

        <!-- GRIGLIA GRAFICI -->
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          <!-- Grafico 1: Indice Clinico Principale -->
          <div
            style="flex: 1; min-width: 450px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"
          >
            <h4 style="margin-top: 0; color: #2c3e50;">{{ chart1Title() }}</h4>
            <app-trend-chart
              [points]="chart1Points()"
              [unit]="chart1Unit()"
              [seriesLabel]="chart1SeriesLabel()"
              [color]="chart1Color()"
              [ariaLabel]="chart1Title()"
              emptyMessage="Nessuna sessione registrata per questo paradigma."
            />
          </div>
          <!-- Grafico 2: Parametro Attentivo Tau -->
          <div
            style="flex: 1; min-width: 450px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"
          >
            <h4 style="margin-top: 0; color: #2c3e50;">
              Analisi Ex-Gaussiana: Parametro &tau; (Latenza Attentiva)
            </h4>
            <app-trend-chart
              [points]="chart2Points()"
              unit="ms"
              seriesLabel="Valore Tau"
              color="tau"
              ariaLabel="Andamento del parametro Tau (latenza attentiva) nel tempo"
              emptyMessage="Nessuna sessione registrata per questo paradigma."
            />
          </div>
        </div>
      }
    </div>
  `,
  styles: [
    `
    .critical-deficit {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .borderline-warning {
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
    }
    .normal-performance {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    `,
  ],
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

/**
 * Componente per il pannello di monitoraggio longitudinale del paziente
 * Mostra grafici e statistiche basate sui test cognitivi selezionati
 * Permette l'esportazione dei dati raw e dei report clinici in PDF
 * Gestisce lo stato locale dei segnali e aggiorna automaticamente i grafici quando cambiano i dati
 *
 */

import {
  Component,
  OnInit,
  ElementRef,
  ViewChild,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NeuroStatsService, SessionSummary } from '../../core/services/neuro-stats.service';
import { PatientContextService } from '../../core/services/patient-context.service';
import Chart from 'chart.js/auto';

type SelectedTest = 'STROOP' | 'GO_NO_GO' | 'FLANKER';

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [FormsModule],
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
              (ngModelChange)="selectedTest.set($event)"
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
        <!-- GRIGLIA GRAFICI -->
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          <!-- Grafico 1: Indice Clinico Principale -->
          <div
            style="flex: 1; min-width: 450px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"
          >
            <h4 style="margin-top: 0; color: #2c3e50;">{{ chart1Title() }}</h4>
            <canvas #chartCanvas1></canvas>
          </div>
          <!-- Grafico 2: Parametro Attentivo Tau -->
          <div
            style="flex: 1; min-width: 450px; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);"
          >
            <h4 style="margin-top: 0; color: #2c3e50;">
              Analisi Ex-Gaussiana: Parametro &tau; (Latenza Attentiva)
            </h4>
            <canvas #chartCanvas2></canvas>
          </div>
        </div>
      }
    </div>
  `,
})
export class PatientDashboardComponent implements OnInit {
  private statsService = inject(NeuroStatsService);
  private router = inject(Router);
  protected patientContext = inject(PatientContextService);

  // 1. SIGNALS DI STATO
  selectedTest = signal<SelectedTest>('STROOP'); // Test di default caricato all'avvio
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
        return 'Tasso di Errori di Inibizione (%) - [Inibizione Attentiva]';
      default:
        return 'Metriche del test';
    }
  });

  // Riferimenti ai Canvas nel DOM (non più statici: compaiono solo quando un paziente è selezionato)
  @ViewChild('chartCanvas1') canvas1?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvas2') canvas2?: ElementRef<HTMLCanvasElement>;

  // Istanze globali dei grafici Chart.js per poterne fare il destroy/update dinamico
  private chart1Instance: Chart | null = null;
  private chart2Instance: Chart | null = null;

  constructor() {
    // 3. ANGULAR EFFECT: Si attiva automaticamente ogni volta che cambia il valore del Computed Signal 'filteredSessions'
    effect(() => {
      const sessions = this.filteredSessions();
      this.updateCharts(sessions);
    });

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

  /**
   * Aggiorna o distrugge/ricrea i grafici Chart.js con i nuovi dati filtrati
   */
  private updateCharts(sessions: SessionSummary[]): void {
    if (!this.canvas1 || !this.canvas2) return; // I canvas esistono solo con un paziente selezionato

    const labels = sessions.map((s) => new Date(s.sessionDate).toLocaleDateString('it-IT'));
    const tauData = sessions.map((s) => s.summaryStats.exGaussian?.tau || 0);

    // Configurazione dinamica dei dati per il Grafico 1 a seconda del paradigma selezionato
    const dataset1Data = sessions.map((s) =>
      this.selectedTest() === 'GO_NO_GO'
        ? (s.summaryStats.falseAlarmRate ?? 0)
        : (s.summaryStats.interferenceEffect ?? 0),
    );

    const dataset1Label =
      this.selectedTest() === 'STROOP'
        ? 'Effetto Interferenza (ms)'
        : this.selectedTest() === 'GO_NO_GO'
          ? 'Tasso Falsi Allarmi (%)'
          : 'Tasso Errori di Inibizione (%)';

    const dataset1Color =
      this.selectedTest() === 'STROOP'
        ? '#ff6384'
        : this.selectedTest() === 'GO_NO_GO'
          ? '#e67e22'
          : '#8e44ad';

    const yAxisLabel = this.selectedTest() === 'STROOP' ? 'Millisecondi (ms)' : 'Percentuale (%)';

    // Se i grafici esistono già, li distruggiamo prima di ricostruirli (evita artefatti grafici al passaggio del mouse)
    if (this.chart1Instance) this.chart1Instance.destroy();
    if (this.chart2Instance) this.chart2Instance.destroy();

    // Rendering Grafico 1 (Variabile a seconda del test)
    this.chart1Instance = new Chart(this.canvas1.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: dataset1Label,
            data: dataset1Data,
            borderColor: dataset1Color,
            backgroundColor: dataset1Color + '15',
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: { responsive: true, scales: { y: { title: { display: true, text: yAxisLabel } } } },
    });

    // Rendering Grafico 2 (Parametro Tau Ex-Gaussiano, presente in entrambi per misurare i vuoti attentivi)
    this.chart2Instance = new Chart(this.canvas2.nativeElement, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Valore Tau (ms)',
            data: tauData,
            borderColor: '#36a2eb',
            backgroundColor: '#36a2eb15',
            fill: true,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        scales: { y: { title: { display: true, text: 'Millisecondi (ms)' } } },
      },
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
}

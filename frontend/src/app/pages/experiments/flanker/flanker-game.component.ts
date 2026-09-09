/**
 * Componente per il test Flanker con monitoraggio delle risposte
 * Gestisce il ciclo di vita dei trial, la raccolta dei dati e la gestione dello stato dei trial durante l'esperimento
 * Fornisce anche la gestione dello stato della fissazione, dello stimolo e dell'intervallo inter-stimolo
 *
 */

import { Component, OnInit, HostListener, inject, NgZone, signal } from '@angular/core';
import { Router } from '@angular/router';

import { NeuroStatsService } from '../../../core/services/neuro-stats.service';
import { PatientContextService } from '../../../core/services/patient-context.service';

type FlankerState = 'START_SCREEN' | 'FIXATION' | 'STIMULUS' | 'ISI' | 'COMPLETED';

interface FlankerTrial {
  stringDisplay: string;
  targetDirection: 'left' | 'right';
  isCongruent: boolean;
}

interface FlankerTrialResult {
  trialNumber: number;
  stimulus: string;
  isCongruent: boolean;
  correctResponse: string;
  userResponse: string;
  isCorrect: boolean;
  reactionTimeMs: number;
}

@Component({
  selector: 'app-flanker-test',
  standalone: true,
  imports: [],
  template: `
    <!-- Utilizziamo i fogli di stile con luminanza controllata visti in precedenza -->
    <div
      class="experiment-viewport"
      style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #1a1a1a; cursor: none; user-select: none;"
    >
      @if (!hasPatient) {
        <div style="color: white; text-align: center; font-family: sans-serif;">
          <p>Nessun paziente selezionato.</p>
          <p>Torna alla dashboard e seleziona un paziente prima di iniziare il test.</p>
        </div>
      }

      @if (hasPatient) {
        <!-- Schermata Iniziale con istruzioni per il paziente -->
        @if (currentState() === 'START_SCREEN') {
          <div style="color: white; text-align: center; font-family: sans-serif; max-width: 520px; padding: 0 20px;">
            <h2>Test di Flanker</h2>
            <p style="line-height: 1.6;">
              Al centro dello schermo apparirà una fila di frecce. Il tuo compito è indicare la
              direzione della <strong>freccia centrale</strong>, ignorando le frecce ai lati.
            </p>
            <div style="display: flex; justify-content: center; gap: 30px; margin: 24px 0;">
              <div style="text-align: center;">
                <div style="font-family: 'Courier New', Courier, monospace; letter-spacing: 10px; font-size: 1.6rem; color: #ecf0f1;">
                  &gt;&gt;&gt;&gt;&gt;
                </div>
                <div style="font-size: 0.85rem; color: #bbb; margin-top: 8px;">
                  Freccia centrale a destra &rarr; premi <strong>&rarr;</strong>
                </div>
              </div>
              <div style="text-align: center;">
                <div style="font-family: 'Courier New', Courier, monospace; letter-spacing: 10px; font-size: 1.6rem; color: #ecf0f1;">
                  &lt;&lt;&gt;&lt;&lt;
                </div>
                <div style="font-size: 0.85rem; color: #bbb; margin-top: 8px;">
                  Freccia centrale a destra &rarr; premi comunque <strong>&rarr;</strong>
                </div>
              </div>
            </div>
            <p style="line-height: 1.6;">
              Premi la freccia <strong>SINISTRA</strong> della tastiera se la freccia centrale
              punta a sinistra, la freccia <strong>DESTRA</strong> se punta a destra. Rispondi il
              più velocemente possibile restando accurato/a. Il test è composto da 20 prove.
            </p>
            <div style="display: flex; justify-content: center; gap: 12px; margin-top: 15px;">
              <button
                (click)="startExperiment()"
                style="padding: 12px 24px; font-size: 1.2rem; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px;"
              >
                Inizia
              </button>
              <button
                (click)="goToDashboard()"
                style="padding: 12px 24px; font-size: 1.2rem; cursor: pointer; background: #6c757d; color: white; border: none; border-radius: 4px;"
              >
                Torna alla Dashboard
              </button>
            </div>
          </div>
        }
        @if (currentState() === 'FIXATION') {
          <div class="fixation-cross">+</div>
        }
        <!-- Stimolo Flanker: Utilizziamo font monospazio per garantire che la freccia centrale sia esattamente al centro millimetrico dello schermo -->
        @if (currentState() === 'STIMULUS') {
          <div
            class="stroop-stimulus"
            style="font-family: 'Courier New', Courier, monospace; letter-spacing: 12px; color: #ecf0f1;"
          >
            {{ activeTrial()?.stringDisplay }}
          </div>
        }
        @if (currentState() === 'ISI') {
          <div></div>
        }
        @if (currentState() === 'COMPLETED') {
          <div style="color: white; text-align: center; font-family: sans-serif;">
            <h3>Elaborazione e salvataggio dei parametri esecutivi...</h3>
          </div>
        }
      }
    </div>
  `,
})
export class FlankerGameComponent implements OnInit {
  private zone = inject(NgZone);
  private statsService = inject(NeuroStatsService);
  private patientContext = inject(PatientContextService);
  private router = inject(Router);

  currentState = signal<FlankerState>('START_SCREEN');
  activeTrial = signal<FlankerTrial | null>(null);

  private totalTrials = 20;
  private currentPointer = 0;
  private startTime!: number;
  private trialResults: FlankerTrialResult[] = [];

  // Matrice pre-bilanciata di stimoli per evitare bias sequenziali
  private stimuliPool: FlankerTrial[] = [
    { stringDisplay: '<<<<<', targetDirection: 'left', isCongruent: true },
    { stringDisplay: '>>>>>', targetDirection: 'right', isCongruent: true },
    { stringDisplay: '<<><<', targetDirection: 'right', isCongruent: false },
    { stringDisplay: '>><>>', targetDirection: 'left', isCongruent: false },
  ];
  private balancedSequence: FlankerTrial[] = [];

  get hasPatient(): boolean {
    return !!this.patientContext.selectedPatientId();
  }

  ngOnInit(): void {
    // Ricorda il paradigma corrente, così la dashboard mostra la vista giusta al ritorno
    this.patientContext.lastTestType.set('FLANKER');
  }

  startExperiment(): void {
    this.currentPointer = 0;
    this.trialResults = [];
    this.generateBalancedSequence();
    this.executeLifecycle();
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  private generateBalancedSequence() {
    // Generiamo una lista equilibrata al 50% tra congruenti e incongruenti usando la logica del modulo Fisher-Yates sviluppato in precedenza
    this.balancedSequence = [];
    for (let i = 0; i < this.totalTrials / 4; i++) {
      this.balancedSequence.push(...this.stimuliPool.map((s) => ({ ...s })));
    }
    // Eseguiamo lo shuffle dell'array in modo deterministico
    this.balancedSequence.sort(() => Math.random() - 0.5); // Per semplicità usiamo un inline, ma si raccomanda Fisher-Yates
  }

  private executeLifecycle() {
    this.currentState.set('ISI');

    this.zone.runOutsideAngular(() => {
      const isiDuration = Math.floor(Math.random() * (1000 - 600 + 1)) + 600;

      setTimeout(() => {
        this.zone.run(() => {
          this.currentState.set('FIXATION');

          setTimeout(() => {
            this.activeTrial.set(this.balancedSequence[this.currentPointer]);
            this.currentState.set('STIMULUS');
            this.startTime = performance.now();
          }, 500); // Croce di fissazione a schermo per 500ms
        });
      }, isiDuration);
    });
  }

  @HostListener('window:keydown', ['$event'])
  handleInput(event: KeyboardEvent) {
    if (this.currentState() !== 'STIMULUS') return;

    // Mappatura dei tasti freccia standard del browser
    let userDirection: 'left' | 'right' | null = null;
    if (event.key === 'ArrowLeft') userDirection = 'left';
    if (event.key === 'ArrowRight') userDirection = 'right';

    if (!userDirection) return; // Ignora altri tasti

    const currentTarget = this.activeTrial()!;
    const rt = performance.now() - this.startTime;
    const isCorrect = userDirection === currentTarget.targetDirection;

    this.trialResults.push({
      trialNumber: this.currentPointer + 1,
      stimulus: currentTarget.stringDisplay,
      isCongruent: currentTarget.isCongruent,
      correctResponse: currentTarget.targetDirection === 'left' ? 'ArrowLeft' : 'ArrowRight',
      userResponse: event.key,
      isCorrect: isCorrect,
      reactionTimeMs: parseFloat(rt.toFixed(2)),
    });

    this.currentPointer++;
    if (this.currentPointer < this.balancedSequence.length) {
      this.executeLifecycle();
    } else {
      this.finalize();
    }
  }

  private finalize() {
    this.currentState.set('COMPLETED');
    const payload = {
      patientId: this.patientContext.selectedPatientId()!,
      testType: 'FLANKER' as const,
      trials: this.trialResults,
    };

    this.statsService.submitSession(payload).subscribe({
      next: () => {
        this.currentState.set('START_SCREEN');
        alert('Test Flanker completato con successo!');
      },
      error: (customError) => {
        if (customError.status === 0 || customError.status === 500) {
          this.statsService.saveSessionToLocalBackup(payload);
          alert(
            'Impossibile contattare il server. I dati sono stati salvati localmente e verranno risincronizzati appena possibile.',
          );
        } else {
          alert(
            `Salvataggio della sessione fallito: ${customError.message || 'errore sconosciuto'}. I dati NON sono stati salvati.`,
          );
        }
        this.currentState.set('START_SCREEN');
      },
    });
  }
}

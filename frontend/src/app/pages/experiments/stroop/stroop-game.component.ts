/**
 * Componente per il test di Stroop con monitoraggio degli errori
 * Gestisce il ciclo di vita dei trial, la raccolta dei dati e il feedback all'utente
 * Fornisce anche il calcolo del tempo di reazione e la gestione dello stato dei trial durante l'esperimento
 * Fornisce anche la gestione dello stato della schermata iniziale, della fissazione, dello stimolo, del feedback e dell'intervallo inter-stimolo
 *
 */

// 1. Estendiamo gli stati possibili del test includendo il FEEDBACK
type TestState = 'START_SCREEN' | 'FIXATION' | 'STIMULUS' | 'FEEDBACK' | 'ISI' | 'COMPLETED';

import { Component, OnInit, HostListener, inject, NgZone, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NeuroStatsService, TrialData } from '../../../core/services/neuro-stats.service';
import { generateBalancedTrials, TrialConfig } from '../utils/trial-balancer';
import { PatientContextService } from '../../../core/services/patient-context.service';

export function calculateReactionTimeMs(responseTime: number, stimulusTime: number): number {
  return parseFloat((responseTime - stimulusTime).toFixed(2));
}

@Component({
  selector: 'app-stroop-test',
  standalone: true,
  imports: [CommonModule],
  styleUrl: './stroop-game.component.scss',
  template: `
    <div
      class="viewport"
      style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #121212; color: white; font-family: sans-serif; user-select: none;"
    >
      <!-- Schermata Iniziale -->
      @if (currentState() === 'START_SCREEN') {
        <div style="text-align: center;">
          <h2>Test di Stroop con Monitoraggio Errori</h2>
          <p>Rispondi il più velocemente possibile evitando gli errori.</p>
          <button
            (click)="startExperiment()"
            style="padding: 12px 24px; font-size: 1.2rem; cursor: pointer; background: #007bff; color: white; border: none; border-radius: 4px; margin-top: 15px;"
          >
            Inizia
          </button>
        </div>
      }

      <!-- Croce di Fissazione Calibrata -->
      @if (currentState() === 'FIXATION') {
        <div class="fixation-cross">+</div>
      }

      <!-- Stimolo Target Calibrato con classi a contrasto controllato -->
      @if (currentState() === 'STIMULUS') {
        <div
          class="stroop-stimulus"
          [ngClass]="{
            'color-target-red': activeTrial()?.color === 'red',
            'color-target-green': activeTrial()?.color === 'green',
          }"
        >
          {{ activeTrial()?.word }}
        </div>
      }

      <!-- Feedback d'Errore Scientifico -->
      @if (currentState() === 'FEEDBACK') {
        <div class="feedback-error shake-animation">X</div>
      }

      <!-- Inter-Stimulus Interval -->
      @if (currentState() === 'ISI') {
        <div></div>
      }

      <!-- Schermata di Fine -->
      @if (currentState() === 'COMPLETED') {
        <div style="text-align: center;">
          <h3>Elaborazione e salvataggio dei parametri esecutivi...</h3>
        </div>
      }
    </div>
  `,
})
export class StroopGameComponent implements OnInit {
  private zone = inject(NgZone);
  private statsService = inject(NeuroStatsService);
  private patientContext = inject(PatientContextService);

  currentState = signal<TestState>('START_SCREEN');

  private totalTrialsCount = 20;
  private trialSequence: TrialConfig[] = [];
  private currentPointer = 0;

  activeTrial = signal<TrialConfig | null>(null);
  private startTime!: number;
  private resultsAccumulator: TrialData[] = [];

  ngOnInit(): void {
    this.trialSequence = generateBalancedTrials(this.totalTrialsCount);
  }

  startExperiment(): void {
    if (!this.patientContext.selectedPatientId()) {
      alert(
        'Nessun paziente selezionato. Torna alla dashboard e seleziona un paziente prima di iniziare il test.',
      );
      return;
    }
    this.currentPointer = 0;
    this.resultsAccumulator = [];
    this.executeTrialLifecycle();
  }

  /**
   * Gestione del ciclo di vita temporale del trial
   */
  private executeTrialLifecycle(): void {
    this.currentState.set('ISI');

    this.zone.runOutsideAngular(() => {
      // ISI standard variabile
      const randomIsi = Math.floor(Math.random() * (1200 - 700 + 1)) + 700;

      setTimeout(() => {
        this.zone.run(() => {
          this.currentState.set('FIXATION');

          setTimeout(() => {
            this.activeTrial.set(this.trialSequence[this.currentPointer]);
            this.startTime = Number.NaN;
            this.currentState.set('STIMULUS');
            requestAnimationFrame(() => {
              if (this.currentState() === 'STIMULUS') {
                this.startTime = performance.now();
              }
            });
          }, 500); // 500ms di fissazione
        });
      }, randomIsi);
    });
  }

  @HostListener('window:keydown', ['$event'])
  handlePatientInput(event: KeyboardEvent): void {
    const responseTime = performance.now();
    if (this.currentState() !== 'STIMULUS' || !Number.isFinite(this.startTime)) return;

    const key = event.key.toLowerCase();
    if (key !== 'r' && key !== 'v') return;

    const currentTarget = this.activeTrial()!;
    const isCorrect = key === currentTarget.correctKey;

    // Registriamo la risposta nel dataset
    this.resultsAccumulator.push({
      trialNumber: this.currentPointer + 1,
      stimulus: currentTarget.word,
      stimulusColor: currentTarget.color === 'red' ? 'ROSSO' : 'VERDE',
      isCongruent: currentTarget.isCongruent,
      correctResponse: currentTarget.correctKey,
      userResponse: key,
      isCorrect: isCorrect,
      reactionTimeMs: calculateReactionTimeMs(responseTime, this.startTime),
    });

    this.currentPointer++;

    // 3. LOGICA DI SNEAK-PEEK DEL FEEDBACK
    if (!isCorrect) {
      // Se l'utente ha sbagliato, mostriamo la "X" rossa prima del prossimo trial
      this.currentState.set('FEEDBACK');

      this.zone.runOutsideAngular(() => {
        setTimeout(() => {
          this.zone.run(() => {
            this.checkProgressOrEnd();
          });
        }, 400); // Il feedback d'errore resta visibile per 400ms fisiti
      });
    } else {
      // Se la risposta è corretta, procediamo immediatamente senza interruzioni visive
      this.checkProgressOrEnd();
    }
  }

  private checkProgressOrEnd(): void {
    if (this.currentPointer < this.trialSequence.length) {
      this.executeTrialLifecycle();
    } else {
      this.finalizeTest();
    }
  }

  private finalizeTest(): void {
    this.currentState.set('COMPLETED');
    const payload = {
      patientId: this.patientContext.selectedPatientId()!,
      testType: 'STROOP' as const,
      trials: this.resultsAccumulator,
    };
    this.statsService.submitSession(payload).subscribe({
      next: () => {
        this.currentState.set('START_SCREEN');
        alert('Test salvato sul server con successo.');
      },
      error: (customError) => {
        // Se lo status è 0 (rete assente) o 500 (crash momentaneo del server)
        if (customError.status === 0 || customError.status === 500) {
          // Chiamiamo il metodo del servizio per salvare l'array in locale
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

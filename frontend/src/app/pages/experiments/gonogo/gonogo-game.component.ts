/**
 * Componente per il test Go/No-Go con monitoraggio delle risposte
 * Gestisce il ciclo di vita dei trial, la raccolta dei dati e la gestione dello stato dei trial durante l'esperimento
 * Fornisce anche la gestione dello stato della fissazione, dello stimolo e dell'intervallo inter-stimolo
 *
 */

import { Component, OnInit, HostListener, inject, NgZone, signal } from '@angular/core';

import { NeuroStatsService } from '../../../core/services/neuro-stats.service';
import { PatientContextService } from '../../../core/services/patient-context.service';

type GoNoGoState = 'FIXATION' | 'STIMULUS' | 'ISI';
type StimulusType = 'GO' | 'NO_GO';

interface GoNoGoTrialResult {
  trialNumber: number;
  stimulusType: StimulusType;
  actionTaken: 'PRESS' | 'NONE';
  reactionTimeMs: number;
  isCorrect: boolean;
}

@Component({
  selector: 'app-gonogo-test',
  standalone: true,
  imports: [],
  template: `
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
        @if (currentState() === 'FIXATION') {
          <div style="font-size: 6rem; color: #7f8c8d;">+</div>
        }
        <!-- Stimolo Visivo: Forma geometrica invece del testo per isolare i processi motori da quelli verbali -->
        @if (currentState() === 'STIMULUS') {
          <div
            [style.border-radius]="currentStimulusType() === 'GO' ? '50%' : '0%'"
            [style.background-color]="currentStimulusType() === 'GO' ? '#2ecc71' : '#e74c3c'"
            style="width: 150px; height: 150px; transform: translateZ(0);"
          ></div>
        }
        @if (currentState() === 'ISI') {
          <div></div>
        }
      }
    </div>
  `,
})
export class GoNoGoGameComponent implements OnInit {
  private zone = inject(NgZone);
  private statsService = inject(NeuroStatsService);
  private patientContext = inject(PatientContextService);

  currentState = signal<GoNoGoState>('ISI');
  currentStimulusType = signal<StimulusType>('GO');

  private totalTrials = 30;
  private currentPointer = 0;
  private startTime!: number;
  private stimulusTimeoutId: ReturnType<typeof setTimeout> | undefined;

  private trialResults: GoNoGoTrialResult[] = [];
  private hasRespondedInCurrentTrial = false;

  get hasPatient(): boolean {
    return !!this.patientContext.selectedPatientId();
  }

  ngOnInit() {
    if (this.hasPatient) {
      this.executeTrial();
    }
  }

  private executeTrial() {
    this.currentState.set('ISI');
    this.hasRespondedInCurrentTrial = false;

    this.zone.runOutsideAngular(() => {
      // 1. ISI Randomizzato (700ms - 1200ms)
      const isiDuration = Math.floor(Math.random() * (1200 - 700 + 1)) + 700;

      setTimeout(() => {
        this.zone.run(() => {
          this.currentState.set('FIXATION');

          // 2. Croce di fissazione fissa (500ms)
          setTimeout(() => {
            // Definiamo il tipo di stimolo (80% GO, 20% NO_GO per creare l'abitudine motoria)
            this.currentStimulusType.set(Math.random() < 0.8 ? 'GO' : 'NO_GO');
            this.currentState.set('STIMULUS');
            this.startTime = performance.now();

            // 3. FINESTRA DI RISPOSTA ATTIVA: Il browser attende 800ms.
            // Se l'utente non preme nulla entro questo limite, il trial scade.
            this.stimulusTimeoutId = setTimeout(() => {
              this.zone.run(() => {
                if (!this.hasRespondedInCurrentTrial) {
                  this.handleNoResponse();
                }
              });
            }, 800); // 800ms finestra temporale critica
          }, 500);
        });
      }, isiDuration);
    });
  }

  /**
   * Intercettore della pressione dei tasti (Barra spaziatrice)
   */
  @HostListener('window:keydown', ['$event'])
  onKeyPress(event: KeyboardEvent) {
    if (event.key !== ' ' || this.currentState() !== 'STIMULUS' || this.hasRespondedInCurrentTrial)
      return;

    // Cancelliamo il timeout di scadenza perché il paziente ha risposto
    clearTimeout(this.stimulusTimeoutId);
    this.hasRespondedInCurrentTrial = true;
    const rt = performance.now() - this.startTime;

    this.trialResults.push({
      trialNumber: this.currentPointer + 1,
      stimulusType: this.currentStimulusType(),
      actionTaken: 'PRESS',
      reactionTimeMs: parseFloat(rt.toFixed(2)),
      // Statistica: premere su un GO è corretto (Hit), premere su un NO-GO è errore (False Alarm)
      isCorrect: this.currentStimulusType() === 'GO',
    });

    this.advance();
  }

  /**
   * Gestione del caso in cui il paziente NON ha premuto la barra entro gli 800ms
   */
  private handleNoResponse() {
    this.hasRespondedInCurrentTrial = true;

    this.trialResults.push({
      trialNumber: this.currentPointer + 1,
      stimulusType: this.currentStimulusType(),
      actionTaken: 'NONE',
      reactionTimeMs: 0, // Nessun tempo registrato
      // Statistica: non premere su NO-GO è corretto (Correct Rejection), non premere su GO è errore (Omission)
      isCorrect: this.currentStimulusType() === 'NO_GO',
    });

    this.advance();
  }

  private advance() {
    this.currentPointer++;
    if (this.currentPointer < this.totalTrials) {
      this.executeTrial();
    } else {
      this.submitData();
    }
  }

  private submitData() {
    // Invio del payload strutturato all'endpoint generico
    const payload = {
      patientId: this.patientContext.selectedPatientId()!,
      testType: 'GO_NO_GO' as const,
      trials: this.trialResults,
    };
    this.statsService.submitSession(payload).subscribe({
      next: () => alert('Test Go/No-Go Salvato!'),
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
      },
    });
  }
}

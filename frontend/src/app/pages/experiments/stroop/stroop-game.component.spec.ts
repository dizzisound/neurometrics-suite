/**
 * Test suite per la funzione di calcolo del tempo di reazione
 * Verifica che il tempo di reazione venga calcolato correttamente e arrotondato a due decimali
 */

import { describe, expect, it } from 'vitest';
import { calculateReactionTimeMs } from './stroop-game.component';

describe('calculateReactionTimeMs', () => {
    it('returns the elapsed time in milliseconds rounded to two decimals', () => {
        expect(calculateReactionTimeMs(1542.678, 1000.123)).toBe(542.56);
    });

    it('returns zero when response and stimulus timestamps match', () => {
        expect(calculateReactionTimeMs(1000, 1000)).toBe(0);
    });
});

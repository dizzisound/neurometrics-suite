/**
 * Funzioni di supporto per il calcolo clinico neuropsicologico.
 * Contiene funzioni per il calcolo dell'età del paziente e dello Z-Score clinico basato sui dati normativi.
 * 
 */

import { NormativeData } from '../database/models/normative.schema';

/**
 * Calcola l'età del paziente partendo dalla data di nascita
 */
function calculateAge(birthDate: Date): number {
    const ageDifMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

/**
 * Servizio per calcolare lo Z-Score clinico basato sulla popolazione di controllo
 */
export async function computeClinicalZScore(
    patientBirthDate: Date,
    educationYears: number,
    testType: 'STROOP' | 'GO_NO_GO' | 'FLANKER',
    metricName: 'INTERFERENCE_EFFECT' | 'FALSE_ALARMS_RATE' | 'TAU',
    patientValue: number
): Promise<number | null> {

    const age = calculateAge(patientBirthDate);

    // Cerchiamo nel DB la fascia normativa corrispondente all'anagrafica del paziente
    const normativeReference = await NormativeData.findOne({
        testType,
        metricName,
        'ageRange.min': { $lte: age },
        'ageRange.max': { $gte: age },
        'educationYearsRange.min': { $lte: educationYears },
        'educationYearsRange.max': { $gte: educationYears }
    });

    if (!normativeReference) {
        // Se non troviamo una fascia adatta nella standardizzazione (es. paziente centenario molto raro)
        return null;
    }

    // Formula dello Z-Score neuropsicologico
    const zScore = (patientValue - normativeReference.populationMean) / normativeReference.populationStdDev;

    return parseFloat(zScore.toFixed(2));
}
/**
 * Schema di validazione per la creazione di un paziente
 * Utilizza Zod per garantire la correttezza dei dati in ingresso
 */

import { z } from 'zod';

export const CreatePatientValidationSchema = z.object({
    patientCode: z.string().min(1, { message: 'Il codice paziente è obbligatorio.' }),
    birthDate: z.coerce.date({ message: 'Data di nascita non valida.' }),
    educationYears: z.number().int().min(0, { message: 'Gli anni di scolarità non possono essere negativi.' }),
    gender: z.enum(['M', 'F', 'O'], { message: "Il genere deve essere 'M', 'F' o 'O'." })
});

export type CreatePatientInput = z.infer<typeof CreatePatientValidationSchema>;

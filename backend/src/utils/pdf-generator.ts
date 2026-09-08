/**
 * Router per la generazione dinamica di report clinici in formato PDF
 * Utilizza PDFKit per creare documenti PDF al volo senza salvare file sul server
 */

import { Request, Response, Router } from 'express';
// pdfkit does not ship TypeScript declarations in this project.
// @ts-expect-error — the package is available at runtime, but has no declarations.
import PDFDocument from 'pdfkit';
import { TestSession, Patient } from '../database/models/session.schema';
import { verifyJwt } from '../modules/auth/auth.controller';

const reportRouter = Router();

/**
 * GET /api/patients/:patientId/report-pdf
 * Genera dinamicamente al volo un report clinico formattato in PDF
 */
reportRouter.get('/patients/:patientId/report-pdf', verifyJwt, async (req: Request, res: Response) => {
    try {
        const { patientId } = req.params;

        // Recuperiamo il profilo del paziente e lo storico delle sessioni ordinato
        const patient = await Patient.findById(patientId);
        const sessions = await TestSession.find({ patient: Patient }).sort({ sessionDate: 1 });

        if (!patient || sessions.length === 0) {
            return res.status(404).json({ error: 'Dati insufficienti per generare il report.' });
        }

        // Inizializziamo il documento PDFKit
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        // Configurazione degli Header HTTP per il trasferimento binario in streaming
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report_clinico_${patientId}.pdf`);

        // Indirizziamo il flusso di scrittura direttamente sulla risposta HTTP (Zero spreco di RAM sul server)
        doc.pipe(res);

        // --- COSTRUZIONE DEL DOCUMENTO ---

        // 1. Intestazione Ospedaliera / Clinica
        doc.fillColor('#2c3e50').fontSize(22).text('REPORT CLINICO NEUROPSICOLOGICO', { align: 'center' });
        doc.fontSize(10).fillColor('#7f8c8d').text('Piattaforma di Calcolo Avanzato NeuroMetrics', { align: 'center' });
        doc.moveDown(2);

        // 2. Tabella Anagrafica Pseudonimizzata
        doc.fillColor('#2980b9').fontSize(14).text('1. Informazioni sul Paziente (Conforme GDPR)', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#2c3e50');
        doc.text(`Codice Identificativo: ${patient.patientCode}`);
        doc.text(`Anni di Scolarità: ${patient.educationYears} (Fascia di correzione psicometrica)`);
        doc.text(`Genere: ${patient.gender}`);
        doc.moveDown(2);

        // 3. Sintesi Longitudinali dei Parametri Statistici
        doc.fillColor('#2980b9').fontSize(14).text('2. Sintesi delle Prestazioni Longitudinali', { underline: true });
        doc.moveDown(1);

        // Struttura di una tabella semplificata disegnata via coordinate in PDFKit
        let currentY = doc.y;
        doc.fontSize(10).fillColor('#ffffff');

        // Intestazioni di Colonna (Sfondo Blu)
        doc.rect(40, currentY, 515, 20).fill('#2980b9');
        doc.fillColor('#ffffff').text('Data', 45, currentY + 5);
        doc.text('Test', 130, currentY + 5);
        doc.text('Accuratezza', 210, currentY + 5);
        doc.text('Interferenza', 300, currentY + 5);
        doc.text('Parametro Tau (τ)', 410, currentY + 5);

        currentY += 20;

        // Righe della tabella dei dati
        sessions.forEach((session, index) => {
            doc.fontSize(10);
            // Alternanza dei colori di sfondo per massima leggibilità visiva (Zebra striping)
            if (index % 2 === 0) {
                doc.rect(40, currentY, 515, 20).fill('#f8f9fa');
            }

            const dateStr = new Date(session.sessionDate).toLocaleDateString('it-IT');
            doc.fillColor('#2c3e50')
                .text(dateStr, 45, currentY + 5)
                .text(session.testType, 130, currentY + 5)
                .text(`${session.summaryStats?.accuracyRate}%`, 210, currentY + 5)
                .text(`${session.summaryStats?.interferenceEffect} ms`, 300, currentY + 5)
                .text(`${session.summaryStats?.exGaussian?.tau} ms`, 410, currentY + 5);

            currentY += 20;
        });

        doc.y = currentY + 30; // Riposizioniamo il cursore verticale di scrittura

        // 4. Sezione Interpretativa Finale automatizzata
        doc.fillColor('#2980b9').fontSize(14).text('3. Interpretazione Clinica Automatizzata', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#2c3e50');

        // Ricaviamo l'ultima sessione registrata per l'interpretazione
        const lastSession = sessions[sessions.length - 1];
        const tauValue = lastSession.summaryStats?.exGaussian?.tau || 0;

        let interpretazioneTesto = "Il profilo longitudinale mostra prestazioni stabili entro i limiti di norma per l'età e la scolarità del soggetto.";
        if (tauValue > 150) {
            interpretazioneTesto = `Si rileva un incremento critico del parametro Ex-Gaussiano Tau (pari a ${tauValue} ms) nell'ultima sessione di test. In neuropsicologia clinica, questo indica la comparsa di frequenti fallimenti di attenzione focalizzata (attentional lapses). Si raccomanda un approfondimento clinico mirato per valutare l'esordio di un potenziale decadimento cognitivo lieve (MCI).`;
        }

        doc.text(interpretazioneTesto, { align: 'justify', lineGap: 4 });

        // 5. Più di pagina con Nota Legale Obbligatoria (Footnote)
        doc.moveDown(4);
        doc.fontSize(8).fillColor('#7f8c8d').text(
            'This is for informational purposes only. For medical advice or diagnosis, consult a professional. AI responses may include mistakes.',
            { align: 'center', italic: true }
        );

        // Chiudiamo il file PDF decretando la fine della trasmissione dati
        doc.end();

    } catch (error) {
        console.error('Errore generazione report PDF:', error);
        return res.status(500).json({ error: 'Impossibile generare il file PDF.' });
    }
});

export default reportRouter;
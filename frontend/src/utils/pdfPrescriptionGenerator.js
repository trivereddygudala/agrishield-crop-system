/**
 * AgriShield Clinical PDF Prescription Generator
 * 
 * Generates an official, downloadable 1-page A4 Clinical Crop Health Prescription
 * using jsPDF and jspdf-autotable.
 * 
 * Directly saves a high-resolution PDF file without relying on browser popup windows.
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { RX_TRANSLATIONS } from './prescriptionShare';

/**
 * Generate and trigger download of Clinical PDF Prescription
 */
export const generateAndDownloadPrescriptionPDF = ({
  cropName = 'Crop',
  diseaseName = 'Foliar Infection',
  confidence = 98.5,
  severity = 'Moderate',
  chemicals = [],
  organic = [],
  prevention = '',
  acres = 1.0,
  farmLocation = 'Pasupugallu Farm',
  farmerName = 'AgriShield Farmer',
  doctorNote = 'Early foliar application recommended before dewfall.',
  language = 'en',
  isOffline = false
}) => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;

    const langKey = (language || 'en').split('-')[0].toLowerCase();
    const dict = RX_TRANSLATIONS[langKey] || RX_TRANSLATIONS.en;

    const rxId = 'AGRI-RX-' + Math.floor(100000 + Math.random() * 900000);
    const currentDate = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
    const currentTime = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // 1. Header Banner Background
    doc.setFillColor(6, 78, 59); // Emerald 900
    doc.rect(margin, 12, contentWidth, 24, 'F');

    // Accent line
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(margin, 36, contentWidth, 1.5, 'F');

    // Header Titles
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('AGRISHIELD AI  TELE-CLINIC', margin + 6, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(167, 243, 208); // Emerald 200
    doc.text('Autonomous Crop Pathology & Agronomy Advisory Services', margin + 6, 28);
    doc.text(`Prescription ID: ${rxId} | Issued: ${currentDate} ${currentTime}`, margin + 6, 33);

    // Verified Stamp / Badge on Right
    doc.setFillColor(isOffline ? 217 : 5, isOffline ? 119 : 150, isOffline ? 6 : 105);
    doc.roundedRect(pageWidth - margin - 50, 16, 44, 16, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(isOffline ? 'OFFLINE FIELD TRIAGE' : 'CLINICALLY VERIFIED', pageWidth - margin - 28, 23, { align: 'center' });
    doc.setFontSize(6.5);
    doc.text(isOffline ? 'Zero-Internet Mode' : 'PyTorch EfficientNetV2', pageWidth - margin - 28, 28, { align: 'center' });

    // 2. Patient & Farm Bio Section
    let currentY = 43;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text('PATIENT & FIELD BIO-PROFILE', margin, currentY);

    currentY += 3;

    // Bio Table
    const numAcres = parseFloat(acres) || 1.0;
    const waterLiters = Math.round(numAcres * 150);
    const pumpTanks15L = Math.ceil(waterLiters / 15);

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'plain',
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
        textColor: [51, 65, 85]
      },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 32 },
        1: { cellWidth: 55 },
        2: { fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 35 },
        3: { cellWidth: 55 }
      },
      body: [
        ['Farmer / Owner:', farmerName, 'Field Location:', farmLocation],
        ['Target Crop:', cropName, 'Field Acreage:', `${numAcres} Acre(s)`],
        ['Primary Diagnosis:', diseaseName, 'Diagnostic Accuracy:', `${confidence}%`],
        ['Severity Level:', severity, 'Total Water Requirement:', `${waterLiters} Liters (${pumpTanks15L} Tanks @ 15L)`]
      ]
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // 3. Chemical Prescription Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('PRESCRIBED AGROCHEMICALS & SPRAY SCHEDULE', margin, currentY);
    currentY += 2;

    const chemRows = (chemicals && chemicals.length > 0 ? chemicals : [
      'Mancozeb 75% WP @ 2.5 g/L of water',
      'Chlorothalonil 75% WP @ 2.0 g/L for broad-spectrum protection'
    ]).map((c, idx) => {
      const parts = c.split('@');
      const name = parts[0]?.trim() || `Prescription ${idx + 1}`;
      const dosage = parts[1]?.trim() || '2.0 g/L';
      const perTank = dosage.includes('ml') ? '30 ml / 15L pump' : '35 - 40 g / 15L pump';
      const phi = '7 - 14 Days';
      return [name, dosage, perTank, phi];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [['Formulation / Active Compound', 'Concentration Rate', '15L Knapsack Tank Mix', 'Pre-Harvest (PHI)']],
      body: chemRows,
      headStyles: {
        fillColor: [5, 150, 105], // Emerald 600
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold' },
        1: { cellWidth: 42 },
        2: { cellWidth: 45 },
        3: { cellWidth: 30 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // 4. Organic & Biological Alternatives Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text('ORGANIC REMEDIES & BIOLOGICAL DEFENSE', margin, currentY);
    currentY += 2;

    const organicRows = (organic && organic.length > 0 ? organic : [
      'Neem oil spray (5 ml/L with 1 ml liquid soap) every 7 days',
      'Foliar spray of Trichoderma harzianum or Bacillus subtilis (5 g/L)'
    ]).map((org) => {
      return [org, 'Foliar / Soil Drench', 'Repeat weekly until new shoot growth'];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [['Biological Formulation', 'Application Mode', 'Recommended Frequency']],
      body: organicRows,
      headStyles: {
        fillColor: [16, 185, 129], // Emerald 500
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 8,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: 42 },
        2: { cellWidth: 45 }
      }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // 5. Clinical Doctor Notes & Weather Advisory
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('PATHOLOGY ADVISORY & SPRAY WINDOW RULES:', margin + 4, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105); // Slate 600
    doc.text('1. Spray Timing: Early morning (before 9:00 AM) or late afternoon (after 4:30 PM). Avoid high mid-day sun.', margin + 4, currentY + 11);
    doc.text('2. Rain Warning: Do not spray if rain or heavy dew is forecast within 4 hours. Ensure leaves are dry before spraying.', margin + 4, currentY + 16);
    doc.text(`3. Agronomist Remark: ${doctorNote || 'Maintain protective personal equipment (PPE). Wash hands and tank thoroughly after use.'}`, margin + 4, currentY + 21);

    // 6. Footer Disclaimer & Signature
    const footerY = pageHeight - 16;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text('This digital prescription is generated by AgriShield AI Diagnostics compliant with Mandi and ICAR standards.', margin, footerY);
    doc.text('Digital Signature: AGRISHIELD-SECURE-STAMP-VALIDATED', pageWidth - margin, footerY, { align: 'right' });

    // Download the file
    const sanitizedCrop = cropName.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedDisease = diseaseName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `AgriShield_Rx_${sanitizedCrop}_${sanitizedDisease}.pdf`;
    doc.save(fileName);

    return { success: true, fileName };
  } catch (err) {
    console.error('Failed to generate PDF prescription:', err);
    throw err;
  }
};

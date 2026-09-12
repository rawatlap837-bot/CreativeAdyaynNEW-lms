// src/utils/certificatePdf.js
//
// Builds a real, downloadable PDF certificate using jsPDF (drawn directly —
// no screenshot/html2canvas step, so text stays crisp and selectable).
//
// Requires: npm install jspdf

import { jsPDF } from "jspdf";

const ACCENT = [82, 39, 255]; // #5227FF
const VIOLET = [46, 26, 85]; // #2E1A55
const AMBER = [232, 163, 61]; // #E8A33D

/**
 * Draws the certificate and returns the jsPDF instance so callers can
 * .save(), .output("blob"), .output("dataurlstring"), etc.
 */
export function buildCertificatePdf({
    studentName,
    courseName,
    issueDate, // display string, e.g. "August 19, 2026"
    certificateId,
    instructorName = "Creative Adhyayan",
}) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageW, pageH, "F");

    // outer + inner border
    doc.setDrawColor(...ACCENT);
    doc.setLineWidth(2.5);
    doc.rect(24, 24, pageW - 48, pageH - 48);
    doc.setDrawColor(...AMBER);
    doc.setLineWidth(1);
    doc.rect(34, 34, pageW - 68, pageH - 68);

    // corner accents
    const c = 14;
    doc.setFillColor(...AMBER);
    [
        [24, 24],
        [pageW - 24 - c, 24],
        [24, pageH - 24 - c],
        [pageW - 24 - c, pageH - 24 - c],
    ].forEach(([x, y]) => doc.rect(x, y, c, c, "F"));

    // header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...VIOLET);
    doc.text("CREATIVE ADHYAYAN", pageW / 2, 90, { align: "center" });

    doc.setFontSize(34);
    doc.setTextColor(...ACCENT);
    doc.text("Certificate of Completion", pageW / 2, 140, { align: "center" });

    doc.setDrawColor(...AMBER);
    doc.setLineWidth(1.2);
    doc.line(pageW / 2 - 80, 155, pageW / 2 + 80, 155);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(90, 80, 110);
    doc.text("This certifies that", pageW / 2, 200, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(30);
    doc.setTextColor(...VIOLET);
    doc.text(studentName, pageW / 2, 240, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(13);
    doc.setTextColor(90, 80, 110);
    doc.text("has successfully completed the course", pageW / 2, 270, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...ACCENT);
    doc.text(courseName, pageW / 2, 305, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(120, 110, 140);
    doc.text(`Issued on ${issueDate}`, pageW / 2, 335, { align: "center" });

    // signature lines
    const sigY = pageH - 90;
    doc.setDrawColor(180, 170, 200);
    doc.setLineWidth(0.8);
    doc.line(90, sigY, 260, sigY);
    doc.line(pageW - 260, sigY, pageW - 90, sigY);

    doc.setFontSize(10);
    doc.setTextColor(...VIOLET);
    doc.text(instructorName, 175, sigY + 16, { align: "center" });
    doc.text("Program Director", pageW - 175, sigY + 16, { align: "center" });

    doc.setFontSize(8.5);
    doc.setTextColor(150, 140, 165);
    doc.text("Instructor", 175, sigY + 28, { align: "center" });
    doc.text("Creative Adhyayan", pageW - 175, sigY + 28, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(150, 140, 165);
    doc.text(`Certificate ID: ${certificateId}`, pageW / 2, pageH - 40, { align: "center" });

    return doc;
}

export function downloadCertificatePdf(data) {
    const doc = buildCertificatePdf(data);
    const safeName = data.courseName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    doc.save(`certificate-${safeName}.pdf`);
}
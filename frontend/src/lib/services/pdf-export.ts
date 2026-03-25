// src/lib/services/pdf-export.ts
import { jsPDF } from 'jspdf';

/**
 * Parse simple HTML to PDF
 * Supports: h1, h2, h3, p, ul/li, strong, em
 */
export async function generateMinutesPDF(
    htmlContent: string,
    filename: string
): Promise<Uint8Array> {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    // Colors
    const navy = '#1a2b4a';
    const gray = '#4b5563';

    // Parse HTML using DOMParser
    const parser = new DOMParser();
    const parsed = parser.parseFromString(htmlContent, 'text/html');
    const body = parsed.body;

    function addPage() {
        doc.addPage();
        yPos = margin;
    }

    function checkPageBreak(lineHeight: number) {
        if (yPos + lineHeight > pageHeight - margin) {
            addPage();
        }
    }

    function processNode(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) {
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(gray);
                const lines = doc.splitTextToSize(text, contentWidth);
                for (const line of lines) {
                    checkPageBreak(6);
                    doc.text(line, margin, yPos);
                    yPos += 6;
                }
            }
            return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        switch (tag) {
            case 'h1':
                checkPageBreak(12);
                doc.setFontSize(18);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(navy);
                doc.text(el.textContent || '', margin, yPos);
                yPos += 12;
                break;

            case 'h2':
                checkPageBreak(10);
                yPos += 4; // Space before
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(navy);
                doc.text(el.textContent || '', margin, yPos);
                yPos += 10;
                break;

            case 'h3':
                checkPageBreak(8);
                yPos += 3;
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(navy);
                doc.text(el.textContent || '', margin, yPos);
                yPos += 8;
                break;

            case 'p':
                checkPageBreak(6);
                doc.setFontSize(11);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(gray);
                const pText = el.textContent || '';
                const pLines = doc.splitTextToSize(pText, contentWidth);
                for (const line of pLines) {
                    checkPageBreak(6);
                    doc.text(line, margin, yPos);
                    yPos += 6;
                }
                yPos += 3; // Paragraph spacing
                break;

            case 'ul':
            case 'ol':
                yPos += 2;
                let itemNum = 1;
                el.querySelectorAll(':scope > li').forEach((li) => {
                    checkPageBreak(6);
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(gray);
                    const bullet = tag === 'ol' ? `${itemNum}. ` : '• ';
                    const liText = li.textContent || '';
                    const liLines = doc.splitTextToSize(bullet + liText, contentWidth - 5);
                    for (let i = 0; i < liLines.length; i++) {
                        checkPageBreak(6);
                        doc.text(liLines[i], margin + (i > 0 ? 5 : 0), yPos);
                        yPos += 6;
                    }
                    itemNum++;
                });
                yPos += 2;
                break;

            case 'table':
                // Simple table rendering
                const rows = el.querySelectorAll('tr');
                const cellWidth = contentWidth / (rows[0]?.querySelectorAll('th, td').length || 1);

                rows.forEach((row, rowIdx) => {
                    checkPageBreak(8);
                    const cells = row.querySelectorAll('th, td');
                    let maxHeight = 6;

                    cells.forEach((cell, cellIdx) => {
                        const isHeader = cell.tagName.toLowerCase() === 'th';
                        doc.setFontSize(10);
                        doc.setFont('helvetica', isHeader ? 'bold' : 'normal');
                        doc.setTextColor(isHeader ? navy : gray);

                        const cellX = margin + cellIdx * cellWidth;
                        const text = cell.textContent || '';
                        const lines = doc.splitTextToSize(text, cellWidth - 4);

                        lines.forEach((line: string, lineIdx: number) => {
                            doc.text(line, cellX + 2, yPos + lineIdx * 5);
                        });

                        maxHeight = Math.max(maxHeight, lines.length * 5 + 3);
                    });

                    yPos += maxHeight;
                });
                yPos += 4;
                break;

            case 'br':
                yPos += 4;
                break;

            case 'strong':
            case 'b':
                doc.setFont('helvetica', 'bold');
                doc.text(el.textContent || '', margin, yPos);
                yPos += 6;
                break;

            default:
                // Process children for container elements
                el.childNodes.forEach(processNode);
        }
    }

    // Process all nodes
    body.childNodes.forEach(processNode);

    // Return as Uint8Array
    const arrayBuffer = doc.output('arraybuffer');
    return new Uint8Array(arrayBuffer);
}

/**
 * Save PDF to file using Tauri fs
 */
export async function savePDF(
    buffer: Uint8Array,
    outputPath: string
): Promise<string> {
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const { invoke } = await import('@tauri-apps/api/core');

    // Check if file exists and get unique path
    const actualPath = await invoke<string>('get_unique_path', { path: outputPath });

    await writeFile(actualPath, buffer);
    return actualPath;
}

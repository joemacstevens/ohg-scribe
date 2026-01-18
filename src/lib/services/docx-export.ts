// src/lib/services/docx-export.ts
import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    convertInchesToTwip
} from 'docx';
import type { TranscriptResult, TranscriptSegment } from '../types';

// Speaker colors - rotate through these for different speakers
const SPEAKER_COLORS = [
    '2563eb', // blue
    'dc2626', // red
    '16a34a', // green
    '9333ea', // purple
    'ea580c', // orange
    '0891b2', // cyan
];

// Sentiment emojis
const SENTIMENT_EMOJI: Record<string, string> = {
    positive: '😊',
    neutral: '😐',
    negative: '😟'
};

// Format milliseconds to [HH:MM:SS]
function formatTimestamp(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `[${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}]`;
}

// Generate a horizontal rule paragraph
function createHorizontalRule(): Paragraph {
    return new Paragraph({
        border: {
            bottom: {
                color: 'cccccc',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
            },
        },
        spacing: {
            before: 200,
            after: 200,
        },
    });
}

// Create section header
function createSectionHeader(title: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text: title,
                bold: true,
                size: 24, // 12pt
                allCaps: true,
            }),
        ],
        spacing: {
            before: 400,
            after: 200,
        },
    });
}

export interface ExportOptions {
    filename: string;
    transcribedDate: Date;
    includeSummary: boolean;
    includeTopics: boolean;
    includeSentiment: boolean;
}

export async function generateWordDocument(
    result: TranscriptResult,
    options: ExportOptions
): Promise<Uint8Array> {
    const children: Paragraph[] = [];

    // Title
    children.push(
        new Paragraph({
            text: options.filename.replace(/\.[^/.]+$/, ''), // Remove extension
            heading: HeadingLevel.TITLE,
            spacing: { after: 100 },
        })
    );

    // Subtitle with date
    children.push(
        new Paragraph({
            children: [
                new TextRun({
                    text: `Transcribed on ${options.transcribedDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}`,
                    color: '666666',
                    size: 22, // 11pt
                }),
            ],
            spacing: { after: 400 },
        })
    );

    // Summary section (if enabled and available)
    if (options.includeSummary && result.summary) {
        children.push(createHorizontalRule());
        children.push(createSectionHeader('Summary'));

        // Parse bullets from summary
        const bulletPoints = result.summary.split('\n').filter(line => line.trim());
        for (const point of bulletPoints) {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: point.startsWith('•') ? point : `• ${point}`,
                            size: 22,
                        }),
                    ],
                    spacing: { before: 100, after: 100 },
                    indent: { left: convertInchesToTwip(0.25) },
                })
            );
        }
    }

    // Topics section (if enabled and available)
    if (options.includeTopics && result.topics && result.topics.length > 0) {
        children.push(createHorizontalRule());
        children.push(createSectionHeader('Topics Detected'));

        // Show top 5 topics
        const topTopics = result.topics.slice(0, 5);
        for (const topic of topTopics) {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `${topic.label} `,
                            size: 22,
                        }),
                        new TextRun({
                            text: `(${Math.round(topic.relevance)}%)`,
                            color: '666666',
                            size: 20,
                        }),
                    ],
                    spacing: { before: 80, after: 80 },
                    indent: { left: convertInchesToTwip(0.25) },
                })
            );
        }
    }

    // Transcript section
    children.push(createHorizontalRule());
    children.push(createSectionHeader('Transcript'));

    // Track speaker colors
    const speakerColorMap: Record<string, string> = {};
    let colorIndex = 0;

    for (const segment of result.segments) {
        // Assign color to speaker
        if (!speakerColorMap[segment.speaker]) {
            speakerColorMap[segment.speaker] = SPEAKER_COLORS[colorIndex % SPEAKER_COLORS.length];
            colorIndex++;
        }

        const speakerColor = speakerColorMap[segment.speaker];

        // Build the speaker line
        const speakerLine: TextRun[] = [
            new TextRun({
                text: `[${segment.speaker}] `,
                bold: true,
                color: speakerColor,
                size: 22,
            }),
            new TextRun({
                text: formatTimestamp(segment.start),
                color: '999999',
                size: 20,
            }),
        ];

        // Add sentiment indicator if enabled
        if (options.includeSentiment && segment.sentiment) {
            speakerLine.push(
                new TextRun({
                    text: ` ${SENTIMENT_EMOJI[segment.sentiment] || ''}`,
                    size: 22,
                })
            );
        }

        children.push(
            new Paragraph({
                children: speakerLine,
                spacing: { before: 200, after: 80 },
            })
        );

        // Transcript text
        children.push(
            new Paragraph({
                children: [
                    new TextRun({
                        text: segment.text,
                        size: 22,
                    }),
                ],
                spacing: { after: 160 },
                alignment: AlignmentType.LEFT,
            })
        );
    }

    // Create document
    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: convertInchesToTwip(1),
                            right: convertInchesToTwip(1),
                            bottom: convertInchesToTwip(1),
                            left: convertInchesToTwip(1),
                        },
                    },
                },
                children,
            },
        ],
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Calibri',
                        size: 22, // 11pt
                    },
                    paragraph: {
                        spacing: {
                            line: 276, // 1.15 line spacing
                        },
                    },
                },
            },
        },
    });

    // Generate the document as a Blob (works in browser/Tauri context)
    try {
        console.log('Starting Packer.toBlob...');
        const blob = await Packer.toBlob(doc);
        console.log('Blob created, size:', blob.size);

        // Convert Blob to Uint8Array
        const arrayBuffer = await blob.arrayBuffer();
        console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        console.error('Error generating Word document:', error);
        throw new Error(`Failed to generate Word document: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Save document to file, with auto-increment if file exists
export async function saveDocument(
    buffer: Uint8Array,
    outputPath: string
): Promise<string> {  // Now returns the actual path used
    try {
        console.log('Importing @tauri-apps/plugin-fs...');
        const { writeFile, exists } = await import('@tauri-apps/plugin-fs');

        // Check if file exists and find a unique name
        let finalPath = outputPath;
        let counter = 1;

        while (await exists(finalPath)) {
            // Extract base path and extension
            const lastDotIndex = outputPath.lastIndexOf('.');
            const basePath = lastDotIndex > 0 ? outputPath.slice(0, lastDotIndex) : outputPath;
            const extension = lastDotIndex > 0 ? outputPath.slice(lastDotIndex) : '';

            // Remove any existing counter suffix (e.g., "_1", "_2")
            const baseWithoutCounter = basePath.replace(/_\d+$/, '');

            finalPath = `${baseWithoutCounter}_${counter}${extension}`;
            counter++;

            // Safety limit to prevent infinite loop
            if (counter > 100) {
                throw new Error('Too many files with the same name');
            }
        }

        console.log('Calling writeFile with path:', finalPath, 'buffer size:', buffer.length);
        await writeFile(finalPath, buffer);
        console.log('File written successfully!');

        return finalPath;
    } catch (error) {
        console.error('Error saving document:', error);
        throw new Error(`Failed to save document: ${error instanceof Error ? error.message : String(error)}`);
    }
}


import { invoke } from '@tauri-apps/api/core';
import type { TranscriptResult } from '../types';
import type { Template, Persona, Lexicon, Style } from '../types/minutes';
import type { ParagraphCitation, CitationSource } from './history';

// Get Anthropic API key from settings
async function getAnthropicKey(): Promise<string | null> {
    try {
        return await invoke<string | null>('get_anthropic_key');
    } catch {
        return null;
    }
}

export interface GenerationRequest {
    transcript: TranscriptResult;
    template: Template;
    persona: Persona;
    style: Style;
    lexicon?: Lexicon;
    slideContext?: string;
    customInstructions?: string;
    includeCitations?: boolean;
}

// Result type when citations are enabled
export interface MinutesGenerationResult {
    content: string;
    citations?: ParagraphCitation[];
}

export async function generateMinutes(request: GenerationRequest): Promise<MinutesGenerationResult> {
    const apiKey = await getAnthropicKey();
    if (!apiKey) {
        throw new Error("Anthropic API key not found. Please set it in Settings.");
    }

    // Truncate slideContext if it's too massive (e.g. > 100k chars) to avoid 400 errors
    let safeSlideContext = request.slideContext;
    if (safeSlideContext && safeSlideContext.length > 100000) {
        console.warn("Slide context truncated to 100k characters");
        safeSlideContext = safeSlideContext.substring(0, 100000) + "\n[...Truncated...]";
    }

    const systemPrompt = constructSystemPrompt(
        request.template,
        request.persona,
        request.style,
        request.lexicon,
        !!safeSlideContext,
        request.customInstructions,
        request.includeCitations
    );
    const userPrompt = constructUserPrompt(request.transcript, safeSlideContext, request.includeCitations);

    try {
        // Use Rust backend to call Claude API (avoids CORS)
        const content = await invoke<string>('generate_with_claude', {
            apiKey,
            systemPrompt,
            userPrompt,
            model: 'claude-sonnet-4-20250514',
            maxTokens: 16000
        });

        if (!content) {
            throw new Error("No content generated from Claude.");
        }

        // If citations were requested, parse structured JSON response
        if (request.includeCitations) {
            try {
                const result = parseCitationResponse(content, request.transcript);
                return result;
            } catch (parseError) {
                console.warn("Failed to parse citation response, returning content only:", parseError);
                return { content: extractHtmlFromResponse(content) };
            }
        }

        return { content };
    } catch (e) {
        console.error("Generate Minutes Failed:", e);
        throw e;
    }
}

// Helper to extract HTML if JSON parsing fails
function extractHtmlFromResponse(response: string): string {
    // Try to find HTML content in case of malformed JSON
    const htmlMatch = response.match(/<[^>]+>[\s\S]*<\/[^>]+>/);
    return htmlMatch ? htmlMatch[0] : response;
}

// Parse the structured JSON response when citations are enabled
function parseCitationResponse(response: string, transcript: TranscriptResult): MinutesGenerationResult {
    // Try to parse as JSON first
    let parsed;
    try {
        // Handle case where response might be wrapped in markdown code blocks
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
            cleanResponse = cleanResponse.slice(7);
        }
        if (cleanResponse.startsWith('```')) {
            cleanResponse = cleanResponse.slice(3);
        }
        if (cleanResponse.endsWith('```')) {
            cleanResponse = cleanResponse.slice(0, -3);
        }
        parsed = JSON.parse(cleanResponse.trim());
    } catch {
        throw new Error("Response is not valid JSON");
    }

    const content = parsed.content || parsed.html || '';
    const rawCitations = parsed.citations || [];

    // Convert raw citations to proper format
    // Support multiple formats:
    // - New simplified: {i: 0, s: 120, e: 180}
    // - Legacy with sources: {elementIndex: 0, sources: [{speaker, startTime, endTime, text}]}
    const citations: ParagraphCitation[] = rawCitations.map((cite: Record<string, unknown>, index: number) => {
        // Handle both "i" (new) and "elementIndex"/"paragraphIndex" (legacy)
        const elementIdx = (cite.i as number) ?? (cite.elementIndex as number) ?? (cite.paragraphIndex as number) ?? index;
        const elementText = extractCitableElementText(content, elementIdx);

        // Build sources array - handle both simplified and full formats
        let sources: Array<{ speaker: string; startTime: number; endTime: number; text: string }>;

        if (cite.sources && Array.isArray(cite.sources)) {
            // Legacy format with sources array
            sources = (cite.sources as Array<Record<string, unknown>>).map((src: Record<string, unknown>) => ({
                speaker: (src.speaker as string) || 'Unknown',
                startTime: (src.startTime as number) || 0,
                endTime: (src.endTime as number) || 0,
                text: (src.text as string) || ''
            }));
        } else {
            // New simplified format: {i, s, e}
            sources = [{
                speaker: 'Transcript',
                startTime: (cite.s as number) ?? (cite.startTime as number) ?? 0,
                endTime: (cite.e as number) ?? (cite.endTime as number) ?? 0,
                text: ''
            }];
        }

        return {
            paragraphIndex: elementIdx,
            paragraphHash: hashString(elementText),
            sources,
            isStale: false
        };
    });

    return { content, citations };
}

// Extract text of a specific citable element (<p> or <li>) from HTML content
function extractCitableElementText(html: string, index: number): string {
    // Match both <p> and <li> elements in order
    const elements = html.match(/<(p|li)[^>]*>[\s\S]*?<\/\1>/gi) || [];
    if (index < elements.length) {
        // Strip HTML tags to get plain text
        return elements[index].replace(/<[^>]+>/g, '').trim();
    }
    return '';
}

// Simple hash function for paragraph content
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
}

export async function refineText(text: string, instruction: string): Promise<string> {
    const apiKey = await getAnthropicKey();
    if (!apiKey) throw new Error("Anthropic API key not found");

    try {
        // Use Rust backend to call Claude API (avoids CORS)
        const refined = await invoke<string>('refine_with_claude', {
            apiKey,
            text,
            instruction
        });

        return refined || text;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

/**
 * Expands selected text by drawing more details from the full transcript context.
 * Unlike refineText, this uses the complete transcript to find additional relevant information.
 * Also uses the current minutes document to match writing style.
 */
export async function expandText(
    selectedText: string,
    fullTranscript: string,
    currentMinutes: string
): Promise<string> {
    const apiKey = await getAnthropicKey();
    if (!apiKey) throw new Error("Anthropic API key not found");

    const instruction = `You are expanding a section of meeting minutes by adding more detail from the transcript.

CRITICAL: You MUST match the exact writing style of the existing meeting minutes below. Study the tone, voice, sentence structure, and formatting carefully.

CURRENT MEETING MINUTES (study this for style):
${currentMinutes}

---

SELECTED TEXT TO EXPAND:
${selectedText}

---

FULL TRANSCRIPT FOR CONTEXT:
${fullTranscript}

---

TASK:
1. Find related discussion in the transcript that pertains to this selected text
2. Add relevant details, quotes, or context that would make this section more comprehensive  
3. CRITICAL: Match the EXACT writing style, tone, voice, and formatting of the existing meeting minutes above
4. Use the same attribution format (e.g., if using 4-letter codes like CJLU, continue using them)
5. Keep the same level of formality and sentence structure
6. Return ONLY the expanded text - no explanations or meta-commentary

IMPORTANT: The expanded text should read as if it was written by the same author as the rest of the minutes. It should blend seamlessly.`;

    try {
        const expanded = await invoke<string>('refine_with_claude', {
            apiKey,
            text: selectedText,
            instruction
        });

        return expanded || selectedText;
    } catch (e) {
        console.error(e);
        throw e;
    }
}

/**
 * Constructs the style section for client-specific formatting conventions.
 */
function constructStyleSection(style: Style): string {
    const attributionExample = style.attribution.format === '4-char-initials'
        ? `
HOW TO FORM 4-CHAR INITIALS:
- Take first letter of first name + first letter of middle name (if any) + first 2 letters of last name
- Examples from transcript speaker labels: 
  - "Tom Turpin" → TCTU or TMTU
  - "Chris Liu" → CJLU or CHLU  
  - "Maria Diaz-Pacheco" → MDZP
  - If no middle name, use first 2 letters of first + first 2 letters of last (e.g., "Tom Liu" → TOLI)
- NEVER write "Tom (TMTU)" — use ONLY the 4-char code`
        : '';

    return `
STYLE GUIDE (STRICT ENFORCEMENT):

### Voice
- Person: ${style.voice.person} person
- Voice: ${style.voice.voice}

### Speaker Attribution
- Format: ${style.attribution.format}${attributionExample}

ATTENDEE LIST FORMAT (MANDATORY):
- Write: "Attendees: TMTU, CJLU, MDZP, OIFR, ITSH"
- Do NOT write: "Attendees: Tom (TMTU), Chris (CJLU)..."
- Unknown speaker: ${style.attribution.unknownSpeaker}

### Decision Language (MANDATORY FORMAT)
For the EXECUTIVE SUMMARY TABLE, use emojis with text for visual clarity:
- When endorsed: ✅ ${style.decisions.vocabulary.approved}
- When deferred: ⚠️ ${style.decisions.vocabulary.deferredToMeeting}
- When not endorsed: ❌ ${style.decisions.vocabulary.notEndorsed}

For INDIVIDUAL PROPOSAL DECISION LINES (at end of each proposal), use text only:
- Decision: ${style.decisions.vocabulary.approved}
- Decision: ${style.decisions.vocabulary.deferredToMeeting}

${style.decisions.forbiddenTerms.length > 0 ? `NEVER use: ${style.decisions.forbiddenTerms.join(', ')}` : ''}

### Q&A Formatting (${style.qanda.nesting ? 'NESTED DASH FORMAT — MANDATORY' : 'FLAT FORMAT'})
${style.qanda.nesting ? `
YOU MUST format Q&A exchanges using markdown nested lists with dashes.
Each question starts with a dash, responses are indented with 4 spaces + dash.

CORRECT FORMAT (use this EXACTLY):
Questions and Comments
- MDZP ${style.qanda.verbs.question} about target audience and whether insurers might be interested in this data
    - CJLU ${style.qanda.verbs.response} that the primary target audience was public payers
    - OIFR added that HTA bodies increasingly require environmental data
- ITSH ${style.qanda.verbs.question} about the tirzepatide comparison
    - TMYU ${style.qanda.verbs.response} that no comparative data exists yet

WRONG FORMAT (do NOT use paragraph style):
"MDZP asked about target audience. CJLU stated that..."
` : 'Use flat bullet points for Q&A'}

### Methodology Detail
- Summarization level: ${style.methodology.summarization}
${style.methodology.summarization === 'none' ? '- PRESERVE ALL trial names, statistics, p-values, sample sizes, and methodology details exactly as stated.' : ''}
    `.trim();
}

// Anti-Compression Block — prevents LLM from over-summarizing
const ANTI_COMPRESSION_BLOCK = `
# DETAIL CONTROLS — READ FIRST

## Anti-Compression Principles
- Fidelity over brevity. Prioritise comprehensive narrative coverage.
- When in doubt, include rather than omit.
- Do not collapse multi-turn debates into a single sentence.
- A slightly longer output that captures the full discussion is preferred.

## Length Requirements
- **Minimum:** 1,200 words for standard meetings (20+ minutes)
- **Minimum:** 600 words for short meetings (<20 minutes)
- **Q&A items:** Capture at least 12 distinct discussion points if present

## PROHIBITED Shortcuts — Never Use These
- "a discussion occurred"
- "concerns were raised"
- "stakeholders aligned"
- "questions were asked"
- "issues were noted"
- "feedback was provided"
- Any vague phrase without who/what/why attribution

---

# SOURCE HIERARCHY

## Slides = Ground Truth for FACTS
Use for: titles, presenters, deadlines, statistics, author lists, methodology details
Citation: [Slide S# / Title]

## Transcript = Ground Truth for DISCUSSION  
Use for: questions, rationale, dissent, risk assessment, action items, decisions
Citation: [Transcript mm:ss]

---

# PRESENTATION SUMMARY EXPANSION

For each proposal, the Presentation Summary section MUST include comprehensive detail:

## Aim / Objective
- State the research question AND the strategic rationale (why now, why needed)
- Include target audience and positioning goals

## Design / Data sources
CAPTURE ALL of these if mentioned:
- Study type (retrospective, RWE, NMA, ITC, observational, pooled analysis)
- Database name and coverage period (e.g., "AMR Plus database, November 2023-June 2024")
- Population criteria (inclusion/exclusion, age, diagnosis codes)
- Sample size with specific numbers (e.g., "n=863 WeGovy users, n=241 tirzepatide users")
- Matching methodology (PSM variables, demographic adjustments)
- Time horizon and follow-up duration
- Comparators used (placebo, active control, matched cohort)
- Endpoints/outcomes measured

## Key findings / conclusions
CAPTURE ALL of these if mentioned:
- Primary endpoint results WITH numbers (%, odds ratios, hazard ratios, confidence intervals)
- Statistical significance and p-values
- Secondary endpoint results
- Subgroup findings
- Unexpected or novel findings
- Contextual interpretation (e.g., "2% reduction in obesity population vs 9% in diabetes population due to lower absolute risk")
- Author recommendations or advisory board feedback

# MOST CRITICAL TASK: DISSENT & RISK HANDLING

When debate or serious concern arises, shift from summarization to detailed reporting:

1. **IDENTIFY THE OBJECTION**: State it clearly with attribution. Is it scientific validity, regulatory compliance, or strategic risk?

2. **CAPTURE THE COUNTER-ARGUMENT**: Document the presenter's defense with their evidence/logic.

3. **NARRATE THE EXCHANGE**: Do NOT flatten multi-person discussions. Show the back-and-forth.

4. **FLAG STRATEGIC RISKS**: If someone raises unfavorable data risk, capture the specific risk AND proposed mitigation.

### Example — WRONG:
"- OIFR expressed concerns regarding scientific value and market research status
    - TMYU defended the proposal"

### Example — CORRECT (full detail with nested format):
"- OIFR, citing compliance policy requirements, questioned whether the proposal constituted market research and was outside the PPG's scope, expressing concern that consumer behaviour data sourced from Numerator—a tech company that describes itself as "reinventing the market research industry"—lacked the scientific rigour expected for peer-reviewed publication [Transcript 32:15]
    - TMYU defended the proposal's scientific validity, emphasising the matched cohort design (demographically adjusted for age, ethnicity, gender, income, household size and geography) and the competitive imperative: Lilly are already publishing similar consumer evidence for Zepbound [Transcript 33:42]
    - [Unattributed] reinforced the policy constraint, clarifying that market research intended for commercial strategy falls outside PPG governance and publication policy requirements [Transcript 35:18]
    - OIFR noted that Numerator's self-description raised classification concerns that required resolution before endorsement [Transcript 36:02]"

---

# Q&A EXPANSION RULES

For each substantial question, capture ALL of these:

1. **WHO + WHY**: Speaker initials AND their underlying rationale/concern
2. **WHAT**: Exact information requested (method, baseline, population, comparator)
3. **ANSWER**: Evidence cited, numbers, datasets, limitations acknowledged
4. **FOLLOW-UP**: Did they accept? Residual concerns? Additional requests?
5. **OUTCOME**: Decision, action item, or parked for later

### Example — WRONG (too sparse):
"- ITSH asked about other NNI projects
    - TMYU stated this study has more patients"

### Example — CORRECT (full detail with nested format):
"- ITSH, noting that other NNI cardiovascular projects were already underway, questioned the added scientific value, asking why another CV study was needed given existing SELECT population re-analyses [Transcript 24:51]
    - TMYU clarified that this study uses a broader CV event definition beyond traditional MACE 4/5, capturing all ICD-10 codes beginning with 'I', and includes substantially larger tirzepatide patient numbers (241 vs. \<50 in existing analyses), addressing a specific evidence gap [Transcript 25:18]
    - ITSH acknowledged the methodological distinction but expressed concern about timeline pressure given the 2 July deadline [Transcript 26:12]"

---

# RATIONALE CAPTURE

For each proposal, extract the "WHY" and place it FIRST in Background:
- Business objectives
- Competitive landscape (e.g., "Lilly are already publishing similar evidence")
- Evidence gaps being addressed
- Target audience needs

---

# DEFERRALS — BE SPECIFIC

### WRONG:
"Deferred pending further discussion"

### CORRECT:
"Deferred pending TMYU providing clear argumentation to classify the work as scientific research (not market research) per VTA.1.07 policy requirements. To be reconsidered at next PPG meeting following offline classification review."

---

# VALIDATION — CHECK BEFORE OUTPUT

1. Word count ≥ 1,200?
2. No prohibited shortcut phrases?
3. Q&A expanded with who/what/why/answer/follow-up?
4. Debates narrated in full (not flattened)?
5. Deferrals include specific reason and next step?
6. Rationale captured for each proposal?
`;

function constructSystemPrompt(
    template: Template,
    persona: Persona,
    style: Style,
    lexicon: Lexicon | undefined,
    hasSlideContext: boolean,
    customInstructions?: string,
    includeCitations?: boolean
): string {
    let lexiconInstructions = "";
    if (lexicon && lexicon.rules && lexicon.rules.length > 0) {
        const rules = lexicon.rules.map(r => {
            let ruleText = `- Source: "${r.from.join('", "')}" → Preferred: "${r.to}"`;
            if (r.acronym) ruleText += ` (Acronym after first use: ${r.acronym})`;
            if (r.notes) ruleText += ` [Note: ${r.notes}]`;
            return ruleText;
        }).join('\n');

        lexiconInstructions = `
TERMINOLOGY LEXICON (STRICT ENFORCEMENT):
You act as a terminology enforcement engine. You must strictly adhere to the following rules. 
If a transcript term matches a "Source" term below, you MUST use the "Preferred" term.
${rules}
        `;
    }

    const styleSection = constructStyleSection(style);

    let slideContextInstructions = "";
    if (hasSlideContext) {
        slideContextInstructions = `
SOURCE OF TRUTH HIERARCHY:
1. SLIDE / OCR CONTEXT (Highest Priority): Use this for proposal titles, dates, attendee names, specific numbers, and study design details.
2. TRANSCRIPT: Use this for discussion points, questions, decision rationale, and speaker tone.
3. If there is a conflict between Slides and Transcript regarding a Fact (e.g. n=100 vs n=105), TRUST THE SLIDES.
        `;
    }

    let customInstructionsSection = "";
    if (customInstructions && customInstructions.trim()) {
        customInstructionsSection = `
USER INSTRUCTIONS (APPLY THESE):
${customInstructions.trim()}
        `;
    }

    // Citation-specific output instructions
    let outputInstructions = "";
    if (includeCitations) {
        outputInstructions = `
CRITICAL: OUTPUT AS JSON WITH CITATIONS
You MUST output your response as a JSON object. Generate COMPLETE citations for EVERY paragraph and list item.

{
  "content": "<h1>Title</h1><p>Para 1</p><p>Para 2</p>...",
  "citations": [
    {"i": 0, "s": 120, "e": 180},
    {"i": 1, "s": 200, "e": 250},
    ...
  ]
}

CITATION FORMAT (use short keys to save space):
- "i" = element index (0-indexed, counting all <p> and <li> elements in order)
- "s" = start time in seconds from transcript
- "e" = end time in seconds from transcript

CRITICAL REQUIREMENTS:
1. EVERY <p> and <li> element MUST have a citation entry - NO EXCEPTIONS
2. If document has 50 elements, you need 50 citation entries
3. The last citation's "i" value should equal (total element count - 1)
4. Do NOT truncate or skip any elements
5. For Q&A sections: use ONE <li> per speaker comment, each with its own citation

Example for 3 paragraphs and 2 list items (5 elements total):
{"i": 0, "s": 10, "e": 30},
{"i": 1, "s": 35, "e": 60},
{"i": 2, "s": 65, "e": 90},
{"i": 3, "s": 95, "e": 120},
{"i": 4, "s": 125, "e": 150}

Output ONLY the JSON object - no markdown, no explanation.
        `;
    } else {
        outputInstructions = `
IMPORTANT OUTPUT INSTRUCTIONS: 
- Output ONLY the content of the minutes in Semantic HTML format.
- Supported tags: <h1>, <h2>, <h3>, <ul>, <ol>, <li>, <p>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>, <th>, <td>.
- Do NOT use markdown. Do NOT use \`\`\`html code blocks. Just valid HTML.
- Do NOT include any preamble ("Here are the minutes...") or postscript.
        `;
    }

    const basePrompt = `${ANTI_COMPRESSION_BLOCK}

${persona.roleDefinition}

TONE AND STYLE:
${persona.toneDescription}

FORMATTING RULES:
${persona.formattingRules}

${styleSection}

${lexiconInstructions}

${slideContextInstructions}

${customInstructionsSection}

YOUR TASK:
Generate meeting minutes based on the provided inputs.

STRUCTURE:
Follow this structure exactly. 
${template.structure}

${outputInstructions}
    `;

    if (template.exampleOutput) {
        return `${basePrompt}
        
EXAMPLE OUTPUT:
The following is a verified example of the output style and depth required. Mimic this style exactly.

${template.exampleOutput}
        `;
    }

    return basePrompt;
}

function constructUserPrompt(transcript: TranscriptResult, slideContext?: string, includeCitations?: boolean): string {
    // When citations are enabled, include timestamps for each segment
    const transcriptText = transcript.segments
        .map(s => {
            if (includeCitations) {
                // Include start/end times in seconds for citation reference
                return `[${Math.floor(s.start)}-${Math.floor(s.end)}s] ${s.speaker}: ${s.text}`;
            }
            return `${s.speaker}: ${s.text}`;
        })
        .join('\n');

    let prompt = `TRANSCRIPT:\n\n${transcriptText}`;

    if (slideContext && slideContext.trim()) {
        prompt += `\n\n================\nSLIDE / OCR CONTEXT (Canonical Source for Data):\n================\n${slideContext}`;
    }

    return prompt;
}


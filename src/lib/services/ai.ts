import { getOpenAIKey } from './transcription';
import type { TranscriptResult } from '../types';
import type { Template, Persona, Lexicon, Style } from '../types/minutes';

export interface GenerationRequest {
    transcript: TranscriptResult;
    template: Template;
    persona: Persona;
    style: Style;
    lexicon?: Lexicon;
    slideContext?: string;
}

export async function generateMinutes(request: GenerationRequest): Promise<string> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) {
        throw new Error("OpenAI API key not found. Please set it in Settings.");
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
        !!safeSlideContext
    );
    const userPrompt = constructUserPrompt(request.transcript, safeSlideContext);

    try {
        // Using gpt-4o for reliable, high-quality generation
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // Reliable high-quality model
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.5, // Lower temp for more consistent, detailed output
                max_tokens: 16000 // Allow extended output for detailed minutes
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error("OpenAI Error:", errData);
            throw new Error(`OpenAI API Error: ${response.status} ${response.statusText} - ${errData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("No content generated from OpenAI.");
        }

        return content;
    } catch (e) {
        console.error("Generate Minutes Failed:", e);
        throw e;
    }
}

export async function refineText(text: string, instruction: string): Promise<string> {
    const apiKey = await getOpenAIKey();
    if (!apiKey) throw new Error("OpenAI API key not found");

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Use faster model for refinements
                messages: [
                    { role: 'system', content: "You are a helpful editor. Refine the text according to the user's instruction. Output only the refined text, no quotes or preamble." },
                    { role: 'user', content: `Text: "${text}"\n\nInstruction: ${instruction}` }
                ],
                temperature: 0.5
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`Refine Error: ${errData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || text;
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
        ? '\n- Example: "TCIT", "CJLU", "MDZP" (use 4-letter codes combining first letters of first/middle/last names)'
        : '';

    const qandaExample = style.qanda.nesting
        ? `

EXAMPLE Q&A FORMAT (FOLLOW THIS EXACTLY):
- MDZP ${style.qanda.verbs.question} who the target audience was and whether there was similar data available as this could be a point of interest for insurers.
    - CJLU ${style.qanda.verbs.response} that the primary target audience was public payers and their sustainability targets.
    - TCIT agreed and noted the strategic importance of addressing environmental considerations.`
        : '';

    return `
STYLE GUIDE (STRICT ENFORCEMENT):

### Voice
- Person: ${style.voice.person} person
- Voice: ${style.voice.voice}

### Speaker Attribution
- Format: ${style.attribution.format}${attributionExample}
- Unknown speaker: ${style.attribution.unknownSpeaker}

### Decision Language
Use ONLY these exact phrases for PPG decisions (formatted as ${style.decisions.formatting}):
- When endorsed: ${style.decisions.vocabulary.approved}
- When deferred to meeting: ${style.decisions.vocabulary.deferredToMeeting}
- When deferred to email: ${style.decisions.vocabulary.deferredToEmail}
- When not endorsed: ${style.decisions.vocabulary.notEndorsed}

${style.decisions.forbiddenTerms.length > 0 ? `NEVER use these terms for decisions: ${style.decisions.forbiddenTerms.join(', ')}` : ''}

### Q&A Formatting
- Nesting: ${style.qanda.nesting ? 'YES — indent responses UNDER questions using dash prefix' : 'NO — use flat list'}
- Preserve full reasoning: ${style.qanda.preserveReasoning ? 'YES — capture complete arguments, not just topic summaries' : 'Summarize topics only'}
- Question verb: "${style.qanda.verbs.question}"
- Response verb: "${style.qanda.verbs.response}"${qandaExample}

### Methodology Detail
- Summarization level: ${style.methodology.summarization}
${style.methodology.summarization === 'none' ? '- PRESERVE ALL trial names, statistics, p-values, sample sizes, and methodology details exactly as stated. Do NOT summarize or abbreviate.' : ''}
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

# MOST CRITICAL TASK: DISSENT & RISK HANDLING

When debate or serious concern arises, shift from summarization to detailed reporting:

1. **IDENTIFY THE OBJECTION**: State it clearly with attribution. Is it scientific validity, regulatory compliance, or strategic risk?

2. **CAPTURE THE COUNTER-ARGUMENT**: Document the presenter's defense with their evidence/logic.

3. **NARRATE THE EXCHANGE**: Do NOT flatten multi-person discussions. Show the back-and-forth.

4. **FLAG STRATEGIC RISKS**: If someone raises unfavorable data risk, capture the specific risk AND proposed mitigation.

### Example — WRONG:
"OIFR expressed concerns regarding scientific value and market research status."

### Example — CORRECT:
"OIFR, citing compliance policy VTA.1.07, questioned whether the proposal constituted market research and was outside the PPG's scope, expressing concern that consumer behaviour data sourced from Numerator—a tech company tracking shopping habits—lacked the scientific rigour expected for peer-reviewed publication. [Transcript 32:15]

TMYU defended the proposal's scientific validity, emphasising the matched cohort design (demographically adjusted for age, ethnicity, gender, income, household size and geography) and the competitive imperative: Lilly are already publishing similar consumer evidence. [Transcript 33:42]

VTA.1.07 reinforced the policy constraint, clarifying that market research falls outside PPG governance. The critical question was whether TMYU could demonstrate the work meets scientific publication criteria. [Transcript 35:18]"

---

# Q&A EXPANSION RULES

For each substantial question, capture ALL of these:

1. **WHO + WHY**: Speaker initials AND their underlying rationale/concern
2. **WHAT**: Exact information requested (method, baseline, population, comparator)
3. **ANSWER**: Evidence cited, numbers, datasets, limitations acknowledged
4. **FOLLOW-UP**: Did they accept? Residual concerns? Additional requests?
5. **OUTCOME**: Decision, action item, or parked for later

### Example — WRONG:
"ITSH asked about other NNI projects. TMYU stated this study has more patients."

### Example — CORRECT:
"Noting that other NNI cardiovascular projects were already underway, ITSH questioned the added scientific value, asking why another CV study was needed. TMYU clarified that this study uses a broader CV event definition beyond MACE 4/5, and includes a larger number of patients on tirzepatide, addressing a specific gap in the existing evidence plan. ITSH acknowledged the point but noted timeline pressure. [Transcript 24:51–26:30]"

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
    hasSlideContext: boolean
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

    const basePrompt = `${ANTI_COMPRESSION_BLOCK}

${persona.roleDefinition}

TONE AND STYLE:
${persona.toneDescription}

FORMATTING RULES:
${persona.formattingRules}

${styleSection}

${lexiconInstructions}

${slideContextInstructions}

YOUR TASK:
Generate meeting minutes based on the provided inputs.

STRUCTURE:
Follow this structure exactly. 
${template.structure}

IMPORTANT OUTPUT INSTRUCTIONS: 
- Output ONLY the content of the minutes in Semantic HTML format.
- Supported tags: <h1>, <h2>, <h3>, <ul>, <ol>, <li>, <p>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>, <th>, <td>.
- Do NOT use markdown. Do NOT use \`\`\`html code blocks. Just valid HTML.
- Do NOT include any preamble ("Here are the minutes...") or postscript.
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

function constructUserPrompt(transcript: TranscriptResult, slideContext?: string): string {
    const transcriptText = transcript.segments
        .map(s => `${s.speaker}: ${s.text}`)
        .join('\n');

    let prompt = `TRANSCRIPT:\n\n${transcriptText}`;

    if (slideContext && slideContext.trim()) {
        prompt += `\n\n================\nSLIDE / OCR CONTEXT (Canonical Source for Data):\n================\n${slideContext}`;
    }

    return prompt;
}


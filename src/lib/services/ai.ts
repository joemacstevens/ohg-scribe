import { getOpenAIKey } from './transcription';
import type { TranscriptResult } from '../types';
import type { Template, Persona } from '../types/minutes';

export interface GenerationRequest {
    transcript: TranscriptResult;
    template: Template;
    persona: Persona;
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

    const systemPrompt = constructSystemPrompt(request.template, request.persona, !!safeSlideContext);
    const userPrompt = constructUserPrompt(request.transcript, safeSlideContext);

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o', // Use high quality model
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.7
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

function constructSystemPrompt(template: Template, persona: Persona, hasSlideContext: boolean): string {
    let lexiconInstructions = "";
    if (persona.lexicon) {
        const rules = persona.lexicon.rules.map(r => {
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

    let slideContextInstructions = "";
    if (hasSlideContext) {
        slideContextInstructions = `
    SOURCE OF TRUTH HIERARCHY:
    1. SLIDE / OCR CONTEXT (Highest Priority): Use this for proposal titles, dates, attendee names, specific numbers, and study design details.
    2. TRANSCRIPT: Use this for discussion points, questions, decision rationale, and speaker tone.
    3. If there is a conflict between Slides and Transcript regarding a Fact (e.g. n=100 vs n=105), TRUST THE SLIDES.
        `;
    }

    const basePrompt = `
    ${persona.roleDefinition}
    
    TONE AND STYLE:
    ${persona.toneDescription}
    
    FORMATTING RULES:
    ${persona.formattingRules}

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

import type { Template } from '$lib/types/minutes';

export const MEDICAL_REVIEW_TEMPLATE: Template = {
    id: 'PPG_REVIEW_MINUTES',
    name: 'Medical Review (PPG)',
    description: 'Detailed protocol for reviewing and endorsing study proposals.',
    icon: 'clipboard-list',
    structure: `<h1>{MeetingName} — Meeting Minutes</h1>

<p><strong>Date:</strong> {Date}<br>
<strong>Chair:</strong> {Chair}<br>
<strong>Attendees:</strong> {Attendees}<br>
<strong>Apologies:</strong> {Apologies}<br>
<strong>Location:</strong> {Location}</p>

<hr>

<h2>Executive Summary</h2>

<table>
  <thead>
    <tr>
      <th>Proposal</th>
      <th>PPG Decision</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>&lt;Title&gt;</td>
      <td>✅ Endorsed / ⚠️ Deferred (reason) / ❌ Not endorsed</td>
    </tr>
  </tbody>
</table>

<blockquote>Every proposal listed below must appear here with its decision.</blockquote>

<hr>

<h2>Proposal Summaries</h2>

<h3>&lt;Proposal title&gt;</h3>
<p><strong>Presenter(s):</strong> &lt;Initials / role&gt;<br>
<strong>Source:</strong> Transcript-sourced / Slide-sourced</p>

<h4>Who / What / Actions</h4>
<table>
  <thead>
    <tr>
      <th>Who</th>
      <th>What</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>&lt;Presenter initials&gt;</td>
      <td>&lt;What was presented&gt;</td>
      <td>&lt;Explicit follow-up tasks&gt;</td>
    </tr>
    <tr>
      <td>All</td>
      <td>Review / decision</td>
      <td>Not stated</td>
    </tr>
  </tbody>
</table>

<p><strong>Abstract / Manuscript</strong><br>
- <strong>Target congress / journal:</strong> &lt;...&gt;<br>
- <strong>Submission date / deadline:</strong> &lt;... or Not stated&gt;</p>

<p><strong>Presentation Summary</strong><br>
- <strong>Aim / Objective:</strong> &lt;...&gt;<br>
- <strong>Design / Data sources:</strong> &lt;...&gt;<br>
- <strong>Key findings / conclusions:</strong> &lt;...&gt;</p>

<p><strong>Questions and Comments</strong><br>
- <strong>[Initials]</strong> asked / commented …<br>
- <strong>[Initials]</strong> replied …<br>
- <em>Compliance note — …</em></p>

<p><strong>Decision:</strong> ✅ Endorsed / ⚠️ Deferred / ❌ Not endorsed<br>
<em>(Transcript-sourced / Slide-sourced)</em></p>

<hr>

<h2>Any Other Business</h2>
<ul>
<li>&lt;Items or “No updates.”&gt;</li>
</ul>

<hr>

<h2>Next Steps</h2>
<ul>
<li><strong>Task:</strong> &lt;Description&gt; — <strong>Responsible:</strong> &lt;Initials&gt; — <strong>Due:</strong> &lt;Date&gt;</li>
</ul>

<hr>

<p><strong>Compliance note:</strong><br>
All proposals reviewed per scientific/clinical need in line with GPP 2022 and Novo Nordisk publication policy. Commercial interest was not a deciding factor.</p>`,
    exampleOutput: `
<p>
<strong>Date:</strong> 20 May 2025<br>
<strong>Chair:</strong> Thomas Turpin-Jelfs (TCIT)<br>
<strong>Attendees:</strong> Chris, Itai, Maria, Lisa, Nina, Timothy, Inger, others joined via chat.<br>
<strong>Apologies:</strong> Not stated<br>
<strong>Location:</strong> Virtual/Online
</p>

<hr>

<h2>Executive Summary</h2>

<table>
<thead>
<tr>
<th>Proposal</th>
<th>PPG Decision</th>
</tr>
</thead>
<tbody>
<tr>
<td>Assessment of the Carbon Emissions Impact Associated with Semaglutide for Obesity/Diabetes in the UK</td>
<td>✅ Endorsed</td>
</tr>
<tr>
<td>Indirect Treatment Comparison (ITC) of Oral semaglutide 25mg with s.c. injectable semaglutide 2.4mg</td>
<td>✅ Endorsed</td>
</tr>
<tr>
<td>Relationships between body mass indices and surgical replacements of knee and hip joints</td>
<td>✅ Endorsed</td>
</tr>
<tr>
<td>Impact of Wegovy on household shopping, lifestyle and behavioural metrics in US; Impact of Wegovy on food noise and mental wellbeing in US</td>
<td>❌ Not endorsed (pending further clarification)</td>
</tr>
<tr>
<td>Real world cardiovascular and gastro-intestinal benefit of Wegovy compared to Zepbound in US</td>
<td>⚠️ Deferred (pending data analysis)</td>
</tr>
</tbody>
</table>

<hr>

<h2>Proposal Summaries</h2>

<h3>Assessment of the Carbon Emissions Impact Associated with Semaglutide for Obesity/Diabetes in the UK</h3>

<p>
<strong>Presenter(s):</strong> CJLU<br>
<strong>Source:</strong> Slide-sourced
</p>

<h4>Who / What / Actions</h4>

<table>
<thead>
<tr>
<th>Who</th>
<th>What</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
<tr>
<td>CJLU</td>
<td>Presented assessment of carbon emissions impact</td>
<td>None stated</td>
</tr>
<tr>
<td>All</td>
<td>Review / decision</td>
<td>Not stated</td>
</tr>
</tbody>
</table>

<p>
<strong>Abstract / Manuscript</strong><br>
Target congress / journal: Value in Health / Pharmacoeconomics<br>
Submission date / deadline: Q3 2025
</p>

<p>
<strong>Presentation Summary</strong><br>
Aim / Objective: Evaluate carbon emissions impact of Semaglutide<br>
Design / Data sources: Utilized established trials and health economic models<br>
Key findings / conclusions: Net reduction in greenhouse gas emissions
</p>

<p>
<strong>Questions and Comments</strong><br>
[H] asked about target audience and comparison with other drugs.<br>
[D] replied focus on public payers and no current comparable data.
</p>

<p>
<strong>Decision:</strong> ✅ Endorsed (Slide-sourced)
</p>

<hr>

<h3>Indirect Treatment Comparison (ITC) of Oral semaglutide 25mg with s.c. injectable semaglutide 2.4mg</h3>

<p>
<strong>Presenter(s):</strong> ICSM<br>
<strong>Source:</strong> Slide-sourced
</p>

<h4>Who / What / Actions</h4>

<table>
<thead>
<tr>
<th>Who</th>
<th>What</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
<tr>
<td>ICSM</td>
<td>Presented indirect treatment comparison</td>
<td>None stated</td>
</tr>
<tr>
<td>All</td>
<td>Review / decision</td>
<td>Not stated</td>
</tr>
</tbody>
</table>

<p>
<strong>Abstract / Manuscript</strong><br>
Target congress / journal: Obesity Week / Journal of Medical Decision Making<br>
Submission date / deadline: 2 July 2025
</p>

<p>
<strong>Presentation Summary</strong><br>
Aim / Objective: Compare efficacy of oral vs subcutaneous semaglutide<br>
Design / Data sources: OASIS-4 and STEP 1 trials<br>
Key findings / conclusions: Equivalence in efficacy demonstrated
</p>

<p>
<strong>Questions and Comments</strong><br>
[H] suggested additional modeling for exposure.<br>
[I] agreed to consider inclusion of modeling data.
</p>

<p>
<strong>Decision:</strong> ✅ Endorsed (Slide-sourced)
</p>

<hr>

<h3>Relationships between body mass indices and surgical replacements of knee and hip joints</h3>

<p>
<strong>Presenter(s):</strong> TMYU<br>
<strong>Source:</strong> Slide-sourced
</p>

<h4>Who / What / Actions</h4>

<table>
<thead>
<tr>
<th>Who</th>
<th>What</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
<tr>
<td>TMYU</td>
<td>Presented correlation between BMI and joint replacement</td>
<td>None stated</td>
</tr>
<tr>
<td>All</td>
<td>Review / decision</td>
<td>Not stated</td>
</tr>
</tbody>
</table>

<p>
<strong>Abstract / Manuscript</strong><br>
Target congress / journal: Obesity Week 2025<br>
Submission date / deadline: July 2025
</p>

<p>
<strong>Presentation Summary</strong><br>
Aim / Objective: Investigate association between obesity and surgeries<br>
Design / Data sources: Retrospective study using AEMR PPlus<br>
Key findings / conclusions: Strong association between increased BMI and surgery risk
</p>

<p>
<strong>Questions and Comments</strong><br>
No questions were raised.
</p>

<p>
<strong>Decision:</strong> ✅ Endorsed (Slide-sourced)
</p>

<hr>

<h3>Impact of Wegovy on household shopping, lifestyle and behavioural metrics in US; Impact of Wegovy on food noise and mental wellbeing in US</h3>

<p>
<strong>Presenter(s):</strong> TMYU<br>
<strong>Source:</strong> Transcript-sourced
</p>

<h4>Who / What / Actions</h4>

<table>
<thead>
<tr>
<th>Who</th>
<th>What</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
<tr>
<td>TMYU</td>
<td>Presented consumer behavior data related to Wegovy</td>
<td>Clarify if this is market research</td>
</tr>
<tr>
<td>All</td>
<td>Review / decision</td>
<td>Pending clarification</td>
</tr>
</tbody>
</table>

<p>
<strong>Abstract / Manuscript</strong><br>
Target congress / journal: Obesity Week 2025<br>
Submission date / deadline: July 2025
</p>

<p>
<strong>Presentation Summary</strong><br>
Aim / Objective: Assess impact of Wegovy on consumer behavior<br>
Design / Data sources: Data from Numerator, a tech company<br>
Key findings / conclusions: Pending further clarification
</p>

<p>
<strong>Questions and Comments</strong><br>
[B] expressed concerns regarding scientific value and market research status.<br>
[A] emphasized adherence to publication requirements.
</p>

<p>
<strong>Decision:</strong> ❌ Not endorsed (pending further clarification)
</p>

<hr>

<h3>Real world cardiovascular and gastro-intestinal benefit of Wegovy compared to Zepbound in US</h3>

<p>
<strong>Presenter(s):</strong> TMYU<br>
<strong>Source:</strong> Transcript-sourced
</p>

<h4>Who / What / Actions</h4>

<table>
<thead>
<tr>
<th>Who</th>
<th>What</th>
<th>Actions</th>
</tr>
</thead>
<tbody>
<tr>
<td>TMYU</td>
<td>Presented comparison of Wegovy and Zepbound</td>
<td>Conduct feasibility assessment</td>
</tr>
<tr>
<td>All</td>
<td>Review / decision</td>
<td>Pending data analysis</td>
</tr>
</tbody>
</table>

<p>
<strong>Abstract / Manuscript</strong><br>
Target congress / journal: Obesity Week 2025<br>
Submission date / deadline: July 2025
</p>

<p>
<strong>Presentation Summary</strong><br>
Aim / Objective: Compare cardiovascular and gastrointestinal benefits<br>
Design / Data sources: AMR PPlus database<br>
Key findings / conclusions: Pending further data analysis
</p>

<p>
<strong>Questions and Comments</strong><br>
[E] questioned the additional value of the CV analysis.<br>
[A] highlighted the risk if data is not favorable.
</p>

<p>
<strong>Decision:</strong> ⚠️ Deferred (pending data analysis)
</p>

<hr>

<h2>Any Other Business</h2>

<p>No updates.</p>

<hr>

<h2>Next Steps</h2>

<ul>
<li><strong>Task:</strong> Clarify market research status of Wegovy proposals — <strong>Responsible:</strong> TMYU — <strong>Due:</strong> Next meeting</li>
</ul>

<p><strong>Compliance note:</strong><br>
All proposals reviewed per scientific/clinical need in line with GPP 2022 and Novo Nordisk publication policy. Commercial interest was not a deciding factor.</p>`
};

export const DEFAULT_TEMPLATES: Template[] = [
    {
        id: 'general',
        name: 'General',
        description: 'Standard meeting format with summary and actions.',
        icon: 'clipboard',
        structure: 'Summary\nAction Items\nKey Decisions'
    },
    MEDICAL_REVIEW_TEMPLATE,
    {
        id: 'adboard',
        name: 'Ad Board',
        description: 'KOL insights and consensus measurement.',
        icon: 'users',
        structure: 'Executive Summary\nKOL Insights\nConsensus Statements\nStrategic Recs'
    }
];

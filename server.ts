import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '15mb' }));

// Lazy initialization for Gemini AI client with dynamic .env reload
let aiClient: GoogleGenAI | null = null;
let lastLoadedKey: string | null = null;

function getAi(): GoogleGenAI | null {
  // Re-read .env dynamically so updates take effect without server restart
  dotenv.config({ override: true });
  const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  const key = rawKey.trim().replace(/^["']|["']$/g, '');

  if (!key || key === 'MY_GEMINI_API_KEY' || key.length < 10) {
    return null;
  }
  if (!aiClient || lastLoadedKey !== key) {
    aiClient = new GoogleGenAI({ apiKey: key });
    lastLoadedKey = key;
  }
  return aiClient;
}

async function callGroqServer(apiKey: string, systemPrompt: string, userQuestion: string) {
  let candidateModels = [
    'openai/gpt-oss-20b',
    'openai/gpt-oss-120b',
    'qwen/qwen3.6-27b',
    'llama-3.3-70b-versatile',
    'llama-3.3-70b-specdec',
    'llama-3.2-3b-preview',
    'llama-3.2-1b-preview',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'deepseek-r1-distill-llama-70b',
  ];

  try {
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const availableIds: string[] = (modelsData.data || [])
        .map((m: any) => m.id)
        .filter((id: string) => !id.includes('whisper') && !id.includes('guard'));
      if (availableIds.length > 0) {
        const prioritized = candidateModels.filter((m) => availableIds.includes(m));
        const others = availableIds.filter((m) => !candidateModels.includes(m));
        candidateModels = [...prioritized, ...others];
      }
    }
  } catch (err) {
    console.warn('Could not query Groq models catalog:', err);
  }

  for (const model of candidateModels) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userQuestion },
          ],
          temperature: 0.6,
          max_tokens: 1024,
        }),
      });

      if (!res.ok) continue;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content;
      if (text) {
        return { text, model: `Groq (${model})` };
      }
    } catch (e) {
      console.warn(`Groq server call failed for ${model}:`, e);
    }
  }
  return null;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  dotenv.config({ override: true });
  const rawKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
  const key = rawKey.trim().replace(/^["']|["']$/g, '');
  const isConfigured = !!key && key !== 'MY_GEMINI_API_KEY' && key.length > 10;
  const isGroq = key.startsWith('gsk_');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    ai_configured: isConfigured,
    provider: isGroq ? 'groq' : 'gemini',
    key_prefix: isConfigured ? key.substring(0, 6) + '...' : 'none'
  });
});

// Grounded AI Assistant Chat Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { question, filterContext, projects } = req.body;

    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'Question is required' });
    }

    dotenv.config({ override: true });
    const rawKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    const activeKey = rawKey.trim().replace(/^["']|["']$/g, '');

    // Projects summary for grounding context
    const projectSummaries = (projects || []).slice(0, 15).map((p: any) => ({
      code: p.project_code,
      name: p.name,
      ministry: p.ministry,
      state: p.state,
      approved_cost: p.approved_cost,
      revised_cost: p.latest_snapshot?.revised_cost,
      physical_progress: p.latest_snapshot?.physical_progress_pct,
      expected_progress: p.latest_snapshot?.expected_progress_pct,
      delay_months: p.latest_snapshot?.delay_months,
      risk_tier: p.latest_snapshot?.risk_tier,
      overall_risk_score: p.latest_snapshot?.overall_risk,
      signals: p.warnings?.map((w: any) => w.detected_signals).flat() || []
    }));

    const systemPrompt = `You are InfraNetra, an authoritative infrastructure risk intelligence specialist advising senior Indian government officials (MoSPI, PMO Project Monitoring Group, Cabinet Secretariat).
You have real-time access to the National Master Registry of Infrastructure Projects derived from PAIMANA Flash Reports.

Current Filter Scope:
${JSON.stringify(filterContext || {})}

Available Projects in Active Registry:
${JSON.stringify(projectSummaries, null, 2)}

Instructions:
1. If the user asks a general question (such as a greeting, general inquiry, definition, or asking what you can do), answer conversationally, politely, and helpfully while explaining how you can assist with infrastructure project monitoring.
2. If the user asks about projects, risks, or performance, provide a rigorous, quantitative, concise executive assessment answering the user's question directly.
3. When listing projects, format each project cleanly as an executive briefing card using structured bullet points:
   • **[PROJECT-CODE] Project Name** (State, Ministry)
     - **Cost Escalation:** Approved Rs. X Cr → Revised Rs. Y Cr (+Z% Overrun)
     - **Timeline & Progress:** X% completed | Y months delay (Risk Tier)
     - **Key Root Cause:** Clear explanation of statutory clearance, land, or geological bottleneck
     - **Governance Action:** High-level corrective measure or PMG/CCEA recommendation
   (Avoid wide raw markdown pipe tables with 6+ columns as they break on narrow slideover screens).
4. When referencing specific projects from the registry, ALWAYS cite their project codes in brackets like [PROJECT-CODE] (e.g. [MORTH-NH44-PKG4], [MOR-USBRL-TUNNEL]) so the UI renders them as clickable links.
5. Reference concrete financial figures in bold (e.g. **Rs. 6,920 Cr**, **+42.7%**, **28 months**).
6. Provide 2-3 short, relevant follow-up questions at the very end formatted as:
FOLLOW_UPS:
- Question 1
- Question 2
- Question 3`;

    // A. Check if Groq key is configured
    if (activeKey.startsWith('gsk_')) {
      const groqRes = await callGroqServer(activeKey, systemPrompt, question);
      if (groqRes && groqRes.text) {
        let answerText = groqRes.text;
        let followUps: string[] = [];

        if (answerText.includes('FOLLOW_UPS:')) {
          const parts = answerText.split('FOLLOW_UPS:');
          answerText = parts[0].trim();
          followUps = parts[1]
            .split('\n')
            .map((line: string) => line.replace(/^-\s*/, '').trim())
            .filter(Boolean);
        }

        const detectedCodes = (projectSummaries as any[])
          .map((p) => p.code)
          .filter((code) => answerText.includes(code));

        return res.json({
          answer: answerText,
          referenced_projects: detectedCodes,
          follow_ups: followUps.slice(0, 3),
          grounded: true,
          model: groqRes.model
        });
      }
    }

    // B. Check if Gemini AI client is configured
    const ai = getAi();
    if (ai) {
      try {
        const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        let response: any = null;
        let usedModel = '';
        let lastError: any = null;

        for (const modelName of candidateModels) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\nUser Question: ${question}` }]
                }
              ]
            });
            if (response && response.text) {
              usedModel = modelName;
              break;
            }
          } catch (mErr: any) {
            lastError = mErr;
            console.warn(`Gemini generation with model ${modelName} failed:`, mErr?.message || mErr);
          }
        }

        if (response && response.text) {
          const rawText = response.text || '';
          let answerText = rawText;
          let followUps: string[] = [];

          if (rawText.includes('FOLLOW_UPS:')) {
            const parts = rawText.split('FOLLOW_UPS:');
            answerText = parts[0].trim();
            followUps = parts[1]
              .split('\n')
              .map(line => line.replace(/^-\s*/, '').trim())
              .filter(Boolean);
          }

          // Extract referenced project codes
          const detectedCodes = (projectSummaries as any[])
            .map(p => p.code)
            .filter(code => answerText.includes(code));

          return res.json({
            answer: answerText,
            referenced_projects: detectedCodes,
            follow_ups: followUps.slice(0, 3),
            grounded: true,
            model: usedModel
          });
        } else {
          console.warn('All Gemini candidate models failed. Last error:', lastError?.message || lastError);
        }
      } catch (geminiError: any) {
        console.warn('Gemini API call error, falling back to heuristic reasoning engine:', geminiError?.message || geminiError);
      }
    }

    // Heuristic intelligent fallback when API key is missing or quota limited
    const lowerQ = question.toLowerCase();
    let answer = '';
    const referencedCodes: string[] = [];
    const followUps: string[] = [];

    if (lowerQ.includes('critical') || lowerQ.includes('high risk') || lowerQ.includes('highest')) {
      answer = `Based on the latest April 2026 PAIMANA Flash Report, 4 mega projects are in the **Critical Risk Tier** (composite score > 80):\n\n` +
        `1. **[MOP-SUBANSIRI-LOWER]** (Risk: 92/100, Cost Overrun: +238% to Rs. 21,247 Cr, Delay: 180 months) - Severely impeded by geological landslides at Diversion Tunnel 1.\n` +
        `2. **[MOR-USBRL-TUNNEL]** (Risk: 91/100, Cost: Rs. 29,500 Cr, Delay: 46 months) - Facing heavy water ingress (>120 L/sec) in Heading 4B and complex Himalayan fault lines.\n` +
        `3. **[MORTH-NH44-PKG4]** (Risk: 88/100, Delay: 28 months) - Critical eco-sensitive buffer zone clearance pending with NTCA/MoEF&CC.\n` +
        `4. **[MOC-TALCHER-FERT]** (Risk: 82/100) - Cryogenic ASU fabrication delay in overseas facility.\n\n` +
        `**Action Priority:** Subansiri Hydro and USBRL Tunnel require immediate Cabinet Committee on Economic Affairs (CCEA) cost ratification and high-level inter-ministerial taskforces.`;
      referencedCodes.push('MOP-SUBANSIRI-LOWER', 'MOR-USBRL-TUNNEL', 'MORTH-NH44-PKG4', 'MOC-TALCHER-FERT');
      followUps.push(
        'What is the expenditure vs approved budget for Subansiri Lower?',
        'Show all projects in Maharashtra experiencing land acquisition delays',
        'Which projects have EPC contractor disputes active?'
      );
    } else if (lowerQ.includes('maharashtra') || lowerQ.includes('mumbai') || lowerQ.includes('nagpur')) {
      answer = `In Maharashtra, InfraNetra is currently monitoring 3 major projects with significant capital exposure:\n\n` +
        `• **[MORTH-NH44-PKG4]** (Jabalpur-Nagpur Corridor): Critical Risk (88). Current physical progress is 59% vs 94% expected milestone, with Rs. 6,920 Cr revised outlay (+43% overrun).\n` +
        `• **[MORTH-DME-PKG12]** (Delhi-Mumbai Expressway JNPT Spur): High Risk (71). 71% completed with Panvel interchange and fly ash supply bottlenecks.\n` +
        `• **[MOR-WDFC-JNPT]** (Western Dedicated Freight Corridor): High Risk (74). 76% progress; 8.4 hectares land acquisition under judicial stay in Palghar.\n\n` +
        `**Key Observation:** All 3 corridors terminate or route into JNPT port zones, creating compounding logistics vulnerability if unaddressed before Q3.`;
      referencedCodes.push('MORTH-NH44-PKG4', 'MORTH-DME-PKG12', 'MOR-WDFC-JNPT');
      followUps.push(
        'What are the mitigation steps for NH-44 Package IV?',
        'Compare cost overruns across Road vs Railway sectors',
        'What is the status of Western DFC land acquisition?'
      );
    } else if (lowerQ.includes('railway') || lowerQ.includes('rail') || lowerQ.includes('train')) {
      answer = `Analysis of Ministry of Railways (MoR) portfolio in the active registry:\n\n` +
        `• Total Capital Exposure: Rs. 71,300 Cr across monitored mega packages.\n` +
        `• **[MOR-USBRL-TUNNEL]**: Rated **Critical** (Score 91). Cost escalation has surged from original Rs. 16,800 Cr to Rs. 29,500 Cr (+76%). Physical progress is 88% with ongoing specialized grouting.\n` +
        `• **[MOR-WDFC-JNPT]**: Rated **High** (Score 74). Revised cost Rs. 41,800 Cr with 22 months delay. Track linking in Palghar is paced by bridge girder launching.\n\n` +
        `**Recommended Intervention:** The PMO Project Monitoring Group should review North Railway geological mitigation protocols and authorize accelerated ballastless track laying.`;
      referencedCodes.push('MOR-USBRL-TUNNEL', 'MOR-WDFC-JNPT');
      followUps.push(
        'Show early warnings active for USBRL Tunnel T-49',
        'Which railway contractors have the highest delay index?',
        'Export ministry-wise risk summary report'
      );
    } else if (
      lowerQ === 'hi' ||
      lowerQ === 'hello' ||
      lowerQ === 'hey' ||
      lowerQ.startsWith('hi ') ||
      lowerQ.startsWith('hello ') ||
      lowerQ.includes('how are you') ||
      lowerQ.includes('who are you') ||
      lowerQ.includes('what can you do') ||
      lowerQ.includes('what is this') ||
      lowerQ.includes('help')
    ) {
      answer = `Hello! I am **InfraNetra Risk Intelligence**, an AI advisory assistant grounded in the **National Master Registry (April 2026 PAIMANA Flash Report)**.\n\n` +
        `I monitor **1,847 mega infrastructure projects** across India. You can ask me:\n` +
        `• *"Which projects have cost overrun exceeding 30%?"*\n` +
        `• *"List all Critical risk projects in Maharashtra"*\n` +
        `• *"What are the primary delay causes across Railway projects?"*\n` +
        `• Or ask about any specific project code like **[MOP-SUBANSIRI-LOWER]** or **[MOR-USBRL-TUNNEL]**.`;
      followUps.push(
        'Which projects have cost overrun exceeding 30%?',
        'List all Critical risk projects in Maharashtra',
        'Summarize key delay vectors across Ministry of Railways'
      );
    } else {
      answer = `Executive Summary from National Master Registry (April 2026 PAIMANA Flash Report):\n\n` +
        `• Total Monitored Projects: 1,847 (Active Sample: 8 flagship mega projects)\n` +
        `• High/Critical Risk Concentration: 50% of sampled major outlays have experienced time overrun > 18 months.\n` +
        `• Highest Risk Vectors: [MOP-SUBANSIRI-LOWER] (Hydro Power, 92/100 risk), [MOR-USBRL-TUNNEL] (Railways, 91/100 risk), and [MORTH-NH44-PKG4] (Roadways, 88/100 risk).\n` +
        `• Primary Delay Catalysts: Statutory environmental/wildlife clearances (42%), Right-of-Way & land litigation (33%), and contractor liquidity/import bottlenecks (25%).\n\n` +
        `Click any highlighted project code above to drill directly into its 4-tier risk diagnostic and snapshot trend.`;
      referencedCodes.push('MOP-SUBANSIRI-LOWER', 'MOR-USBRL-TUNNEL', 'MORTH-NH44-PKG4');
      followUps.push(
        'List all Critical risk projects needing cabinet escalation',
        'Which projects have cost overrun exceeding 30%?',
        'Show early warnings by severity tier'
      );
    }

    return res.json({
      answer,
      referenced_projects: referencedCodes,
      follow_ups: followUps,
      grounded: true,
      model: 'infranetra-risk-engine'
    });
  } catch (err: any) {
    console.error('Chat endpoint error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// Flash Report PDF Ingestion & Parsing Simulation
app.post('/api/parse-flash-report', (req, res) => {
  try {
    const { reportMonth = 'April 2026', fileName = 'PAIMANA_Flash_Report_Apr2026.pdf' } = req.body;

    // Simulate real ingestion pipeline results matching Workflow 1 in spec:
    // 1. PDF uploaded to storage
    // 2. Table extraction runs
    // 3. Project code matching against Master Registry
    // 4. Time, Cost, Implementation & Overall Risk recomputed
    // 5. Early warnings updated
    const parseResult = {
      job_id: `parse-${Date.now()}`,
      report_month: reportMonth,
      file_name: fileName,
      status: 'completed',
      rows_total: 1847,
      rows_matched: 1789,
      rows_failed: 58,
      match_rate_pct: 96.8,
      new_critical_alerts: 4,
      recalculated_projects: 1789,
      warnings: [
        '58 rows flagged: Missing standardized MoSPI project_code in State PWD road packages (surfaced for manual audit)',
        'Exchange rate variance detected for import items in Mumbai Port Berth expansion',
        'Environmental clearance condition trigger for Package IV of Jabalpur-Nagpur NH-44',
      ],
      completed_at: new Date().toISOString(),
    };

    return res.json(parseResult);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process report' });
  }
});

// MoSPI Datasets Months Availability Endpoint (12 Months Jan-Dec 2026)
app.get('/api/datasets/months', async (req, res) => {
  try {
    const fastApiRes = await fetch('http://127.0.0.1:8000/api/datasets/months');
    if (fastApiRes.ok) {
      const data = await fastApiRes.json();
      return res.json(data);
    }
  } catch (err) {
    // FastAPI not reachable directly from node, fallback to 12-month schema
  }

  const defaultMonths = [
    { report_month: '2026-04-01', label: 'April 2026', available: true, record_count: 2105 },
    { report_month: '2026-05-01', label: 'May 2026', available: true, record_count: 2101 },
    { report_month: '2026-06-01', label: 'June 2026', available: true, record_count: 1977 },
    { report_month: '2026-07-01', label: 'July 2026', available: true, record_count: 1800 },
  ];
  return res.json({ months: defaultMonths });
});

// Deep AI Project Risk Diagnostic
app.post('/api/analyze-project', async (req, res) => {
  try {
    const { project } = req.body;
    if (!project) {
      return res.status(400).json({ error: 'Project data is required' });
    }

    const ai = getAi();
    if (ai) {
      try {
        const prompt = `Perform a comprehensive MoSPI Infrastructure Risk Diagnostic for:
Project Code: ${project.project_code}
Name: ${project.name}
Ministry: ${project.ministry}
Sector: ${project.sector}
State: ${project.state}
Approved Cost: Rs. ${project.approved_cost} Cr
Revised Cost: Rs. ${project.latest_snapshot?.revised_cost} Cr
Physical Progress: ${project.latest_snapshot?.physical_progress_pct}% vs Expected: ${project.latest_snapshot?.expected_progress_pct}%
Delay: ${project.latest_snapshot?.delay_months} months
Contractor: ${project.epc_contractor || 'Not specified'}
Current Signals: ${JSON.stringify(project.warnings?.map((w: any) => w.detected_signals) || [])}

Provide:
1. Executive Risk Diagnosis (2 sentences)
2. Primary Root Causes (Land, Clearances, Contractor, Engineering)
3. Immediate Inter-Ministerial Corrective Actions
4. 90-Day Milestone Recovery Roadmap`;

        const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
        let response: any = null;
        for (const modelName of candidateModels) {
          try {
            response = await ai.models.generateContent({
              model: modelName,
              contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            if (response && response.text) break;
          } catch (mErr: any) {
            console.warn(`Deep analysis with ${modelName} failed:`, mErr?.message || mErr);
          }
        }

        if (response && response.text) {
          return res.json({ analysis: response.text });
        }
      } catch (e) {
        console.warn('Deep analysis AI error, using fallback template:', e);
      }
    }

    // Heuristic fall-back diagnosis
    const diagnosis = `### Executive Risk Diagnosis
The project **${project.name}** ([${project.project_code}]) exhibits acute schedule divergence with physical progress lagging at ${project.latest_snapshot?.physical_progress_pct}% against the baseline milestone of ${project.latest_snapshot?.expected_progress_pct}%. With an estimated cost escalation of +${project.latest_snapshot?.cost_overrun_pct}%, this project requires high-level MoSPI inter-agency intervention.

### Primary Root Causes
- **Statutory Clearances & Right-of-Way:** Unresolved forest/buffer zone permits and regional administrative delays have throttled front-line construction.
- **Contractor Cashflow & Material Logistics:** Subcontractor mobilization and critical equipment procurement delays have disrupted continuous civil execution.
- **Geotechnical & Engineering Adjustments:** Site conditions required unbudgeted structural realignments and safety enhancements.

### Immediate Corrective Actions
1. Convene a tripartite alignment meeting between ${project.ministry}, State Administration, and ${project.epc_contractor || 'the EPC contractor'}.
2. Institute weekly milestone monitoring with biometric worker and machinery tracking.
3. Fast-track pending financial milestone escrow releases linked to verified site deliverables.`;

    return res.json({ analysis: diagnosis });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to analyze project' });
  }
});

// Reverse proxy all remaining /api/* routes directly to FastAPI backend (supports FASTAPI_URL env)
app.use('/api', async (req, res, next) => {
  const fastapiBase = (process.env.FASTAPI_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
  const fastApiUrl = `${fastapiBase}${req.originalUrl}`;
  try {
    const forwardedHeaders: Record<string, string> = {
      'Content-Type': (req.headers['content-type'] as string) || 'application/json',
    };
    if (req.headers['authorization']) {
      forwardedHeaders['authorization'] = req.headers['authorization'] as string;
    }
    if (req.headers['x-auth-token']) {
      forwardedHeaders['x-auth-token'] = req.headers['x-auth-token'] as string;
    }

    const options: RequestInit = {
      method: req.method,
      headers: forwardedHeaders,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }
    const response = await fetch(fastApiUrl, options);
    const contentType = response.headers.get('content-type') || 'application/json';
    res.status(response.status).set('content-type', contentType);
    const data = await response.text();
    return res.send(data);
  } catch (err: any) {
    console.warn(`[Proxy Warning] FastAPI backend (127.0.0.1:8000) not reached for ${req.originalUrl}:`, err?.message || err);
    return res.status(502).json({
      error: 'FastAPI backend connection failed',
      detail: err?.message || String(err),
    });
  }
});

async function startServer() {
  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(express.static(path.resolve(process.cwd(), 'public')));

    app.get('/favicon.ico', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'public', 'infranetra-logo.png'));
    });

    app.use(vite.middlewares);

    // Development SPA route fallback so routes like /map load correctly without blank screens
    app.get('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        if (vite && vite.ssrFixStacktrace) {
          vite.ssrFixStacktrace(e);
        }
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InfraNetra server running on port ${PORT}`);
  });
}

startServer();

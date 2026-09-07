import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  ExternalLink,
  Bot,
  User,
  ShieldCheck,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { ProjectWithSnapshot, ChatMessage } from '../types';

interface AiAssistantSlideoverProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectWithSnapshot[];
  onSelectProject: (projectCode: string) => void;
  currentFilterContext?: {
    ministry?: string;
    state?: string;
    risk_tier?: string;
  };
}

const INITIAL_WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-msg',
    sender: 'assistant',
    text: `Welcome to **InfraNetra Risk Intelligence**. I am grounded directly in the **National Master Registry (April 2026 PAIMANA Flash Report)**.

Ask me about cost escalations, critical bottleneck corridors, time overruns, or contractor performance across mega infrastructure projects.`,
    timestamp: 'Just now',
    referenced_project_codes: ['MORTH-NH44-PKG4', 'MOR-USBRL-TUNNEL', 'MOP-SUBANSIRI-LOWER'],
    suggested_followups: [
      'Which projects have cost escalation exceeding 30%?',
      'List all Critical risk projects in Maharashtra',
      'Summarize key delay vectors across Ministry of Railways',
    ],
  },
];

export const AiAssistantSlideover: React.FC<AiAssistantSlideoverProps> = ({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  currentFilterContext,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_WELCOME_MESSAGES);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Helper to handle closing and clear history if user has made 2 or more searches
  const handleClose = () => {
    const userSearchCount = messages.filter((m) => m.sender === 'user').length;
    if (userSearchCount >= 2) {
      setMessages(INITIAL_WELCOME_MESSAGES);
      setInputQuestion('');
    }
    onClose();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    } else {
      // Clear history when slideover is closed if user performed 2 or more searches
      const userSearchCount = messages.filter((m) => m.sender === 'user').length;
      if (userSearchCount >= 2) {
        setMessages(INITIAL_WELCOME_MESSAGES);
        setInputQuestion('');
      }
    }
  }, [messages, isOpen]);

  // Close when clicking outside the panel or pressing Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, messages, onClose]);

  if (!isOpen) return null;

  const getAiKey = () => {
    const env = (import.meta as any).env || {};
    const key = (
      env.VITE_GROQ_API_KEY ||
      env.GROQ_API_KEY ||
      env.VITE_GEMINI_API_KEY ||
      env.GEMINI_API_KEY ||
      ''
    ).trim().replace(/^["']|["']$/g, '');
    return key;
  };

  const isGroqKey = (key: string) => key.startsWith('gsk_');

  // Robust parser for AI responses: extracts follow-up suggestions and guarantees contextual fallbacks
  const parseAiResponse = (rawText: string, query: string, projectSummaries: { code: string }[]) => {
    let answerText = rawText;
    let followUps: string[] = [];

    // Match any variation of follow-up / suggested inquiries header (e.g. FOLLOW_UPS:, **Follow-up Questions:**, Suggested Inquiries:, etc.)
    const followUpMatch = rawText.match(
      /(?:\*{1,2})?(?:FOLLOW[-_ ]?UPS?|Follow[- ]?up (?:Questions?|Inquiries?)|Suggested (?:Questions?|Inquiries?|Prompts?))(?:\*{1,2})?:?\s*/i
    );

    if (followUpMatch && followUpMatch.index !== undefined) {
      answerText = rawText.substring(0, followUpMatch.index).trim();
      const followUpSection = rawText.substring(followUpMatch.index + followUpMatch[0].length);
      followUps = followUpSection
        .split('\n')
        .map((line: string) => line.replace(/^[\*\-\d\.\s\•]+/, '').trim())
        .filter((line: string) => line.length > 5 && !line.startsWith('#'));
    }

    const detectedCodes = projectSummaries
      .map((p) => p.code)
      .filter((code) => answerText.includes(code));

    // If followUps is empty, always guarantee 3 smart, context-tailored inquiries!
    if (followUps.length === 0) {
      if (detectedCodes.length > 0) {
        const p1 = detectedCodes[0];
        followUps = [
          `What are the key causes of delay in [${p1}]?`,
          `Show expenditure vs revised cost comparison for referenced projects`,
          `Which other projects in this sector have high cost overruns?`,
        ];
      } else {
        const qLower = query.toLowerCase();
        if (qLower.includes('railway') || qLower.includes('rail') || qLower.includes('train')) {
          followUps = [
            'Which Railway projects are currently on schedule?',
            'List Railway mega projects with cost escalation exceeding 40%',
            'What are the key statutory clearance issues in railway corridors?',
          ];
        } else if (qLower.includes('cost') || qLower.includes('overrun') || qLower.includes('budget')) {
          followUps = [
            'Which 5 infrastructure projects have the highest cost escalation?',
            'Show projects where expenditure exceeds approved sanction',
            'List mega projects currently within sanctioned budget',
          ];
        } else if (qLower.includes('delay') || qLower.includes('time') || qLower.includes('schedule')) {
          followUps = [
            'Which projects have milestone delays exceeding 24 months?',
            'Show Table 3 completed projects and their final delivery timeline',
            'What are the primary reasons for forest clearance delays?',
          ];
        } else {
          followUps = [
            'Which projects have cost escalation exceeding 30%?',
            'List all Critical risk projects in Maharashtra',
            'Summarize key delay vectors across Ministry of Railways',
          ];
        }
      }
    }

    return {
      answerText,
      detectedCodes,
      followUps: followUps.slice(0, 3),
    };
  };

  const callGroqDirect = async (query: string, apiKey: string) => {
    const projectSummaries = (projects || []).slice(0, 15).map((p) => ({
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
    }));

    const systemPrompt = `You are InfraNetra, an authoritative infrastructure risk intelligence specialist advising senior Indian government officials (MoSPI, PMO Project Monitoring Group, Cabinet Secretariat).
You have real-time access to the National Master Registry of Infrastructure Projects derived from PAIMANA Flash Reports.

Current Filter Scope:
${JSON.stringify(currentFilterContext || {})}

Available Projects in Active Registry:
${JSON.stringify(projectSummaries, null, 2)}

Instructions:
1. If the user asks a general question (such as a greeting, general knowledge, or asking what you can do), answer conversationally, politely, and helpfully, and explain how you can assist with infrastructure project monitoring.
2. If the user asks about projects, risks, or performance, provide a rigorous, quantitative, concise executive assessment answering the user's question directly.
3. When listing projects, format each project cleanly as an executive briefing card using structured bullet points:
   • **[PROJECT-CODE] Project Name** (State, Ministry)
     - **Cost Escalation:** Approved Rs. X Cr → Revised Rs. Y Cr (+Z% Overrun)
     - **Timeline & Progress:** X% completed | Y months delay (Risk Tier)
     - **Key Root Cause:** Clear explanation of statutory clearance, land, or geological bottleneck
     - **Governance Action:** High-level corrective measure or PMG/CCEA recommendation
   (Avoid wide raw markdown pipe tables with 6+ columns as they break on narrow slideover screens).
4. When referencing specific projects from the registry, ALWAYS cite their project codes in brackets like [PROJECT-CODE] (e.g. [MORTH-NH44-PKG4], [MOR-USBRL-TUNNEL]) so they can be clicked.
5. Reference concrete financial figures in bold (e.g. **Rs. 6,920 Cr**, **+42.7%**, **28 months**).
6. Provide 2-3 short, relevant follow-up questions at the very end formatted as:
FOLLOW_UPS:
- Question 1
- Question 2
- Question 3`;

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
      } else {
        const errJson = await modelsRes.json().catch(() => null);
        if (modelsRes.status === 401 || modelsRes.status === 403) {
          throw new Error(
            `Invalid Groq API key: ${errJson?.error?.message || 'Unauthorized'}. Please verify or create a new key at https://console.groq.com/keys`
          );
        }
      }
    } catch (modelsErr: any) {
      if (modelsErr.message?.includes('Invalid Groq API key')) {
        throw modelsErr;
      }
    }

    let lastError: any = null;

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
              { role: 'user', content: query },
            ],
            temperature: 0.6,
            max_tokens: 1024,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error?.message || `Groq HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const rawText = data.choices?.[0]?.message?.content;
        if (!rawText) {
          throw new Error('Empty response received from Groq');
        }

        const { answerText, detectedCodes, followUps } = parseAiResponse(rawText, query, projectSummaries);

        return {
          answer: answerText,
          referenced_projects: detectedCodes,
          follow_ups: followUps,
          model: `Groq (${model})`,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`Direct Groq attempt with ${model} failed:`, err);
      }
    }

    throw lastError || new Error('Failed to generate response from Groq');
  };

  const callGeminiDirect = async (query: string, apiKey: string) => {
    const projectSummaries = (projects || []).slice(0, 15).map((p) => ({
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
    }));

    const systemPrompt = `You are InfraNetra, an authoritative infrastructure risk intelligence specialist advising senior Indian government officials (MoSPI, PMO Project Monitoring Group, Cabinet Secretariat).
You have real-time access to the National Master Registry of Infrastructure Projects derived from PAIMANA Flash Reports.

Current Filter Scope:
${JSON.stringify(currentFilterContext || {})}

Available Projects in Active Registry:
${JSON.stringify(projectSummaries, null, 2)}

Instructions:
1. If the user asks a general question (such as a greeting, general knowledge, or asking what you can do), answer conversationally, politely, and helpfully, and explain how you can assist with infrastructure project monitoring.
2. If the user asks about projects, risks, or performance, provide a rigorous, quantitative, concise executive assessment answering the user's question directly.
3. When listing projects, format each project cleanly as an executive briefing card using structured bullet points:
   • **[PROJECT-CODE] Project Name** (State, Ministry)
     - **Cost Escalation:** Approved Rs. X Cr → Revised Rs. Y Cr (+Z% Overrun)
     - **Timeline & Progress:** X% completed | Y months delay (Risk Tier)
     - **Key Root Cause:** Clear explanation of statutory clearance, land, or geological bottleneck
     - **Governance Action:** High-level corrective measure or PMG/CCEA recommendation
   (Avoid wide raw markdown pipe tables with 6+ columns as they break on narrow slideover screens).
4. When referencing specific projects from the registry, ALWAYS cite their project codes in brackets like [PROJECT-CODE] (e.g. [MORTH-NH44-PKG4], [MOR-USBRL-TUNNEL]) so they can be clicked.
5. Reference concrete financial figures in bold (e.g. **Rs. 6,920 Cr**, **+42.7%**, **28 months**).
6. Provide 2-3 short, relevant follow-up questions at the very end formatted as:
FOLLOW_UPS:
- Question 1
- Question 2
- Question 3`;

    const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\nUser Question: ${query}` }
                ]
              }
            ]
          })
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawText) {
          throw new Error('Empty response received from Gemini');
        }

        const { answerText, detectedCodes, followUps } = parseAiResponse(rawText, query, projectSummaries);

        return {
          answer: answerText,
          referenced_projects: detectedCodes,
          follow_ups: followUps,
          model: `Gemini (${model})`,
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`Direct Gemini attempt with ${model} failed:`, err);
      }
    }

    throw lastError || new Error('Failed to generate response from Gemini');
  };

  const callAiDirect = async (query: string) => {
    const key = getAiKey();
    if (!key || key === 'MY_GEMINI_API_KEY' || key.length < 10) {
      throw new Error('No valid API key found in .env. Please check GROQ_API_KEY or GEMINI_API_KEY in .env');
    }

    if (isGroqKey(key)) {
      return callGroqDirect(query, key);
    }
    return callGeminiDirect(query, key);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuestion).trim();
    if (!query || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setIsTyping(true);

    try {
      let data: any = null;

      // 1. Try server endpoint first
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: query,
            filterContext: currentFilterContext,
            projects: projects.map((p) => ({
              project_code: p.project_code,
              name: p.name,
              ministry: p.ministry,
              state: p.state,
              approved_cost: p.approved_cost,
              latest_snapshot: p.latest_snapshot,
              warnings: p.warnings,
            })),
          }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.model && resData.model !== 'infranetra-risk-engine' && resData.model !== 'infrax-risk-engine') {
            data = resData;
          }
        }
      } catch {
        // Server endpoint unreachable or not running
      }

      // 2. If server didn't provide a live AI answer, call Groq / Gemini directly from browser!
      if (!data) {
        data = await callAiDirect(query);
      }

      // Guarantee suggestions are never empty even if endpoint or custom LLM returned empty follow_ups
      let followUps = data.follow_ups || [];
      if (!followUps || followUps.length === 0) {
        const projectSummaries = (projects || []).map((p) => ({ code: p.project_code }));
        const parsed = parseAiResponse(data.answer || '', query, projectSummaries);
        followUps = parsed.followUps;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: data.answer || 'Analysis completed based on the active InfraNetra dataset.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        referenced_project_codes: data.referenced_projects || [],
        suggested_followups: followUps,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('Ask AI error:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: `**AI Assistant Notice:** ${err.message || 'Unable to complete request.'}\n\nPlease verify your API key in \`.env\`. Both Groq (\`gsk_...\`) and Gemini (\`AIza...\` / \`AQ...\`) keys are supported.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Helper to render inline markdown: **bold**, *italic*, `code`, and [PROJECT-CODE]
  const renderInlineContent = (str: string, keyPrefix: string = 'inline'): React.ReactNode => {
    if (!str) return null;
    const tokenRegex = /(\[([A-Z0-9_\-]+)\]|\*\*(.+?)\*\*|`([^`]+)`|\*([^*]+)\*)/g;
    const elements: React.ReactNode[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;
    let elemCount = 0;

    while ((match = tokenRegex.exec(str)) !== null) {
      if (match.index > lastIdx) {
        elements.push(str.substring(lastIdx, match.index));
      }

      const fullMatch = match[0];
      const projectCode = match[2];
      const boldText = match[3];
      const codeText = match[4];
      const italicText = match[5];

      if (projectCode) {
        elements.push(
          <button
            key={`${keyPrefix}-code-${elemCount++}`}
            onClick={() => {
              onSelectProject(projectCode);
              handleClose();
            }}
            className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded font-mono-code text-[11px] sm:text-xs font-semibold bg-[#E6F6F4] text-[#0F9D8C] border border-[#0F9D8C]/30 hover:bg-[#0F9D8C] hover:text-white transition-colors cursor-pointer align-baseline"
            title={`Click to view details for ${projectCode}`}
          >
            <span>{projectCode}</span>
            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
          </button>
        );
      } else if (boldText !== undefined) {
        elements.push(
          <strong key={`${keyPrefix}-bold-${elemCount++}`} className="font-bold text-[#101A3D]">
            {renderInlineContent(boldText, `${keyPrefix}-b-${elemCount}`)}
          </strong>
        );
      } else if (codeText !== undefined) {
        elements.push(
          <code key={`${keyPrefix}-codeblock-${elemCount++}`} className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-teal-800 font-mono text-[11px]">
            {codeText}
          </code>
        );
      } else if (italicText !== undefined) {
        elements.push(
          <em key={`${keyPrefix}-em-${elemCount++}`} className="italic text-slate-600">
            {italicText}
          </em>
        );
      }

      lastIdx = match.index + fullMatch.length;
    }

    if (lastIdx < str.length) {
      elements.push(str.substring(lastIdx));
    }

    return elements;
  };

  // Helper to render full structured message (tables, cards, headings, lists, bold)
  const renderMessageContent = (text: string) => {
    if (!text) return null;

    const lines = text.split('\n');
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // 1. Detect Markdown Table
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }

        if (tableLines.length >= 2) {
          const rawHeader = tableLines[0];
          const headerCells = rawHeader
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());

          const isSep = /^[:\-\|\s]+$/.test(tableLines[1]);
          const startRowIdx = isSep ? 2 : 1;

          const rowData: string[][] = [];
          for (let r = startRowIdx; r < tableLines.length; r++) {
            const cells = tableLines[r]
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());
            if (cells.some((c) => c.length > 0)) {
              rowData.push(cells);
            }
          }

          nodes.push(
            <div
              key={`table-block-${i}`}
              className="my-3 overflow-x-auto rounded-lg border border-slate-200 shadow-xs bg-white"
            >
              <table className="min-w-full text-xs text-left border-collapse">
                <thead className="bg-[#F8FAFC] text-[#1E293B] font-bold border-b border-slate-200">
                  <tr>
                    {headerCells.map((h, hIdx) => (
                      <th
                        key={hIdx}
                        className="py-2.5 px-3 whitespace-nowrap text-[11px] uppercase tracking-wider text-[#101A3D] font-bold border-r border-slate-200 last:border-r-0"
                      >
                        {renderInlineContent(h, `th-${i}-${hIdx}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rowData.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className={
                        rIdx % 2 === 1
                          ? 'bg-slate-50/70 hover:bg-teal-50/30 transition-colors'
                          : 'bg-white hover:bg-teal-50/30 transition-colors'
                      }
                    >
                      {row.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className="py-2 px-3 align-top leading-relaxed text-[#334155] border-r border-slate-100 last:border-r-0"
                        >
                          {renderInlineContent(cell, `td-${i}-${rIdx}-${cIdx}`)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
          continue;
        }
      }

      // 2. Headings
      if (trimmed.startsWith('### ')) {
        nodes.push(
          <h4
            key={`h4-${i}`}
            className="font-bold text-xs sm:text-sm text-[#101A3D] mt-3.5 mb-1 flex items-center gap-1.5"
          >
            <span className="w-1.5 h-3.5 rounded-full bg-[#0F9D8C]" />
            {renderInlineContent(trimmed.slice(4), `h4-${i}`)}
          </h4>
        );
        i++;
        continue;
      }

      if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
        const titleText = trimmed.replace(/^#+\s*/, '');
        nodes.push(
          <h3
            key={`h3-${i}`}
            className="font-bold text-sm sm:text-base text-[#101A3D] mt-4 mb-1.5 pb-1 border-b border-slate-200"
          >
            {renderInlineContent(titleText, `h3-${i}`)}
          </h3>
        );
        i++;
        continue;
      }

      // Standalone bold badge title e.g. **Projects with cost escalation > 30%**
      if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4 && !trimmed.includes('\n')) {
        const content = trimmed.slice(2, -2).trim();
        nodes.push(
          <div
            key={`section-badge-${i}`}
            className="font-bold text-xs sm:text-sm text-[#101A3D] mt-3 mb-2 px-3 py-1.5 rounded-md bg-[#E6F6F4] text-[#0F9D8C] border border-[#0F9D8C]/30 flex items-center gap-2 shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#0F9D8C] shrink-0" />
            <span>{renderInlineContent(content, `badge-${i}`)}</span>
          </div>
        );
        i++;
        continue;
      }

      // 3. Bullet points (• or - or *)
      if (/^[•\-\*]\s+/.test(trimmed)) {
        const bulletText = trimmed.replace(/^[•\-\*]\s+/, '');
        const isIndented = line.startsWith('  ') || line.startsWith('\t');
        nodes.push(
          <div
            key={`bullet-${i}`}
            className={`flex items-start gap-2 my-1 text-xs sm:text-sm leading-relaxed text-[#334155] ${
              isIndented ? 'ml-4 sm:ml-5' : ''
            }`}
          >
            <span
              className={`rounded-full shrink-0 mt-1.5 ${
                isIndented
                  ? 'w-1 h-1 bg-slate-400'
                  : 'w-1.5 h-1.5 bg-[#0F9D8C] ring-2 ring-[#0F9D8C]/20'
              }`}
            />
            <div className="flex-1">{renderInlineContent(bulletText, `bullet-${i}`)}</div>
          </div>
        );
        i++;
        continue;
      }

      // 4. Numbered list items
      const numMatch = trimmed.match(/^(\d+)[\.\)]\s+(.*)/);
      if (numMatch) {
        nodes.push(
          <div
            key={`num-${i}`}
            className="flex items-start gap-2.5 my-1.5 text-xs sm:text-sm leading-relaxed text-[#334155]"
          >
            <span className="w-4 h-4 rounded-full bg-[#0F9D8C]/15 text-[#0F9D8C] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              {numMatch[1]}
            </span>
            <div className="flex-1">{renderInlineContent(numMatch[2], `num-${i}`)}</div>
          </div>
        );
        i++;
        continue;
      }

      // 5. Empty line spacer
      if (!trimmed) {
        nodes.push(<div key={`spacer-${i}`} className="h-1.5" />);
        i++;
        continue;
      }

      // 6. Regular Paragraph
      nodes.push(
        <p key={`p-${i}`} className="my-1.5 text-xs sm:text-sm leading-relaxed text-[#334155]">
          {renderInlineContent(trimmed, `p-${i}`)}
        </p>
      );
      i++;
    }

    return <div className="space-y-0.5">{nodes}</div>;
  };

  // Derive quick suggestions from the last assistant message
  const lastAssistantMsg = [...messages].reverse().find((m) => m.sender === 'assistant');
  const latestSuggestions: string[] =
    lastAssistantMsg?.suggested_followups && lastAssistantMsg.suggested_followups.length > 0
      ? lastAssistantMsg.suggested_followups
      : lastAssistantMsg?.referenced_project_codes && lastAssistantMsg.referenced_project_codes.length > 0
      ? [
          `What are the key causes of delay in [${lastAssistantMsg.referenced_project_codes[0]}]?`,
          `Show expenditure vs revised cost for referenced projects`,
          `Which projects in this sector have high cost overruns?`,
        ]
      : [
          'Which projects have cost escalation exceeding 30%?',
          'List all Critical risk projects in Maharashtra',
          'Summarize key delay vectors across Ministry of Railways',
        ];

  return (
    <div
      id="ai-assistant-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity duration-200"
      aria-modal="true"
      role="dialog"
      aria-label="Ask AI Assistant"
    >
      <div
        ref={panelRef}
        id="ai-assistant-slideover"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md sm:max-w-xl lg:max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-[#E2E8F0] animate-in slide-in-from-right duration-300"
      >
        {/* Slideover Header */}
        <div className="blurry-grey-header p-4 flex items-center justify-between border-b border-[#E2E8F0]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-[#0F9D8C] flex items-center justify-center text-white shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#101A3D]">
                InfraNetra Risk Intelligence
              </h3>
            </div>
          </div>
          <button
            id="btn-close-ai-assistant"
            type="button"
            onClick={handleClose}
            aria-label="Close Ask AI Assistant"
            title="Close (Esc or click outside)"
            className="text-slate-500 hover:text-[#101A3D] p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0F9D8C]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#F8FAFC]">
          {messages.map((msg) => {
            const followUpsToDisplay =
              msg.suggested_followups && msg.suggested_followups.length > 0
                ? msg.suggested_followups
                : msg.referenced_project_codes && msg.referenced_project_codes.length > 0
                ? [
                    `What are the key causes of delay in [${msg.referenced_project_codes[0]}]?`,
                    `Show expenditure vs revised cost comparison for referenced projects`,
                    `Which other projects in this sector have high cost overruns?`,
                  ]
                : [
                    'Which projects have cost escalation exceeding 30%?',
                    'List all Critical risk projects in Maharashtra',
                    'Summarize key delay vectors across Ministry of Railways',
                  ];

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  {msg.sender === 'user' ? (
                    <span className="text-[10px] font-semibold text-[#64748B]">
                      You · {msg.timestamp}
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-[#0F9D8C] flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#0F9D8C]" />
                      InfraNetra · {msg.timestamp}
                    </span>
                  )}
                </div>

                <div
                  className={`p-3.5 rounded-lg text-sm ${
                    msg.sender === 'user'
                      ? 'blurry-grey-card text-[#101A3D] rounded-br-none shadow-xs font-medium max-w-[88%]'
                      : 'bg-white text-[#1E293B] border border-[#E2E8F0] rounded-bl-none shadow-xs max-w-full sm:max-w-[98%]'
                  }`}
                >
                  {msg.sender === 'assistant' ? (
                    renderMessageContent(msg.text)
                  ) : (
                    <p className="whitespace-pre-line text-xs sm:text-sm">{msg.text}</p>
                  )}

                  {/* Clickable Referenced Projects Chips */}
                  {msg.referenced_project_codes && msg.referenced_project_codes.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-[#E2E8F0] flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-semibold uppercase text-[#64748B] mr-1">
                        Referenced Projects:
                      </span>
                      {msg.referenced_project_codes.map((code) => (
                        <button
                          key={code}
                          onClick={() => {
                            onSelectProject(code);
                            handleClose();
                          }}
                          className="text-[11px] font-mono-code font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-[#0F9D8C] hover:text-white text-[#101A3D] transition-colors border border-slate-300 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>{code}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Follow-up Question suggestions */}
                {msg.sender === 'assistant' && followUpsToDisplay.length > 0 && (
                  <div className="mt-2.5 pl-1 space-y-1.5 w-full max-w-[96%] animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#0F9D8C]">
                      <Sparkles className="w-3 h-3 text-[#0F9D8C]" />
                      <span>Suggested Inquiries:</span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {followUpsToDisplay.map((followUp, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSendMessage(followUp)}
                          className="text-left text-xs text-[#0F9D8C] hover:text-[#0b7569] bg-white hover:bg-[#E6F6F4] px-3 py-2 rounded-lg transition-all border border-[#0F9D8C]/25 hover:border-[#0F9D8C]/50 shadow-2xs flex items-center justify-between group cursor-pointer"
                        >
                          <span className="leading-snug">{followUp}</span>
                          <span className="text-[#0F9D8C] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-sm ml-1.5 font-bold shrink-0">
                            ›
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 p-3 bg-white border border-[#E2E8F0] rounded-lg w-max text-xs text-[#64748B]">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#0F9D8C]" />
              <span>Synthesizing cross-ministry data from Flash Report...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Pills Bar above Input */}
        {latestSuggestions.length > 0 && !isTyping && (
          <div className="px-3 pt-2 pb-1.5 bg-slate-50/90 border-t border-[#E2E8F0] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-[#64748B] whitespace-nowrap flex items-center gap-1 shrink-0">
              <Sparkles className="w-3 h-3 text-[#0F9D8C]" />
              Quick:
            </span>
            {latestSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(suggestion)}
                className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-[#E6F6F4] text-[#1E293B] hover:text-[#0F9D8C] border border-[#CBD5E1] hover:border-[#0F9D8C]/50 transition-all cursor-pointer shrink-0 shadow-2xs font-medium"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-[#E2E8F0]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              id="ai-assistant-input"
              type="text"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder="Ask about project risks, cost overruns, contractors..."
              disabled={isTyping}
              className="flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-lg border border-[#CBD5E1] focus:outline-none focus:border-[#0F9D8C] text-[#1E293B]"
            />
            <button
              id="ai-assistant-send-btn"
              type="submit"
              disabled={!inputQuestion.trim() || isTyping}
              className="px-3.5 py-2.5 rounded-lg bg-[#0F9D8C] hover:bg-[#0d8778] text-white disabled:opacity-40 transition-colors shadow-xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

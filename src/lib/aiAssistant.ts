import { Lead, Filters, FilterOptions } from '../types.ts';

export interface AICommandResult {
  action: 'search' | 'create' | 'update' | 'delete' | 'restore' | 'show_deleted' | 'show_revived' | 'unlock' | 'chat';
  explanation: string;
  // Search payload
  searchQuery?: string;
  filterUpdates?: Partial<Filters>;
  matchingLeadIds?: number[];
  // Create payload
  newLeadData?: Partial<Lead>;
  // Update payload
  targetLeadId?: number;
  targetLeadName?: string;
  updateData?: Partial<Lead>;
  // Delete payload
  deleteLeadId?: number;
  deleteLeadName?: string;
}

export interface ChatHistoryItem {
  sender: 'user' | 'assistant';
  text: string;
}

/**
 * Helper to scan chat history backwards and resolve the last referenced/created/updated lead object.
 */
function extractLastMentionedLeadFromHistory(chatHistory: ChatHistoryItem[], allLeads: Lead[]): Lead | undefined {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const text = chatHistory[i].text;
    
    // Look for ID pattern e.g. lead #12
    const idMatch = text.match(/(?:lead|#)\s*#?(\d+)/i);
    if (idMatch) {
      const found = allLeads.find(l => l.id === parseInt(idMatch[1]));
      if (found) return found;
    }

    // Look for quoted names e.g. "Yas Na" or "Yash"
    const nameMatch = text.match(/"([A-Za-z0-9\s]+)"/);
    if (nameMatch) {
      const targetName = nameMatch[1].trim().toLowerCase();
      if (targetName && !['create', 'update', 'delete', 'chat', 'search'].includes(targetName)) {
        const found = allLeads.find(l => {
          const full = `${l.firstName} ${l.lastName && l.lastName !== '-' ? l.lastName : ''}`.trim().toLowerCase();
          return full === targetName || l.firstName.toLowerCase() === targetName || (l.email && l.email.toLowerCase() === targetName);
        });
        if (found) return found;
      }
    }

    // Scan for lead first names in history text
    for (const lead of allLeads) {
      const fName = (lead.firstName || '').toLowerCase();
      if (fName.length > 2 && text.toLowerCase().includes(fName)) {
        return lead;
      }
    }
  }
  return undefined;
}

/**
 * Process any natural language input string with full ChatGPT-level key-value, informal text & conversation history scanning:
 * - "name is yash" -> strips "is" -> firstName: "Yash", lastName: "-"
 * - "name is Yash Daxini" -> strips "is" -> firstName: "Yash", lastName: "Daxini"
 * - Handles key-value prompts like "insert name yas na,organisation bitm,gmail hlo@gmail"
 */
export async function processNaturalLanguageCommand(
  prompt: string,
  allLeads: Lead[],
  filterOptions: FilterOptions,
  chatHistory: ChatHistoryItem[] = [],
  activeLeadsOnPage: Lead[] = []
): Promise<AICommandResult> {
  const cleanPrompt = prompt.trim();

  const leadsContext = activeLeadsOnPage.length > 0 ? activeLeadsOnPage : allLeads;

  // Try Gemini AI API if key is available
  const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : '');
  
  if (apiKey) {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });

      const topCompanies = Array.from(new Set(leadsContext.map(l => l.organization).filter(Boolean))).slice(0, 15).join(', ');
      const topCities = Array.from(new Set(leadsContext.map(l => l.city).filter(Boolean))).slice(0, 15).join(', ');
      const sampleLeads = leadsContext.slice(0, 5).map(l => `#${l.id}: ${l.firstName} ${l.lastName || ''} (${l.jobTitle || '-'} at ${l.organization || '-'}, ${l.city || '-'})`).join(' | ');

      const systemInstruction = `
You are a ChatGPT-level intelligent AI Assistant for a B2B Lead Intelligence Platform.
You have FULL context of conversation history.

NAME EXTRACTION RULES:
- If user types "name is yash" or "name yash": firstName MUST be "Yash", lastName MUST be "-".
- If user types "name is Yash Daxini" or "name Yash Daxini": firstName MUST be "Yash", lastName MUST be "Daxini".
- Always strip filler words like "is", "are", "as", "=", ":".

EMAIL EXTRACTION RULES:
- Extract full or casual emails (e.g. "gmail hlo@gmail", "email hlo@gmail.com", "hlo@gmail"). If .com is missing from domain, append ".com".

Return ONLY a JSON object with this exact shape:
{
  "action": "search" | "create" | "update" | "delete" | "restore" | "show_revived" | "show_deleted" | "chat",
  "explanation": "Detailed, natural response or explanation answering the user's prompt using conversation history & page data",
  "searchQuery": "string keyword if search",
  "filterUpdates": { "search": "", "cities": [], "companies": [], "jobTitles": [] },
  "newLeadData": { "firstName": "-", "lastName": "-", "email": "-", "organization": "-", "jobTitle": "-", "city": "-", "phone": "-", "questions": "-" },
  "targetLeadId": 123,
  "targetLeadName": "string",
  "matchingLeadIds": [1, 2, 3],
  "updateData": { "email": "", "organization": "", "jobTitle": "", "city": "", "phone": "", "approvalStatus": "" },
  "deleteLeadId": 123
}
`;

      const contents: any[] = chatHistory.slice(-6).map(item => ({
        role: item.sender === 'user' ? 'user' : 'model',
        parts: [{ text: item.text }]
      }));

      contents.push({
        role: 'user',
        parts: [{ text: `User Prompt: "${cleanPrompt}"\n\nPage & Database Context:\n- Visible Leads on Page: ${leadsContext.length}\n- Top Companies: ${topCompanies}\n- Top Cities: ${topCities}\n- Sample Leads: ${sampleLeads}` }]
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        }
      });

      if (response.text) {
        const parsed = JSON.parse(response.text);
        if (parsed && parsed.action) {
          if (parsed.action === 'create' && parsed.newLeadData) {
            parsed.newLeadData.firstName = parsed.newLeadData.firstName || '-';
            parsed.newLeadData.lastName = parsed.newLeadData.lastName || '-';
            parsed.newLeadData.email = parsed.newLeadData.email || '-';
            parsed.newLeadData.organization = parsed.newLeadData.organization || '-';
            parsed.newLeadData.jobTitle = parsed.newLeadData.jobTitle || '-';
            parsed.newLeadData.city = parsed.newLeadData.city || '-';
            parsed.newLeadData.phone = parsed.newLeadData.phone || '-';
            parsed.newLeadData.questions = parsed.newLeadData.questions || '-';
          }
          return parsed as AICommandResult;
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to local NLP & context engine:', err);
    }
  }

  // Fallback: ChatGPT-Style Client-side Key-Value & Natural Language Entity Parser
  return parseCommandLocally(cleanPrompt, allLeads, filterOptions, chatHistory, leadsContext);
}

/**
 * ChatGPT-Style Ultra-Flexible Natural Language & Entity Extractor with Chat History Scanner
 */
function parseCommandLocally(
  prompt: string,
  allLeads: Lead[],
  filterOptions: FilterOptions,
  chatHistory: ChatHistoryItem[],
  leadsContext: Lead[]
): AICommandResult {
  const clean = prompt.trim();
  const lower = clean.toLowerCase();

  const lastMentioned = extractLastMentionedLeadFromHistory(chatHistory, allLeads);

  // 1. INTENT: SHOW / QUERY INTENTS
  const containsQueryWord = /\b(show|list|view|display|which|what|tell|see|get|check)\b/i.test(clean) ||
                            /(?:show|list|view|display)\s*$/i.test(clean);

  if (containsQueryWord) {
    if (/\b(revive|revived|restore|restored|recovered|un-deleted|undeleted)\b/i.test(clean)) {
      return {
        action: 'show_revived',
        explanation: `Viewing list of recently revived/restored lead records.`
      };
    }

    if (/\b(deleted|delete|trash|removed|erased|dropped|earlier)\b/i.test(clean)) {
      return {
        action: 'show_deleted',
        explanation: `Viewing list of earlier & recently deleted lead records.`
      };
    }
  }

  // 2. INTENT: EXECUTE RESTORE / REVIVE DELETED LEADS
  const isRestore = /\b(revive|restore|undo|bring back|recover|un-delete|undelete|cancel delete|no revive|get back|bring all back)\b/i.test(clean) &&
    !containsQueryWord;

  if (isRestore) {
    return {
      action: 'restore',
      explanation: `Understood restore/revive command. Restoring all recently deleted lead records back into the database.`
    };
  }

  // 3. INTENT: DELETE RECORD
  const isDelete = /\b(delete|remove|drop|erase|trash|get rid of)\b/i.test(clean);
  if (isDelete) {
    const idMatch = clean.match(/(?:lead|id|#)\s*#?(\d+)/i);
    if (idMatch) {
      const delId = parseInt(idMatch[1]);
      const lead = allLeads.find(l => l.id === delId);
      return {
        action: 'delete',
        explanation: `Understood delete command for lead #${delId}.`,
        deleteLeadId: delId,
        deleteLeadName: lead ? `${lead.firstName} ${lead.lastName && lead.lastName !== '-' ? lead.lastName : ''}` : `Lead #${delId}`
      };
    }

    if (/\b(it|this|that|him|her|same)\b/i.test(clean) && lastMentioned) {
      return {
        action: 'delete',
        explanation: `Deleting lead #${lastMentioned.id} (${lastMentioned.firstName} ${lastMentioned.lastName || ''}) from previous chat context.`,
        deleteLeadId: lastMentioned.id,
        deleteLeadName: `${lastMentioned.firstName} ${lastMentioned.lastName || ''}`
      };
    }

    let deleteCondition = clean
      .replace(/\b(delete|remove|drop|erase|trash|get rid of|all|leads|lead|contacts|contact|records|record|where|with|named|called|is|are|equal|to|the)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const fnMatch = clean.match(/(?:first\s*name|name)\s*(?:is|=|:)?\s*([A-Za-z0-9._-]+)/i);
    let targetNameOrVal = fnMatch ? fnMatch[1].trim().toLowerCase() : deleteCondition.toLowerCase();

    const matchingIds = allLeads.filter(l => {
      const fName = (l.firstName || '').toLowerCase();
      const lName = (l.lastName || '').toLowerCase();
      const full = `${fName} ${lName}`.trim();
      const org = (l.organization || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      const city = (l.city || '').toLowerCase();

      if (targetNameOrVal === 'as' && (fName === 'as' || fName === '-')) return true;
      if (fName === targetNameOrVal || lName === targetNameOrVal || full === targetNameOrVal) return true;
      if (email === targetNameOrVal || email.includes(targetNameOrVal)) return true;
      if (org === targetNameOrVal || city === targetNameOrVal) return true;

      const fullStr = `${full} ${org} ${email} ${city}`.toLowerCase();
      return deleteCondition.length > 0 && fullStr.includes(deleteCondition.toLowerCase());
    }).map(l => l.id);

    return {
      action: 'delete',
      explanation: `Identified deletion request for "${deleteCondition || targetNameOrVal}". Found ${matchingIds.length} matching lead record(s) to delete.`,
      matchingLeadIds: matchingIds
    };
  }

  // 4. INTENT: CREATE NEW RECORD
  const isCreate = /\b(add|create|insert|new lead|new contact|register|save lead)\b/i.test(clean);
  if (isCreate) {
    const newLeadData = parseLeadEntitiesFromText(clean);

    const displayName = newLeadData.lastName && newLeadData.lastName !== '-'
      ? `${newLeadData.firstName} ${newLeadData.lastName}`
      : `${newLeadData.firstName}`;

    return {
      action: 'create',
      explanation: `Parsed record for "${displayName}". Organization: "${newLeadData.organization}", Email: "${newLeadData.email}".`,
      newLeadData
    };
  }

  // 5. INTENT: UPDATE EXISTING RECORD
  const isUpdate = /\b(update|change|modify|set|edit|rename)\b/i.test(clean);
  if (isUpdate) {
    let targetLeadId: number | undefined = undefined;
    const idMatch = clean.match(/(?:lead|id|#)\s*#?(\d+)/i);
    if (idMatch) {
      targetLeadId = parseInt(idMatch[1]);
    }

    let targetLeadName: string | undefined = undefined;
    if (!targetLeadId) {
      const targetMatch = clean.match(/(?:for|lead|contact)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
      if (targetMatch) targetLeadName = targetMatch[1].trim();
    }

    let targetLead: Lead | undefined = undefined;
    if (targetLeadId) {
      targetLead = allLeads.find(l => l.id === targetLeadId);
    } else if (targetLeadName) {
      targetLead = allLeads.find(l => `${l.firstName} ${l.lastName || ''}`.toLowerCase().includes(targetLeadName!.toLowerCase()));
    } else if (lastMentioned) {
      targetLead = lastMentioned;
    } else {
      targetLead = leadsContext[0] || allLeads[0];
    }

    const updateData: Partial<Lead> = {};

    const emailMatch = clean.match(/(?:email|gmail)\s*(?:to|:|=)?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/i);
    if (emailMatch) {
      const captured = emailMatch[1].trim();
      updateData.email = captured.includes('.') ? captured : `${captured}.com`;
    }

    const cityMatch = clean.match(/\b(?:city|location)\b\s*(?:to|:|=)?\s*([A-Za-z\s]+?)(?:,|\.|$|\s+and)/i);
    if (cityMatch) updateData.city = cityMatch[1].trim();

    const orgMatch = clean.match(/\b(?:company|organization|organisation|oranisation|org)\b\s*(?:to|:|=)?\s*([A-Za-z0-9\s&]+?)(?:,|\.|$|\s+and)/i);
    if (orgMatch) updateData.organization = orgMatch[1].trim();

    const titleMatch = clean.match(/\b(?:title|role|job)\b\s*(?:to|:|=)?\s*([A-Za-z0-9\s&]+?)(?:,|\.|$|\s+and)/i);
    if (titleMatch) updateData.jobTitle = titleMatch[1].trim();

    if (lower.includes('approved') || lower.includes('approve')) updateData.approvalStatus = 'approved';
    if (lower.includes('denied') || lower.includes('deny')) updateData.approvalStatus = 'denied';

    if (targetLead) {
      return {
        action: 'update',
        explanation: `Understood update command for lead #${targetLead.id} (${targetLead.firstName} ${targetLead.lastName && targetLead.lastName !== '-' ? targetLead.lastName : ''}). Fields to update: ${Object.keys(updateData).join(', ')}.`,
        targetLeadId: targetLead.id,
        targetLeadName: `${targetLead.firstName} ${targetLead.lastName && targetLead.lastName !== '-' ? targetLead.lastName : ''}`,
        updateData
      };
    }
  }

  // 6. INTENT: GENERAL QUESTIONS / CONVERSATIONAL
  const isGeneralQuestion = 
    /\b(what|how|why|tell|explain|summarize|summary|who|list|which|count|many|detail)\b/i.test(clean) ||
    lower.includes('previous') || lower.includes('before') || lower.includes('above') || lower.includes('page');

  if (isGeneralQuestion) {
    const prevTurn = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1] : null;
    const count = leadsContext.length;
    const companies = Array.from(new Set(leadsContext.map(l => l.organization).filter(b => b && b !== '-')));
    const cities = Array.from(new Set(leadsContext.map(l => l.city).filter(b => b && b !== '-')));
    const roles = Array.from(new Set(leadsContext.map(l => l.jobTitle).filter(b => b && b !== '-')));

    let chatResponse = '';

    if (lower.includes('summarize') || lower.includes('summary')) {
      chatResponse = `Here is a summary of the ${count} leads currently displayed on the page:\n- Companies: ${companies.slice(0, 6).join(', ') || '-'}\n- Primary Locations: ${cities.slice(0, 6).join(', ') || '-'}\n- Core Roles: ${roles.slice(0, 6).join(', ') || '-'}`;
    } else if (lower.includes('company') || lower.includes('companies')) {
      chatResponse = `The leads currently on your page belong to the following companies:\n${companies.map(c => `• ${c}`).join('\n') || 'No explicit companies listed.'}`;
    } else if (lower.includes('city') || lower.includes('cities') || lower.includes('location')) {
      chatResponse = `Locations represented on the current page view:\n${cities.map(c => `• ${c}`).join('\n') || 'No explicit locations listed.'}`;
    } else if (lower.includes('how many') || lower.includes('count')) {
      const approved = leadsContext.filter(l => l.approvalStatus === 'approved').length;
      const saved = leadsContext.filter(l => l.isSaved).length;
      chatResponse = `Currently showing ${count} total leads on the page (${approved} approved, ${saved} saved).`;
    } else if (lastMentioned) {
      chatResponse = `Regarding your recent lead ${lastMentioned.firstName} ${lastMentioned.lastName && lastMentioned.lastName !== '-' ? lastMentioned.lastName : ''} (#${lastMentioned.id}):\n- Organization: ${lastMentioned.organization || '-'}\n- Job Title: ${lastMentioned.jobTitle || '-'}\n- Email: ${lastMentioned.email || '-'}\n- City: ${lastMentioned.city || '-'}`;
    } else if (prevTurn) {
      chatResponse = `Based on your previous query ("${prevTurn.text}") and the current ${count} records on page:\n- Top matches include ${leadsContext.slice(0, 3).map(l => `${l.firstName} (${l.jobTitle || '-'} at ${l.organization || '-'})`).join(', ')}.`;
    } else {
      chatResponse = `Currently displaying ${count} leads on page across ${companies.length} companies and ${cities.length} locations. You can ask me to filter, summarize, add new leads, or edit records!`;
    }

    return {
      action: 'chat',
      explanation: chatResponse
    };
  }

  // 7. INTENT: SEARCH & IDENTIFY
  const isSearch = /\b(find|search|show|filter|display|locate|get)\b/i.test(clean) || clean.length > 0;
  if (isSearch) {
    let cleanSearch = clean
      .replace(/\b(find|search|show|me|all|leads|contacts|records|the|where|who|is|are|in|at|with)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const matchingIds = allLeads.filter(l => {
      const fullStr = `${l.firstName || ''} ${l.lastName || ''} ${l.organization || ''} ${l.jobTitle || ''} ${l.city || ''} ${l.email || ''} ${l.approvalStatus || ''}`.toLowerCase();
      const tokens = cleanSearch.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      if (tokens.length === 0) return fullStr.includes(lower);
      return tokens.some(t => fullStr.includes(t));
    }).map(l => l.id);

    return {
      action: 'search',
      explanation: `Identified search query for "${cleanSearch || clean}". Found ${matchingIds.length} matching lead records directly on page.`,
      searchQuery: cleanSearch || clean,
      matchingLeadIds: matchingIds,
      filterUpdates: {
        search: cleanSearch || clean
      }
    };
  }

  return {
    action: 'chat',
    explanation: `I am your Apollo AI Assistant. I can search records, summarize page context, answer questions based on chat history, or edit contacts.`
  };
}

/**
 * ChatGPT-Style Filler-Word Stripping Name & Entity Parser
 */
function parseLeadEntitiesFromText(text: string): Partial<Lead> {
  const cleanText = text.trim();

  // Email extraction
  let email = '-';
  const fullEmailMatch = cleanText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (fullEmailMatch) {
    email = fullEmailMatch[0];
  } else {
    const casualEmailMatch = cleanText.match(/(?:email|gmail|mail)\s*[:=]?\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)/i);
    if (casualEmailMatch && casualEmailMatch[1]) {
      const captured = casualEmailMatch[1].trim();
      email = captured.includes('.') ? captured : `${captured}.com`;
    } else {
      const orphanEmailMatch = cleanText.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)\b/);
      if (orphanEmailMatch && orphanEmailMatch[1]) {
        const captured = orphanEmailMatch[1].trim();
        email = captured.includes('.') ? captured : `${captured}.com`;
      }
    }
  }

  const phoneMatch = cleanText.match(/\b\+?\d{1,4}?[-.\s]?\(?\d{1,3}?\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/);
  const phone = phoneMatch ? phoneMatch[0] : '-';

  let org = '-';
  const orgMatch = cleanText.match(/\b(?:organization|organisation|oranisation|company|org|firm|employer)\b\s*[:=]?\s*([A-Za-z0-9._\s-&]+?)(?:,|$|\s+\b(?:email|gmail|mail|phone|city|location|title|role|job|name)\b)/i);
  if (orgMatch && orgMatch[1] && orgMatch[1].trim()) {
    let candidate = orgMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();
    if (!['lead', 'contact', 'name', 'new'].includes(candidate.toLowerCase())) {
      org = candidate;
    }
  }

  let title = '-';
  const titleMatch = cleanText.match(/\b(?:title|role|job|designation|position)\b\s*[:=]?\s*([A-Za-z0-9._\s-&]+?)(?:,|$|\s+\b(?:email|gmail|mail|phone|city|location|company|org|organisation|oranisation|name)\b)/i);
  if (titleMatch && titleMatch[1] && titleMatch[1].trim()) {
    let candidate = titleMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();
    if (!['lead', 'contact', 'name', 'new'].includes(candidate.toLowerCase())) {
      title = candidate;
    }
  }

  let city = '-';
  const cityMatch = cleanText.match(/\b(?:city|location|town|based in)\b\s*[:=]?\s*([A-Za-z\s]+?)(?:,|$|\s+\b(?:email|gmail|mail|phone|company|org|organisation|oranisation|role|title|job|name)\b)/i);
  if (cityMatch && cityMatch[1] && cityMatch[1].trim()) {
    let candidate = cityMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();
    if (!['lead', 'contact', 'name', 'new'].includes(candidate.toLowerCase())) {
      city = candidate;
    }
  }

  let firstName = '-';
  let lastName = '-';

  // 1. Explicit name field match: e.g. "name is yash", "name: Yash Daxini", "first name is yash"
  const explicitNameMatch = cleanText.match(/\b(?:full\s*name|contact\s*name|lead\s*name|first\s*name|name)\b\s*[:=]?\s*([A-Za-z0-9._\s-]+?)(?:,|$|\s+\b(?:organization|organisation|oranisation|company|org|firm|email|gmail|mail|phone|city|location|title|role|job)\b)/i);
  
  if (explicitNameMatch && explicitNameMatch[1] && explicitNameMatch[1].trim()) {
    let nameVal = explicitNameMatch[1].trim();
    nameVal = nameVal.replace(/^(?:is|are|as|to|=|\s)+/i, '').replace(/[,:=]+$/, '').trim();

    if (nameVal && !['lead', 'contact', 'new', 'as'].includes(nameVal.toLowerCase())) {
      const parts = nameVal.split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        firstName = parts[0];
        lastName = '-';
      } else if (parts.length >= 2) {
        firstName = parts[0];
        lastName = parts.slice(1).join(' ');
      }
    }
  }

  // 2. Freeform name match: e.g. "insert Yash Daxini company reva" or "add lead Yash"
  if (firstName === '-') {
    const freeformMatch = cleanText.match(/\b(?:add|create|insert|save)\b\s+(?:a\s+)?(?:new\s+)?(?:lead|contact)?\s*(?:as\s+)?([A-Za-z]+(?:\s+[A-Za-z]+)?)/i);
    if (freeformMatch && freeformMatch[1]) {
      let rawVal = freeformMatch[1].trim().replace(/^(?:is|are|as|to|=|\s)+/i, '').trim();
      const parts = rawVal.split(/\s+/).filter(Boolean);
      if (parts.length > 0 && !['name', 'lead', 'contact', 'as', 'new'].includes(parts[0].toLowerCase())) {
        if (parts.length === 1) {
          firstName = parts[0];
          lastName = '-';
        } else if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }
      }
    }
  }

  // 3. Email username fallback
  if (firstName === '-' && email !== '-') {
    const uname = email.split('@')[0].replace(/[^a-zA-Z]/g, ' ');
    const parts = uname.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      if (parts.length > 1) {
        lastName = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
      } else {
        lastName = '-';
      }
    }
  }

  if (firstName !== '-') {
    firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
  }
  if (lastName !== '-' && lastName !== '') {
    lastName = lastName.charAt(0).toUpperCase() + lastName.slice(1);
  } else {
    lastName = '-';
  }

  return {
    firstName,
    lastName,
    email,
    organization: org,
    jobTitle: title,
    city,
    phone,
    approvalStatus: 'approved',
    questions: '-'
  };
}

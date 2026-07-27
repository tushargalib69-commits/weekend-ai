
function show(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(t => t.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
  window.scrollTo(0, 0);
}
function goToPlan() {
  const val = document.getElementById('hero-input').value.trim();
  if (val) document.getElementById('dest').value = val;
  show('plan');
}
function setAndPlan(name) {
  document.getElementById('dest').value = name;
  show('plan');
}

async function callAI(system, userMsg, history) {
  const messages = history ? [...history, {role:'user', content: userMsg}] : [{role:'user', content: userMsg}];
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ system, messages })
  });
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function stripJsonWrapper(raw) {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '');
  text = text.replace(/\s*```$/i, '');
  return text.trim();
}

function parsePlanFromText(raw) {
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const days = [];
  let currentDay = null;

  lines.forEach(line => {
    const dayMatch = line.match(/^Day\s*(\d+)\s*[:\-]?\s*(.*)$/i);
    if (dayMatch) {
      currentDay = { title: `Day ${dayMatch[1]}${dayMatch[2] ? ': ' + dayMatch[2] : ''}`, items: [] };
      days.push(currentDay);
      return;
    }

    const itemMatch = line.match(/^(?:\d+[:\.)]?|[-•*])\s*["“]?(.+?)["”]?\s*(?:\(.+?\))?\s*(?:-\s*.*)?$/);
    if (itemMatch && currentDay) {
      const rawItem = itemMatch[1].trim();
      const cleanedItem = rawItem.replace(/\s*\([^)]+\)$/, '').replace(/\s*-\s*OK$/i, '').trim();
      if (cleanedItem) currentDay.items.push(cleanedItem);
      return;
    }

    if (currentDay && line.length > 0 && !/^Total|Budget|Cost|Estimated/i.test(line)) {
      currentDay.items.push(line.replace(/\s*\([^)]+\)$/, '').trim());
    }
  });

  if (!days.length || days.every(day => day.items.length === 0)) return null;
  return { days, totalCost: null };
}

async function generatePlan() {
  const origin   = document.getElementById('origin').value;
  const dest     = document.getElementById('dest').value.trim() || "Cox's Bazar";
  const duration = document.getElementById('duration').value;
  const budget   = document.getElementById('budget').value || '8000';
  const travelers= document.getElementById('travelers').value;
  const style    = document.getElementById('style').value;

  const btn    = document.getElementById('gen-btn');
  const loader = document.getElementById('loading');
  const result = document.getElementById('ai-result');
  btn.disabled = true;
  loader.style.display = 'block';
  result.style.display = 'none';

  const system = `You are Weekend AI, a travel planning assistant for Bangladesh.
Reply as a planner with a complete, human-readable itinerary for the entire trip.
Include preferred budgeted resources for travel, transport, accommodation, meals, activities, and local expenses.
Provide a full day-by-day schedule with clear headings, time order, and realistic cost estimates in BDT.
If the requested origin or destination is outside Bangladesh, reply in slang Bangla/English telling the user the trip must start and end within Bangladesh. Do not make a plan.
Do not return JSON, markdown fences, code blocks, or any extra wrapper.
Do not stop early; continue until the full trip plan is complete.
Return only the plain travel plan text, nothing else.`;

  const userMsg = `Plan a ${duration} trip from ${origin} to ${dest} for ${travelers}. Budget ৳${budget} BDT. Style: ${style}.`;
  let raw = '';

  try {
    raw = stripJsonWrapper(await callAI(system, userMsg, null));
    lastPlanText = raw;
    console.log('Raw AI response:', raw);

    const escaped = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    document.getElementById('plan-content').innerHTML = `<pre style="white-space:pre-wrap;font-size:14px;color:#333;margin:0;">${escaped}</pre>`;
    document.getElementById('plan-cost').textContent = `৳${budget}`;
    document.getElementById('download-btn').style.display = 'inline-flex';
    result.style.display = 'block';
  } catch(e) {
    console.error('Plan error:', e);
    lastPlanText = raw || String(e.message);
    document.getElementById('plan-content').textContent = lastPlanText;
    document.getElementById('plan-cost').textContent = `৳${budget}`;
    document.getElementById('download-btn').style.display = 'inline-flex';
    result.style.display = 'block';
  }

  btn.disabled = false;
  loader.style.display = 'none';
}

let lastPlanText = '';
const chatHistory = [];

async function loadJsPDF() {
  if (window.jspdf || window.jsPDF) {
    return window.jspdf || window.jsPDF;
  }

  return new Promise((resolve, reject) => {
    const src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.jspdf || window.jsPDF));
      existing.addEventListener('error', () => reject(new Error('Failed to load jsPDF library')));
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(window.jspdf || window.jsPDF);
    script.onerror = () => reject(new Error('Failed to load jsPDF library'));
    document.head.appendChild(script);
  });
}

async function downloadPlan() {
  const text = lastPlanText || document.getElementById('plan-content').textContent || 'Weekend AI plan';
  if (!text) return;

  let jspdfLib;
  try {
    jspdfLib = await loadJsPDF();
  } catch (err) {
    alert('PDF library failed to load. Please refresh and try again.');
    console.error(err);
    return;
  }

  const jsPDFClass = jspdfLib.jsPDF || jspdfLib;
  const doc = new jsPDFClass({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const fontSize = 11;
  doc.setFontSize(fontSize);

  const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
  let cursor = margin;

  lines.forEach(line => {
    if (cursor + fontSize * 1.4 > pageHeight - margin) {
      doc.addPage();
      cursor = margin;
    }
    doc.text(line, margin, cursor);
    cursor += fontSize * 1.4;
  });

  doc.save('weekend-ai-plan.pdf');
}

async function sendChat() {
  const inp = document.getElementById('chat-in');
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = '';
  addMsg(msg, 'user');
  await botReply(msg);
}

async function askChat(msg) {
  show('chat');
  setTimeout(() => { addMsg(msg, 'user'); botReply(msg); }, 100);
}

async function botReply(userMsg) {
  const typing = document.getElementById('chat-typing');
  typing.style.display = 'block';
  scrollChat();

  const system = `You are Weekend AI's friendly travel assistant for Bangladesh.
Help with destinations, hotels, transport, food, budgets.
Be concise (2-4 sentences), warm, practical.
Support Bangla and English — reply in the same language the user writes in.
Use emojis occasionally.`;

  chatHistory.push({role:'user', content: userMsg});

  try {
    const text = await callAI(system, userMsg, chatHistory);
    const reply = text || "Let me help you with that! Could you share more details?";
    chatHistory.push({role:'assistant', content: reply});
    typing.style.display = 'none';
    addMsg(reply, 'bot');
  } catch(e) {
    typing.style.display = 'none';
    console.error('Chat error:', e);
    addMsg("Connection issue. Make sure the server is running! 🙏", 'bot');
  }
}

function addMsg(text, type) {
  const msgs = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = `msg msg-${type}`;
  div.textContent = text;
  msgs.appendChild(div);
  scrollChat();
}

function scrollChat() {
  const msgs = document.getElementById('chat-msgs');
  msgs.scrollTop = msgs.scrollHeight;
}

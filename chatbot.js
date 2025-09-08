// chatbot.js

(function(){
  const toggleBtn = document.getElementById("chatbotToggle");
  const panel = document.getElementById("chatbotPanel");
  const closeBtn = document.getElementById("chatbotClose");
  const chatHistory = document.getElementById("chatHistory");
  const chatPrompt = document.getElementById("chatPrompt");
  const chatSend = document.getElementById("chatSend");
  const translated = document.getElementById("translated");
  const extracted = document.getElementById("extracted");
  const settingsBtn = document.getElementById("chatbotSettingsBtn");
  const settingsPane = document.getElementById("chatbotSettings");
  const geminiKeyInput = document.getElementById("geminiKey");
  const saveGeminiBtn = document.getElementById("saveGemini");
  const clearGeminiBtn = document.getElementById("clearGemini");
  const useGeminiExplain = document.getElementById("useGeminiExplain");

  if(!toggleBtn || !panel) return;

  function openPanel(){ panel.style.display = "flex"; chatPrompt.focus(); ensureSeedIntro(); }
  function closePanel(){ panel.style.display = "none"; }

  toggleBtn.addEventListener("click", ()=>{
    if(panel.style.display === "flex") { closePanel(); return; }
    openPanel();
    if(!translated) return;
    const txt = (translated.value || "").trim();
    // Only auto-explain if history is empty and we have text
    if(txt && chatHistory.children.length === 1) {
      addMessage("user", "Explain this translation.");
      respondToTranslation(txt, "explain");
    }
  });
  closeBtn && closeBtn.addEventListener("click", closePanel);
  // Settings button hidden; keep pane accessible only via code for now

  // Load from config.js and URL parameter; no localStorage requirement
  const urlKey = new URLSearchParams(location.search).get("gemini") || "";
  const cfg = (window.APP_CONFIG || {});
  if(cfg.geminiKey || urlKey){ geminiKeyInput.value = urlKey || cfg.geminiKey; }
  if(cfg.useGeminiExplain){ useGeminiExplain.checked = true; }
  saveGeminiBtn && saveGeminiBtn.addEventListener("click", ()=>{
    // Session-only: keep in memory
    window.APP_CONFIG = window.APP_CONFIG || {};
    window.APP_CONFIG.geminiKey = geminiKeyInput.value.trim();
    window.APP_CONFIG.useGeminiExplain = !!useGeminiExplain.checked;
    alert("Saved for this session");
  });
  clearGeminiBtn && clearGeminiBtn.addEventListener("click", ()=>{
    if(window.APP_CONFIG){ window.APP_CONFIG.geminiKey = ""; window.APP_CONFIG.useGeminiExplain = false; }
    geminiKeyInput.value = "";
    useGeminiExplain.checked = false;
  });

  chatSend.addEventListener("click", handleSend);
  chatPrompt.addEventListener("keydown", (e)=>{ if(e.key === "Enter") handleSend(); });

  function handleSend(){
    const q = chatPrompt.value.trim();
    if(!q) return;
    addMessage("user", q);
    chatPrompt.value = "";
    const basis = (translated.value || extracted.value || "").trim();
    if(!basis) {
      addMessage("bot", "No translation yet. Run OCR and Translate first.");
      return;
    }
    const set = window.APP_CONFIG || {};
    if((set.geminiKey || geminiKeyInput.value.trim()) && (set.useGeminiExplain || useGeminiExplain.checked)){
      addMessage("bot", "Thinking with Gemini…");
      const key = (set.geminiKey || geminiKeyInput.value.trim());
      explainWithGemini(key, basis, q).then(ans=>{
        // replace last placeholder message
        chatHistory.lastChild.textContent = ans;
      }).catch(e=>{
        chatHistory.lastChild.textContent = "Gemini error. Falling back to local explanation.";
        respondToTranslation(basis, q);
      });
    } else {
      respondToTranslation(basis, q);
    }
  }

  function addMessage(role, text){
    const div = document.createElement("div");
    div.className = "cb-msg " + (role === "user" ? "user" : "bot");
    div.textContent = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight;
  }

  function ensureSeedIntro(){
    if(chatHistory.children.length === 0){
      addMessage("bot", "Hi! I explain the translated text, provide summaries, keywords, and tone.");
    }
  }

  function respondToTranslation(text, question){
    const explanation = buildHeuristicExplanation(text, question);
    addMessage("bot", explanation);
  }

  function buildHeuristicExplanation(text, question){
    const clean = text.replace(/\s+/g, " ").trim();
    const wordCount = clean.split(/\s+/).filter(Boolean).length;
    const sentences = clean.match(/[^.!?]+[.!?]?/g) || [clean];
    const tone = detectTone(clean);
    const keyPhrases = extractKeyPhrases(clean).slice(0,6);
    const entities = extractEntities(clean).slice(0,8);

    // Build richer summary (<= 3 sentences or 60 words)
    let summary = sentences.slice(0,3).join(" ").trim();
    if(summary.split(/\s+/).length > 60){
      summary = summary.split(/\s+/).slice(0,60).join(" ") + "…";
    }
    if(!summary) summary = clean.slice(0,120) + (clean.length>120?"…":"");

    // Simple paraphrase
    let simple = simplifyText(clean);
    if(simple.toLowerCase() === clean.toLowerCase()){
      simple = "In simple terms, it says: " + summary;
    }

    // Build a more explanatory breakdown
    const details = buildDetailedBreakdown(clean, keyPhrases);

    const parts = [];
    parts.push("Summary: " + summary);
    parts.push("In simple terms: " + simple);
    if(details.length) parts.push("Breakdown:\n- " + details.join("\n- "));
    if(keyPhrases.length) parts.push("Keywords: " + keyPhrases.join(", "));
    if(entities.length) parts.push("Entities: " + entities.join(", "));
    parts.push("Tone: " + tone + " • Length: ~" + wordCount + " words");

    if(question) {
      const q = question.toLowerCase();
      const ans = answerQuestion(clean, q, { summary, simple, keyPhrases, entities, tone });
      if(ans) parts.push("Answer: " + ans);
    }
    return parts.join("\n");
  }

  function simplifyText(text){
    // remove parentheticals and extra clauses after dashes/colons
    let s = text.replace(/\([^\)]*\)/g, "");
    s = s.replace(/\s+-\s+.*$/, "");
    s = s.replace(/:\s+.*$/, ": …");
    // shorten to first sentence or 25 words
    const first = (s.match(/[^.!?]+[.!?]?/) || [s])[0].trim();
    let short = first.split(/\s+/).slice(0,25).join(" ");
    if(first.split(/\s+/).length > 25) short += "…";
    return short;
  }

  function detectTone(text){
    const lower = text.toLowerCase();
    if(/\b(thank|please|appreciat|kindly)\b/.test(lower)) return "polite";
    if(/\b(urgent|immediately|asap|now)\b/.test(lower)) return "urgent";
    if(/\b(error|issue|problem|fail)\b/.test(lower)) return "problem-report";
    if(/\bcongratulation|great|awesome|well done|happy\b/.test(lower)) return "positive";
    if(/\brefund|complain|disappoint|angry|frustrat\b/.test(lower)) return "negative";
    return "neutral";
  }

  function extractKeyPhrases(text){
    const words = text
      .toLowerCase()
      .replace(/[^a-z0-9\s\-']/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    const stop = new Set(["the","a","an","and","or","for","to","of","in","on","at","is","are","be","by","with","as","from","that","this","it","we","you","they","i","was","were","will","shall","can","could","would","should","not","no","yes","but","if","then","so","than","too","very","just"]);
    const freq = {};
    for(const w of words){ if(!stop.has(w)){ freq[w] = (freq[w]||0)+1; } }
    const list = Object.entries(freq).sort((a,b)=> b[1]-a[1]).map(([w])=>w);
    return list;
  }

  function buildDetailedBreakdown(text, keyPhrases){
    const bullets = [];
    // Identify purpose/instruction vs. descriptive
    const imperative = /\b(please|do|open|close|press|enter|click|install|remove|update|configure|set|go to|select|choose|submit|apply)\b/i.test(text);
    if(imperative) bullets.push("It reads like instructions or requests (imperative tone).");
    if(/\b(policy|terms|warranty|guarantee|return|refund)\b/i.test(text)) bullets.push("Mentions policy/terms; check conditions or eligibility.");
    if(/\bdate|time|deadline|schedule|until|by\b/i.test(text)) bullets.push("Includes timing or deadlines; note due dates.");
    if(/\bprice|cost|fee|charge|payment|invoice\b/i.test(text)) bullets.push("Refers to cost/payment; verify amounts and currency.");
    if(/\baddress|email|phone|website|link\b/i.test(text)) bullets.push("Contains contact details or links; ensure accuracy.");

    // Pull 2–3 salient phrases to highlight
    const tops = keyPhrases.slice(0,3);
    if(tops.length) bullets.push("Core idea revolves around: " + tops.join(", ") + ".");

    // Add recommendation/next step
    if(imperative) bullets.push("If acting on this, follow steps in order and confirm each outcome.");
    else bullets.push("Consider summarizing for reuse (email/reply/notes) and confirm any unclear terms.");

    return bullets.slice(0,6);
  }

  async function explainWithGemini(apiKey, text, question){
    const prompt = `You are a helpful assistant. Provide a structured, thorough explanation:
1) 2–3 sentence summary
2) Simpler paraphrase (1–2 sentences)
3) Breakdown with 4–6 bullets (key points, intent, important details)
4) Tone and 3–6 keywords
If a question is provided, answer it first in 1–2 sentences.
Text: "${text}"
Question: ${question || "(none)"}`;
    // Use Gemini REST API (models: gemini-1.5-flash)
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + encodeURIComponent(apiKey);
    const res = await fetch(url,{
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] })
    });
    if(!res.ok) throw new Error("Gemini HTTP " + res.status);
    const data = await res.json();
    const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if(!txt) throw new Error("Gemini empty response");
    return txt.trim();
  }

  function answerQuestion(text, q, pre){
    if(/explain|meaning|what does it mean|clarif/.test(q)) return pre.simple;
    if(/keyword|key word|main topic|about|topic/.test(q)) return pre.keyPhrases.join(", ");
    if(/tone|mood|sentiment/.test(q)) return pre.tone;
    if(/summar|tl;dr|short/.test(q)) return pre.summary;
    if(/who|where|when|why|how|what/.test(q)){
      const hit = (text.match(/[^.!?]*\b(who|where|when|why|how|what)\b[^.!?]*[.!?]/i) || [null])[0];
      return hit ? hit.trim() : pre.summary;
    }
    return pre.summary;
  }

  function extractEntities(text){
    const caps = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const nums = text.match(/\b\d+(?:[.,]\d+)?\b/g) || [];
    const dates = text.match(/\b(?:\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g) || [];
    const set = new Set([...caps, ...nums, ...dates]);
    return Array.from(set).slice(0,12);
  }
})();



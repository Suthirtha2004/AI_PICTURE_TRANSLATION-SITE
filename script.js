// script.js

const fileInput = document.getElementById("fileInput");
const img = document.getElementById("img");
const canvas = document.getElementById("cropsel");
const ctx = canvas.getContext("2d");
const extracted = document.getElementById("extracted");
const translated = document.getElementById("translated");
const conf = document.getElementById("conf");
const detected = document.getElementById("detected");
const targetLang = document.getElementById("targetLang");
const modeBadge = document.getElementById("modeBadge");

let imgDataUrl = null;
let selecting = false;
let selMode = false;
let startX, startY, endX, endY;

fileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    imgDataUrl = ev.target.result;
    img.src = imgDataUrl;
  };
  reader.readAsDataURL(file);
});

img.onload = () => {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.clearRect(0,0,canvas.width,canvas.height);
};

document.getElementById("toggleSel").onclick = () => {
  selMode = !selMode;
  modeBadge.textContent = selMode ? "Label OCR" : "Full OCR";
};

canvas.onmousedown = e => {
  if (!selMode) return;
  selecting = true;
  startX = e.offsetX; startY = e.offsetY;
};
canvas.onmouseup = e => {
  if (!selMode) return;
  selecting = false;
  endX = e.offsetX; endY = e.offsetY;
  drawSelection();
};
canvas.onmousemove = e => {
  if (!selMode || !selecting) return;
  endX = e.offsetX; endY = e.offsetY;
  drawSelection();
};

function drawSelection(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle = "red";
  ctx.lineWidth = 2;
  ctx.strokeRect(startX,startY,endX-startX,endY-startY);
}

// Run OCR
document.getElementById("doOCR").onclick = async () => {
  if (!imgDataUrl) return alert("Upload an image first");
  extracted.value = "Running OCR...";

  let cropData = imgDataUrl;
  if(selMode && startX!=null){
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = Math.abs(endX-startX);
    tempCanvas.height = Math.abs(endY-startY);
    const tctx = tempCanvas.getContext("2d");
    tctx.drawImage(img,startX,startY,tempCanvas.width,tempCanvas.height,0,0,tempCanvas.width,tempCanvas.height);
    cropData = tempCanvas.toDataURL();
  }

  const { data: { text, confidence } } = await Tesseract.recognize(cropData,"eng");
  extracted.value = text.trim();
  conf.textContent = confidence.toFixed(1)+"%";
};

document.getElementById("clearBtn").onclick = ()=>{
  extracted.value = translated.value = "";
  conf.textContent = detected.textContent = "—";
};

document.getElementById("translateBtn").onclick = async ()=>{
  const text = extracted.value.trim();
  if(!text) return;

  // If target is "auto", preserve original text and skip API
  if(targetLang.value === "auto"){
    translated.value = text;
    detected.textContent = "auto";
    return;
  }

  translated.value = "Translating...";
  try {
    const data = await translateWithFallback(text, targetLang.value);
    translated.value = data.translatedText || "";
    const det = (data.detectedLanguage || data.detected_language || "auto");
    detected.textContent = (typeof det === "string" ? det : "auto").toUpperCase();
  } catch(err){
    console.error(err);
    translated.value = "";
    alert("Translation failed. Try again or switch language/endpoint.");
  }
};

const TRANSLATE_ENDPOINTS = [
  "https://libretranslate.de/translate",
  "https://translate.argosopentech.com/translate",
  "https://libretranslate.com/translate",
  "https://libretranslate.org/translate",
  "https://libretranslate.online/translate",
  "https://translate.federalize.cloud/translate"
];

async function translateWithFallback(text, target){
  let lastError;
  for(const url of TRANSLATE_ENDPOINTS){
    try {
      const controller = new AbortController();
      const t = setTimeout(()=>controller.abort(), 12000);
      const res = await fetch(url,{
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ q: text, source: "auto", target, format: "text" }),
        signal: controller.signal
      });
      clearTimeout(t);
      if(!res.ok){ lastError = new Error(`HTTP ${res.status} at ${url}`); continue; }
      const data = await res.json();
      if(!data || (!data.translatedText && !data.translated_text)){
        lastError = new Error("Unexpected response format");
        continue;
      }
      return { ...data, translatedText: data.translatedText || data.translated_text };
    } catch(e){
      lastError = e;
      continue;
    }
  }
  // Try MyMemory as a final fallback (CORS-friendly, rate-limited)
  try {
    const mm = await translateWithMyMemory(text, target);
    return mm;
  } catch(e){
    // ignore, will throw below
  }
  throw lastError || new Error("All translation endpoints failed");
}

async function translateWithMyMemory(text, target){
  const source = await detectLanguageWithFallback(text).catch(()=>"en");
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source + '|' + target)}`;
  const res = await fetch(url, { headers: { "Accept": "application/json" } });
  if(!res.ok) throw new Error("MyMemory HTTP " + res.status);
  const data = await res.json();
  const translatedText = data?.responseData?.translatedText;
  if(!translatedText) throw new Error("MyMemory unexpected response");
  const detectedLanguage = source;
  return { translatedText, detectedLanguage };
}

// Gemini translation removed by user request; Gemini is used only for explanations in chatbot.js

const DETECT_ENDPOINTS = TRANSLATE_ENDPOINTS.map(u=>u.replace(/\/translate$/, "/detect"));

async function detectLanguageWithFallback(text){
  let lastError;
  for(const url of DETECT_ENDPOINTS){
    try {
      const controller = new AbortController();
      const t = setTimeout(()=>controller.abort(), 8000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ q: text }),
        signal: controller.signal
      });
      clearTimeout(t);
      if(!res.ok){ lastError = new Error(`Detect HTTP ${res.status} at ${url}`); continue; }
      const data = await res.json();
      // LibreTranslate detect returns array of candidates [{language, confidence}]
      const lang = Array.isArray(data) && data[0] && data[0].language ? data[0].language : null;
      if(lang) return lang;
      lastError = new Error("Detect unexpected response");
    } catch(e){
      lastError = e;
      continue;
    }
  }
  // naive fallback: if mostly ASCII, guess English; else Spanish as common fallback
  const asciiRatio = (text.match(/[\x00-\x7F]/g) || []).length / Math.max(text.length,1);
  return asciiRatio > 0.9 ? "en" : "es";
}

document.getElementById("swapBtn").onclick = ()=>{
  const tmp = extracted.value;
  extracted.value = translated.value;
  translated.value = tmp;
};

document.getElementById("copyBtn").onclick = ()=>{
  navigator.clipboard.writeText(translated.value);
  alert("Translated text copied");
};

document.getElementById("exportPdf").onclick = ()=>{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text(translated.value || extracted.value,10,10);
  doc.save("translation.pdf");
};

document.getElementById("exportDocx").onclick = async ()=>{
  const { Document, Packer, Paragraph } = window.docx;
  const doc = new Document({sections:[{properties:{},children:[new Paragraph(translated.value || extracted.value)]}]});
  const blob = await Packer.toBlob(doc);
  saveAs(blob,"translation.docx");
};

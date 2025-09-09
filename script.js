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
  // Hide the "No image selected" text when image loads
  const placeholder = document.getElementById("placeholder");
  if (placeholder) {
    placeholder.style.display = "none";
  }
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

// Simple image preprocessing to improve OCR (grayscale + threshold)
async function preprocessImage(dataUrl){
  return new Promise(resolve => {
    const im = new Image();
    im.onload = () => {
      const t = document.createElement("canvas");
      t.width = im.width; t.height = im.height;
      const c = t.getContext("2d");
      c.drawImage(im,0,0);
      const imgData = c.getImageData(0,0,t.width,t.height);
      const d = imgData.data;
      for(let i=0;i<d.length;i+=4){
        const r=d[i], g=d[i+1], b=d[i+2];
        const gray = (r*0.299 + g*0.587 + b*0.114);
        const v = gray > 180 ? 255 : 0;
        d[i]=d[i+1]=d[i+2]=v; // binarize
      }
      c.putImageData(imgData,0,0);
      resolve(t.toDataURL());
    };
    im.src = dataUrl;
  });
}

// Naive language guesser placeholder (can be enhanced later)
function detectLanguageFromImage(){
  return "eng";
}

function prioritizeStrategies(strategies, lang){
  if(!lang) return strategies;
  return [...strategies].sort((a,b)=>{
    const am = a.lang && a.lang.includes(lang) ? 0 : 1;
    const bm = b.lang && b.lang.includes(lang) ? 0 : 1;
    return am - bm;
  });
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

  try {
    // Preprocess image for better OCR results
    const processedImage = await preprocessImage(cropData);
    
    let bestResult = { text: '', confidence: 0 };
    
    // Try multiple OCR strategies for all languages
    const strategies = [
      // Bengali strategies
      {
        name: "Bengali Handwritten",
        lang: "ben",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
          tessedit_char_whitelist: 'অআইঈউঊঋএঐওঔকখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহক্ষত্রজ্ঞ।,'
        }
      },
      {
        name: "Bengali Single Block",
        lang: "ben",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      {
        name: "Bengali Single Line",
        lang: "ben",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_TEXT_LINE,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      // Hindi strategies
      {
        name: "Hindi Handwritten",
        lang: "hin",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
          tessedit_char_whitelist: 'अआइईउऊऋएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहक्षत्रज्ञ।,'
        }
      },
      {
        name: "Hindi Single Block",
        lang: "hin",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      {
        name: "Hindi Single Line",
        lang: "hin",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_TEXT_LINE,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      // Spanish strategies
      {
        name: "Spanish Handwritten",
        lang: "spa",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzñáéíóúü¿¡.,;:!?()[]{}'
        }
      },
      {
        name: "Spanish Single Block",
        lang: "spa",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      {
        name: "Spanish Single Line",
        lang: "spa",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_TEXT_LINE,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      // French strategies
      {
        name: "French Handwritten",
        lang: "fra",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzàâäçéèêëïîôöùûüÿ.,;:!?()[]{}'
        }
      },
      {
        name: "French Single Block",
        lang: "fra",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      {
        name: "French Single Line",
        lang: "fra",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_TEXT_LINE,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      // German strategies
      {
        name: "German Handwritten",
        lang: "deu",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzäöüß.,;:!?()[]{}'
        }
      },
      {
        name: "German Single Block",
        lang: "deu",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      {
        name: "German Single Line",
        lang: "deu",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_TEXT_LINE,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      // Multi-language strategies
      {
        name: "Multi-language All",
        lang: "eng+hin+ben+spa+fra+deu",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      {
        name: "Multi-language Block",
        lang: "eng+hin+ben+spa+fra+deu",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      // English strategies
      {
        name: "English Handwritten",
        lang: "eng",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      },
      {
        name: "English Single Block",
        lang: "eng",
        options: {
          tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        }
      }
    ];
    
    console.log("Trying multiple OCR strategies for all languages...");
    
    // First, try to detect the most likely language from the image
    const detectedLang = detectLanguageFromImage(processedImage);
    console.log("Detected likely language from image:", detectedLang);
    
    // Reorder strategies to prioritize detected language
    let prioritizedStrategies = prioritizeStrategies(strategies, detectedLang);
    // speed: only try up to 3 strategies
    prioritizedStrategies = prioritizedStrategies.slice(0, 3);
    
    for (let strategy of prioritizedStrategies) {
      try {
        console.log(`Trying strategy: ${strategy.name}`);
        const { data: { text, confidence } } = await Tesseract.recognize(processedImage, strategy.lang, {
          // disable verbose logs for speed
          ...strategy.options
        });
        
        console.log(`${strategy.name} result:`, { text: text.trim(), confidence });
        
        // Choose the best result based on confidence and text length
        if (confidence > bestResult.confidence || 
            (confidence > bestResult.confidence * 0.8 && text.trim().length > bestResult.text.length)) {
          bestResult = { text: text.trim(), confidence };
          console.log(`New best result from ${strategy.name}:`, bestResult);
        }
        // If we already have a strong result, stop early
        if (bestResult.confidence >= 70 && bestResult.text.length >= 3) break;
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }
    
    // If we still don't have good results, try the original image without preprocessing
    if (bestResult.confidence < 30 || bestResult.text.length < 4) {
      console.log("Trying original image without preprocessing...");
      try {
        const { data: { text, confidence } } = await Tesseract.recognize(cropData, "eng+hin+ben", {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300'
        });
        if (confidence > bestResult.confidence || text.trim().length > bestResult.text.length) {
          bestResult = { text: text.trim(), confidence };
          console.log(`Multilang Original gave better results:`, bestResult);
        }
      } catch (error) {
        console.warn(`Multilang Original failed:`, error);
      }
    }
    
    // Set the best result
    extracted.value = bestResult.text;
    conf.textContent = bestResult.confidence.toFixed(1) + "%";
    
    console.log("Final OCR result:", bestResult);
    
  } catch (error) {
    console.error("OCR Error:", error);
    extracted.value = "OCR failed. Please try again.";
    conf.textContent = "ERROR";
  }
};

document.getElementById("clearBtn").onclick = ()=>{
  extracted.value = translated.value = "";
  conf.textContent = detected.textContent = "—";
  // Show the "No image selected" text when clearing
  const placeholder = document.getElementById("placeholder");
  if (placeholder) {
    placeholder.style.display = "flex";
  }
  // Clear the image and file input
  img.src = "";
  fileInput.value = "";
  imgDataUrl = null;
  // Clear the canvas
  ctx.clearRect(0,0,canvas.width,canvas.height);
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
    // Ensure we send UTF-8 and avoid mojibake by normalizing text
    const normalized = text.normalize('NFC');
    const data = await translateWithFallback(normalized, targetLang.value);
    translated.value = data.translatedText || "";
    const det = (data.detectedLanguage || data.detected_language || "auto");
    detected.textContent = (typeof det === "string" ? det : "auto").toUpperCase();
  } catch(err){
    console.error(err);
    translated.value = "";
    alert("Translation failed. Try again or switch language.");
  }
};

const TRANSLATE_ENDPOINTS = [
  "https://translate.fedified.com/translate",
  "https://libretranslate.de/translate",
  "https://translate.argosopentech.com/translate",
  "https://libretranslate.com/translate",
  "https://libretranslate.org/translate",
  "https://libretranslate.online/translate",
  "https://translate.federalize.cloud/translate"
];

function splitTextIntoChunks(text, maxLen = 480){
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[\.!?\u0964])(\s+)/g) // include Devanagari danda \u0964
    .filter(Boolean);
  const chunks = [];
  let current = '';
  for(const part of sentences){
    if((current + part).length <= maxLen){
      current += part;
    } else {
      if(current) chunks.push(current.trim());
      if(part.length > maxLen){
        // hard split very long segment
        for(let i=0;i<part.length;i+=maxLen){
          chunks.push(part.slice(i, i+maxLen));
        }
        current = '';
      } else {
        current = part;
      }
    }
  }
  if(current) chunks.push(current.trim());
  return chunks.length ? chunks : [text];
}

async function translateSingleChunk(text, target){
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
  // Final fallback: MyMemory with detected source (does not accept 'auto')
  try {
    const mm = await translateWithMyMemory(text, target);
    return mm;
  } catch(e){ /* ignore */ }
  throw lastError || new Error("All translation endpoints failed");
}

async function translateWithFallback(text, target){
  // Automatically chunk to avoid API limits; concatenate results
  const chunks = splitTextIntoChunks(text, 480);
  const out = [];
  for(const chunk of chunks){
    const r = await translateSingleChunk(chunk, target);
    out.push(r.translatedText || '');
  }
  return { translatedText: out.join(' ').trim(), detectedLanguage: undefined };
}

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
      const lang = Array.isArray(data) && data[0] && data[0].language ? data[0].language : null;
      if(lang) return lang;
      lastError = new Error("Detect unexpected response");
    } catch(e){ lastError = e; continue; }
  }
  // Heuristics when network detect fails: map by Unicode script ranges
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  if (hasDevanagari) return "hi"; // Hindi / Devanagari
  const hasBengali = /[\u0980-\u09FF]/.test(text);
  if (hasBengali) return "bn"; // Bengali
  const hasArabic = /[\u0600-\u06FF]/.test(text);
  if (hasArabic) return "ar";
  const hasCyrillic = /[\u0400-\u04FF]/.test(text);
  if (hasCyrillic) return "ru";
  const asciiRatio = (text.match(/[\x00-\x7F]/g) || []).length / Math.max(text.length,1);
  return asciiRatio > 0.9 ? "en" : "es";
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

document.getElementById("swapBtn").onclick = ()=>{
  const tmp = extracted.value;
  extracted.value = translated.value;
  translated.value = tmp;
  // Update the readonly textareas by temporarily removing readonly, updating, then restoring
  const extractedTextarea = document.getElementById("extracted");
  const translatedTextarea = document.getElementById("translated");
  
  extractedTextarea.removeAttribute('readonly');
  translatedTextarea.removeAttribute('readonly');
  
  extractedTextarea.value = translated.value;
  translatedTextarea.value = tmp;
  
  extractedTextarea.setAttribute('readonly', '');
  translatedTextarea.setAttribute('readonly', '');
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

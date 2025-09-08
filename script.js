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
    const prioritizedStrategies = prioritizeStrategies(strategies, detectedLang);
    
    for (let strategy of prioritizedStrategies) {
      try {
        console.log(`Trying strategy: ${strategy.name}`);
        const { data: { text, confidence } } = await Tesseract.recognize(processedImage, strategy.lang, {
          logger: m => console.log(m),
          ...strategy.options
        });
        
        console.log(`${strategy.name} result:`, { text: text.trim(), confidence });
        
        // Choose the best result based on confidence and text length
        if (confidence > bestResult.confidence || 
            (confidence > bestResult.confidence * 0.8 && text.trim().length > bestResult.text.length)) {
          bestResult = { text: text.trim(), confidence };
          console.log(`New best result from ${strategy.name}:`, bestResult);
        }
      } catch (error) {
        console.warn(`Strategy ${strategy.name} failed:`, error);
      }
    }
    
    // If we still don't have good results, try the original image without preprocessing
    if (bestResult.confidence < 30 || bestResult.text.length < 20) {
      console.log("Trying original image without preprocessing...");
      
      // Try all languages in fallback order
      const fallbackStrategies = [
        { lang: "ben", name: "Bengali Original" },
        { lang: "hin", name: "Hindi Original" },
        { lang: "spa", name: "Spanish Original" },
        { lang: "fra", name: "French Original" },
        { lang: "deu", name: "German Original" },
        { lang: "eng", name: "English Original" },
        { lang: "eng+hin+ben+spa+fra+deu", name: "Multi-lang Original" }
      ];
      
      for (let fallback of fallbackStrategies) {
        try {
          const { data: { text, confidence } } = await Tesseract.recognize(cropData, fallback.lang, {
            logger: m => console.log(m),
            tessedit_pageseg_mode: Tesseract.PSM.AUTO,
            tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
            preserve_interword_spaces: '1',
            user_defined_dpi: '300'
          });
          
          if (confidence > bestResult.confidence || text.trim().length > bestResult.text.length) {
            bestResult = { text: text.trim(), confidence };
            console.log(`${fallback.name} gave better results:`, bestResult);
          }
        } catch (error) {
          console.warn(`${fallback.name} failed:`, error);
        }
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
  translated.value = "Translating...";

  const res = await fetch("https://libretranslate.de/translate",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({q:text,source:"auto",target:targetLang.value,format:"text"})
  });
  const data = await res.json();
  translated.value = data.translatedText;
  detected.textContent = data.detectedLanguage?.toUpperCase() || "auto";
};

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

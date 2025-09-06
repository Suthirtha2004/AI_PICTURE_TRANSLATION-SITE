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

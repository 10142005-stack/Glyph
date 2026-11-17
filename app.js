const textInput = document.querySelector("#text-input");
const charCount = document.querySelector("#char-count");
const fontSelect = document.querySelector("#font-select");
const widthRange = document.querySelector("#width-range");
const widthValue = document.querySelector("#width-value");
const invertToggle = document.querySelector("#invert-toggle");
const artOutput = document.querySelector("#art-output");
const artFrame = document.querySelector("#art-frame");
const outputMeta = document.querySelector("#output-meta");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");

const characterRamp = "@%#*+=-:. ";
const cellWidth = 8;
const cellHeight = 16;

function makeAsciiArt(text, columns, fontFamily, invert) {
  const lines = text.split("\n");
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  const referenceSize = 100;
  measureContext.font = `${referenceSize}px ${fontFamily}`;

  const widestLine = Math.max(
    0,
    ...lines.map((line) => measureContext.measureText(line).width),
  );
  if (!widestLine) return "";

  const pixelWidth = columns * cellWidth;
  const fontSize = Math.min(
    (pixelWidth - 16) / widestLine * referenceSize,
    columns * 5,
    1536 / (1.12 + (lines.length - 1) * 1.18),
  );
  const lineHeight = fontSize * 1.18;
  const pixelHeight = Math.max(
    cellHeight,
    Math.ceil((fontSize * 1.12 + (lines.length - 1) * lineHeight) / cellHeight) * cellHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = invert ? "#000" : "#fff";
  context.fillRect(0, 0, pixelWidth, pixelHeight);
  context.fillStyle = invert ? "#fff" : "#000";
  context.font = `${fontSize}px ${fontFamily}`;
  context.textBaseline = "alphabetic";
  lines.forEach((line, index) => {
    context.fillText(line, 8, fontSize * 0.92 + index * lineHeight);
  });

  const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight).data;
  const rows = [];
  for (let y = 0; y < pixelHeight; y += cellHeight) {
    let row = "";
    for (let x = 0; x < pixelWidth; x += cellWidth) {
      const sampleX = Math.min(x + Math.floor(cellWidth / 2), pixelWidth - 1);
      const sampleY = Math.min(y + Math.floor(cellHeight / 2), pixelHeight - 1);
      const offset = (sampleY * pixelWidth + sampleX) * 4;
      const luminance = (
        pixels[offset] * 0.2126
        + pixels[offset + 1] * 0.7152
        + pixels[offset + 2] * 0.0722
      ) / 255;
      const tone = invert ? 1 - luminance : luminance;
      const rampIndex = Math.round(tone * (characterRamp.length - 1));
      row += characterRamp[rampIndex];
    }
    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].trim() === "") rows.pop();
  return rows.join("\n");
}

function render() {
  const text = textInput.value;
  const columns = Number(widthRange.value);
  const art = makeAsciiArt(text, columns, fontSelect.value, invertToggle.checked);
  artOutput.textContent = art;
  charCount.textContent = `${text.length} / 240`;
  widthValue.textContent = columns;
  outputMeta.innerHTML = `${columns} columns <span class="meta-separator">·</span> ready to copy`;
  artFrame.classList.toggle("is-inverted", invertToggle.checked);
  copyButton.disabled = !art;
  downloadButton.disabled = !art;
}

textInput.addEventListener("input", render);
fontSelect.addEventListener("change", render);
widthRange.addEventListener("input", render);
invertToggle.addEventListener("change", render);

copyButton.addEventListener("click", async () => {
  if (!artOutput.textContent) return;
  try {
    await navigator.clipboard.writeText(artOutput.textContent);
    copyButton.querySelector("span").textContent = "Copied!";
    window.setTimeout(() => {
      copyButton.querySelector("span").textContent = "Copy art";
    }, 1400);
  } catch (error) {
    outputMeta.textContent = "Clipboard access unavailable — select and copy the art.";
  }
});

downloadButton.addEventListener("click", () => {
  if (!artOutput.textContent) return;
  const file = new Blob([artOutput.textContent], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = "glyph-ascii-art.txt";
  link.click();
  URL.revokeObjectURL(url);
});

render();

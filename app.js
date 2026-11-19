const textInput = document.querySelector("#text-input");
const charCount = document.querySelector("#char-count");
const widthRange = document.querySelector("#width-range");
const widthValue = document.querySelector("#width-value");
const fontControl = document.querySelector(".font-control");
const inputTitle = document.querySelector("#input-title");
const outputTitle = document.querySelector("#output-title");
const invertToggle = document.querySelector("#invert-toggle");
const artOutput = document.querySelector("#art-output");
const artFrame = document.querySelector("#art-frame");
const outputMeta = document.querySelector("#output-meta");
const copyButton = document.querySelector("#copy-button");
const downloadButton = document.querySelector("#download-button");
const sourceTabs = [...document.querySelectorAll(".source-tab")];
const textSource = document.querySelector("#text-source");
const imageSource = document.querySelector("#image-source");
const imageInput = document.querySelector("#image-input");
const imageDrop = document.querySelector("#image-drop");
const imageLabel = document.querySelector("#image-label");

const characterRamp = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,\"^`'. ";
const cellWidth = 6;
const cellHeight = 10;
const imageRamp = " .'`^\",:;Il!i~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
let measuredImageRamp = null;
let sourceMode = "text";
let loadedImage = null;
let renderFileName = "glyph-ascii-art";

function makeAsciiArt(text, columns, invert) {
  const lines = text.split("\n");
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  const referenceSize = 100;
  measureContext.font = `${referenceSize}px monospace`;

  const pixelWidth = columns * cellWidth;
  const maxTextWidth = pixelWidth - 16;
  const wrappedLines = lines.flatMap((line) => {
    if (!line) return [""];
    const words = line.match(/\S+|\s+/g) || [line];
    const result = [];
    let current = "";

    words.forEach((word) => {
      const candidate = current + word;
      if (measureContext.measureText(candidate).width <= maxTextWidth) {
        current = candidate;
        return;
      }

      if (current) result.push(current);
      if (measureContext.measureText(word).width <= maxTextWidth) {
        current = word;
        return;
      }

      current = "";
      for (const character of Array.from(word)) {
        const characterCandidate = current + character;
        if (measureContext.measureText(characterCandidate).width <= maxTextWidth) {
          current = characterCandidate;
        } else {
          if (current) result.push(current);
          current = character;
        }
      }
    });
    if (current) result.push(current);
    return result;
  });

  const widestLine = Math.max(
    0,
    ...wrappedLines.map((line) => measureContext.measureText(line).width),
  );
  if (!widestLine) return "";

  const fittedSize = (pixelWidth - 16) / widestLine * referenceSize;
  const fontSize = Math.max(5, Math.min(fittedSize, 140));
  const lineHeight = fontSize * 1.18;
  const pixelHeight = Math.max(
    cellHeight,
    Math.ceil((fontSize * 1.12 + (wrappedLines.length - 1) * lineHeight) / cellHeight) * cellHeight,
  );
  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = invert ? "#000" : "#fff";
  context.fillRect(0, 0, pixelWidth, pixelHeight);
  context.fillStyle = invert ? "#fff" : "#000";
  context.font = `${fontSize}px monospace`;
  context.textBaseline = "alphabetic";
  wrappedLines.forEach((line, index) => {
    context.fillText(line, 8, fontSize * 0.92 + index * lineHeight);
  });

  const pixels = context.getImageData(0, 0, pixelWidth, pixelHeight).data;
  const rows = [];
  for (let y = 0; y < pixelHeight; y += cellHeight) {
    let row = "";
    for (let x = 0; x < pixelWidth; x += cellWidth) {
      let luminance = 0;
      let samples = 0;
      for (let sampleY = y; sampleY < Math.min(y + cellHeight, pixelHeight); sampleY++) {
        for (let sampleX = x; sampleX < Math.min(x + cellWidth, pixelWidth); sampleX++) {
          const offset = (sampleY * pixelWidth + sampleX) * 4;
          luminance += (
            pixels[offset] * 0.2126
            + pixels[offset + 1] * 0.7152
            + pixels[offset + 2] * 0.0722
          ) / 255;
          samples++;
        }
      }
      luminance /= samples;
      const tone = invert ? 1 - luminance : luminance;
      const bayer = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
      const ditherOffset = (bayer[(y / cellHeight) % 4 | 0][(x / cellWidth) % 4 | 0] - 7.5) / 16;
      const rampIndex = Math.max(0, Math.min(
        characterRamp.length - 1,
        Math.round((tone + ditherOffset * 0.18) * (characterRamp.length - 1)),
      ));
      row += characterRamp[rampIndex];
    }
    rows.push(row);
  }

  while (rows.length && rows[rows.length - 1].trim() === "") rows.pop();
  return rows.join("\n");
}

function makeImageAsciiArt(image, columns, invert) {
  if (!measuredImageRamp) {
    const measureCanvas = document.createElement("canvas");
    measureCanvas.width = 32;
    measureCanvas.height = 40;
    const measureContext = measureCanvas.getContext("2d", { willReadFrequently: true });
    measureContext.font = '28px "DM Mono", monospace';
    measureContext.textAlign = "center";
    measureContext.textBaseline = "middle";
    measuredImageRamp = Array.from(new Set(imageRamp))
      .map((character) => {
        measureContext.clearRect(0, 0, measureCanvas.width, measureCanvas.height);
        measureContext.fillStyle = "#000";
        measureContext.fillText(character, measureCanvas.width / 2, measureCanvas.height / 2);
        const samples = measureContext.getImageData(0, 0, measureCanvas.width, measureCanvas.height).data;
        let ink = 0;
        for (let i = 3; i < samples.length; i += 4) ink += samples[i] / 255;
        return { character, density: ink / (samples.length / 4) };
      })
      .sort((a, b) => a.density - b.density);
  }
  const maximumInkDensity = measuredImageRamp[measuredImageRamp.length - 1].density;

  const cellWidthRatio = 0.62;
  const cellHeightRatio = 0.94;
  const pixelColumns = columns;
  const pixelRows = Math.max(
    16,
    Math.min(
      480,
      Math.round(columns * (image.naturalHeight / image.naturalWidth) * cellWidthRatio / cellHeightRatio),
    ),
  );
  const canvas = document.createElement("canvas");
  canvas.width = pixelColumns;
  canvas.height = pixelRows;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, pixelColumns, pixelRows);

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const frameRatio = pixelColumns / pixelRows;
  let drawWidth = pixelColumns;
  let drawHeight = pixelRows;
  let drawX = 0;
  let drawY = 0;
  if (imageRatio > frameRatio) {
    drawHeight = pixelColumns / imageRatio;
    drawY = (pixelRows - drawHeight) / 2;
  } else {
    drawWidth = pixelRows * imageRatio;
    drawX = (pixelColumns - drawWidth) / 2;
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  const pixels = context.getImageData(0, 0, pixelColumns, pixelRows).data;
  const gray = new Float32Array(pixelColumns * pixelRows);
  const borderSamples = [];
  const imageLeft = Math.max(0, Math.floor(drawX));
  const imageRight = Math.min(pixelColumns - 1, Math.ceil(drawX + drawWidth) - 1);
  const imageTop = Math.max(0, Math.floor(drawY));
  const imageBottom = Math.min(pixelRows - 1, Math.ceil(drawY + drawHeight) - 1);
  const borderSize = Math.max(1, Math.round(Math.min(drawWidth, drawHeight) * 0.035));
  for (let y = imageTop; y <= imageBottom; y++) {
    for (let x = imageLeft; x <= imageRight; x++) {
      if (
        x < imageLeft + borderSize || x > imageRight - borderSize
        || y < imageTop + borderSize || y > imageBottom - borderSize
      ) {
        const offset = (y * pixelColumns + x) * 4;
        borderSamples.push(
          (pixels[offset] * 0.2126 + pixels[offset + 1] * 0.7152 + pixels[offset + 2] * 0.0722) / 255,
        );
      }
    }
  }
  borderSamples.sort((a, b) => a - b);
  const darkBackground = (borderSamples[Math.floor(borderSamples.length / 2)] ?? 1) < 0.48;
  for (let i = 0, p = 0; i < pixels.length; i += 4, p++) {
    const red = pixels[i] / 255;
    const green = pixels[i + 1] / 255;
    const blue = pixels[i + 2] / 255;
    const linearRed = red <= 0.04045 ? red / 12.92 : ((red + 0.055) / 1.055) ** 2.4;
    const linearGreen = green <= 0.04045 ? green / 12.92 : ((green + 0.055) / 1.055) ** 2.4;
    const linearBlue = blue <= 0.04045 ? blue / 12.92 : ((blue + 0.055) / 1.055) ** 2.4;
    const luminance = linearRed * 0.2126 + linearGreen * 0.7152 + linearBlue * 0.0722;
    const subjectDarkness = darkBackground ? luminance : 1 - luminance;
    gray[p] = invert ? 1 - subjectDarkness : subjectDarkness;
  }

  const sorted = Array.from(gray).sort((a, b) => a - b);
  const low = sorted[Math.floor(sorted.length * 0.015)] ?? 0;
  const high = sorted[Math.floor(sorted.length * 0.985)] ?? 1;
  const spread = Math.max(0.12, high - low);
  for (let i = 0; i < gray.length; i++) {
    const normalized = Math.max(0, Math.min(1, (gray[i] - low) / spread));
    const perceptualTone = Math.pow(normalized, 0.82);
    gray[i] = perceptualTone * maximumInkDensity;
  }

  const output = [];
  for (let y = 0; y < pixelRows; y++) {
    let row = "";
    for (let x = 0; x < pixelColumns; x++) {
      const darkness = gray[x + y * pixelColumns];
      let lowIndex = 0;
      let highIndex = measuredImageRamp.length - 1;
      while (lowIndex < highIndex) {
        const middle = (lowIndex + highIndex) >> 1;
        if (measuredImageRamp[middle].density < darkness) lowIndex = middle + 1;
        else highIndex = middle;
      }
      if (
        lowIndex > 0
        && darkness - measuredImageRamp[lowIndex - 1].density
          < measuredImageRamp[lowIndex].density - darkness
      ) lowIndex--;
      row += measuredImageRamp[lowIndex].character;
    }
    output.push(row);
  }
  return output.join("\n");
}

function render() {
  const columns = Number(widthRange.value);
  const text = textInput.value;
  const art = sourceMode === "image" && loadedImage
    ? makeImageAsciiArt(loadedImage, columns, invertToggle.checked)
    : sourceMode === "text"
      ? makeAsciiArt(text, columns, invertToggle.checked)
      : "";
  artOutput.textContent = art;
  charCount.textContent = `${text.length} / 240`;
  charCount.classList.toggle("is-near-limit", text.length >= 200);
  widthValue.textContent = columns;
  const rowCount = art ? art.split("\n").length : 0;
  outputMeta.innerHTML = art
    ? `${columns} × ${rowCount} <span class="meta-separator">·</span> ready to copy`
    : `${columns} columns <span class="meta-separator">·</span> waiting for input`;
  artFrame.classList.toggle("is-inverted", invertToggle.checked);
  artFrame.classList.toggle("is-image-art", sourceMode === "image");
  if (fontControl) fontControl.hidden = sourceMode === "image";
  if (inputTitle) inputTitle.textContent = sourceMode === "image" ? "Choose an image" : "Start with a character";
  if (outputTitle) outputTitle.textContent = sourceMode === "image" ? "Image as characters" : "Your art, in characters";
  copyButton.disabled = !art;
  downloadButton.disabled = !art;
}

sourceTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    sourceMode = tab.dataset.mode;
    if (sourceMode === "text") renderFileName = "glyph-ascii-art";
    sourceTabs.forEach((item) => {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", String(active));
    });
    textSource.hidden = sourceMode !== "text";
    imageSource.hidden = sourceMode !== "image";
    render();
  });
});

function loadImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    loadedImage = image;
    imageLabel.textContent = file.name;
    renderFileName = file.name.replace(/\.[^.]+$/, "") || "glyph-image";
    URL.revokeObjectURL(url);
    render();
  };
  image.src = url;
}

imageInput.addEventListener("change", () => loadImage(imageInput.files[0]));
document.addEventListener("paste", (event) => {
  const imageFile = [...(event.clipboardData?.files || [])].find((file) => file.type.startsWith("image/"));
  if (!imageFile) return;
  sourceTabs.find((tab) => tab.dataset.mode === "image")?.click();
  loadImage(imageFile);
});
["dragenter", "dragover"].forEach((eventName) => {
  imageDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    imageDrop.classList.add("is-dragging");
  });
});
["dragleave", "drop"].forEach((eventName) => {
  imageDrop.addEventListener(eventName, (event) => {
    event.preventDefault();
    imageDrop.classList.remove("is-dragging");
  });
});
imageDrop.addEventListener("drop", (event) => loadImage(event.dataTransfer.files[0]));

textInput.addEventListener("input", render);
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
  link.download = `${renderFileName}.txt`;
  link.click();
  URL.revokeObjectURL(url);
});

render();
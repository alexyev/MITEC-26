const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const fs = require("fs");

const BG = "F8F7F3", INK = "1F2A24", BODY = "3F3F3F", MUTED = "6E6E6E";
const GOLD = "F0B43C", SAGE = "E4ECE1", GREEN = "2D5A44", CARD = "FFFFFF", LINE = "D9DED5";

async function png(svg) { return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64"); }
function daisySvg() {
  const petals = Array.from({ length: 6 }, (_, i) =>
    `<ellipse cx="128" cy="64" rx="27" ry="56" transform="rotate(${i * 60 + 15} 128 128)" fill="#FFFFFF" stroke="#C9D4C6" stroke-width="7"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${petals}<circle cx="128" cy="128" r="27" fill="#${GOLD}"/></svg>`;
}
const T = (s, text, o) => s.addText(text, Object.assign({ fontFace: "Arial", color: BODY, margin: 0, isTextBox: true, valign: "top" }, o));

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Construction";
  const s = pres.addSlide();
  s.background = { color: BG };
  const daisy = await png(daisySvg());
  [[8.75, 0.02, 0.62], [9.3, 0.42, 0.55], [8.6, 0.6, 0.5]].forEach(([x, y, d], i) =>
    s.addImage({ data: daisy, x, y, w: d, h: d, objectName: `Daisy ${i + 1}`, altText: "Daisy decoration" }));

  T(s, "Construction", { x: 2, y: 0.2, w: 6, h: 0.75, fontFace: "Playfair Display", fontSize: 38, bold: true, color: INK,
    align: "center", valign: "middle", objectName: "Title" });

  // ---------- Left: where the radios go
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.45, y: 1.05, w: 4.45, h: 4.05, rectRadius: 0.15, fill: { color: SAGE },
    line: { color: SAGE }, objectName: "Left panel" });
  s.addImage({ path: "p3photo.jpg", x: 0.65, y: 1.22, w: 4.05, h: 2.549, objectName: "Corner module render",
    altText: "Rendered Exowatt P3 units with a 4-beam corner radio module linking down the lane and across the column" });
  T(s, "One 4-beam corner module on selected P3s, beaming down the lane and across the rows",
    { x: 0.65, y: 3.84, w: 4.05, h: 0.4, fontSize: 10.5, bold: true, color: GREEN, objectName: "Photo caption" });
  const chips = [["45", "radio modules"], ["~425 m", "between modules"], ["~112 W", "whole network"]];
  chips.forEach(([big, lab], i) => {
    const x = 0.65 + i * 1.4;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.32, w: 1.25, h: 0.66, rectRadius: 0.08, fill: { color: CARD },
      line: { color: LINE, width: 0.5 }, objectName: `Chip ${i + 1}` });
    T(s, big, { x: x + 0.1, y: 4.36, w: 1.05, h: 0.32, fontFace: "Playfair Display", fontSize: 16, bold: true, color: INK,
      valign: "middle", objectName: `Chip value ${i + 1}` });
    T(s, lab, { x: x + 0.1, y: 4.68, w: 1.1, h: 0.26, fontSize: 9, color: MUTED, valign: "middle", objectName: `Chip label ${i + 1}` });
  });

  // ---------- Right: what it costs
  const RX = 5.15, RW = 4.4;
  T(s, "$74.6k", { x: RX, y: 1.02, w: RW, h: 0.62, fontFace: "Playfair Display", fontSize: 34, bold: true, color: INK,
    valign: "middle", objectName: "Total cost" });
  T(s, "Radio network for the whole 23,000-unit site", { x: RX, y: 1.64, w: RW, h: 0.28, fontSize: 13, bold: true, color: INK,
    objectName: "Total label" });
  T(s, "≈ $3.24 per P3 · a module on every P3 would cost ≈ $18.3M", { x: RX, y: 1.93, w: RW, h: 0.26, fontSize: 10.5,
    italic: true, color: MUTED, objectName: "Per-unit line" });

  const hdr = { bold: true, color: INK, fill: { color: SAGE } };
  const tot = { bold: true, color: INK };
  const rows = [
    [["Item", hdr], ["Qty × price", hdr], ["Cost", hdr]],
    [["Corner modules (Wi-Fi HaLow)", {}], ["45 × $794", {}], ["$35.7k", {}]],
    [["Battery packs (reused)", {}], ["17 × $1,229", {}], ["$20.9k", {}]],
    [["Base radio", {}], ["1 × $8,000", {}], ["$8.0k", {}]],
    [["Spares 5% + contingency 10%", {}], ["", {}], ["$10.0k", {}]],
    [["Total", tot], ["", tot], ["$74.6k", tot]],
  ].map((r) => r.map(([text, o], j) => ({ text, options: Object.assign({ align: j === 0 ? "left" : "right" }, o) })));
  s.addTable(rows, { x: RX, y: 2.3, w: RW, colW: [2.35, 1.15, 0.9], rowH: 0.245, fontFace: "Arial", fontSize: 10.5, color: BODY,
    valign: "middle", margin: [0.02, 0.08, 0.02, 0.08], border: { type: "solid", pt: 0.5, color: LINE }, fill: { color: CARD },
    objectName: "Cost breakdown" });

  T(s, "Why Wi-Fi HaLow", { x: RX, y: 3.97, w: RW, h: 0.26, fontSize: 11.5, bold: true, color: INK, objectName: "Alternatives header" });
  const alts = ["LoRa: $11k, but ~5 kbps is too slow for machine traffic", "5 GHz mesh: $634k (144 modules, 300 m range)",
    "Bluetooth: $615k–$1.04M (1,950 modules, 80 m range)"];
  s.addText(alts.map((t, j) => ({ text: t, options: { bullet: { indent: 10 }, breakLine: j < alts.length - 1 } })),
    { x: RX, y: 4.27, w: RW, h: 0.82, fontFace: "Arial", fontSize: 10.5, color: BODY, margin: 0, paraSpaceAfter: 3,
      valign: "top", isTextBox: true, objectName: "Alternatives" });

  T(s, "Team cost model (unverified estimates, not supplier quotes). Module = 2 HaLow radios + host board, 4 antennas, enclosure, bracket, " +
    "sun shield, 0.75 h install; 500 m range, 2.5 W. Packs hold 30 days of power until the module's P3 is commissioned.",
    { x: 0.45, y: 5.16, w: 9.1, h: 0.36, fontSize: 8.5, color: MUTED, align: "center", valign: "middle", objectName: "Footnote" });

  await pres.writeFile({ fileName: "construction_slide.pptx" });
})();

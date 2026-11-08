const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { FiClock, FiDollarSign, FiCrosshair } = require("react-icons/fi");

const BG = "F8F7F3", INK = "1F2A24", BODY = "4A4A4A", MUTED = "7A7A7A";
const GOLD = "E9B949", CARD = "FFFFFF", LINE = "E4E1D8";

async function iconPng(Icon) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color: "#" + INK, size: 256, strokeWidth: 2.2 }));
  return "image/png;base64," + (await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer()).toString("base64");
}
async function daisyPng() {
  const petals = Array.from({ length: 6 }, (_, i) =>
    `<ellipse cx="128" cy="62" rx="26" ry="58" transform="rotate(${i * 60} 128 128)" fill="#FFFFFF" stroke="#C9C9C9" stroke-width="5"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${petals}<circle cx="128" cy="128" r="24" fill="#${GOLD}"/></svg>`;
  return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pres.title = "Surveying";
  const s = pres.addSlide();
  s.background = { color: BG };

  s.addText("Surveying", { x: 0.5, y: 0.25, w: 9, h: 0.8, fontFace: "Playfair Display", fontSize: 40, bold: true,
    color: INK, align: "center", valign: "middle", isTextBox: true, objectName: "Title" });
  s.addImage({ data: await daisyPng(), x: 8.95, y: 0.3, w: 0.5, h: 0.5, objectName: "Daisy", altText: "Daisy logo" });

  const cols = [
    { icon: FiClock, q: "How long does it take", big: "~76", bigUnit: " acres/hr", label: "per vehicle · 15 km/h · 30 m strip",
      table: [["Vehicles", "Field hours", "Days"], ["1", "26.4", "3.1"], ["2", "13.2", "1.6"], ["3", "8.8", "1.0"], ["5", "5.3", "0.6"]] },
    { icon: FiDollarSign, q: "How much does this cost", big: "~$272k", label: "1 vehicle + on-site GPS base",
      lines: ["Vehicle + self-driving kit: $122k", "Lidar + GPS/inertial + software: $120k", "Starlink, compute, power, base, build: $30k"] },
    { icon: FiCrosshair, q: "How fine of a scan we can get", big: "5 cm", label: "point spacing (≥ 400 points/m²)",
      lines: ["Heights accurate to ≈ 3–5 cm", "1 cm is possible: ≈ 13 days", "1 mm: ≈ 1,222 days, finer than the sensor can measure"] },
  ];
  const x0 = 0.5, gap = 0.3, w = (9 - 2 * gap) / 3, y0 = 1.25, h = 3.55;
  for (let i = 0; i < 3; i++) {
    const c = cols[i], x = x0 + i * (w + gap), pad = 0.22;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y0, w, h, rectRadius: 0.12, fill: { color: CARD },
      line: { color: LINE, width: 0.75 }, shadow: { type: "outer", color: "000000", opacity: 0.08, blur: 6, offset: 2, angle: 90 },
      objectName: `Card ${i + 1}` });
    s.addShape(pres.shapes.OVAL, { x: x + pad, y: y0 + 0.22, w: 0.46, h: 0.46, fill: { color: GOLD }, line: { color: GOLD }, objectName: `Icon circle ${i + 1}` });
    s.addImage({ data: await iconPng(c.icon), x: x + pad + 0.11, y: y0 + 0.33, w: 0.24, h: 0.24, objectName: `Icon ${i + 1}`, altText: c.q });
    s.addText(c.q, { x: x + pad + 0.58, y: y0 + 0.17, w: w - 2 * pad - 0.58, h: 0.56, fontFace: "Arial", fontSize: 13, bold: true,
      color: INK, valign: "middle", margin: 0, isTextBox: true, objectName: `Question ${i + 1}` });
    const bigRuns = [{ text: c.big }].concat(c.bigUnit ? [{ text: c.bigUnit, options: { fontSize: 18 } }] : []);
    s.addText(bigRuns, { x: x + pad, y: y0 + 0.85, w: w - 2 * pad, h: 0.72, fontFace: "Playfair Display", fontSize: 38, bold: true,
      color: INK, valign: "middle", margin: 0, isTextBox: true, objectName: `Stat ${i + 1}` });
    s.addText(c.label, { x: x + pad, y: y0 + 1.57, w: w - 2 * pad, h: 0.3, fontFace: "Arial", fontSize: 11, italic: true,
      color: MUTED, valign: "top", margin: 0, isTextBox: true, objectName: `Stat label ${i + 1}` });
    if (c.table) {
      const hdr = { bold: true, color: INK, fill: { color: "F3EFE3" } };
      s.addTable(c.table.map((r, ri) => r.map(t => ({ text: t, options: ri === 0 ? hdr : {} }))),
        { x: x + pad, y: y0 + 2.0, w: w - 2 * pad, colW: [0.8, 0.95, w - 2 * pad - 1.75], rowH: 0.24, fontFace: "Arial",
          fontSize: 11, color: BODY, align: "center", valign: "middle", margin: 0.02,
          border: { type: "solid", pt: 0.5, color: LINE }, objectName: "Fleet times table" });
      continue;
    }
    s.addText(c.lines.map((t, j) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: j < c.lines.length - 1 } })),
      { x: x + pad, y: y0 + 2.0, w: w - 2 * pad, h: 1.4, fontFace: "Arial", fontSize: 12, color: BODY, valign: "top",
        margin: 0, paraSpaceAfter: 5, isTextBox: true, objectName: `Details ${i + 1}` });
  }
  s.addText("Assumes 1 gasoline Polaris Ranger, Ouster OS1-128 lidar + Applanix GPS/inertial unit, a local GPS base station, " +
    "1 work day = 10 h at 85% uptime; 2,000 acres at 5 cm spacing incl. 20% overlap + turn time. Costs from listings and estimates; confirm by vendor quote.",
    { x: 0.5, y: 4.98, w: 9, h: 0.4, fontFace: "Arial", fontSize: 9, color: MUTED, align: "center", valign: "middle",
      margin: 0, isTextBox: true, objectName: "Footnote" });

  await pres.writeFile({ fileName: "surveying_slide.pptx" });
})();

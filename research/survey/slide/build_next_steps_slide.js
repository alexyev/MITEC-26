const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { MdCellTower, MdTerrain } = require("react-icons/md");

const BG = "F8F7F3", INK = "1F2A24", BODY = "3F3F3F", MUTED = "6E6E6E";
const GOLD = "F0B43C", SAGE = "E4ECE1", GREEN = "2D5A44", CARD = "FFFFFF", LINE = "D9DED5";

async function png(svg) { return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64"); }
const iconPng = (Icon) => png(ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color: "#" + INK, size: 256 })));
function daisySvg() {
  const petals = Array.from({ length: 6 }, (_, i) =>
    `<ellipse cx="128" cy="64" rx="27" ry="56" transform="rotate(${i * 60 + 15} 128 128)" fill="#FFFFFF" stroke="#C9D4C6" stroke-width="7"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${petals}<circle cx="128" cy="128" r="27" fill="#${GOLD}"/></svg>`;
}
const T = (s, text, o) => s.addText(text, Object.assign({ fontFace: "Arial", color: BODY, margin: 0, isTextBox: true, valign: "top" }, o));

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "Next Steps";
  const s = pres.addSlide();
  s.background = { color: BG };
  const daisy = await png(daisySvg());
  [[0.08, 5.0, 0.5], [0.55, 5.18, 0.38], [9.25, 0.12, 0.55], [8.8, 0.45, 0.42]].forEach(([x, y, d], i) =>
    s.addImage({ data: daisy, x, y, w: d, h: d, objectName: `Daisy ${i + 1}`, altText: "Daisy decoration" }));

  T(s, "Next Steps", { x: 2, y: 0.2, w: 6, h: 0.75, fontFace: "Playfair Display", fontSize: 38, bold: true, color: INK,
    align: "center", valign: "middle", objectName: "Title" });
  T(s, "Two tests confirm the numbers the plan rests on", { x: 1.5, y: 0.92, w: 7, h: 0.3, fontSize: 13, italic: true,
    color: MUTED, align: "center", valign: "middle", objectName: "Subtitle" });

  const cards = [
    { icon: MdCellTower, title: "Bench test: P3 radios", feeds: "Feeds the radio count and cost (45 modules, $74.6k)",
      rows: [["Range", "≥ 425 m link with a steel P3 in the way", "Sets module spacing; shorter range means more modules"],
             ["Bandwidth", "≥ 2 Mbps per link at that range", "Site control traffic ≈ 24 kbps; the rest carries maps"],
             ["Power", "≤ 2.5 W average, in desert heat", "Sets the 2.6 kWh, 30-day battery per module"]] },
    { icon: MdTerrain, title: "Field test: survey 4x4", feeds: "Feeds the survey time and cost (26 h, ~$244k)",
      rows: [["Speed", "Hold 15 km/h on rough ground", "Gives 76 acres/hr; at 10 km/h it takes ~40\u00A0h"],
             ["Resolution", "≤ 5 cm point spacing across a 30 m strip", "Detail the grading design needs"],
             ["Accuracy", "≤ 5 cm height error at ≥ 30 RTK checkpoints", "Standard survey check (ASPRS)"]] },
  ];
  const cw = 4.4, gap = 0.3, y0 = 1.38, ch = 3.55;
  for (let i = 0; i < 2; i++) {
    const c = cards[i], x = 0.45 + i * (cw + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y0, w: cw, h: ch, rectRadius: 0.15, fill: { color: SAGE },
      line: { color: SAGE }, objectName: `Card ${i + 1}` });
    s.addShape(pres.shapes.OVAL, { x: x + 0.22, y: y0 + 0.2, w: 0.46, h: 0.46, fill: { color: GOLD }, line: { color: GOLD }, objectName: `Icon circle ${i + 1}` });
    s.addImage({ data: await iconPng(c.icon), x: x + 0.32, y: y0 + 0.3, w: 0.26, h: 0.26, objectName: `Icon ${i + 1}`, altText: c.title });
    T(s, c.title, { x: x + 0.8, y: y0 + 0.2, w: cw - 1.0, h: 0.46, fontSize: 16, bold: true, color: GREEN, valign: "middle",
      objectName: `Card title ${i + 1}` });
    const hdr = { bold: true, color: INK, fill: { color: "D3DFCE" } };
    const rows = [[["Check", hdr], ["Pass if", hdr], ["Why it matters", hdr]]]
      .concat(c.rows.map(([a, b, d]) => [[a, { bold: true, color: INK }], [b, {}], [d, { color: MUTED }]]))
      .map((r) => r.map(([text, options]) => ({ text, options })));
    s.addTable(rows, { x: x + 0.22, y: y0 + 0.85, w: cw - 0.44, colW: [0.9, 1.5, cw - 0.44 - 2.4], rowH: [0.3, 0.62, 0.62, 0.62],
      fontFace: "Arial", fontSize: 10.5, color: BODY, valign: "middle", margin: [0.03, 0.07, 0.03, 0.07],
      border: { type: "solid", pt: 0.5, color: LINE }, fill: { color: CARD }, objectName: `Tests ${i + 1}` });
    T(s, "→ " + c.feeds, { x: x + 0.22, y: y0 + ch - 0.45, w: cw - 0.44, h: 0.3, fontSize: 10.5, bold: true, color: GREEN,
      valign: "middle", objectName: `Feeds ${i + 1}` });
  }
  T(s, "Known limit: lidar maps the surface only. Soil and buried utilities come from Exowatt's engineering assessments.",
    { x: 1.3, y: 5.08, w: 7.4, h: 0.3, fontSize: 9.5, color: MUTED, align: "center", valign: "middle", objectName: "Footnote" });

  await pres.writeFile({ fileName: "next_steps_slide.pptx" });
})();

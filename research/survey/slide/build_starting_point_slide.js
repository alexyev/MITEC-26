const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const { MdSatelliteAlt, MdCellTower, MdBolt } = require("react-icons/md");

const BG = "F8F7F3", INK = "1F2A24", BODY = "4A4A4A", MUTED = "6E6E6E";
const GOLD = "F0B43C", CARD = "FFFFFF", LINE = "E4E1D8";

async function png(svg) { return "image/png;base64," + (await sharp(Buffer.from(svg)).png().toBuffer()).toString("base64"); }
async function iconPng(Icon) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Icon, { color: "#" + INK, size: 256 }));
  return png(svg);
}
function daisySvg() {
  const petals = Array.from({ length: 6 }, (_, i) =>
    `<ellipse cx="128" cy="64" rx="27" ry="56" transform="rotate(${i * 60 + 15} 128 128)" fill="#FFFFFF" stroke="#C9D4C6" stroke-width="7"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">${petals}<circle cx="128" cy="128" r="27" fill="#${GOLD}"/></svg>`;
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "The Starting Point";
  const s = pres.addSlide();
  s.background = { color: BG };
  const daisy = await png(daisySvg());
  // Corner daisies, echoing the deck's decoration
  [[0.25, 0.2, 0.75], [0.95, 0.65, 0.65], [0.1, 1.0, 0.68], [8.75, 3.95, 0.68], [9.25, 4.55, 0.62], [8.55, 4.75, 0.6], [9.45, 5.1, 0.35]]
    .forEach(([x, y, d], i) => s.addImage({ data: daisy, x, y, w: d, h: d, objectName: `Daisy ${i + 1}`, altText: "Daisy decoration" }));

  s.addText("The Starting Point", { x: 1.5, y: 0.25, w: 7, h: 0.8, fontFace: "Playfair Display", fontSize: 38, bold: true,
    color: INK, align: "center", valign: "middle", isTextBox: true, objectName: "Title" });

  // ---- Section 1: site assumptions (stat cards)
  const X0 = 1.55, W = 6.9;
  s.addText("The first Exowatt plant", { x: X0, y: 1.2, w: W, h: 0.32, fontFace: "Arial", fontSize: 15, bold: true,
    color: INK, margin: 0, valign: "middle", isTextBox: true, objectName: "Section 1 header" });
  const stats = [["23,000", "P3 units"], ["2,000", "acres"], ["$43,000", "per unit"]];
  const gap = 0.25, cw = (W - 2 * gap) / 3;
  stats.forEach(([big, lab], i) => {
    const x = X0 + i * (cw + gap), y = 1.62;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: 1.05, rectRadius: 0.1, fill: { color: CARD },
      line: { color: LINE, width: 0.75 }, shadow: { type: "outer", color: "000000", opacity: 0.07, blur: 5, offset: 2, angle: 90 },
      objectName: `Stat card ${i + 1}` });
    s.addText(big, { x: x + 0.2, y: y + 0.1, w: cw - 0.4, h: 0.58, fontFace: "Playfair Display", fontSize: 26, bold: true,
      color: INK, margin: 0, valign: "middle", isTextBox: true, objectName: `Stat ${i + 1}` });
    s.addText(lab, { x: x + 0.2, y: y + 0.68, w: cw - 0.4, h: 0.28, fontFace: "Arial", fontSize: 13, color: MUTED,
      margin: 0, valign: "middle", isTextBox: true, objectName: `Stat label ${i + 1}` });
  });

  // ---- Section 2: starting base station
  s.addText("Starting base station on site", { x: X0, y: 2.95, w: W, h: 0.32, fontFace: "Arial", fontSize: 15, bold: true,
    color: INK, margin: 0, valign: "middle", isTextBox: true, objectName: "Section 2 header" });
  const items = [
    [MdSatelliteAlt, "≥ 2 Starlink terminals", "Internet link off site; the second is a backup"],
    [MdCellTower, "High-power radio relay", "Links machines across the site to the base"],
    [MdBolt, "Generators", "Power for the base; no grid on site"],
  ];
  for (let i = 0; i < items.length; i++) {
    const [Icon, name, desc] = items[i], x = X0 + i * (cw + gap), y = 3.37;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cw, h: 1.5, rectRadius: 0.1, fill: { color: CARD },
      line: { color: LINE, width: 0.75 }, shadow: { type: "outer", color: "000000", opacity: 0.07, blur: 5, offset: 2, angle: 90 },
      objectName: `Base card ${i + 1}` });
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: y + 0.18, w: 0.44, h: 0.44, fill: { color: GOLD }, line: { color: GOLD }, objectName: `Base icon circle ${i + 1}` });
    s.addImage({ data: await iconPng(Icon), x: x + 0.29, y: y + 0.27, w: 0.26, h: 0.26, objectName: `Base icon ${i + 1}`, altText: name });
    s.addText(name, { x: x + 0.76, y: y + 0.12, w: cw - 0.96, h: 0.56, fontFace: "Arial", fontSize: 13, bold: true, color: INK,
      margin: 0, valign: "middle", isTextBox: true, objectName: `Base item ${i + 1}` });
    s.addText(desc, { x: x + 0.2, y: y + 0.82, w: cw - 0.4, h: 0.55, fontFace: "Arial", fontSize: 12, color: BODY,
      margin: 0, valign: "top", isTextBox: true, objectName: `Base desc ${i + 1}` });
  }
  await pres.writeFile({ fileName: "starting_point_slide.pptx" });
})();

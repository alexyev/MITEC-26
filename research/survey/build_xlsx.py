"""Build research/survey/survey_tradeoffs.xlsx with live formulas (edit yellow cells on 'Inputs').
Run: python3 research/survey/build_xlsx.py   (then optionally recalc with LibreOffice)."""
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

wb = Workbook()
BOLD = Font(bold=True)
INPUT = PatternFill("solid", fgColor="FFF2CC")
HEAD = PatternFill("solid", fgColor="D9E1F2")
WRAP = Alignment(wrap_text=True, vertical="top")

def header(ws, row, labels, widths=None):
    for j, lab in enumerate(labels, start=1):
        c = ws.cell(row=row, column=j, value=lab)
        c.font = BOLD; c.fill = HEAD; c.alignment = WRAP
    if widths:
        for j, w in enumerate(widths, start=1):
            ws.column_dimensions[get_column_letter(j)].width = w

# ---------------------------------------------------------------- Inputs
ws = wb.active; ws.title = "Inputs"
ws["A1"] = "Inputs — edit YELLOW cells only. Every other sheet is formulas."; ws["A1"].font = Font(bold=True, size=13)
inputs = [
    # key, label, value, unit, source / basis
    ("acres", "Site area", 2000, "acre", "Given"),
    ("acre_m2", "1 acre", 4046.8564224, "m²", "International acre (exact); NIST SP 811 / Handbook 44"),
    ("N", "Effective measurement rate per scanner", 1_000_000, "pts/s", "RIEGL VUX-1HA datasheet (2020): 1,000,000 meas/s @ 1000 kHz PRR"),
    ("k", "Scanners per vehicle", 2, "-", "RIEGL VMX-2HA = 2x VUX-1HA"),
    ("fmin", "Min scan-line rate", 10, "lines/s", "VUX-1HA datasheet: 10–250 scans/s"),
    ("fmax", "Max scan-line rate", 250, "lines/s", "VUX-1HA datasheet: 10–250 scans/s"),
    ("h", "Scanner height above ground", 2.5, "m", "ASSUMPTION (mast over UTV bed)"),
    ("vcap", "Max data-collection speed", 15, "km/h", "ASSUMPTION for semi-rough desert/brush"),
    ("dcap", "Max usable lateral reach (each side)", 15, "m", "ASSUMPTION: grazing angle atan(2.5/15)=9.5°, brush occlusion"),
    ("overlap", "Side overlap between passes", 0.20, "fraction", "ASSUMPTION (strip adjustment needs overlap)"),
    ("turn", "Non-logging time (turns, transit)", 0.15, "fraction", "ASSUMPTION"),
    ("hpd", "Operating hours per day", 10, "h/day", "ASSUMPTION (daylight + supervision)"),
    ("avail", "Availability", 0.85, "fraction", "ASSUMPTION (weather, refuel, maintenance, data offload)"),
    ("nveh", "Number of vehicles (for 'days, n vehicles' column)", 2, "-", "Choice"),
    ("bpp", "Bytes per point", 30, "B", "ASPRS LAS 1.4 Point Data Record Format 6 = 30 bytes"),
    ("up", "Starlink sustained upload", 8, "Mbps", "Starlink spec doc DOC-1525-57370-71: Mobile Priority upload 8–25 Mbps (low end)"),
    ("grid", "DTM grid cell size", 0.10, "m", "Recommendation"),
    ("cellB", "Bytes per DTM cell", 4, "B", "float32"),
    ("ev_kwh", "EV pack (Ranger XP Kinetic Ultimate)", 29.8, "kWh", "Polaris compare-trims page"),
    ("ev_range", "EV rated range", 80, "mi", "Polaris (25 mph, 250 lb cargo)"),
    ("ev_margin", "Rough-terrain/payload energy margin", 0.30, "fraction", "ASSUMPTION"),
    ("payload_kw", "Electrical payload (sensors+compute+Starlink)", 0.53, "kW", "ASSUMPTION: ~250 W MLS + 130 W Thor + 100 W Starlink + 50 W misc"),
    ("usable_soc", "Usable state of charge", 0.80, "fraction", "ASSUMPTION"),
]
header(ws, 3, ["Key", "Parameter", "Value", "Unit", "Source / basis"], [12, 46, 16, 10, 80])
REF = {}
for i, (key, lab, val, unit, src) in enumerate(inputs, start=4):
    ws.cell(row=i, column=1, value=key)
    ws.cell(row=i, column=2, value=lab)
    c = ws.cell(row=i, column=3, value=val); c.fill = INPUT
    ws.cell(row=i, column=4, value=unit)
    ws.cell(row=i, column=5, value=src)
    REF[key] = f"Inputs!$C${i}"
r = len(inputs) + 5
ws.cell(row=r, column=2, value="Derived: site area A").font = BOLD
ws.cell(row=r, column=3, value=f"={REF['acres']}*{REF['acre_m2']}"); ws.cell(row=r, column=4, value="m²")
REF["A"] = f"Inputs!$C${r}"
ws.cell(row=r+1, column=2, value="Derived: v_cap").font = BOLD
ws.cell(row=r+1, column=3, value=f"={REF['vcap']}/3.6"); ws.cell(row=r+1, column=4, value="m/s")
REF["vcap_ms"] = f"Inputs!$C${r+1}"
R = REF

# ---------------------------------------------------------------- Resolution tradeoff
ws = wb.create_sheet("Resolution_Tradeoff")
ws["A1"] = ("Per-vehicle coverage vs required ground point spacing s (profile-scanner model). "
            "f is chosen to maximise coverage subject to caps. Formulas: dα=2πf/N; s_cross(d)=(h²+d²)/h·dα; "
            "s_along=v/(k f); d_max=√(s h/dα − h²); C=2·min(d_max,d_cap)·v")
ws["A1"].alignment = WRAP; ws.merge_cells("A1:Y1"); ws.row_dimensions[1].height = 45
cols = ["s [mm]", "s [m]", "f_unc = sN/(4πh) [Hz]", "f where d_max=d_cap [Hz]", "f no-speed-cap [Hz]",
        "f where v=v_cap [Hz]", "f chosen [Hz]", "dα [mrad]", "s h/dα − h²", "d_max [m]", "d used [m]",
        "Swath [m]", "v [m/s]", "v [km/h]", "Coverage C [m²/s]", "Coverage [acre/h]",
        "Field hours, 1 vehicle", "Days, 1 vehicle", "Days, n vehicles (Inputs)", "Max slant range [m]",
        "Points at exactly 1/s² (lower bound)", "Raw points actually logged", "Raw LAS volume [TB]",
        "Starlink uplink of raw LAS [days]", "Survey line length [km]"]
header(ws, 3, cols, [8, 8, 11, 11, 11, 11, 10, 10, 11, 10, 10, 10, 9, 9, 11, 11, 12, 11, 12, 11, 14, 14, 12, 12, 12])
S_LIST = [1, 2, 3, 5, 7.5, 10, 15, 20, 30, 50, 75, 100, 150, 250]
for i, s_mm in enumerate(S_LIST, start=4):
    ws.cell(row=i, column=1, value=s_mm).fill = INPUT
    f = {
        "B": f"=A{i}/1000",
        "C": f"=B{i}*{R['N']}/(4*PI()*{R['h']})",
        "D": f"=B{i}*{R['h']}*{R['N']}/(2*PI()*({R['dcap']}^2+{R['h']}^2))",
        "E": f"=IF({R['dcap']}>={R['h']},C{i},D{i})",
        "F": f"={R['vcap_ms']}/(B{i}*{R['k']})",
        "G": f"=MIN(MAX(MIN(E{i},F{i}),{R['fmin']}),{R['fmax']})",
        "H": f"=2*PI()*G{i}/{R['N']}*1000",
        "I": f"=B{i}*{R['h']}/(H{i}/1000)-{R['h']}^2",
        "J": f"=IF(I{i}>0,SQRT(I{i}),0)",
        "K": f"=MIN(J{i},{R['dcap']})",
        "L": f"=2*K{i}",
        "M": f"=IF(I{i}>0,MIN(B{i}*{R['k']}*G{i},{R['vcap_ms']}),0)",
        "N": f"=M{i}*3.6",
        "O": f"=L{i}*M{i}",
        "P": f"=O{i}*3600/{R['acre_m2']}",
        "Q": f"=IF(O{i}>0,{R['A']}/(O{i}*(1-{R['overlap']})*(1-{R['turn']}))/3600,NA())",
        "R": f"=Q{i}/({R['hpd']}*{R['avail']})",
        "S": f"=R{i}/{R['nveh']}",
        "T": f"=SQRT({R['h']}^2+K{i}^2)",
        "U": f"={R['A']}/B{i}^2",
        "V": f"={R['k']}*{R['N']}*Q{i}*3600*(1-{R['turn']})",
        "W": f"=V{i}*{R['bpp']}/1E12",
        "X": f"=W{i}*1E12*8/({R['up']}*1E6)/86400",
        "Y": f"=IF(L{i}>0,{R['A']}/(L{i}*(1-{R['overlap']}))/1000,NA())",
    }
    for col, formula in f.items():
        ws[f"{col}{i}"] = formula
last_res = 3 + len(S_LIST)

# ---------------------------------------------------------------- Speed tradeoff (2-D)
ws = wb.create_sheet("Speed_Tradeoff")
ws["A1"] = ("Worst-case point spacing across the whole swath vs speed and swath half-width d. "
            "Optimal line rate equalises along/cross spacing: f=√(vNh/(2πk(h²+d²))), s=√(2πv(h²+d²)/(kNh)); "
            "f clipped to [fmin,fmax] then s=max(v/(kf),(h²+d²)/h·2πf/N). Lower table: coverage in acre/h = 2·d·v.")
ws["A1"].alignment = WRAP; ws.merge_cells("A1:J1"); ws.row_dimensions[1].height = 45
D_LIST = [1, 2.5, 5, 10, 15, 20]
V_LIST = [0.25, 0.5, 1, 2, 5, 10, 15, 20, 25, 30]
ws["A3"] = "Worst-case spacing s [mm]"; ws["A3"].font = BOLD
ws.cell(row=4, column=1, value="v [km/h] \\ d [m]").font = BOLD
for j, d in enumerate(D_LIST, start=2):
    c = ws.cell(row=4, column=j, value=d); c.fill = INPUT; c.font = BOLD
for i, v in enumerate(V_LIST, start=5):
    ws.cell(row=i, column=1, value=v).fill = INPUT
    for j in range(2, 2 + len(D_LIST)):
        col = get_column_letter(j)
        vms = f"($A{i}/3.6)"; d = f"{col}$4"
        fopt = (f"MIN(MAX(SQRT({vms}*{R['N']}*{R['h']}/(2*PI()*{R['k']}*({R['h']}^2+{d}^2))),{R['fmin']}),{R['fmax']})")
        ws[f"{col}{i}"] = (f"=1000*MAX({vms}/({R['k']}*{fopt}),({R['h']}^2+{d}^2)/{R['h']}*2*PI()*{fopt}/{R['N']})")
r0 = 5 + len(V_LIST) + 2
ws.cell(row=r0, column=1, value="Coverage [acre/h] = 2·d·v").font = BOLD
ws.cell(row=r0 + 1, column=1, value="v [km/h] \\ d [m]").font = BOLD
for j, d in enumerate(D_LIST, start=2):
    ws.cell(row=r0 + 1, column=j, value=f"={get_column_letter(j)}$4").font = BOLD
for i, v in enumerate(V_LIST, start=r0 + 2):
    ws.cell(row=i, column=1, value=f"=A{5 + (i - r0 - 2)}")
    for j in range(2, 2 + len(D_LIST)):
        col = get_column_letter(j)
        ws[f"{col}{i}"] = f"=2*{col}$4*($A{i}/3.6)*3600/{R['acre_m2']}"
r1 = r0 + 2 + len(V_LIST) + 2
ws.cell(row=r1, column=1, value="Absolute speed limit for spacing s at zero swath: v_max = k·N·s²/(2π·h); area-optimal speed = v_max/2").font = BOLD
header(ws, r1 + 1, ["s [mm]", "v_max [km/h]", "v_area-optimal [km/h]"])
for i, s_mm in enumerate([1, 2, 5, 10, 20, 50], start=r1 + 2):
    ws.cell(row=i, column=1, value=s_mm).fill = INPUT
    ws.cell(row=i, column=2, value=f"={R['k']}*{R['N']}*(A{i}/1000)^2/(2*PI()*{R['h']})*3.6")
    ws.cell(row=i, column=3, value=f"=B{i}/2")
for j in range(1, 8):
    ws.column_dimensions[get_column_letter(j)].width = 18

# ---------------------------------------------------------------- Sensor bounds
ws = wb.create_sheet("Sensor_Bounds")
ws["A1"] = ("Hard lower bound on survey time, independent of geometry: C_max = N_ground · s² (every ground point "
            "lands in a distinct s×s cell). Real systems are slower (see Resolution_Tradeoff).")
ws["A1"].alignment = WRAP; ws.merge_cells("A1:J1"); ws.row_dimensions[1].height = 35
header(ws, 3, ["Sensor", "Rate [pts/s]", "Fraction hitting ground (assumed)", "N_ground [pts/s]",
               "Hours @1 mm", "Hours @1 cm", "Hours @5 cm", "Angular step [mrad]", "Range where step = 1 mm [m]",
               "Range where step = 5 cm [m]", "Rate source"], [34, 13, 14, 13, 12, 12, 12, 12, 14, 14, 60])
sensors = [
    ("2x RIEGL VUX-1HA (VMX-2HA) @250 Hz", 2_000_000, 0.5, "=2*PI()*250/1E6*1000", "RIEGL VUX-1HA datasheet 1 MHz each"),
    ("2x RIEGL VUX-1HA (VMX-2HA) @10 Hz", 2_000_000, 0.5, "=2*PI()*10/1E6*1000", "RIEGL VUX-1HA datasheet 1 MHz each"),
    ("Ouster OS1-128 (2048x10 mode) horiz", 2_621_440, 0.5, "=RADIANS(360/2048)*1000", "128 ch x 2048 x 10 Hz (computed)"),
    ("Ouster OS1-128 vertical", 2_621_440, 0.5, "=RADIANS(45/128)*1000", "45° VFOV / 128 ch"),
    ("Hesai PandarXT32 horiz (single return)", 640_000, 0.5, "=RADIANS(0.18)*1000", "Hesai: 640k pts/s single return, 0.18°"),
    ("DJI Zenmuse L2 (aerial, single return)", 240_000, 1.0, None, "DJI L2 published 240k pts/s"),
]
for i, (name, rate, frac, step, src) in enumerate(sensors, start=4):
    ws.cell(row=i, column=1, value=name)
    ws.cell(row=i, column=2, value=rate).fill = INPUT
    ws.cell(row=i, column=3, value=frac).fill = INPUT
    ws.cell(row=i, column=4, value=f"=B{i}*C{i}")
    for col, s in (("E", 0.001), ("F", 0.01), ("G", 0.05)):
        ws[f"{col}{i}"] = f"={R['A']}/(D{i}*{s}^2)/3600"
    if step:
        ws[f"H{i}"] = step
        ws[f"I{i}"] = f"=0.001/(H{i}/1000)"
        ws[f"J{i}"] = f"=0.05/(H{i}/1000)"
    ws.cell(row=i, column=11, value=src)

# ---------------------------------------------------------------- Costs
ws = wb.create_sheet("Costs")
ws["A1"] = ("Hardware cost per vehicle. 'Listed' = price on a vendor/reseller page; 'Press' = list price reported in trade "
            "press; 'Estimate' = quote-only item, budgetary number with stated basis. CONFIRM ALL BY QUOTE.")
ws["A1"].alignment = WRAP; ws.merge_cells("A1:H1"); ws.row_dimensions[1].height = 35
header(ws, 3, ["Tier", "Item", "Qty", "Unit price [USD]", "Extended [USD]", "Price type", "Link", "Note"],
       [10, 52, 6, 15, 15, 12, 70, 70])
L = {
    "ranger": "https://www.polaris.com/en-us/off-road/ranger/",
    "dataspeed": "https://www.fwi.co.uk/machinery/atvs/dataspeed-develops-driverless-system-for-polaris-utvs",
    "vmx": "https://www.riegl.com/en-austria/products/detail/riegl-vmx-2ha",
    "mmscost": "https://swyvl.io/blog/3d-mapping-cost-guide/",
    "os1": "https://eu.robotshop.com/products/general-laser-ouster-os1-128-rev-7-mid-range-lidar-sensor",
    "poslv": "https://applanix.trimble.com/en/products/hardware/applanix-pos-lv",
    "poslv_used": "https://www.thephotoforum.com/threads/applanix-pos-lv-for-sale.423288/",
    "starperf": "https://www.gps4us.com/KVH-Starlink-Performance-Gen-3-Kit-%2D-Flat-Mount-w-and-o-Router--P368962.html",
    "starmini": "https://www.starlink.com/mini-product-us",
    "thor": "https://www.hackster.io/news/nvidia-tells-resellers-to-open-jetson-agx-thor-developer-kit-orders-at-3-499-06e8cbf52441",
    "victbatt": "https://offgridsource.com/products/victron-lithium-ng-battery-12-8v-200-ah",
    "orion": "https://windandsolar.com/products/victron-energy-orion-xs-1212-50a-dc-dc-battery-charger",
    "rs3": "https://advexure.com/products/emlid-reach-rs3",
    "m350l2": "https://buydirectny.com/products/dji-matrice-350-rtk-drone-combo-zenmuse-l2-lidar-care-basic",
    "kinetic": "https://www.atv.com/specs/polaris/utility/2027/ranger-xp-kinetic/ultimate/detail.html",
}
common = [
    ("Polaris RANGER XP 1000 (gasoline), base trim", 1, 21799, "Listed", L["ranger"], "2027 MY starting MSRP; NorthStar cab trim (what Dataspeed kit targets) costs more; + destination"),
    ("Dataspeed driverless kit for Ranger XP1000 NorthStar (by-wire + path following)", 1, 100000, "Press", L["dataspeed"], "Farmers Weekly reports $100,000 list (~2024). Confirm scope (e-stop, obstacle lidar) by quote"),
    ("Starlink Performance (Gen 3) kit, flat mount + router (KVH-supplied)", 1, 2049, "Listed", L["starperf"], "75–100 W; in-motion rated. Reseller listings $1,849–$2,049"),
    ("Starlink Mini (redundant link)", 1, 599, "Listed", L["starmini"], "Price range found $249–$599; upper bound used. 25–40 W"),
    ("NVIDIA Jetson AGX Thor Developer Kit (autonomy/QA compute)", 1, 3499, "Listed", L["thor"], "40–130 W. Dev kit is not ruggedised: budget a rugged carrier for production"),
    ("Victron LiFePO4 12.8 V / 200 Ah (2.56 kWh) aux battery", 1, 1409.30, "Listed", L["victbatt"], "Isolates sensors from engine-start battery"),
    ("Victron Orion XS 12/12-50A DC-DC charger", 1, 386, "Listed", L["orion"], "List $386; street ~$328–$338"),
    ("Mast, mounts, wiring, enclosure fabrication + integration labour", 1, 15000, "Estimate", "", "ASSUMPTION — no public source"),
    ("Removable rugged SSD set for data shuttle (2 x ~8 TB)", 1, 1500, "Estimate", "", "ASSUMPTION — size from Resolution_Tradeoff raw volume"),
]
tierS = [("RIEGL VMX-2HA mobile mapping system (2x VUX-1HA + GNSS/INS)", 1, 600000, "Estimate", L["vmx"],
          "Quote-only. Secondary cost guides give ~$250k–$1.2M for high-end vehicle MLS (see report §7). Mid value used"),
         ("Lidar processing software (annual)", 1, 15000, "Estimate", L["mmscost"], "Secondary source: $2k–$15k/yr; upper value used")]
tierE = [("Ouster OS1-128 Rev 7 lidar", 1, 20000, "Listed", L["os1"], "RobotShop EU €18,634 incl. tax; 2019 US launch list $18,000. ~$20k budget"),
         ("Applanix POS LV 220 (dual-GNSS INS + POSPac)", 1, 85000, "Estimate", L["poslv"],
          "Quote-only. Only public number: forum post, unit bought new for $85k (~2017), resold $45k. LOW confidence"),
         ("GNSS/INS + lidar georeferencing software (annual)", 1, 15000, "Estimate", L["mmscost"], "Secondary source: $2k–$15k/yr")]
row = 4
def put(tier, items):
    global row
    start = row
    for (item, q, p, typ, link, note) in items:
        ws.cell(row=row, column=1, value=tier); ws.cell(row=row, column=2, value=item)
        ws.cell(row=row, column=3, value=q).fill = INPUT
        c = ws.cell(row=row, column=4, value=p); c.fill = INPUT; c.number_format = '#,##0.00'
        ws.cell(row=row, column=5, value=f"=C{row}*D{row}").number_format = '#,##0'
        ws.cell(row=row, column=6, value=typ); ws.cell(row=row, column=7, value=link); ws.cell(row=row, column=8, value=note)
        row += 1
    return start, row - 1
cs, ce = put("Common", common)
ss, se = put("Tier S", tierS)
es, ee = put("Tier E", tierE)
row += 1
ws.cell(row=row, column=2, value="Per-vehicle total, Tier S (survey-grade MLS)").font = BOLD
ws.cell(row=row, column=5, value=f"=SUM(E{cs}:E{ce})+SUM(E{ss}:E{se})").number_format = '#,##0'
TOT_S = f"Costs!$E${row}"; row += 1
ws.cell(row=row, column=2, value="Per-vehicle total, Tier E (engineering-grade)").font = BOLD
ws.cell(row=row, column=5, value=f"=SUM(E{cs}:E{ce})+SUM(E{es}:E{ee})").number_format = '#,##0'
TOT_E = f"Costs!$E${row}"; row += 2
ws.cell(row=row, column=2, value="Shared (one per site)").font = BOLD; row += 1
sh_s = row
for (item, q, p, typ, link, note) in [
    ("Emlid Reach RS3 GNSS receiver (1 base + 1 checkpoint rover)", 2, 2999, "Listed", L["rs3"], "7 mm+1 ppm H / 14 mm+1 ppm V RTK; logs RINEX for PPK"),
]:
    ws.cell(row=row, column=1, value="Shared"); ws.cell(row=row, column=2, value=item)
    ws.cell(row=row, column=3, value=q).fill = INPUT; ws.cell(row=row, column=4, value=p).fill = INPUT
    ws.cell(row=row, column=5, value=f"=C{row}*D{row}"); ws.cell(row=row, column=6, value=typ)
    ws.cell(row=row, column=7, value=link); ws.cell(row=row, column=8, value=note); row += 1
SHARED = f"Costs!$E${sh_s}"
row += 1
ws.cell(row=row, column=2, value="Monthly operating").font = BOLD; row += 1
ws.cell(row=row, column=2, value="Starlink service per terminal per month (Roam Unlimited)")
ws.cell(row=row, column=4, value=175).fill = INPUT
ws.cell(row=row, column=6, value="Listed")
ws.cell(row=row, column=7, value="https://www.starlink.com/public-files/CIS_Roam_March2025.pdf")
ws.cell(row=row, column=8, value="Reported $165–$175/mo; upper used. Mobile Priority plans (higher upload) priced separately — quote")
STAR_MO = f"Costs!$D${row}"; row += 2
ws.cell(row=row, column=2, value="Alternative: aerial lidar kit").font = BOLD; row += 1
ws.cell(row=row, column=1, value="UAV"); ws.cell(row=row, column=2, value="DJI Matrice 350 RTK + Zenmuse L2 + Care Basic (bundle)")
ws.cell(row=row, column=3, value=1).fill = INPUT; ws.cell(row=row, column=4, value=41037.15).fill = INPUT
ws.cell(row=row, column=5, value=f"=C{row}*D{row}"); ws.cell(row=row, column=6, value="Listed")
ws.cell(row=row, column=7, value=L["m350l2"])
ws.cell(row=row, column=8, value="FCC Covered List (23 Dec 2025) blocks NEW DJI models; previously authorised models remain legal to sell/use. Supply/repair risk")
UAV = f"Costs!$E${row}"

# ---------------------------------------------------------------- Fleet
ws = wb.create_sheet("Fleet")
ws["A1"] = "Calendar days to survey the whole site vs fleet size and spacing (from Resolution_Tradeoff col R ÷ n). Capex below."
ws.merge_cells("A1:L1")
N_LIST = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20]
ws.cell(row=3, column=1, value="s [mm] \\ vehicles").font = BOLD
for j, n in enumerate(N_LIST, start=2):
    c = ws.cell(row=3, column=j, value=n); c.fill = INPUT; c.font = BOLD
for i, rr in enumerate(range(4, last_res + 1), start=4):
    ws.cell(row=i, column=1, value=f"=Resolution_Tradeoff!A{rr}")
    for j in range(2, 2 + len(N_LIST)):
        col = get_column_letter(j)
        ws[f"{col}{i}"] = f"=Resolution_Tradeoff!$R{rr}/{col}$3"
rc = 4 + len(S_LIST) + 1
ws.cell(row=rc, column=1, value="Capex [USD]").font = BOLD
ws.cell(row=rc + 1, column=1, value="Tier S fleet")
ws.cell(row=rc + 2, column=1, value="Tier E fleet")
ws.cell(row=rc + 3, column=1, value="Starlink service / month (2 terminals per vehicle)")
for j in range(2, 2 + len(N_LIST)):
    col = get_column_letter(j)
    ws[f"{col}{rc+1}"] = f"={col}$3*{TOT_S}+{SHARED}"
    ws[f"{col}{rc+2}"] = f"={col}$3*{TOT_E}+{SHARED}"
    ws[f"{col}{rc+3}"] = f"={col}$3*2*{STAR_MO}"
    for k in (1, 2, 3):
        ws[f"{col}{rc+k}"].number_format = '#,##0'
ws.cell(row=rc + 5, column=1, value="UAV alternative (1 kit + shared GNSS)")
ws.cell(row=rc + 5, column=2, value=f"={UAV}+{SHARED}").number_format = '#,##0'
ws.column_dimensions["A"].width = 44

# ---------------------------------------------------------------- Data + power
ws = wb.create_sheet("Data_Power")
header(ws, 2, ["Quantity", "Value", "Unit", "Formula / note"], [52, 16, 10, 80])
items = [
    ("Raw point stream per vehicle", f"={R['k']}*{R['N']}*{R['bpp']}*8/1E6", "Mbps", "k·N·bytes·8"),
    ("Starlink sustained upload (input)", f"={R['up']}", "Mbps", "Inputs"),
    ("Ratio raw stream / uplink", "=B3/B4", "x", "How many Starlinks you would need to stream raw data"),
    ("DTM cells for site", f"={R['A']}/{R['grid']}^2", "cells", "A / grid²"),
    ("DTM size", f"=B6*{R['cellB']}/1E9", "GB", "cells · 4 B"),
    ("DTM uplink time", f"=B7*1E9*8/({R['up']}*1E6)/3600", "h", "at sustained upload"),
    ("EV rated consumption", f"={R['ev_kwh']}/({R['ev_range']}*1.609344)", "kWh/km", "pack / rated range"),
    ("EV consumption with margin", f"=B9*(1+{R['ev_margin']})", "kWh/km", ""),
    ("Energy per survey hour at v_cap", f"=B10*{R['vcap']}+{R['payload_kw']}", "kWh/h", "drive + payload"),
    ("EV hours per charge", f"={R['ev_kwh']}*{R['usable_soc']}/B11", "h", "usable pack / hourly energy"),
    ("Payload energy per 10 h day", f"={R['payload_kw']}*{R['hpd']}", "kWh", "aux battery is 2.56 kWh → needs DC-DC charging while driving"),
]
for i, (q, f, u, note) in enumerate(items, start=3):
    ws.cell(row=i, column=1, value=q); ws.cell(row=i, column=2, value=f); ws.cell(row=i, column=3, value=u); ws.cell(row=i, column=4, value=note)

wb.save("research/survey/survey_tradeoffs.xlsx")
print("written research/survey/survey_tradeoffs.xlsx")

"""
Survey coverage model for a ground-vehicle (mobile) lidar survey of a 2,000-acre site.

Reproduces every number in research/survey-vehicle-lidar-analysis.md.
Run:  python3 research/survey/survey_model.py

Model (profile / line scanner, e.g. RIEGL VUX-1HA class), all SI units:
  N    effective measurement rate of ONE scanner [pts/s]
  k    number of scanners on the vehicle (their scan lines interleave along track)
  f    scan-line (mirror rotation) rate [lines/s]
  h    scanner height above ground [m]
  s    required ground point spacing [m]  (s = 1 mm  <=> "1 mm^2 resolution")
  angular step            da   = 2*pi*f/N
  cross-track spacing     s_c(d) = (h^2 + d^2)/h * da     (from d = h*tan(a) -> dd/da = (h^2+d^2)/h)
  along-track spacing     s_a  = v/(k*f)
  max lateral offset      d_max = sqrt(s*h/da - h^2)      (s_c(d_max) = s); infeasible if h*da > s
  swath                   W = 2*min(d_max, d_cap)
  speed                   v = min(s*k*f, v_cap)
  coverage rate           C = W*v  [m^2/s]
Unconstrained optimum over f:  f* = s*N/(4*pi*h),  d_max(f*) = h,  C* = k*N*s^2/(2*pi)
"""
import math

ACRE_M2 = 4046.8564224                 # international acre, exact (NIST)
SITE_ACRES = 2000
A = SITE_ACRES * ACRE_M2               # m^2

# ---- Scanner: RIEGL VUX-1HA (datasheet 2020): 1,000,000 meas/s @ 1000 kHz, 10..250 lines/s,
#      accuracy 5 mm, precision 3 mm, divergence 0.5 mrad. VMX-2HA carries two of them.
N = 1.0e6
K = 2
F_MIN, F_MAX = 10.0, 250.0
H = 2.5          # m, ASSUMPTION: scanner head on a mast over a UTV bed
V_CAP = 15/3.6   # m/s, ASSUMPTION: 15 km/h max data-collection speed on semi-rough ground
D_CAP = 15.0     # m,  ASSUMPTION: usable lateral reach (grazing angle atan(2.5/15)=9.5 deg; brush occlusion)
OVERLAP = 0.20   # ASSUMPTION: side overlap between adjacent passes for strip adjustment
TURN = 0.15      # ASSUMPTION: fraction of drive time spent turning / transiting / not logging
HOURS_PER_DAY = 10.0   # ASSUMPTION
AVAIL = 0.85           # ASSUMPTION: weather, refuel/recharge, maintenance, data offload


def best_f(s, N=N, k=K, h=H, v_cap=V_CAP, d_cap=D_CAP, fmin=F_MIN, fmax=F_MAX):
    f_unc = s * N / (4 * math.pi * h)
    f_w = s * h * N / (2 * math.pi * (d_cap**2 + h**2))      # f where d_max == d_cap
    f_nocap = f_unc if d_cap >= h else f_w
    f_v = v_cap / (s * k)                                      # f where speed hits v_cap
    return min(max(min(f_nocap, f_v), fmin), fmax)


def coverage(s, f=None, N=N, k=K, h=H, v_cap=V_CAP, d_cap=D_CAP):
    if f is None:
        f = best_f(s, N, k, h, v_cap, d_cap)
    da = 2 * math.pi * f / N
    inner = s * h / da - h**2
    if inner <= 0:
        return dict(f=f, da=da, d_max=0.0, W=0.0, v=0.0, C=0.0, feasible=False)
    d_max = math.sqrt(inner)
    d = min(d_max, d_cap)
    v = min(s * k * f, v_cap)
    C = 2 * d * v
    return dict(f=f, da=da, d_max=d_max, d=d, W=2*d, v=v, C=C, feasible=True,
                slant=math.hypot(h, d))


def field_hours(C, n=1):
    C_eff = C * (1 - OVERLAP) * (1 - TURN)
    return A / C_eff / n / 3600.0


if __name__ == "__main__":
    print(f"Site area A = {SITE_ACRES} ac x {ACRE_M2} m2/ac = {A:,.1f} m2 = {A/1e6:.4f} km2\n")

    print("Points needed at exactly one point per s x s cell (lower bound, no oversampling):")
    for s in [0.001, 0.01, 0.05, 0.10]:
        pts = A / s**2
        print(f"  s={s*1000:6.1f} mm  rho={1/s**2:>12,.0f} pts/m2  total={pts:.3e} pts  "
              f"LAS(30 B/pt)={pts*30/1e12:,.2f} TB")
    print()

    hdr = (f"{'s [mm]':>7} {'f [Hz]':>7} {'da[mrad]':>8} {'d_max[m]':>8} {'swath[m]':>8} "
           f"{'v[km/h]':>8} {'C[m2/s]':>9} {'ac/h':>8} {'h/2000ac':>10} {'days(1 veh)':>11}")
    print("Per-vehicle coverage, 2x VUX-1HA, h=2.5 m, v_cap=15 km/h, d_cap=15 m:")
    print(hdr)
    for s_mm in [1, 2, 5, 10, 20, 50, 100, 250]:
        s = s_mm / 1000
        r = coverage(s)
        if not r["feasible"]:
            print(f"{s_mm:>7} infeasible"); continue
        hrs = field_hours(r["C"])
        days = hrs / (HOURS_PER_DAY * AVAIL)
        print(f"{s_mm:>7} {r['f']:>7.1f} {r['da']*1e3:>8.4f} {r['d_max']:>8.2f} {r['W']:>8.2f} "
              f"{r['v']*3.6:>8.3f} {r['C']:>9.3f} {r['C']*3600/ACRE_M2:>8.2f} {hrs:>10,.0f} {days:>11,.1f}")
    print()

    # Closed-form check for 1 mm
    s = 0.001
    Cstar = K * N * s**2 / (2 * math.pi)
    print(f"Closed form C* = k N s^2/(2 pi) at 1 mm = {Cstar:.4f} m2/s  (f*={s*N/(4*math.pi*H):.2f} Hz, d_max=h={H} m)")
    # Max reach for 1 mm at slowest mirror (10 Hz)
    r10 = coverage(0.001, f=10.0)
    print(f"1 mm at f=10 Hz (finest angular step): d_max={r10['d_max']:.2f} m, slant={math.hypot(H, r10['d_max']):.2f} m, "
          f"v={r10['v']*100:.1f} cm/s, C={r10['C']:.3f} m2/s")
    print()

    # Best-case angular-sampling range for common sensors: r = s / dtheta (beam perpendicular to surface)
    print("Range at which angular sampling alone equals s (normal incidence, best case):")
    sensors = {
        "VUX-1HA @250 Hz (1.0 MHz)": 2*math.pi*250/1e6,
        "VUX-1HA @10 Hz  (1.0 MHz)": 2*math.pi*10/1e6,
        "Hesai XT32 horiz 0.18 deg": math.radians(0.18),
        "Hesai XT32 vert 1.0 deg": math.radians(1.0),
        "Ouster OS1-128 horiz 360/2048": math.radians(360/2048),
        "Ouster OS1-128 vert 45/128 deg": math.radians(45/128),
    }
    for name, dth in sensors.items():
        print(f"  {name:32s} dtheta={dth*1e3:7.4f} mrad  r(1mm)={0.001/dth:8.3f} m  r(1cm)={0.01/dth:8.2f} m  r(5cm)={0.05/dth:8.2f} m")
    print()

    # Footprint lower bound (divergence only; exit diameter adds to it)
    print("Beam-footprint growth (0.5 mrad divergence) — lower bound, excludes exit aperture:")
    for rr in [2.5, 5, 10, 15]:
        print(f"  r={rr:5.1f} m: +{0.5e-3*rr*1000:.2f} mm")
    print()

    # Georeferencing error budget (POS LV 610/620 post-processed, RMS)
    print("Error budget, POS LV 610/620 PP (RMS): X,Y 20 mm, Z 30 mm, roll/pitch 0.0025 deg, heading 0.015 deg")
    rp = math.radians(0.0025); hd = math.radians(0.015)
    for rr in [3, 10, 15]:
        print(f"  r={rr:3d} m: roll/pitch -> {rp*rr*1000:.2f} mm, heading -> {hd*rr*1000:.2f} mm")
    sz = math.sqrt(30**2 + 3**2 + (rp*15*1000)**2)
    print(f"  vertical RSS (Z 30, range noise 3, pitch@15 m): {sz:.1f} mm")
    print()

    # Fleet table for the recommended spec (5 cm) and 1 mm
    for s_mm in [1, 10, 50]:
        r = coverage(s_mm/1000)
        print(f"Fleet, s={s_mm} mm: ", end="")
        for n in [1, 2, 3, 5, 10, 20]:
            hrs = field_hours(r["C"], n)
            print(f"n={n}: {hrs/(HOURS_PER_DAY*AVAIL):,.1f} d; ", end="")
        print()
    print()

    # Data volume & Starlink
    print("Data volume (LAS PDRF 6 = 30 B/pt) and Starlink uplink time:")
    for s_mm in [1, 10, 50]:
        r = coverage(s_mm/1000)
        hrs = field_hours(r["C"])
        logging_s = hrs * 3600 * (1 - TURN)          # scanners log while driving survey lines
        pts = K * N * logging_s
        b = pts * 30
        for up in [8e6, 25e6]:
            t_days = b * 8 / up / 86400
            print(f"  s={s_mm:3d} mm: points={pts:.3e}, LAS={b/1e12:,.1f} TB, uplink@{up/1e6:.0f} Mbps = {t_days:,.0f} days")
    rate_bps = K * N * 30 * 8
    print(f"  Raw stream per vehicle: {rate_bps/1e6:,.0f} Mbps (vs Starlink Mobile Priority 8-25 Mbps upload)")
    for g in [0.05, 0.10, 0.25]:
        cells = A / g**2
        print(f"  DTM grid {g*100:.0f} cm float32: {cells:.3e} cells = {cells*4/1e9:.2f} GB -> {cells*4*8/8e6/3600:.1f} h @ 8 Mbps")
    print()

    # EV energy check
    print("EV energy (Ranger XP Kinetic Ultimate 29.8 kWh, 80 mi @25 mph w/250 lb):")
    kwh_km = 29.8 / (80 * 1.609344)
    print(f"  rated {kwh_km:.4f} kWh/km; with +30% rough-terrain/payload margin {kwh_km*1.3:.4f} kWh/km")
    r = coverage(0.05)
    v_kmh = r["v"] * 3.6
    payload_kw = 0.53
    per_h = kwh_km * 1.3 * v_kmh + payload_kw
    print(f"  at {v_kmh:.1f} km/h + {payload_kw} kW payload: {per_h:.2f} kWh/h -> {29.8*0.8/per_h:.1f} h on 80% of pack")

    # UAV comparison (DJI L2 published: 2.5 km2/flight @150 m, 15 m/s, 20% side overlap)
    print("\nUAV comparison: 2.5 km2/flight ->", f"{A/2.5e6:.2f} flights for the site")

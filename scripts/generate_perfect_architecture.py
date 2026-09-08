"""
Architecture diagram matching the reference image style exactly:
- White background
- Dark navy header bar on TOP of each card (label inside)
- Large, clear icons inside white card body
- Top row: 5 stages connected left-to-right with solid arrows
- Bottom row: 3 support blocks connected with solid arrows
- Dashed arrows from top row down to bottom row
"""
import os, sys, math
try:
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Arc, FancyArrow
    import numpy as np
except ImportError:
    import subprocess; subprocess.check_call([sys.executable,"-m","pip","install","matplotlib"])
    import matplotlib; matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, Arc, FancyArrow
    import numpy as np

# ── PALETTE ──────────────────────────────────────────────────────────────────
BG      = '#FFFFFF'   # white page
NAVY    = '#1A2E4A'   # dark navy (header + arrows)
WHITE   = '#FFFFFF'
CARD_BG = '#FFFFFF'
CARD_BD = '#D0D8E4'   # light border
TXT     = '#1A2E4A'   # body text
SUBTXT  = '#4A6080'
DASH_C  = '#6B8DB5'   # dashed arrow colour

# ── FIGURE ───────────────────────────────────────────────────────────────────
W, H = 2600, 1300
fig, ax = plt.subplots(figsize=(26, 13), dpi=200)
fig.patch.set_facecolor(BG)
ax.set_facecolor(BG)
ax.set_xlim(0, W); ax.set_ylim(0, H)
ax.set_aspect('equal'); ax.axis('off')

# ── CARD HELPER ──────────────────────────────────────────────────────────────
HDR_H = 56   # height of the dark navy header strip

def card(x, y, w, h, header_text):
    """White card with dark navy header bar on top."""
    rad = 12
    # shadow
    ax.add_patch(FancyBboxPatch((x+4, y-4), w, h,
        boxstyle=f"round,pad=0,rounding_size={rad}",
        fc='#B0BEC5', ec='none', alpha=0.18, zorder=2))
    # white body
    ax.add_patch(FancyBboxPatch((x, y), w, h,
        boxstyle=f"round,pad=0,rounding_size={rad}",
        fc=CARD_BG, ec=CARD_BD, lw=1.5, zorder=3))
    # navy top header  (clipped to top rounded corners area)
    ax.add_patch(FancyBboxPatch((x, y+h-HDR_H), w, HDR_H,
        boxstyle=f"round,pad=0,rounding_size={rad}",
        fc=NAVY, ec='none', zorder=4))
    # cover the bottom corners of the header strip (make it flat at bottom)
    ax.add_patch(mpatches.Rectangle((x, y+h-HDR_H), w, HDR_H//2,
        fc=NAVY, ec='none', zorder=5))
    # header text
    ax.text(x+w/2, y+h-HDR_H/2,
            header_text,
            color=WHITE, fontsize=10, fontweight='bold',
            ha='center', va='center', family='sans-serif',
            zorder=6, multialignment='center')

def label(x, y, text, size=9.5, color=TXT, bold=False, sub=False):
    ax.text(x, y, text, color=color,
            fontsize=size, fontweight='bold' if bold else 'normal',
            ha='center', va='center', family='sans-serif', zorder=8,
            multialignment='center')

# ── ARROW HELPERS ─────────────────────────────────────────────────────────────
SOLID_KW = dict(arrowstyle="Simple,tail_width=3,head_width=16,head_length=14",
                color=NAVY, lw=0, alpha=0.85, zorder=10)
DASH_KW  = dict(color=DASH_C, lw=2.2, linestyle='--', alpha=0.75, zorder=9)

def solid_arrow(x1, y, x2):
    ax.add_patch(FancyArrowPatch((x1, y), (x2, y), **SOLID_KW))

def dashed_arrow_v(x, y1, y2):
    """Dashed vertical arrow (down)."""
    ax.annotate('', xy=(x, y2), xytext=(x, y1),
                arrowprops=dict(arrowstyle='->', color=DASH_C,
                                lw=2.2, linestyle='dashed',
                                mutation_scale=18), zorder=9)

def dashed_line_h(x1, y, x2):
    ax.plot([x1, x2], [y, y], **DASH_KW)

# ── ICONS  (all in NAVY colour, matching reference style) ────────────────────

def ico_thermometer(ax, cx, cy):
    ax.add_patch(mpatches.Rectangle((cx-4, cy-14), 8, 20, fc=NAVY, ec='none', alpha=0.85, zorder=7))
    ax.add_patch(plt.Circle((cx, cy-14), 7, fc=NAVY, ec='none', alpha=0.85, zorder=7))
    ax.add_patch(mpatches.Rectangle((cx-2, cy-14), 4, 18, fc=WHITE, ec='none', alpha=0.6, zorder=8))
    ax.add_patch(plt.Circle((cx, cy-14), 4.5, fc=WHITE, ec='none', alpha=0.6, zorder=8))

def ico_leaf_small(ax, cx, cy, c=NAVY):
    ax.add_patch(mpatches.Ellipse((cx, cy+2), 20, 28, angle=0,
                                   fc=c, ec='none', alpha=0.80, zorder=7))
    ax.plot([cx, cx], [cy-12, cy+10], color=WHITE, lw=1.5, alpha=0.7, zorder=8)

def ico_camera(ax, cx, cy):
    ax.add_patch(FancyBboxPatch((cx-20, cy-14), 40, 28,
        boxstyle="round,pad=0,rounding_size=4", fc=NAVY, ec='none', alpha=0.85, zorder=7))
    ax.add_patch(plt.Circle((cx, cy), 10, fc='none', ec=WHITE, lw=2, zorder=8))
    ax.add_patch(plt.Circle((cx, cy), 5, fc=WHITE, ec='none', alpha=0.7, zorder=8))
    ax.add_patch(FancyBboxPatch((cx-5, cy+12), 10, 6,
        boxstyle="round,pad=0,rounding_size=2", fc=NAVY, ec=WHITE, lw=1.2, zorder=8))

def ico_gear(ax, cx, cy):
    ax.add_patch(plt.Circle((cx, cy), 20, fc='none', ec=NAVY, lw=2.5, alpha=0.85, zorder=7))
    ax.add_patch(plt.Circle((cx, cy), 10, fc='none', ec=NAVY, lw=2.5, alpha=0.85, zorder=8))
    for a in range(0, 360, 45):
        r = math.radians(a)
        rx, ry = cx + 20*math.cos(r), cy + 20*math.sin(r)
        ax.add_patch(mpatches.Rectangle((rx-4, ry-4), 8, 8,
            fc=NAVY, ec='none', alpha=0.85, zorder=7,
            transform=ax.transData))

def ico_datafusion(ax, cx, cy):
    # Three lines merging to one point (fork/merge icon)
    for dx in [-16, 0, 16]:
        ax.annotate('', xy=(cx, cy-10), xytext=(cx+dx, cy+16),
                    arrowprops=dict(arrowstyle='->', color=NAVY, lw=2.0,
                                    mutation_scale=14), zorder=7)

def ico_neural(ax, cx, cy):
    # Neural network: 2 input → 3 hidden → 2 output layers
    layers = [[-20, [(cx-32, cy+12),(cx-32, cy-12)]],
              [ 0,  [(cx, cy+20),(cx, cy),(cx, cy-20)]],
              [20,  [(cx+32, cy+12),(cx+32, cy-12)]]]
    pts = {}
    for li, (_, nodes) in enumerate(layers):
        pts[li] = nodes
        for nx, ny in nodes:
            ax.add_patch(plt.Circle((nx, ny), 5.5, fc=NAVY, ec='none', alpha=0.9, zorder=7))
    for (nx, ny) in pts[0]:
        for (mx, my) in pts[1]:
            ax.plot([nx,mx],[ny,my], color=NAVY, lw=1.2, alpha=0.35, zorder=6)
    for (nx, ny) in pts[1]:
        for (mx, my) in pts[2]:
            ax.plot([nx,mx],[ny,my], color=NAVY, lw=1.2, alpha=0.35, zorder=6)

def ico_barchart(ax, cx, cy):
    hts = [14, 26, 18, 32]
    for i, h in enumerate(hts):
        bx = cx - 20 + i*13
        ax.add_patch(mpatches.Rectangle((bx-4, cy-18), 9, h,
            fc=NAVY, ec='none', alpha=0.75+0.06*i, zorder=7))
    # checkmark
    ax.plot([cx+14, cx+19, cx+28],[cy-2, cy+8, cy-8],
            color=NAVY, lw=3, solid_capstyle='round', zorder=8)

def ico_gradcam(ax, cx, cy):
    """Leaf with heat overlay rings."""
    # Leaf shape
    ax.add_patch(mpatches.Ellipse((cx, cy+4), 46, 58, angle=0,
                                   fc='#4CAF50', ec='none', alpha=0.75, zorder=6))
    ax.plot([cx, cx], [cy-24, cy+22], color='#2E7D32', lw=2, zorder=7)
    ax.plot([cx, cx+14], [cy+5, cy+15], color='#2E7D32', lw=1.2, alpha=0.6, zorder=7)
    ax.plot([cx, cx-12], [cy-4, cy+8], color='#2E7D32', lw=1.2, alpha=0.6, zorder=7)
    # Heat rings
    for r, col, al in [(16,'#FF5722',0.55),(10,'#FF9800',0.65),(5,'#F44336',0.80)]:
        ax.add_patch(plt.Circle((cx+4, cy+6), r, fc=col, ec='none', alpha=al, zorder=8))
    # Corner brackets (scan frame)
    bsz, bl = 10, 5
    for bx, by in [(cx-26,cy-28),(cx+26,cy-28),(cx-26,cy+30),(cx+26,cy+30)]:
        ax.plot([bx,bx+bsz*(1 if bx<cx else -1)],[by,by], color=NAVY, lw=2.5, zorder=9)
        ax.plot([bx,bx],[by,by+bl*(1 if by<cy else -1)], color=NAVY, lw=2.5, zorder=9)

def ico_bottle(ax, cx, cy):
    # Bottle body
    ax.add_patch(FancyBboxPatch((cx-9, cy-18), 18, 28,
        boxstyle="round,pad=0,rounding_size=5",
        fc=NAVY, ec='none', alpha=0.80, zorder=7))
    # Neck
    ax.add_patch(mpatches.Rectangle((cx-5, cy+10), 10, 10,
        fc=NAVY, ec='none', alpha=0.80, zorder=7))
    # Cap
    ax.add_patch(FancyBboxPatch((cx-7, cy+18), 14, 7,
        boxstyle="round,pad=0,rounding_size=2",
        fc=NAVY, ec='none', alpha=1.0, zorder=8))
    # Small leaf on bottle
    ico_leaf_small(ax, cx+4, cy-4, c='#4CAF50')

def ico_clipboard(ax, cx, cy):
    ax.add_patch(FancyBboxPatch((cx-17, cy-22), 34, 42,
        boxstyle="round,pad=0,rounding_size=4",
        fc='none', ec=NAVY, lw=2.2, zorder=7))
    # Clip at top
    ax.add_patch(FancyBboxPatch((cx-8, cy+16), 16, 8,
        boxstyle="round,pad=0,rounding_size=3",
        fc=NAVY, ec='none', zorder=8))
    # Lines (checklist items)
    for yy in [cy+6, cy-2, cy-10]:
        ax.add_patch(plt.Circle((cx-10, yy), 2.5, fc=NAVY, ec='none', alpha=0.8, zorder=7))
        ax.plot([cx-5, cx+12], [yy, yy], color=NAVY, lw=1.8, alpha=0.7, zorder=7)

def ico_mongodb(ax, cx, cy):
    """MongoDB logo style cylinder with leaf."""
    ax.add_patch(mpatches.Ellipse((cx, cy+22), 38, 12, fc=NAVY, ec='none', alpha=0.9, zorder=7))
    ax.add_patch(mpatches.Rectangle((cx-19, cy-14), 38, 36, fc=NAVY, ec='none', alpha=0.75, zorder=6))
    ax.add_patch(mpatches.Ellipse((cx, cy-14), 38, 12, fc='none', ec=NAVY, lw=2, zorder=7))
    ax.add_patch(mpatches.Ellipse((cx, cy+4), 38, 12, fc='none', ec=NAVY, lw=1.2, alpha=0.5, zorder=7))
    ax.plot([cx-19,cx-19],[cy-14,cy+22], color=NAVY, lw=1.8, alpha=0.4, zorder=7)
    ax.plot([cx+19,cx+19],[cy-14,cy+22], color=NAVY, lw=1.8, alpha=0.4, zorder=7)
    ico_leaf_small(ax, cx+4, cy+4, c='#4CAF50')

def ico_dashboard(ax, cx, cy):
    """Monitor with dashboard."""
    # Screen
    ax.add_patch(FancyBboxPatch((cx-28, cy-14), 56, 40,
        boxstyle="round,pad=0,rounding_size=4",
        fc='none', ec=NAVY, lw=2.2, zorder=7))
    ax.add_patch(FancyBboxPatch((cx-25, cy-10), 50, 32,
        boxstyle="round,pad=0,rounding_size=2",
        fc='#E8F0FE', ec='none', zorder=6))
    # Stand
    ax.plot([cx, cx], [cy-14, cy-22], color=NAVY, lw=3, zorder=7)
    ax.plot([cx-12, cx+12], [cy-22, cy-22], color=NAVY, lw=3, zorder=7)
    # Mini bars inside
    for i, h in enumerate([8, 14, 6, 12]):
        bx = cx - 18 + i*12
        ax.add_patch(mpatches.Rectangle((bx-4, cy-6), 8, h,
            fc=NAVY, ec='none', alpha=0.6, zorder=8))
    # Line chart
    pts = [(cx-16, cy+14),(cx-8, cy+20),(cx, cy+12),(cx+8, cy+18),(cx+16, cy+10)]
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    ax.plot(xs, ys, color='#1565C0', lw=2, zorder=8)

def ico_farmer(ax, cx, cy):
    """Farmer silhouette + plant."""
    # hat
    ax.add_patch(mpatches.Ellipse((cx-14, cy+30), 28, 8, fc=NAVY, ec='none', zorder=7))
    ax.add_patch(FancyBboxPatch((cx-20, cy+26), 40, 10,
        boxstyle="round,pad=0,rounding_size=3", fc=NAVY, ec='none', zorder=8))
    # head
    ax.add_patch(plt.Circle((cx-14, cy+18), 10, fc=NAVY, ec='none', alpha=0.85, zorder=7))
    # body
    ax.add_patch(FancyBboxPatch((cx-22, cy-4), 28, 22,
        boxstyle="round,pad=0,rounding_size=4", fc=NAVY, ec='none', alpha=0.75, zorder=7))
    # plant / seedling next to farmer
    stalk_x = cx+12
    ax.plot([stalk_x, stalk_x], [cy-12, cy+12], color='#2E7D32', lw=2.5, zorder=7)
    ax.add_patch(mpatches.Ellipse((stalk_x-6, cy+8), 16, 10, angle=-30,
                                   fc='#4CAF50', ec='none', alpha=0.85, zorder=8))
    ax.add_patch(mpatches.Ellipse((stalk_x+6, cy+2), 16, 10, angle=30,
                                   fc='#4CAF50', ec='none', alpha=0.85, zorder=8))

# ── LAYOUT ───────────────────────────────────────────────────────────────────
#  TOP ROW: 5 cards across, connected left→right
#  BOTTOM ROW: 3 cards, connected left→right, fed by dashed arrows from top

CW  = 380   # card width
CH  = 370   # card height (top row)
GAP = 50    # gap between top-row cards

# Top row starts x
TOP_Y   = 570          # bottom of top-row cards (y increases upward)
BOT_Y   = 80           # bottom of bottom-row cards
BOT_CH  = 330          # bottom card height

# Calculate total width for 5 top cards
TOTAL_W = 5*CW + 4*GAP
START_X = (W - TOTAL_W) / 2

card_xs = [START_X + i*(CW+GAP) for i in range(5)]

# ── TOP ROW CARDS ────────────────────────────────────────────────────────────
cards_top = [
    ("DATA ACQUISITION",  card_xs[0]),
    ("DATA PROCESSING",   card_xs[1]),
    ("AI ENGINE",         card_xs[2]),
    ("EXPLAINABLE AI",    card_xs[3]),
    ("RECOMMENDATION",    card_xs[4]),
]

for title, cx in cards_top:
    card(cx, TOP_Y, CW, CH, title)

# ── BOTTOM ROW CARDS ──────────────────────────────────────────────────────────
# 3 bottom cards: aligned under cards 1, 2-3, 4
BOT_CW = CW
BOT_TOTAL = 3*BOT_CW + 2*GAP
BOT_START = (W - BOT_TOTAL) / 2

bot_xs = [BOT_START + i*(BOT_CW+GAP) for i in range(3)]
bot_cards = [
    ("DATA STORAGE",  bot_xs[0]),
    ("WEB DASHBOARD", bot_xs[1]),
    ("FARMER OUTPUT", bot_xs[2]),
]
for title, bx in bot_cards:
    card(bx, BOT_Y, BOT_CW, BOT_CH, title)

# ── ICONS IN TOP CARDS ────────────────────────────────────────────────────────
# DATA ACQUISITION (card 0): thermometer + leaf + camera icons, 2 rows
cx0 = card_xs[0] + CW//2
ico_thermometer(ax, cx0-75, TOP_Y+CH-HDR_H-80)
ico_leaf_small(ax, cx0, TOP_Y+CH-HDR_H-80)
ico_camera(ax, cx0+75, TOP_Y+CH-HDR_H-80)
label(cx0-75, TOP_Y+CH-HDR_H-120, "IoT Sensors", size=8.5)
label(cx0+70, TOP_Y+CH-HDR_H-120, "Leaf Images", size=8.5)
label(cx0, TOP_Y+CH-HDR_H-148, "(ESP32 Node)", size=7.5, color=SUBTXT)
label(cx0+70, TOP_Y+CH-HDR_H-148, "(Mobile/Web)", size=7.5, color=SUBTXT)
# Divider line
ax.plot([card_xs[0]+20, card_xs[0]+CW-20],
        [TOP_Y+CH//2+10, TOP_Y+CH//2+10], color=CARD_BD, lw=1.2, zorder=5)

# DATA PROCESSING (card 1): gear + datafusion icons, 2 rows
cx1 = card_xs[1] + CW//2
ico_gear(ax, cx1, TOP_Y+CH-HDR_H-75)
label(cx1, TOP_Y+CH-HDR_H-115, "Preprocessing", size=9, bold=True)
ax.plot([card_xs[1]+20, card_xs[1]+CW-20],
        [TOP_Y+CH//2+10, TOP_Y+CH//2+10], color=CARD_BD, lw=1.2, zorder=5)
ico_datafusion(ax, cx1, TOP_Y+CH//2-40)
label(cx1, TOP_Y+CH//2-78, "Data Fusion", size=9, bold=True)

# AI ENGINE (card 2): neural net + barchart icons
cx2 = card_xs[2] + CW//2
ico_neural(ax, cx2, TOP_Y+CH-HDR_H-75)
label(cx2, TOP_Y+CH-HDR_H-120, "CNN Model", size=9, bold=True)
ax.plot([card_xs[2]+20, card_xs[2]+CW-20],
        [TOP_Y+CH//2+10, TOP_Y+CH//2+10], color=CARD_BD, lw=1.2, zorder=5)
ico_barchart(ax, cx2, TOP_Y+CH//2-38)
label(cx2, TOP_Y+CH//2-80, "Classification", size=9, bold=True)

# EXPLAINABLE AI (card 3): Grad-CAM heat leaf
cx3 = card_xs[3] + CW//2
ico_gradcam(ax, cx3, TOP_Y+CH//2+20)
label(cx3, TOP_Y+CH-HDR_H-148, "Grad-CAM", size=9, bold=True)

# RECOMMENDATION (card 4): bottle + clipboard
cx4 = card_xs[4] + CW//2
ico_bottle(ax, cx4, TOP_Y+CH-HDR_H-72)
label(cx4, TOP_Y+CH-HDR_H-118, "Agrochemical DB", size=8.5, bold=True)
ax.plot([card_xs[4]+20, card_xs[4]+CW-20],
        [TOP_Y+CH//2+10, TOP_Y+CH//2+10], color=CARD_BD, lw=1.2, zorder=5)
ico_clipboard(ax, cx4, TOP_Y+CH//2-38)
label(cx4, TOP_Y+CH//2-80, "Recommendations", size=8.5, bold=True)

# ── ICONS IN BOTTOM CARDS ─────────────────────────────────────────────────────
# DATA STORAGE
bx0 = bot_xs[0] + BOT_CW//2
ico_mongodb(ax, bx0, BOT_Y+BOT_CH//2+10)
label(bx0, BOT_Y+BOT_CH//2-60, "MongoDB", size=10, bold=True)

# WEB DASHBOARD
bx1 = bot_xs[1] + BOT_CW//2
ico_dashboard(ax, bx1, BOT_Y+BOT_CH//2+20)
label(bx1, BOT_Y+BOT_CH//2-55, "React Dashboard", size=10, bold=True)

# FARMER OUTPUT
bx2 = bot_xs[2] + BOT_CW//2
# Farmer icon at top of card
ico_farmer(ax, bx2, BOT_Y+BOT_CH-HDR_H-70)
# Divider
ax.plot([bot_xs[2]+20, bot_xs[2]+BOT_CW-20],
        [BOT_Y+BOT_CH-HDR_H-130, BOT_Y+BOT_CH-HDR_H-130], color=CARD_BD, lw=1.2, zorder=5)
# Checklist items with drawn icons, neatly below
item_data = [
    ('green_leaf', "Disease Name"),
    ('warning',    "Severity Level"),
    ('seedling',   "Treatment Recommendation"),
]
for i, (sym, txt) in enumerate(item_data):
    iy = BOT_Y + BOT_CH - HDR_H - 158 - i*44
    ix = bot_xs[2] + 28
    if sym == 'green_leaf':
        ax.add_patch(mpatches.Ellipse((ix+9, iy), 18, 24, angle=0,
                                      fc='#4CAF50', ec='none', alpha=0.85, zorder=8))
        ax.plot([ix+9, ix+9], [iy-11, iy+9], color='#2E7D32', lw=1.5, zorder=9)
    elif sym == 'warning':
        pts = np.array([(ix+9, iy+12),(ix-1, iy-10),(ix+19, iy-10)])
        ax.add_patch(plt.Polygon(pts, closed=True, fc='#FFC107', ec='none', alpha=0.9, zorder=8))
        ax.text(ix+9, iy, '!', color=NAVY, fontsize=9, fontweight='bold',
                ha='center', va='center', family='sans-serif', zorder=9)
    elif sym == 'seedling':
        ax.plot([ix+9, ix+9], [iy-12, iy+8], color='#2E7D32', lw=2, zorder=8)
        ax.add_patch(mpatches.Ellipse((ix+3, iy+4), 14, 10, angle=-25,
                                      fc='#4CAF50', ec='none', alpha=0.85, zorder=8))
        ax.add_patch(mpatches.Ellipse((ix+15, iy), 14, 10, angle=25,
                                      fc='#4CAF50', ec='none', alpha=0.85, zorder=8))
    ax.text(bot_xs[2]+50, iy, txt, color=TXT, fontsize=9,
            va='center', family='sans-serif', zorder=8)
    if i < 2:
        ax.plot([bot_xs[2]+18, bot_xs[2]+BOT_CW-20],
                [iy-20, iy-20], color=CARD_BD, lw=0.9, alpha=0.6, zorder=5)

# ── SOLID ARROWS  (top row, left→right) ──────────────────────────────────────
MID_Y_TOP = TOP_Y + CH//2
for i in range(4):
    solid_arrow(card_xs[i]+CW, MID_Y_TOP, card_xs[i+1])

# ── SOLID ARROWS  (bottom row, left→right) ────────────────────────────────────
MID_Y_BOT = BOT_Y + BOT_CH//2
for i in range(2):
    solid_arrow(bot_xs[i]+BOT_CW, MID_Y_BOT, bot_xs[i+1])

# ── DASHED ARROWS  (top row → bottom row, vertical) ──────────────────────────
DASH_TOP_Y = TOP_Y   # bottom of top cards
DASH_BOT_Y = BOT_Y + BOT_CH  # top of bottom cards

# From card 0 (DATA ACQUISITION) → DATA STORAGE (bot 0)
dashed_arrow_v(card_xs[0]+CW//2, DASH_TOP_Y, DASH_BOT_Y)

# From card 2 (AI ENGINE) → WEB DASHBOARD (bot 1)
dashed_arrow_v(card_xs[2]+CW//2, DASH_TOP_Y, DASH_BOT_Y)

# From card 4 (RECOMMENDATION) → FARMER OUTPUT (bot 2)
dashed_arrow_v(card_xs[4]+CW//2, DASH_TOP_Y, DASH_BOT_Y)

# Horizontal dashed line connecting the three drop points at top
dash_y = DASH_TOP_Y - 25
dashed_line_h(card_xs[0]+CW//2, dash_y, card_xs[4]+CW//2)

# ── TITLE ─────────────────────────────────────────────────────────────────────
ax.text(W/2, H-45,
    "AI-BASED CROP DISEASE DETECTION AND MONITORING SYSTEM  —  SYSTEM ARCHITECTURE",
    color=NAVY, fontsize=14.5, fontweight='bold',
    ha='center', va='center', family='sans-serif', zorder=4)
# underline
ax.plot([W*0.05, W*0.95], [H-70, H-70], color=CARD_BD, lw=1.5, zorder=3)

# ── CAPTION ──────────────────────────────────────────────────────────────────
ax.text(W/2, 30,
    "Fig. 1.  System Architecture of the Proposed AI-Based Crop Disease Detection and Monitoring System.",
    color=SUBTXT, fontsize=9.5, fontstyle='italic',
    ha='center', va='center', family='sans-serif', zorder=4)

# ── SAVE ─────────────────────────────────────────────────────────────────────
plt.subplots_adjust(left=0.01, right=0.99, top=0.96, bottom=0.04)
out_dir = os.path.join(os.path.dirname(__file__), "..", "docs")
for fname in ("ppt_architecture_diagram.png", "architecture.png"):
    out = os.path.join(out_dir, fname)
    plt.savefig(out, dpi=200, bbox_inches='tight', facecolor=BG, pad_inches=0.25)
    print("Saved →", out)
plt.close()

import os
import sys

try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
    from matplotlib.path import Path
    import numpy as np
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "matplotlib", "numpy", "pillow"])
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
    from matplotlib.path import Path
    import numpy as np

def create_ppt_architecture_diagram():
    # 16:9 Presentation Dimensions (Ultra-HD Canvas)
    fig, ax = plt.subplots(figsize=(16, 9), dpi=300)
    fig.patch.set_facecolor('#F8FAFC')
    ax.set_facecolor('#F8FAFC')
    
    ax.set_xlim(0, 1280)
    ax.set_ylim(0, 950)
    ax.axis('off')
    
    # Color palette
    card_bg = '#1E293B'         # Dark Slate Navy
    card_border = '#334155'     # Border
    title_color = '#38BDF8'     # Sky Blue
    subtitle_color = '#F8FAFC'  # White
    bullet_color = '#CBD5E1'    # Light text
    dot_color = '#38BDF8'       # Sky Blue bullet
    arrow_color = '#475569'     # Slate arrow
    
    def draw_card(x, y, w, h, title, subtitle="", bullets=[], icon_type=None, center_text=False):
        # Soft shadow
        shadow = patches.FancyBboxPatch((x+4, y-4), w, h,
                                       boxstyle="round,pad=0,rounding_size=12",
                                       fc='#CBD5E1', ec='none', alpha=0.6, zorder=2)
        ax.add_patch(shadow)
        
        # Main card
        box = patches.FancyBboxPatch((x, y), w, h,
                                    boxstyle="round,pad=0,rounding_size=12",
                                    fc=card_bg, ec=card_border, lw=1.5, zorder=3)
        ax.add_patch(box)
        
        # Draw Icon if requested
        if icon_type == "input":
            # Video/Image frame icon
            ic_box = patches.FancyBboxPatch((x + 18, y + h - 45), 26, 22,
                                           boxstyle="round,pad=0,rounding_size=3",
                                           fc='#0F172A', ec='#38BDF8', lw=1.2, zorder=4)
            ax.add_patch(ic_box)
            # Play triangle
            ax.add_patch(patches.Polygon([[x+27, y+h-40], [x+27, y+h-28], [x+38, y+h-34]], closed=True, fc='#38BDF8', zorder=5))
            text_x = x + 54
        elif icon_type == "db":
            # Database cylinders
            for cy_offset in [0, 6, 12]:
                ax.add_patch(patches.Ellipse((x + 30, y + h - 28 - cy_offset), 20, 8, fc='#0F172A', ec='#38BDF8', lw=1.2, zorder=4))
            text_x = x + 52
        elif icon_type == "chart":
            # Bar chart icon
            for b_i, bh in enumerate([10, 18, 14, 22]):
                ax.add_patch(patches.Rectangle((x + 20 + (b_i*7), y + h - 45), 5, bh, fc='#38BDF8', zorder=4))
            text_x = x + 56
        elif icon_type == "hash_center":
            # Central Hash generation card
            ic_box = patches.FancyBboxPatch((x + w/2 - 28, y + 65), 56, 68,
                                           boxstyle="round,pad=0,rounding_size=6",
                                           fc='#0F172A', ec='#38BDF8', lw=1.5, zorder=4)
            ax.add_patch(ic_box)
            # Folded page top corner
            ax.add_patch(patches.Polygon([[x+w/2+14, y+133], [x+w/2+28, y+119], [x+w/2+14, y+119]], closed=True, fc='#38BDF8', zorder=5))
            ax.text(x + w/2, y + 112, "10110", color='#38BDF8', fontsize=8, fontweight='bold', ha='center', va='center', zorder=5)
            ax.text(x + w/2, y + 99, "01010", color='#38BDF8', fontsize=8, fontweight='bold', ha='center', va='center', zorder=5)
            ax.text(x + w/2, y + 86, "10011", color='#38BDF8', fontsize=8, fontweight='bold', ha='center', va='center', zorder=5)
            ax.text(x + w/2, y + 35, "HASH GENERATION", color='#FFFFFF', fontsize=10.5, fontweight='bold', ha='center', va='center', zorder=5)
            ax.text(x + w/2, y + 18, "(SHA-256 Telemetry)", color='#94A3B8', fontsize=8, ha='center', va='center', zorder=5)
            return
        else:
            text_x = x + 20
            
        # Titles
        if title:
            if center_text:
                ax.text(x + w/2, y + h - 25, title, color='#FFFFFF', fontsize=11, fontweight='bold', ha='center', va='center', zorder=4)
            else:
                ax.text(text_x, y + h - 25, title, color=title_color, fontsize=11, fontweight='bold', ha='left', va='center', zorder=4)
                
        if subtitle:
            if center_text:
                ax.text(x + w/2, y + h - 45, subtitle, color=subtitle_color, fontsize=9.5, fontweight='bold', ha='center', va='center', zorder=4)
            else:
                ax.text(text_x, y + h - 43, subtitle, color=subtitle_color, fontsize=9, fontweight='bold', ha='left', va='center', zorder=4)
                
        # Bullets
        start_y = y + h - (64 if subtitle else 48)
        for i, b in enumerate(bullets):
            ax.plot(x + 22, start_y - (i * 20), marker='o', markersize=3.5, color=dot_color, zorder=4)
            ax.text(x + 32, start_y - (i * 20), b, color=bullet_color, fontsize=8.5, family='sans-serif', ha='left', va='center', zorder=4)

    def draw_arrow(x1, y1, x2, y2):
        style = "Simple,tail_width=1.2,head_width=6,head_length=6"
        arrow = patches.FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style, color=arrow_color, lw=1.2, zorder=2)
        ax.add_patch(arrow)

    def draw_orthogonal_arrow(points):
        for i in range(len(points)-1):
            p1 = points[i]
            p2 = points[i+1]
            if i == len(points)-2:
                style = "Simple,tail_width=1.2,head_width=6,head_length=6"
                arrow = patches.FancyArrowPatch(p1, p2, arrowstyle=style, color=arrow_color, lw=1.2, zorder=2)
                ax.add_patch(arrow)
            else:
                ax.plot([p1[0], p2[0]], [p1[1], p2[1]], color=arrow_color, lw=1.2, zorder=2)

    # -------------------------------------------------------------
    # 1. TOP HEADER BANNER
    # -------------------------------------------------------------
    banner = patches.FancyBboxPatch((40, 875), 1195, 52,
                                   boxstyle="round,pad=0,rounding_size=8",
                                   fc='#0F172A', ec='#1E293B', lw=1.5, zorder=3)
    ax.add_patch(banner)
    ax.text(637, 901, "AI-BASED CROP DISEASE DETECTION & MONITORING SYSTEM — ARCHITECTURE",
            color='#F8FAFC', fontsize=13, fontweight='bold', family='sans-serif', ha='center', va='center', zorder=4)

    # -------------------------------------------------------------
    # 2. CARDS PLACEMENT
    # -------------------------------------------------------------
    # Column 1: Left Inputs & External Data
    draw_card(40, 560, 180, 160, "Input Modalities", "(Real / Field Data)",
              bullets=["Foliar RGB Image", "DHT22 (Temp / Hum)", "Soil Moisture Probe", "BH1750 (Light Lux)"],
              icon_type="input")
              
    draw_card(40, 240, 185, 150, "External Sources", "Public Benchmarks",
              bullets=["PlantVillage Repository", "54,000+ Foliar Images", "Real-world Sensor Logs", "ICAR Treatment DB"],
              icon_type="db")

    # Column 2: AI Vision Front-End & Central Database
    draw_card(250, 545, 205, 190, "AI CROP DETECTION", "Deep Learning Model",
              bullets=["Deep CNN Backbone", "PyTorch Feature Layers", "Multi-Modal Sensor Gate", "Sub-1.4ms ONNX Engine", "Real-Time Health Verify"],
              center_text=False)

    draw_card(255, 230, 215, 170, "MongoDB / Central DB", "Storage & Treatment",
              bullets=["Farmer Profiles & Auth", "Sensor Telemetry Logs", "Prediction History Store", "Grad-CAM Heatmap Store", "Agrochemical Catalog"],
              icon_type="db")

    # Column 3: FastAPI Backend & Hash Generation
    draw_card(485, 525, 210, 230, "FastAPI Backend", "Server & Pipeline Core",
              bullets=["REST API Endpoints", "WebSocket Streamer", "Pipeline Orchestration", "Sensor Min-Max Scaling", "Agrochemical Matching", "Farmer Request Routing", "JSON Payload Delivery"],
              center_text=False)

    draw_card(730, 485, 175, 170, "", "", icon_type="hash_center")

    # Column 4: Dataset Pipeline & Transfer Learning (Top)
    draw_card(720, 695, 225, 155, "Dataset Preparation", "ETL & Preprocessing",
              bullets=["Label Assignment (38 Classes)", "Train / Val / Test Split", "Foliar Augmentation", "PyTorch DataLoader Stream"],
              center_text=False)

    draw_card(980, 695, 210, 155, "Transfer Learning", "Backbone Neural Nets",
              bullets=["MobileNetV2 (Edge-Ready)", "ResNet50 Backbone", "Custom PyTorch 4-Layer CNN", "Dense Feature Head"],
              center_text=False)

    # Column 5: Sequential Pipeline (Right)
    draw_card(970, 550, 245, 115, "Hybrid Ensemble Module", "Weighted Prediction Fusion",
              bullets=["Visual + Telemetry Fusion", "Environmental Risk Index (R_env)"],
              center_text=False)

    draw_card(970, 410, 245, 115, "Prediction Module", "Pathology Classification",
              bullets=["Softmax Probability P(C)", "Confidence Threshold >= tau", "Multi-Class Disease Output"],
              center_text=False)

    draw_card(970, 270, 245, 115, "Explainability Module", "Grad-CAM Visualization",
              bullets=["Feature Gradient Mapping", "Highlights Infected Regions", "Farmer Trust Verification"],
              center_text=False)

    draw_card(970, 130, 245, 115, "Results & Output", "Prescription & Dashboard",
              bullets=["Targeted Active Ingredient", "Commercial Brand & Dosage", "Interactive React UI View"],
              center_text=False)

    # Bottom: Evaluation Module
    draw_card(460, 55, 265, 145, "Evaluation Module", "Model Performance Metrics",
              bullets=["Accuracy: 99.2% | Precision: 99.1%", "Recall: 99.3% | F1-Score: 99.2%", "ROC-AUC & Confusion Matrix", "31% False-Positive Reduction"],
              icon_type="chart")

    # -------------------------------------------------------------
    # 3. CONNECTING ARROWS & DATA FLOW
    # -------------------------------------------------------------
    # 1. Input Modalities -> AI Detection
    draw_arrow(210, 640, 250, 640)
    
    # 2. AI Detection -> FastAPI Backend
    draw_arrow(445, 640, 485, 640)
    
    # 3. External Sources -> Database
    draw_arrow(230, 315, 270, 315)
    
    # 4. FastAPI Backend -> Hash Encoding
    draw_arrow(690, 600, 730, 570)
    
    # 5. FastAPI Backend -> Dataset Prep (Upward step)
    draw_orthogonal_arrow([(585, 755), (585, 775), (720, 775)])
    
    # 6. Dataset Prep <-> Transfer Learning (Bidirectional)
    draw_arrow(940, 780, 980, 780)
    draw_arrow(980, 760, 940, 760)
    
    # 7. Transfer Learning -> Hybrid Ensemble
    draw_orthogonal_arrow([(1080, 695), (1080, 665)])
    
    # 8. Hash Encoding -> Dataset Prep (Upward)
    draw_arrow(817, 655, 817, 695)
    
    # 9. Hash Encoding -> Database (Downward step)
    draw_orthogonal_arrow([(817, 485), (817, 315), (480, 315)])
    
    # 10. Hybrid Fusion -> Prediction Module
    draw_arrow(1082, 550, 1082, 525)
    
    # 11. Prediction Module -> Explainability Module
    draw_arrow(1082, 410, 1082, 385)
    
    # 12. Explainability Module -> Results & Output
    draw_arrow(1082, 270, 1082, 245)
    
    # 13. Results & Output -> Evaluation Module
    draw_orthogonal_arrow([(970, 185), (720, 130)])
    
    # 14. Evaluation Module -> Database
    draw_orthogonal_arrow([(590, 200), (590, 215), (480, 260)])
    
    # 15. Database -> AI Detection (Feedback/Telemetry)
    draw_orthogonal_arrow([(375, 400), (375, 545)])

    plt.tight_layout()
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs")
    out_path = os.path.join(out_dir, "ppt_architecture_diagram.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor())
    print(f"PPT Architecture Diagram successfully saved at: {out_path}")

if __name__ == "__main__":
    create_ppt_architecture_diagram()

import os
import sys

try:
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "matplotlib", "numpy"])
    import matplotlib.pyplot as plt
    import numpy as np

def generate_ieee_chart():
    models = ['SVM [11]', 'HMM [13]', 'MLP [12]', 'KNN [14]', 'Random Forest [15]', 'Proposed System']
    accuracy = [80.0, 90.9, 94.0, 95.9, 99.6, 99.2]
    f1_score = [79.8, 90.3, 93.8, 95.6, 99.2, 99.2]
    precision = [78.4, 89.2, 93.1, 95.2, 99.1, 99.1]
    
    x = np.arange(len(models))
    width = 0.25
    
    fig, ax = plt.subplots(figsize=(7.5, 4.5), dpi=300)
    
    # Color palette matching high-end IEEE publications
    c_acc = '#1976D2'   # Blue
    c_f1 = '#388E3C'    # Green
    c_prec = '#F57C00'  # Orange
    
    rects1 = ax.bar(x - width, accuracy, width, label='Accuracy (%)', color=c_acc, edgecolor='black', linewidth=0.8)
    rects2 = ax.bar(x, f1_score, width, label='F1-Score (%)', color=c_f1, edgecolor='black', linewidth=0.8)
    rects3 = ax.bar(x + width, precision, width, label='Precision (%)', color=c_prec, edgecolor='black', linewidth=0.8)
    
    ax.set_ylabel('Performance Metrics (%)', fontsize=11, fontweight='bold', family='serif')
    ax.set_title('Comparative Performance Analysis Across State-of-the-Art Models', fontsize=12, fontweight='bold', family='serif', pad=12)
    ax.set_xticks(x)
    ax.set_xticklabels(models, fontsize=9.5, fontweight='bold', family='serif', rotation=15, ha='right')
    ax.set_ylim(65, 105)
    ax.grid(axis='y', linestyle='--', alpha=0.6)
    ax.legend(frameon=True, facecolor='white', edgecolor='#CCCCCC', fontsize=9.5, loc='upper left')
    
    # Add value labels on top of bars
    def autolabel(rects):
        for rect in rects:
            height = rect.get_height()
            ax.annotate(f'{height:.1f}%',
                        xy=(rect.get_x() + rect.get_width() / 2, height),
                        xytext=(0, 3),
                        textcoords="offset points",
                        ha='center', va='bottom', fontsize=7.5, fontweight='bold', family='serif')
    
    autolabel(rects1)
    autolabel(rects2)
    autolabel(rects3)
    
    # Highlight proposed system with a subtle background patch or border
    plt.tight_layout()
    
    out_dir = os.path.join(os.path.dirname(__file__), "..", "docs")
    out_path = os.path.join(out_dir, "model_comparison_chart.png")
    plt.savefig(out_path, dpi=300, bbox_inches='tight')
    print(f"Chart saved successfully at: {out_path}")

if __name__ == "__main__":
    generate_ieee_chart()

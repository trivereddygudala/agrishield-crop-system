import os
from PIL import Image, ImageDraw

src_path = 'frontend/public/icon-512.png'
base_res = 'android/app/src/main/res'

sizes = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
}

im = Image.open(src_path).convert('RGBA')

for folder, size in sizes.items():
    out_dir = os.path.join(base_res, folder)
    os.makedirs(out_dir, exist_ok=True)
    
    # 1. Square icon with rounded corners / standard icon
    resized = im.resize((size, size), Image.Resampling.LANCZOS)
    square_path = os.path.join(out_dir, 'ic_launcher.png')
    resized.save(square_path, 'PNG')
    
    # 2. Circular icon (ic_launcher_round.png)
    mask = Image.new('L', (size * 4, size * 4), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.Resampling.LANCZOS)
    
    round_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    round_img.paste(resized, (0, 0), mask=mask)
    round_path = os.path.join(out_dir, 'ic_launcher_round.png')
    round_img.save(round_path, 'PNG')
    
    print(f"Generated {folder}: {size}x{size} square and round icons.")

print("All Android launcher icons generated successfully!")

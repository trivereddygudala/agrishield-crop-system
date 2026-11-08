with open('backend/app/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any character with ord > 127 with clean ascii equivalent or remove
cleaned = []
for ch in text:
    if ord(ch) <= 127:
        cleaned.append(ch)
    else:
        # replace with safe space or symbol
        cleaned.append(' ')

cleaned_text = ''.join(cleaned)
with open('backend/app/main.py', 'w', encoding='utf-8') as f:
    f.write(cleaned_text)

print("Sanitized backend/app/main.py to 100% ASCII-safe text!")


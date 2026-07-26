import sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = f.read()
data = data.replace(", {\n      headers: { 'Content-Type': 'multipart/form-data' },\n    }", "")
with open(sys.argv[1], 'w', encoding='utf-8') as f:
    f.write(data)

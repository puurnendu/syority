import sys
import base64
import subprocess
import os

with open(r'c:\Users\purne\.gemini\antigravity\scratch\STO\aurianoa-sto-v2\prisma\schema.prisma', 'rb') as f:
    content = f.read()

encoded = base64.b64encode(content)

ssh_cmd = [
    'ssh', '-i', r'C:\Users\purne\.ssh\gcp-key', 'purne@app.syority.com',
    'base64 -d > /home/purne/aurianoa-sto-v2-live/prisma/schema.prisma'
]

print(f"Uploading schema.prisma to server via stdin pipe...")
process = subprocess.Popen(ssh_cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
stdout, stderr = process.communicate(input=encoded)

if process.returncode == 0:
    print("Upload complete.")
else:
    print(f"Upload failed with exit code {process.returncode}")
    print(f"Stderr: {stderr.decode('utf-8')}")
    sys.exit(1)

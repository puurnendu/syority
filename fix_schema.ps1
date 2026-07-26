$path = "c:\Users\purne\.gemini\antigravity\scratch\STO\aurianoa-sto-v2\prisma\schema.prisma"
$content = Get-Content -Path $path
$header = @(
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
    'datasource db {',
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    '}',
    ''
)
# Line 10 in original file is the start of Organization model.
# In 0-indexed $content, line 10 is index 9.
$newContent = $header + $content[9..($content.Length-1)]
$newContent | Set-Content -Path $path -Encoding UTF8
Write-Host "✅ schema.prisma fixed"

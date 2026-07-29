@echo off
setlocal
set "NODE_EXE=C:\Program Files\nodejs\node.exe"
set "PRISMA_CLI=c:\DEV\STO\node_modules\.prisma\..\..\prisma\build\index.js"
"%NODE_EXE%" "c:\DEV\STO\node_modules\prisma\build\index.js" validate

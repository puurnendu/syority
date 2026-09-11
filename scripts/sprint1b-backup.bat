@echo off
setlocal
set PGPASSWORD=postgres
set PGCLIENTENCODING=UTF8
set BIN=C:\Program Files\PostgreSQL\17\bin
set TS=%DATE:~-4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set TS=%TS: =0%
set OUTDIR=C:\DEV\STO\backups\sprint1b_pre_%TS%
mkdir "%OUTDIR%" 2>nul
echo BACKUP_DIR=%OUTDIR%
"%BIN%\pg_dump.exe" -h localhost -U postgres -d syority -F c -f "%OUTDIR%\syority.dump"
if errorlevel 1 exit /b 1
"%BIN%\pg_dump.exe" -h localhost -U postgres -d syority --no-owner --no-acl -f "%OUTDIR%\syority.sql"
if errorlevel 1 exit /b 1
echo BACKUP_OK
dir "%OUTDIR%"
endlocal

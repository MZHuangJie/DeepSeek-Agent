@echo off
setlocal EnableExtensions
where node >nul 2>nul
if %ERRORLEVEL%==0 (
  node "%~dp0git-askpass.cjs" %*
  exit /b %ERRORLEVEL%
)
if not defined DEEPSEEK_ELECTRON_EXE (
  echo DEEPSEEK_ELECTRON_EXE is not set 1>&2
  exit /b 1
)
set ELECTRON_RUN_AS_NODE=1
"%DEEPSEEK_ELECTRON_EXE%" "%~dp0git-askpass.cjs" %*

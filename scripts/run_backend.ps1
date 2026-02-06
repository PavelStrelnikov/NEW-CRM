$env:PYTHONPATH = "$PSScriptRoot\..\backend"
Set-Location "$PSScriptRoot\..\backend"
uvicorn app.main:app --reload
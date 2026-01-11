$env:PYTHONPATH = "$PSScriptRoot\..\backend"
uvicorn app.main:app --reload
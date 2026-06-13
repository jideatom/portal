# Run this from D:\Repo\portal to commit and push the audit fixes
Set-Location "D:\Repo\portal"
git add ai.html aws-roadmap.html career.html cloud.html courses.html devops.html linux.html python.html reader.html index.html playbook.html
git commit -m "Fix audit: theme-color meta, reader.html nav + height, restore truncated files"
git push origin main
Write-Host "Done! Check https://jideatom.github.io/portal" -ForegroundColor Green

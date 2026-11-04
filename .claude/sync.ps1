# 変更があれば commit して push する（Claude Code の Stop フックから呼ばれる）
Set-Location (git rev-parse --show-toplevel)
git add -A
if (git status --porcelain) {
  git commit -q -m "自動同期: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
}
git push -q origin HEAD 2>&1 | Out-Null

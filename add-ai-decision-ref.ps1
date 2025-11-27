# PowerShell script to implement edge case safety features
# This script uses line-based insertion instead of regex replacement for better reliability

$filePath = "src\components\InterviewScreen.tsx"
$lines = Get-Content $filePath

Write-Host "🔧 Implementing Edge Case Safety Features..." -ForegroundColor Cyan

# Find the line number where we need to add aiDecisionRef
$hasCalledNotifyLine = -1
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "const hasCalledNotifyRef = useRef<boolean>\(false\);") {
        $hasCalledNotifyLine = $i
        break
    }
}

if ($hasCalledNotifyLine -ge 0) {
    Write-Host "  1️⃣ Adding aiDecisionRef after line $hasCalledNotifyLine..." -ForegroundColor Yellow
    # Insert after the hasCalledNotifyRef line and its comment
    $insertLine = $hasCalledNotifyLine + 1
    $newLines = @(
        "    ",
        "    // 🔒 AI Decision Preservation - Store AI's authoritative decision",
        "    const aiDecisionRef = useRef<{ passed: boolean; reason: string } | null>(null);"
    )
    $lines = $lines[0..$hasCalledNotifyLine] + $newLines + $lines[($hasCalledNotifyLine + 1)..($lines.Count - 1)]
    Write-Host "     ✓ Added aiDecisionRef" -ForegroundColor Green
}
else {
    Write-Host "     ✗ Could not find hasCalledNotifyRef line" -ForegroundColor Red
}

# Save the file
$lines | Set-Content $filePath

Write-Host "✅ Phase 1 complete: Added aiDecisionRef" -ForegroundColor Green
Write-Host "   Next: Run additional scripts to add other features" -ForegroundColor Cyan

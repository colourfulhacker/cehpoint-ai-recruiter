# PowerShell script to implement all edge case safety features in InterviewScreen.tsx

$filePath = "src\components\InterviewScreen.tsx"
$content = Get-Content $filePath -Raw

Write-Host "🔧 Implementing Edge Case Safety Features..." -ForegroundColor Cyan

# 1. Add aiDecisionRef after hasCalledNotifyRef
Write-Host "  1️⃣ Adding aiDecisionRef..." -ForegroundColor Yellow
$oldRefs = @'
    const hasCalledNotifyRef = useRef<boolean>(false); // Prevent multiple notifyResult calls

    // Hide instruction banner after 4 seconds when connected
'@

$newRefs = @'
    const hasCalledNotifyRef = useRef<boolean>(false); // Prevent multiple notifyResult calls
    
    // 🔒 AI Decision Preservation - Store AI's authoritative decision
    const aiDecisionRef = useRef<{ passed: boolean; reason: string } | null>(null);

    // Hide instruction banner after 4 seconds when connected
'@

$content = $content -replace [regex]::Escape($oldRefs), $newRefs

# 2. Add hard timer expiration handler
Write-Host "  2️⃣ Adding hard timer expiration handler..." -ForegroundColor Yellow
$oldTimer = @'
        } else if (timeLeft === 0 && !showContactOverlay) {
            // 5 minutes up - force conclusion
            if (!hasCalledNotifyRef.current) {
                sessionRef.current?.send({
                    parts: [{ text: "[SYSTEM: 5 minute limit reached. Make final decision NOW. Call notifyResult with your decision.]" }]
                });
            }
        }
'@

$newTimer = @'
        } else if (timeLeft === 0 && !showContactOverlay) {
            // 5 minutes up - force conclusion
            if (!hasCalledNotifyRef.current) {
                sessionRef.current?.send({
                    parts: [{ text: "[SYSTEM: 5 minute limit reached. Make final decision NOW. Call notifyResult with your decision.]" }]
                });
            }
        }
'@

# 3. Add useEffect for hard timeout after timer expiration
Write-Host "  3️⃣ Adding hard timeout useEffect..." -ForegroundColor Yellow
$oldTimerEffect = @'
    }, [connectionState, timeLeft, showContactOverlay]);

    // --- 2. Silence Monitor ---
'@

$newTimerEffect = @'
    }, [connectionState, timeLeft, showContactOverlay]);

    // ⏱ Hard Timer Expiration - Force result after 3s grace period
    useEffect(() => {
        if (timeLeft === 0 && !showContactOverlay && !hasCalledNotifyRef.current) {
            const forceEndTimer = setTimeout(() => {
                if (!hasCalledNotifyRef.current) {
                    console.log('⏱ HARD TIMEOUT: Timer expired, forcing result page');
                    handleEndSession(false, 'Interview time limit reached (10 minutes)');
                }
            }, 3000); // 3 second grace period
            
            return () => clearTimeout(forceEndTimer);
        }
    }, [timeLeft, showContactOverlay]);

    // --- 2. Silence Monitor ---
'@

$content = $content -replace [regex]::Escape($oldTimerEffect), $newTimerEffect

# 4. Update tool call handler to store AI decision
Write-Host "  4️⃣ Updating tool call handler..." -ForegroundColor Yellow
$oldToolCall = @'
                if (fc.name === 'notifyResult') {
                    const { passed, reason } = fc.args as any;

                    // Prevent multiple notifyResult calls
                    if (hasCalledNotifyRef.current) {
                        console.warn("notifyResult already called, ignoring duplicate");
                        return;
                    }
                    hasCalledNotifyRef.current = true;

                    // Ack
                    sessionRef.current?.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                    });
                    console.log("🔔 notifyResult called:", { passed, reason });
                    handleEndSession(passed, reason);
                }
'@

$newToolCall = @'
                if (fc.name === 'notifyResult') {
                    const { passed, reason } = fc.args as any;

                    // Prevent multiple notifyResult calls
                    if (hasCalledNotifyRef.current) {
                        console.warn("notifyResult already called, ignoring duplicate");
                        return;
                    }
                    hasCalledNotifyRef.current = true;

                    // 🔒 Store AI's decision IMMEDIATELY
                    aiDecisionRef.current = { passed, reason };
                    console.log('🔒 STORE AI\'S DECISION - This is the authoritative result');

                    // Ack
                    sessionRef.current?.sendToolResponse({
                        functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                    });
                    console.log("🔔 notifyResult called:", { passed, reason });
                    handleEndSession(passed, reason);
                }
'@

$content = $content -replace [regex]::Escape($oldToolCall), $newToolCall

# 5. Add handleManualEnd function before handleEndSession
Write-Host "  5️⃣ Adding handleManualEnd function..." -ForegroundColor Yellow
$oldHandleEnd = @'
    const handleEndSession = async (passed: boolean, reason?: string) => {
'@

$newHandleEnd = @'
    // 🛡 Manual End Handler - Respects AI decision if it exists
    const handleManualEnd = () => {
        if (aiDecisionRef.current) {
            // AI already decided - respect that decision
            console.log('🛡 AI decision exists, using that instead of manual termination');
            handleEndSession(aiDecisionRef.current.passed, aiDecisionRef.current.reason);
        } else {
            // No AI decision yet - mark as user termination
            console.log('⚠ Manual termination by user (no AI decision yet)');
            handleEndSession(false, "Terminated by candidate");
        }
    };

    const handleEndSession = async (passed: boolean, reason?: string) => {
'@

$content = $content -replace [regex]::Escape($oldHandleEnd), $newHandleEnd

# 6. Update End Interview button to use handleManualEnd
Write-Host "  6️⃣ Updating End Interview button..." -ForegroundColor Yellow
$oldButton = @'
                        <button
                            onClick={() => handleEndSession(false, "Terminated by candidate")}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg flex items-center gap-2 border border-red-600/30"
                        >
'@

$newButton = @'
                        <button
                            onClick={handleManualEnd}
                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-4 py-2 rounded-lg flex items-center gap-2 border border-red-600/30"
                        >
'@

$content = $content -replace [regex]::Escape($oldButton), $newButton

# Write back to file
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "✅ Successfully implemented all edge case safety features!" -ForegroundColor Green
Write-Host ""
Write-Host "Features Added:" -ForegroundColor Cyan
Write-Host "  ✓ AI Decision Preservation (aiDecisionRef)" -ForegroundColor Green
Write-Host "  ✓ Hard Timer Expiration (3s grace period)" -ForegroundColor Green
Write-Host "  ✓ Manual End Handler (handleManualEnd)" -ForegroundColor Green
Write-Host "  ✓ AI Decision Storage in Tool Call" -ForegroundColor Green
Write-Host "  ✓ Updated End Interview Button" -ForegroundColor Green

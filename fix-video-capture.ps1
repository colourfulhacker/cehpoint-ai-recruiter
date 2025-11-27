# PowerShell script to fix the video capture race condition in InterviewScreen.tsx

$filePath = "src\components\InterviewScreen.tsx"
$content = Get-Content $filePath -Raw

# Define the old code block to replace
$oldCode = @'
    const handleEndSession = (passed: boolean, reason?: string) => {
        if (showContactOverlay) return; // Already ending

        console.log("📊 Interview Ending - Result:", { passed, reason });
        console.log("🎬 [VIDEO] MediaRecorder state:", mediaRecorderRef.current?.state);
        console.log("🎬 [VIDEO] Current video blob:", recordedVideoBlobRef.current ? `${recordedVideoBlobRef.current.size} bytes` : 'null');

        // Ensure we capture the last things said
        flushTranscriptBuffers();

        // Stop video recording and wait for blob
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log("🎬 [VIDEO] Stopping MediaRecorder...");
            mediaRecorderRef.current.stop();
            // Give a brief moment for onstop to fire and create the blob
            setTimeout(() => {
                console.log("🎬 [VIDEO] After timeout, video blob:", recordedVideoBlobRef.current ? `${recordedVideoBlobRef.current.size} bytes` : 'null');
                finalizeEndSession(passed, reason);
            }, 500);
        } else {
            console.log("🎬 [VIDEO] MediaRecorder already inactive or null");
            finalizeEndSession(passed, reason);
        }
    };
'@

# Define the new code block
$newCode = @'
    const handleEndSession = async (passed: boolean, reason?: string) => {
        if (showContactOverlay) return; // Already ending

        console.log("📊 Interview Ending - Result:", { passed, reason });
        console.log("🎬 [VIDEO] MediaRecorder state:", mediaRecorderRef.current?.state);

        // Ensure we capture the last things said
        flushTranscriptBuffers();

        // Stop video recording and wait for blob
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            console.log("🎬 [VIDEO] Stopping MediaRecorder...");
            
            // Create a promise that resolves when the blob is ready
            const blobPromise = new Promise<void>((resolve) => {
                const originalOnStop = mediaRecorderRef.current!.onstop;
                mediaRecorderRef.current!.onstop = (event) => {
                    // Call original handler to create the blob
                    if (originalOnStop) originalOnStop.call(mediaRecorderRef.current!, event);
                    console.log("🎬 [VIDEO] onstop fired via Promise wrapper");
                    resolve();
                };
            });

            mediaRecorderRef.current.stop();
            
            // Wait for the blob to be created (max 2 seconds)
            const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 2000));
            await Promise.race([blobPromise, timeoutPromise]);
            
            console.log("🎬 [VIDEO] Blob capture complete (or timed out)");
            finalizeEndSession(passed, reason);
        } else {
            console.log("🎬 [VIDEO] MediaRecorder already inactive or null");
            finalizeEndSession(passed, reason);
        }
    };
'@

# Replace the code
$newContent = $content -replace [regex]::Escape($oldCode), $newCode

# Write back to file
Set-Content -Path $filePath -Value $newContent -NoNewline

Write-Host "✅ Successfully updated handleEndSession function in $filePath"
Write-Host "🎬 Video capture logic now uses Promise-based approach instead of setTimeout"

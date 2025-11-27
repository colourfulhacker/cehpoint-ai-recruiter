#!/usr/bin/env python3
"""
Implement Edge Case Safety Features in InterviewScreen.tsx
Using simple string find/replace for maximum reliability
"""

def main():
    filepath = 'src/components/InterviewScreen.tsx'
    print("🔧 Implementing Edge Case Safety Features...")
    print(f"📄 Reading {filepath}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes = 0
    
    # Change 1: Add aiDecisionRef
    print("\n1️⃣ Adding aiDecisionRef...")
    old1 = "    const hasCalledNotifyRef = useRef<boolean>(false); // Prevent multiple notifyResult calls\r\n\r\n    // Hide instruction banner"
    new1 = """    const hasCalledNotifyRef = useRef<boolean>(false); // Prevent multiple notifyResult calls
    
    // 🔒 AI Decision Preservation - Store AI's authoritative decision
    const aiDecisionRef = useRef<{ passed: boolean; reason: string } | null>(null);

    // Hide instruction banner"""
    if old1 in content:
        content = content.replace(old1, new1)
        print("   ✓ Added aiDecisionRef")
        changes += 1
    else:
        print("   ✗ Pattern not found")
    
    # Change 2: Add hard timer useEffect
    print("\n2️⃣ Adding hard timer expiration useEffect...")
    old2 = "    }, [connectionState, timeLeft, showContactOverlay]);\r\n\r\n    // --- 2. Silence Monitor ---"
    new2 = """    }, [connectionState, timeLeft, showContactOverlay]);

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

    // --- 2. Silence Monitor ---"""
    if old2 in content:
        content = content.replace(old2, new2)
        print("   ✓ Added hard timer useEffect")
        changes += 1
    else:
        print("   ✗ Pattern not found")
    
    # Change 3: Update tool call handler
    print("\n3️⃣ Updating tool call handler...")
    old3 = """                    hasCalledNotifyRef.current = true;

                    // Ack"""
    new3 = """                    hasCalledNotifyRef.current = true;

                    // 🔒 Store AI's decision IMMEDIATELY
                    aiDecisionRef.current = { passed, reason };
                    console.log('🔒 STORE AI\\'S DECISION - This is the authoritative result');

                    // Ack"""
    if old3 in content:
        content = content.replace(old3, new3)
        print("   ✓ Updated tool call handler")
        changes += 1
    else:
        print("   ✗ Pattern not found")
    
    # Change 4: Add handleManualEnd
    print("\n4️⃣ Adding handleManualEnd function...")
    old4 = "    const handleEndSession = async (passed: boolean, reason?: string) => {"
    new4 = """    // 🛡 Manual End Handler - Respects AI decision if it exists
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

    const handleEndSession = async (passed: boolean, reason?: string) => {"""
    if old4 in content:
        content = content.replace(old4, new4)
        print("   ✓ Added handleManualEnd")
        changes += 1
    else:
        print("   ✗ Pattern not found")
    
    # Change 5: Update button
    print("\n5️⃣ Updating End Interview button...")
    old5 = '                            onClick={() => handleEndSession(false, "Terminated by candidate")}'
    new5 = '                            onClick={handleManualEnd}'
    if old5 in content:
        content = content.replace(old5, new5)
        print("   ✓ Updated button")
        changes += 1
    else:
        print("   ✗ Pattern not found")
    
    # Write file
    if changes > 0:
        print(f"\n💾 Writing {changes} changes to {filepath}...")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("\n✅ Successfully implemented edge case safety features!")
        print(f"   Total changes: {changes}/5")
        return 0
    else:
        print("\n❌ No changes made - patterns didn't match")
        # Debug: show a sample of the file
        print("\nFirst 500 chars of file:")
        print(content[:500])
        return 1

if __name__ == '__main__':
    import sys
    sys.exit(main())

#!/usr/bin/env python3
"""
Implement Edge Case Safety Features in InterviewScreen.tsx
This script makes precise, targeted changes to add all safety mechanisms.
"""

import re
import sys

def read_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(filepath, content):
    with open(filepath, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(content)

def main():
    filepath = 'src/components/InterviewScreen.tsx'
    print("🔧 Implementing Edge Case Safety Features...")
    print(f"📄 Reading {filepath}...")
    
    content = read_file(filepath)
    original_content = content
    changes_made = []
    
    # Change 1: Add aiDecisionRef after hasCalledNotifyRef
    print("\n1️⃣ Adding aiDecisionRef...")
    pattern1 = r"(    const hasCalledNotifyRef = useRef<boolean>\(false\); // Prevent multiple notifyResult calls\r?\n)"
    replacement1 = r"\1    \r\n    // 🔒 AI Decision Preservation - Store AI's authoritative decision\r\n    const aiDecisionRef = useRef<{ passed: boolean; reason: string } | null>(null);\r\n"
    content, count = re.subn(pattern1, replacement1, content)
    if count > 0:
        changes_made.append("✓ Added aiDecisionRef")
        print("   ✓ Added aiDecisionRef")
    else:
        print("   ✗ Could not find hasCalledNotifyRef line")
    
    # Change 2: Add hard timer expiration useEffect
    print("\n2️⃣ Adding hard timer expiration useEffect...")
    pattern2 = r"(    }, \[connectionState, timeLeft, showContactOverlay\]\);\r?\n\r?\n    // --- 2\. Silence Monitor ---)"
    replacement2 = r"""    }, [connectionState, timeLeft, showContactOverlay]);

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
    content, count = re.subn(pattern2, replacement2, content)
    if count > 0:
        changes_made.append("✓ Added hard timer expiration useEffect")
        print("   ✓ Added hard timer expiration useEffect")
    else:
        print("   ✗ Could not find timer useEffect location")
    
    # Change 3: Update tool call handler to store AI decision
    print("\n3️⃣ Updating tool call handler...")
    pattern3 = r"(                    hasCalledNotifyRef\.current = true;\r?\n)\r?\n(                    // Ack)"
    replacement3 = r"""\1
                    // 🔒 Store AI's decision IMMEDIATELY
                    aiDecisionRef.current = { passed, reason };
                    console.log('🔒 STORE AI\\'S DECISION - This is the authoritative result');

\2"""
    content, count = re.subn(pattern3, replacement3, content)
    if count > 0:
        changes_made.append("✓ Updated tool call handler")
        print("   ✓ Updated tool call handler")
    else:
        print("   ✗ Could not find tool call handler location")
    
    # Change 4: Add handleManualEnd function before handleEndSession
    print("\n4️⃣ Adding handleManualEnd function...")
    pattern4 = r"(    const handleEndSession = async \(passed: boolean, reason\?: string\) => \{)"
    replacement4 = r"""    // 🛡 Manual End Handler - Respects AI decision if it exists
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

\1"""
    content, count = re.subn(pattern4, replacement4, content)
    if count > 0:
        changes_made.append("✓ Added handleManualEnd function")
        print("   ✓ Added handleManualEnd function")
    else:
        print("   ✗ Could not find handleEndSession location")
    
    # Change 5: Update End Interview button
    print("\n5️⃣ Updating End Interview button...")
    pattern5 = r'(                        <button\r?\n                            onClick=\{)\(\) => handleEndSession\(false, "Terminated by candidate"\)\}(\r?\n                            className="bg-red-600/20)'
    replacement5 = r'\1handleManualEnd}\2'
    content, count = re.subn(pattern5, replacement5, content)
    if count > 0:
        changes_made.append("✓ Updated End Interview button")
        print("   ✓ Updated End Interview button")
    else:
        print("   ✗ Could not find End Interview button")
    
    # Write the file
    if content != original_content:
        print(f"\n💾 Writing changes to {filepath}...")
        write_file(filepath, content)
        print("\n✅ Successfully implemented all edge case safety features!")
        print("\nFeatures Added:")
        for change in changes_made:
            print(f"  {change}")
        return 0
    else:
        print("\n❌ No changes were made. File may already have these features or patterns didn't match.")
        return 1

if __name__ == '__main__':
    sys.exit(main())

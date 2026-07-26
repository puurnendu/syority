// Simplified version of parseVisionJson for testing
function parseVisionJson(text) {
    let raw = text.trim();
    raw = raw.replace(/^```json\s*/i, '').replace(/\s*```$/g, '').trim();
    raw = raw.replace(/^```\w*\s*/, '').replace(/\s*```$/, '').trim();

    try {
        return JSON.parse(raw);
    } catch {
        /* Continue to refinement */
    }

    const firstBrace = raw.indexOf('{');
    const firstBracket = raw.indexOf('[');
    const lastBrace = raw.lastIndexOf('}');
    const lastBracket = raw.lastIndexOf(']');

    let start = -1;
    let end = -1;

    const hasBraces = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace;
    const hasBrackets = firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket;

    if (hasBraces && hasBrackets) {
        if (firstBrace < firstBracket && lastBrace > lastBracket) {
            start = firstBrace;
            end = lastBrace;
        } else if (firstBracket < firstBrace && lastBracket > lastBrace) {
            start = firstBracket;
            end = lastBracket;
        } else {
            start = Math.min(firstBrace, firstBracket);
            end = Math.max(lastBrace, lastBracket);
        }
    } else if (hasBraces) {
        start = firstBrace;
        end = lastBrace;
    } else if (hasBrackets) {
        start = firstBracket;
        end = lastBracket;
    }

    if (start !== -1 && end !== -1) {
        raw = raw.slice(start, end + 1);
    }

    try {
        return JSON.parse(raw);
    } catch (e1) {
        // ... fallbacks
        try {
            const lastBraceIndex = raw.lastIndexOf('}');
            const firstBracketIndex = raw.indexOf('[');
            if (lastBraceIndex !== -1 && firstBracketIndex !== -1 && firstBracketIndex < lastBraceIndex) {
                let truncated = raw.substring(firstBracketIndex, lastBraceIndex + 1);
                if (raw.includes('[') && !truncated.endsWith(']')) {
                    truncated = truncated + ']';
                }
                return JSON.parse(truncated);
            }
        } catch (e3) { }
    }
    throw new Error('Parse failed');
}

function test(label, input) {
    try {
        const result = parseVisionJson(input);
        console.log(`${label}: SUCCESS. TYPE: ${Array.isArray(result) ? 'array' : typeof result}`);
    } catch (err) {
        console.log(`${label}: FAILED. ${err.message}`);
    }
}

console.log('--- TESTING POTENTIAL BUG CASES ---');
test('Object wrapping array', '{"activities": [{"id": 1}]}');
test('Brackets before braces', '[DEBUG] { "a": 1 }');
test('Gemini response with text', 'Certainly, here is the JSON: [ { "id": 1 } ]');
test('AI Answer with reasoning', 'Reasoning: [I will create a workpack] Answer: { "scope": "test" }');

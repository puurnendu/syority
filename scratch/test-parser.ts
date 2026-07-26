import { parseVisionJson } from '../src/services/ai/VisionAiService';

function test(label: string, input: string) {
    try {
        const result = parseVisionJson(input);
        console.log(`${label}: SUCCESS. TYPE: ${Array.isArray(result) ? 'array' : typeof result}`);
        if (Array.isArray(result)) console.log(`  Length: ${result.length}`);
    } catch (err: any) {
        console.log(`${label}: FAILED. ${err.message}`);
    }
}

console.log('--- TESTING parseVisionJson ---');

test('Simple Object', '{"a": 1}');
test('Simple Array', '[{"a": 1}]');
test('Object with leading text', 'Here is the data: {"a": 1}');
test('Array with leading text', 'Here is the data: [{"a": 1}]');
test('Object with brackets in leading text', 'Results [PRO] are: {"a": 1}');
test('Object wrapping array', '{"activities": [{"id": 1}]}');
test('Gemini-style leading text + object', 'JSON Response: { "scope_of_work": "test", "activities": [] }');

console.log('--- TESTING POTENTIAL BUG CASES ---');
test('Brackets before braces', '[DEBUG] { "a": 1 }');
test('Mixed brackets and braces', 'Notes: [X] Data: { "a": 1 }');

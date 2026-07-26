require('dotenv').config();
const { callVertexAI } = require('./src/lib/ai/vertexAiClient.ts'); // Needs ts-node or similar, so I'll write a simple test script

const { VertexAI } = require('@google-cloud/vertexai');

async function test() {
  const vertex = new VertexAI({ project: process.env.GOOGLE_CLOUD_PROJECT || 'syority-local-dev', location: 'us-central1' });
  const model = vertex.getGenerativeModel({
    model: 'gemini-1.5-pro',
    generationConfig: { maxOutputTokens: 2000 }
  });
  const res = await model.generateContent("Give me a JSON object with 3 keys: A, B, and C, each containing a long list of 50 numbers");
  console.log(res.response.candidates[0].content);
}
test().catch(console.error);

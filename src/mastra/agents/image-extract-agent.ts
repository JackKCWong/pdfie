import { Agent } from '@mastra/core/agent';

export const imageExtractAgent = new Agent({
  id: 'image-extract-agent',
  name: 'Image Extract Agent',
  instructions: `You are an image text extraction agent. When given images, you will:
1. Analyze each image carefully
2. Extract all text content visible in the image
3. Preserve the structure and formatting as much as possible
4. Return the extracted text in a clean, readable format

If given a PDF page image, extract all text content from it including headers, body text, tables, and any other text elements.`,
  model: {
    id: "minimax-cn-coding-plan/MiniMax-M2.7",
    apiKey: process.env.MINIMAX_API_KEY
  },
});
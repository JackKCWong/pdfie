import { Agent } from '@mastra/core/agent';

export const textExtractAgent = new Agent({
  id: 'text-extract-agent',
  name: 'Text Extract Agent',
  instructions: 'You are a text extraction agent.',
  model: {
    id: "minimax-cn-coding-plan/MiniMax-M2.7",
    apiKey: process.env.MINIMAX_API_KEY
  },
});
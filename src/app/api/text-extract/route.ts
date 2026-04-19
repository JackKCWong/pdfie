import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { context, system_prompt, output_format, model, agentId } = await request.json();
    const agent = agentId || 'text-extract-agent';
    const res = await fetch(`http://localhost:4111/api/agents/${agent}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instructions: system_prompt,
        context: [context],
        messages: [`Output Format: ${output_format}`],
        maxSteps: 1,
        model: model || undefined,
      }),
    });
    const data = await res.json();
    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error('Text extract error:', error);
    return NextResponse.json({ error: 'Text extraction failed' }, { status: 500 });
  }
}
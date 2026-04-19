import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { context, system_prompt, output_format } = await request.json();
    const res = await fetch('http://localhost:4111/api/agents/text-extract-agent/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [`Context: ${context}\n\nTask: ${system_prompt}\n\nOutput Format: ${output_format}`],
        maxSteps: 1,
      }),
    });
    const data = await res.json();
    return NextResponse.json({ text: data.text });
  } catch (error) {
    console.error('Text extract error:', error);
    return NextResponse.json({ error: 'Text extraction failed' }, { status: 500 });
  }
}
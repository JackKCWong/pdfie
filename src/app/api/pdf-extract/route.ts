import { NextRequest, NextResponse } from 'next/server';
import { PDFiumLibrary } from '@hyzyla/pdfium';
import sharp from 'sharp';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const pagesStr = formData.get('pages') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const pages: number[] = pagesStr ? JSON.parse(pagesStr) : undefined;

    const pdfBuffer = Buffer.from(await file.arrayBuffer());

    const scale = 2;
    const library = await PDFiumLibrary.init();
    const document = await library.loadDocument(new Uint8Array(pdfBuffer));

    const images: Array<{
      pageNumber: number;
      base64Image: string;
      width: number;
      height: number;
    }> = [];

    const pagesToProcess = pages && pages.length > 0
      ? pages
      : Array.from({ length: document.getPageCount() }, (_, i) => i + 1);

    for (const pageNum of pagesToProcess) {
      const pageIndex = pageNum - 1;
      if (pageIndex < 0 || pageIndex >= document.getPageCount()) {
        continue;
      }

      const page = document.getPage(pageIndex);
      const rendered = await page.render({ scale });

      const pngBuffer = await sharp(Buffer.from(rendered.data), {
        raw: {
          width: rendered.width,
          height: rendered.height,
          channels: 4,
        },
      })
        .png()
        .toBuffer();

      images.push({
        pageNumber: pageNum,
        base64Image: pngBuffer.toString('base64'),
        width: rendered.width,
        height: rendered.height,
      });
    }

    document.destroy();
    library.destroy();

    const content = images.map(img => ({
      type: 'image' as const,
      data: `data:image/png;base64,${img.base64Image}`,
      mimeType: 'image/png',
    }));

    const agentResponse = await fetch('http://localhost:4111/api/agents/image-extract-agent/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extract all text content from these PDF page images. Return the extracted text preserving structure as much as possible.',
              },
              ...content,
            ],
          },
        ],
        maxSteps: 1,
      }),
    });

    const data = await agentResponse.json();
    return NextResponse.json({ text: data.text, pages: pagesToProcess });
  } catch (error) {
    console.error('PDF extract error:', error);
    return NextResponse.json({ error: 'PDF extraction failed' }, { status: 500 });
  }
}
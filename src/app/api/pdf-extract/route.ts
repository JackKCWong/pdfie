import { NextRequest, NextResponse } from 'next/server';
import { PDFiumLibrary, PDFiumPageRenderOptions } from '@hyzyla/pdfium';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

async function renderToPng(options: PDFiumPageRenderOptions) {
  console.log('Rendering page to PNG with options: data.length=%d', options.data.length);
  console.log('Rendering page to PNG with options: width=%d, height=%d', options.width, options.height);
  return await sharp(options.data, {
    raw: {
      width: options.width,
      height: options.height,
      channels: 4,
    },
  })
    .png()
    .toBuffer();
}

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
    const pdfHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

    const uploadsDir = path.join(os.tmpdir(), 'pdfie-uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const scale = 3;
    const library = await PDFiumLibrary.init();
    const document = await library.loadDocument(new Uint8Array(pdfBuffer));

    const images: Array<{
      pageNumber: number;
      base64Image: string;
      width: number;
      height: number;
      url: string;
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
      const size = page.getOriginalSize();
      const pngBuffer = await page.render({
        scale,
        render: renderToPng,
      });

      console.log('Rendered page %d to PNG, buffer length: %d, type: %s', pageNum, pngBuffer.data.length, Buffer.isBuffer(pngBuffer.data));

      const imageHash = `${pdfHash}-${pageNum}`;
      const imagePath = path.join(uploadsDir, `${imageHash}.png`);
      fs.writeFileSync(imagePath, pngBuffer.data);

      const base64Image = Buffer.from(pngBuffer.data).toString('base64');
      console.log('Converted page %d PNG to base64, length: %d', pageNum, base64Image.length);

      images.push({
        pageNumber: pageNum,
        base64Image: base64Image,
        width: Math.floor(size.originalWidth * scale),
        height: Math.floor(size.originalHeight * scale),
        url: `/api/uploads/${imageHash}`,
      });
    }

    const content = images.map(img => ({
      type: 'image' as const,
      // image: `http://localhost:3000${img.url}`,
      image: `data:image/png;base64,${img.base64Image}`,
      mimeType: 'image/png',
    }));

    document.destroy();
    library.destroy();

    const body = JSON.stringify({
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
    });

    const agentResponse = await fetch('http://localhost:4111/api/agents/image-extract-agent/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body,
    });

    const data = await agentResponse.json();
    return NextResponse.json({ text: data.text, pages: pagesToProcess, hashes: images.map(img => ({ pageNumber: img.pageNumber, hash: `${pdfHash}-${img.pageNumber}`, url: img.url })) });
  } catch (error) {
    console.error('PDF extract error:', error);
    return NextResponse.json({ error: 'PDF extraction failed' }, { status: 500 });
  }
}
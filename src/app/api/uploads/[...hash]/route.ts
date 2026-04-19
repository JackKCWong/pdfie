import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ hash: string[] }> }
) {
  try {
    const { hash } = await params;
    const filename = hash[hash.length - 1];
    const cleanHash = filename.replace(/\.(pdf|png)$/i, '');

    const uploadsDir = path.join(os.tmpdir(), 'pdfie-uploads');

    const pdfPath = path.join(uploadsDir, `${cleanHash}.pdf`);
    const pngPath = path.join(uploadsDir, `${cleanHash}.png`);

    let filePath: string;
    let contentType: string;

    if (fs.existsSync(pdfPath)) {
      filePath = pdfPath;
      contentType = 'application/pdf';
    } else if (fs.existsSync(pngPath)) {
      filePath = pngPath;
      contentType = 'image/png';
    } else {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const buffer = fs.readFileSync(filePath);

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${cleanHash}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Serve error:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}
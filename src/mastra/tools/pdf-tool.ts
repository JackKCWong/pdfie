import { createTool } from '@mastra/core/tools';
import { PDFiumLibrary } from '@hyzyla/pdfium';
import sharp from 'sharp';
import { z } from 'zod';

const pdfTool = createTool({
  id: 'pdf-to-images',
  description: 'Converts specified PDF pages to images using PDFium and sharp',
  inputSchema: z.object({
    pdfData: z.string().describe('Base64 encoded PDF data'),
    pages: z.array(z.number()).describe('Array of page numbers to convert (1-indexed)'),
    scale: z.number().optional().default(2).describe('Render scale factor'),
  }),
  outputSchema: z.object({
    images: z.array(z.object({
      pageNumber: z.number(),
      base64Image: z.string(),
      width: z.number(),
      height: z.number(),
    })),
  }),
  execute: async ({ pdfData, pages, scale = 2 }) => {
    const binaryData = Buffer.from(pdfData, 'base64');

    const library = await PDFiumLibrary.init();
    const document = await library.loadDocument(new Uint8Array(binaryData));

    const renderFunction = async (options: { data: Uint8Array; width: number; height: number }) => {
      return await sharp(options.data, {
        raw: {
          width: options.width,
          height: options.height,
          channels: 4,
        },
      })
        .png()
        .toBuffer();
    };

    const results = [];

    for (const pageNum of pages) {
      const pageIndex = pageNum - 1;
      if (pageIndex < 0 || pageIndex >= document.getPageCount()) {
        continue;
      }

      const page = document.getPage(pageIndex);
      const imageBuffer = await page.render({
        scale,
        render: renderFunction,
      });

      results.push({
        pageNumber: pageNum,
        base64Image: Buffer.from(imageBuffer.data).toString('base64'),
        width: imageBuffer.width,
        height: imageBuffer.height,
      });
    }

    document.destroy();
    library.destroy();

    return { images: results };
  },
});

export { pdfTool };
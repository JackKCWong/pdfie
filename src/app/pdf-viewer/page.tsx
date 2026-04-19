"use client";

import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("@embedpdf/react-pdf-viewer").then((mod) => mod.PDFViewer), { ssr: false });

export default function PdfViewerPage() {
  const url = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("url") : null;
  const hash = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("hash") : null;

  if (!url) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-100">
        <p className="text-zinc-500">No PDF URL provided</p>
      </div>
    );
  }

  return (
    <div className="w-full h-screen">
      <PDFViewer
        key={hash}
        config={{
          src: url,
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
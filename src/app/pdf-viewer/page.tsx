"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("@embedpdf/react-pdf-viewer").then((mod) => mod.PDFViewer), { ssr: false });

export default function PdfViewerPage() {
  const [url, setUrl] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setUrl(new URLSearchParams(window.location.search).get("url"));
    setHash(new URLSearchParams(window.location.search).get("hash"));
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-zinc-100">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

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
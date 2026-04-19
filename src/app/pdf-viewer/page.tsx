"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const PDFViewer = dynamic(() => import("@embedpdf/react-pdf-viewer").then((mod) => mod.PDFViewer), { ssr: false });

export default function PdfViewerPage() {
  const [url, setUrl] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadFromParams = () => {
      const params = new URLSearchParams(window.location.search);
      setUrl(params.get("url"));
      setHash(params.get("hash"));
      setMounted(true);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "LOAD_PDF") {
        setUrl(event.data.url);
        setHash(event.data.hash);
        setMounted(true);
      }
    };

    window.addEventListener("message", handleMessage);
    loadFromParams();

    return () => window.removeEventListener("message", handleMessage);
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
    <div className="w-full h-screen" ref={viewerRef}>
      <PDFViewer
        key={url}
        config={{
          src: url,
        }}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
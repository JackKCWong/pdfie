"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const PDFViewer = dynamic(() => import("@embedpdf/react-pdf-viewer").then((mod) => mod.PDFViewer), { ssr: false });

interface UploadedFile {
  name: string;
  hash: string;
  url: string;
  textContent: string | null;
}

type TabType = "pdf" | "textLayer" | "extraction";

const STORAGE_KEYS = {
  files: "pdfie_files",
  systemPrompt: "pdfie_systemPrompt",
  outputFormat: "pdfie_outputFormat",
  extractionResult: "pdfie_extractionResult",
} as const;

function loadFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors
  }
}

export default function PdfiePage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editor1Content, setEditor1Content] = useState("");
  const [editor2Content, setEditor2Content] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("pdf");
  const [extractionResult, setExtractionResult] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const isHydrated = useRef(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setFiles(loadFromStorage(STORAGE_KEYS.files, []));
    setEditor1Content(loadFromStorage(STORAGE_KEYS.systemPrompt, ""));
    setEditor2Content(loadFromStorage(STORAGE_KEYS.outputFormat, ""));
    setExtractionResult(loadFromStorage(STORAGE_KEYS.extractionResult, null));
    isHydrated.current = true;
  }, []);

  const extractTextFromPdf = async (url: string): Promise<string | null> => {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).href;
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        fullText += `# page ${i}\n${pageText}\n\n`;
      }

      return fullText.trim() || null;
    } catch (err) {
      console.error("Error extracting text:", err);
      return null;
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    setUploading(true);

    const uploadedFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      if (file.type !== "application/pdf") continue;

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/pdf-upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        const fullUrl = `${window.location.origin}${data.url}`;
        const textContent = await extractTextFromPdf(fullUrl);

        uploadedFiles.push({
          name: file.name,
          hash: data.hash,
          url: data.url,
          textContent,
        });
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }

    setFiles((prev) => [...prev, ...uploadedFiles]);
    setUploading(false);
  };

  useEffect(() => {
    if (selectedFile) {
      const file = files.find((f) => f.hash === selectedFile.hash);
      if (file && file.textContent === undefined) {
        const fullUrl = `${window.location.origin}${selectedFile.url}`;
        extractTextFromPdf(fullUrl).then((text) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.hash === selectedFile.hash ? { ...f, textContent: text } : f
            )
          );
          setSelectedFile((prev) => (prev ? { ...prev, textContent: text } : null));
        });
      }
    }
  }, [selectedFile]);

  useEffect(() => {
    if (isHydrated.current) {
      saveToStorage(STORAGE_KEYS.files, files);
    }
  }, [files]);

  useEffect(() => {
    if (isHydrated.current) {
      saveToStorage(STORAGE_KEYS.systemPrompt, editor1Content);
    }
  }, [editor1Content]);

  useEffect(() => {
    if (isHydrated.current) {
      saveToStorage(STORAGE_KEYS.outputFormat, editor2Content);
    }
  }, [editor2Content]);

  useEffect(() => {
    if (isHydrated.current) {
      saveToStorage(STORAGE_KEYS.extractionResult, extractionResult);
    }
  }, [extractionResult]);

  useEffect(() => {
    if (isHydrated.current && files.length > 0 && !selectedFile) {
      setSelectedFile(files[0]);
    }
  }, [files, selectedFile]);

  return (
    <div className="flex flex-1 bg-white">
      <div id="file-panel" className="w-[15%] h-screen border-r border-zinc-200 p-6 overflow-y-auto">
        <h1 className="text-xl font-semibold text-zinc-900 mb-6">PDFie</h1>
        <label className="block">
          <span className="sr-only">Choose PDF files</span>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-900 hover:file:bg-zinc-200 cursor-pointer disabled:opacity-50"
          />
        </label>
        {uploading && (
          <p className="mt-4 text-sm text-zinc-500">Uploading...</p>
        )}
        {files.length > 0 && (
          <ul className="mt-6 space-y-2">
            {files.map((file) => (
              <li key={file.hash}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(file);
                    setActiveTab("pdf");
                  }}
                  className={`text-sm text-left truncate w-full px-2 py-1 rounded ${
                    selectedFile?.hash === file.hash
                      ? "bg-zinc-200 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {file.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-auto pt-6">
          <button
            type="button"
            onClick={async () => {
              if (!selectedFile?.textContent) return;
              setIsExtracting(true);
              try {
                const res = await fetch("/api/text-extract", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    context: selectedFile.textContent,
                    system_prompt: editor1Content,
                    output_format: editor2Content,
                  }),
                });
                const data = await res.json();
                setExtractionResult(data.text);
                setActiveTab("extraction");
              } catch (err) {
                console.error("Extraction failed:", err);
              }
              setIsExtracting(false);
            }}
            disabled={!selectedFile?.textContent || isExtracting}
            className="w-full py-2 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExtracting ? "Extracting..." : "Run"}
          </button>
        </div>
      </div>
      <div id="viewer-panel" className="w-[40%] h-screen overflow-y-auto">
        {selectedFile ? (
          <div className="w-full h-full flex flex-col min-h-0">
            <div className="flex border-b border-zinc-200 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("pdf")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "pdf"
                    ? "text-zinc-900 border-b-2 border-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                PDF
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("textLayer")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "textLayer"
                    ? "text-zinc-900 border-b-2 border-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                Text Layer
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("extraction")}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === "extraction"
                    ? "text-zinc-900 border-b-2 border-zinc-900"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                Extraction
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {activeTab === "pdf" ? (
                <div className="h-full overflow-y-auto">
                  <PDFViewer
                    key={selectedFile.hash}
                    config={{
                      src: `${window.location.origin}${selectedFile.url}`,
                    }}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              ) : activeTab === "textLayer" ? (
                selectedFile.textContent ? (
                  <MonacoEditor
                    language="markdown"
                    value={selectedFile.textContent}
                    theme="vs"
                    options={{
                      minimap: { enabled: false },
                      readOnly: true,
                      wordWrap: "on",
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-400">
                    No text layer available
                  </div>
                )
              ) : activeTab === "extraction" ? (
                extractionResult ? (
                  <MonacoEditor
                    language="markdown"
                    value={extractionResult}
                    theme="vs"
                    options={{
                      minimap: { enabled: false },
                      readOnly: true,
                      wordWrap: "on",
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-400">
                    Run extraction to see results
                  </div>
                )
              ) : null}
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-50">
            <p className="text-zinc-400">Select PDF files to begin</p>
          </div>
        )}
      </div>
      <div id="editor-panel" className="w-[45%] h-screen shrink-0 flex flex-col overflow-hidden">
          <div className="h-[60%] border-b border-zinc-200 flex flex-col">
            <div className="px-3 py-2 bg-zinc-100 border-b border-zinc-200 text-sm font-medium text-zinc-700">
              System Prompt
            </div>
            <MonacoEditor
              language="markdown"
              value={editor1Content}
              onChange={(val) => setEditor1Content(val || "")}
              theme="vs"
              options={{ minimap: { enabled: false } }}
            />
          </div>
          <div className="h-[40%] flex flex-col">
            <div className="px-3 py-2 bg-zinc-100 border-b border-zinc-200 text-sm font-medium text-zinc-700">
              Output Format
            </div>
            <MonacoEditor
              language="markdown"
              value={editor2Content}
              onChange={(val) => setEditor2Content(val || "")}
              theme="vs"
              options={{ minimap: { enabled: false } }}
            />
          </div>
        </div>
    </div>
  );
}
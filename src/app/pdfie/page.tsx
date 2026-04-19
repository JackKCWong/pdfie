"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });
const PDFViewer = dynamic(() => import("@embedpdf/react-pdf-viewer").then((mod) => mod.PDFViewer), { ssr: false });

interface PDFViewerFrameProps {
  url: string;
  hash: string;
}

function PDFViewerFrame({ url, hash }: PDFViewerFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <iframe
      ref={iframeRef}
      src={`/pdf-viewer?url=${encodeURIComponent(url)}&hash=${encodeURIComponent(hash)}`}
      className="w-full h-full border-0"
      title="PDF Viewer"
    />
  );
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
}

function Editor({ value, onChange, label }: EditorProps) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (val: string | undefined) => {
    const newValue = val || "";
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 bg-zinc-100 border-b border-zinc-200 text-sm font-medium text-zinc-700">
        {label}
      </div>
      <div className="flex-1 min-h-0">
        <MonacoEditor
          language="markdown"
          value={localValue}
          onChange={handleChange}
          theme="vs"
          options={{ minimap: { enabled: false } }}
        />
      </div>
    </div>
  );
}

function TextLayerEditor({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <MonacoEditor
      language="markdown"
      value={localValue}
      onChange={(val) => onChange(val || "")}
      theme="vs"
      options={{ minimap: { enabled: false }, wordWrap: "on" }}
    />
  );
}

interface Model {
  id: string;
  provider: string;
  providerName: string;
  model: string;
  contextWindow?: number;
}

const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "gpt-4-turbo": 128000,
  "gpt-4": 8192,
  "gpt-4-32k": 32768,
  "gpt-3.5-turbo": 16385,
  "claude-opus-4-5": 200000,
  "claude-sonnet-4-5": 200000,
  "claude-haiku-4-5": 200000,
  "claude-opus-4-1": 200000,
  "claude-sonnet-4-5-20250929": 200000,
  "claude-haiku-4-5-20251001": 200000,
  "gemini-2.5-pro": 1048576,
  "gemini-2.5-flash": 1048576,
  "gemini-2.0-flash-lite": 1048576,
  "gemini-3-pro-preview": 1048576,
  "gemini-3-flash-preview": 1048576,
  "qwen-max": 32768,
  "qwen-plus": 131072,
  "qwen-flash": 131072,
  "qwen3-max": 131072,
  "qwen3-235b-a22b": 131072,
  "deepseek-chat": 128000,
  "deepseek-v3.2": 128000,
  "deepseek-reasoner": 128000,
  "doubao-seed-1-8-251215": 256000,
  "doubao-seed-1-6-vision-250815": 256000,
  "kimi-k2": 128000,
  "kimi-k2-0905-preview": 128000,
  "ministral-14b-2512": 128000,
  "mistral-large-2512": 128000,
  "gpt-5": 128000,
  "gpt-5-mini": 128000,
  "gpt-5-pro": 128000,
  "gpt-5-thinking": 128000,
  "gpt-4.1": 128000,
  "gpt-4.1-mini": 128000,
  "gpt-4.1-nano": 128000,
  "gpt-5.1": 128000,
  "gpt-5.2": 400000,
  "grok-4": 131072,
  "grok-4.1": 131072,
  "grok-4-1-fast-reasoning": 131072,
  "grok-4-1-fast-non-reasoning": 131072,
  "MiniMax-M1": 1000000,
  "MiniMax-M2": 1000000,
  "MiniMax-M2.1": 200000,
  "MiniMax-M2.7": 1000000,
};

interface Agent {
  id: string;
  name: string;
  provider: string;
  modelId: string;
}

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
  const [isMultimodalExtracting, setIsMultimodalExtracting] = useState(false);
  const [multimodalPages, setMultimodalPages] = useState<string>("");
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const isHydrated = useRef(false);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const [tokenCounts, setTokenCounts] = useState({ textLayer: 0, systemPrompt: 0, outputFormat: 0, extractionResult: 0 });

  const calculateTokens = async (text: string): Promise<number> => {
    try {
      const tiktoken = await import("js-tiktoken");
      const encoding = await tiktoken.getEncoding("o200k_base");
      const tokens = encoding.encode(text);
      return tokens.length;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    const updateTokens = async () => {
      const textLayerTokens = selectedFile?.textContent ? await calculateTokens(selectedFile.textContent) : 0;
      const systemPromptTokens = await calculateTokens(editor1Content);
      const outputFormatTokens = await calculateTokens(editor2Content);
      const extractionResultTokens = extractionResult ? await calculateTokens(extractionResult) : 0;
      setTokenCounts({ textLayer: textLayerTokens, systemPrompt: systemPromptTokens, outputFormat: outputFormatTokens, extractionResult: extractionResultTokens });
    };
    updateTokens();
  }, [selectedFile?.textContent, editor1Content, editor2Content, extractionResult]);

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

  useEffect(() => {
    fetch('/api/models')
      .then((res) => res.json())
      .then((data) => {
        const modelsWithContext: Model[] = (data.models || []).map((m: Model) => ({
          ...m,
          contextWindow: MODEL_CONTEXT_WINDOWS[m.model] || MODEL_CONTEXT_WINDOWS[m.id] || undefined,
        }));
        setModels(modelsWithContext);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch('http://localhost:4111/api/agents')
      .then((res) => res.json())
      .then((data) => {
        const agentList: Agent[] = Object.entries(data).map(([id, agent]: [string, any]) => ({
          id,
          name: agent.name,
          provider: agent.provider,
          modelId: agent.modelId,
        }));
        setAgents(agentList);
        if (agentList.length > 0) {
          setSelectedAgent(agentList[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedAgent && agents.length > 0) {
      const agent = agents.find((a) => a.id === selectedAgent);
      if (agent) {
        const filtered = models.filter((m) => m.provider === agent.provider);
        if (filtered.length > 0) {
          setSelectedModel(filtered[0].id);
        }
      }
    }
  }, [selectedAgent, agents, models]);

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

  const handleDeleteFile = (hash: string) => {
    setFiles((prev) => prev.filter((f) => f.hash !== hash));
    setSelectedFile((prev) => (prev?.hash === hash ? null : prev));
  };

  const handleMultimodalExtract = async () => {
    if (!selectedFile) return;
    setIsMultimodalExtracting(true);
    try {
      const pdfUrl = `${window.location.origin}${selectedFile.url}`;
      const response = await fetch(pdfUrl);
      const pdfBlob = await response.blob();

      const formData = new FormData();
      formData.append("file", pdfBlob, selectedFile.name);
      if (multimodalPages.trim()) {
        const pages = multimodalPages.split(",").map(p => parseInt(p.trim(), 10)).filter(n => !isNaN(n));
        if (pages.length > 0) {
          formData.append("pages", JSON.stringify(pages));
        }
      }
      formData.append("system_prompt", editor1Content);
      formData.append("output_format", editor2Content);

      const res = await fetch("/api/pdf-extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setExtractionResult(data.text);
      setActiveTab("extraction");
    } catch (err) {
      console.error("Multimodal extraction failed:", err);
    }
    setIsMultimodalExtracting(false);
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
              <li key={file.hash} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(file);
                    setActiveTab("pdf");
                    setExtractionResult(null);
                  }}
                  className={`text-sm text-left truncate flex-1 px-2 py-1 rounded ${
                    selectedFile?.hash === file.hash
                      ? "bg-zinc-200 text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100"
                  }`}
                >
                  {file.name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteFile(file.hash)}
                  className="text-zinc-400 hover:text-red-500 px-1 py-1 text-sm"
                  title="Delete file"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6 border border-zinc-200 rounded-lg p-3">
          <h3 className="text-xs font-medium text-zinc-700 mb-2">Token Summary</h3>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-500 border-b border-zinc-100">
                <th className="text-left font-medium py-1">Component</th>
                <th className="text-right font-medium py-1">Tokens</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-zinc-100">
                <td className="py-1 text-zinc-600">Text Layer</td>
                <td className="py-1 text-right text-zinc-900 font-mono">{tokenCounts.textLayer.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-1 text-zinc-600">System Prompt</td>
                <td className="py-1 text-right text-zinc-900 font-mono">{tokenCounts.systemPrompt.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-1 text-zinc-600">Output Format</td>
                <td className="py-1 text-right text-zinc-900 font-mono">{tokenCounts.outputFormat.toLocaleString()}</td>
              </tr>
              <tr className="border-b border-zinc-100">
                <td className="py-1 text-zinc-600">Extraction</td>
                <td className="py-1 text-right text-zinc-900 font-mono">{tokenCounts.extractionResult.toLocaleString()}</td>
              </tr>
              <tr className="border-t border-zinc-200 font-medium">
                <td className="py-1 text-zinc-700">Total Used</td>
                <td className="py-1 text-right text-zinc-900 font-mono">
                  {(tokenCounts.textLayer + tokenCounts.systemPrompt + tokenCounts.outputFormat + tokenCounts.extractionResult).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
          {selectedModel && (() => {
            const selectedModelInfo = models.find((m) => m.id === selectedModel);
            const contextWindow = selectedModelInfo?.contextWindow;
            const totalUsed = tokenCounts.textLayer + tokenCounts.systemPrompt + tokenCounts.outputFormat + tokenCounts.extractionResult;
            if (!contextWindow) return <p className="mt-2 text-xs text-zinc-400">Context window: Unknown</p>;
            const percentage = ((totalUsed / contextWindow) * 100).toFixed(1);
            return (
              <p className="mt-2 text-xs text-zinc-400">
                Context: {contextWindow.toLocaleString()} | {percentage}% used
              </p>
            );
          })()}
        </div>
        <div className="mt-auto pt-6">
          <label className="block text-xs text-zinc-500 mb-1">Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="w-full mb-2 px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
          <label className="block text-xs text-zinc-500 mb-1">Model</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full mb-2 px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {models.filter((m) => m.provider === agents.find((a) => a.id === selectedAgent)?.provider).map((model) => (
              <option key={model.id} value={model.id}>
                {model.model}
              </option>
            ))}
          </select>
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
                    model: selectedModel,
                    agentId: selectedAgent,
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
          <div className="mt-3">
            <label className="block text-xs text-zinc-500 mb-1">Pages (optional)</label>
            <input
              type="text"
              value={multimodalPages}
              onChange={(e) => setMultimodalPages(e.target.value)}
              placeholder="e.g., 1,2,3 or 1-5"
              className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-lg bg-white text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
          </div>
          <button
            type="button"
            onClick={handleMultimodalExtract}
            disabled={!selectedFile || isMultimodalExtracting}
            className="w-full py-2 px-4 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMultimodalExtracting ? "Extracting..." : "Run Multimodal"}
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
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <div className="absolute inset-0 overflow-y-auto" style={{ visibility: activeTab === "pdf" ? "visible" : "hidden" }}>
                {selectedFile && (
                  <PDFViewerFrame
                    url={`${window.location.origin}${selectedFile.url}`}
                    hash={selectedFile.hash}
                  />
                )}
              </div>
              <div className="absolute inset-0 overflow-y-auto" style={{ visibility: activeTab === "textLayer" ? "visible" : "hidden" }}>
                {selectedFile?.textContent != null ? (
                  <TextLayerEditor
                    value={selectedFile.textContent}
                    onChange={(val) => {
                      setSelectedFile((prev) => prev ? { ...prev, textContent: val } : null);
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-zinc-400">
                    No text layer available
                  </div>
                )}
              </div>
              <div className="absolute inset-0 overflow-y-auto" style={{ visibility: activeTab === "extraction" ? "visible" : "hidden" }}>
                {extractionResult ? (
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
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-50">
            <p className="text-zinc-400">Select PDF files to begin</p>
          </div>
        )}
      </div>
      <div
          id="editor-panel"
          className="w-[45%] h-screen shrink-0 flex flex-col overflow-hidden"
        >
          <div className="h-[60%] border-b border-zinc-200">
            <Editor
              value={editor1Content}
              onChange={setEditor1Content}
              label="System Prompt"
            />
          </div>
          <div className="h-[40%]">
            <Editor
              value={editor2Content}
              onChange={setEditor2Content}
              label="Output Format"
            />
          </div>
        </div>
    </div>
  );
}
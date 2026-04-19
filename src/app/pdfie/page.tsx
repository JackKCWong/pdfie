"use client";

import { useState } from "react";

export default function PdfiePage() {
  const [files, setFiles] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList) {
      setFiles(Array.from(fileList).map((f) => f.name));
    }
  };

  return (
    <div className="flex flex-1 bg-white">
      <div className="w-64 border-r border-zinc-200 p-6">
        <h1 className="text-xl font-semibold text-zinc-900 mb-6">PDFie</h1>
        <label className="block">
          <span className="sr-only">Choose PDF files</span>
          <input
            type="file"
            accept="application/pdf"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-900 hover:file:bg-zinc-200 cursor-pointer"
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-6 space-y-2">
            {files.map((name) => (
              <li key={name} className="text-sm text-zinc-600 truncate">
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex-1 flex items-center justify-center">
        <p className="text-zinc-400">Select PDF files to begin</p>
      </div>
    </div>
  );
}
import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function findRegistryPath() {
  const rel = join('node_modules', '@mastra', 'core', 'dist', 'provider-registry.json');
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    try {
      const p = join(dir, rel);
      readFileSync(p, "utf-8");
      return p;
    } catch {
      dir = dirname(dir);
    }
  }
  return join(process.cwd(), rel);
}

export async function GET() {
  try {
    const path = findRegistryPath();
    const registry = JSON.parse(readFileSync(path, "utf-8"));
    const models = Object.entries(registry.providers).flatMap(([providerKey, provider]: [string, any]) =>
      provider.models.map((model: string) => ({
        id: `${providerKey}/${model}`,
        provider: providerKey,
        providerName: provider.name || providerKey,
        model,
      }))
    );
    return NextResponse.json({ models, version: registry.version });
  } catch (error) {
    console.error('Error loading model registry:', error);
    return NextResponse.json({ error: 'Failed to load model registry' }, { status: 500 });
  }
}
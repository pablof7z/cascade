import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const webRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const libRoot = path.join(webRoot, 'src', 'lib');
const envStubUrl = pathToFileURL(path.join(webRoot, 'tests', 'stubs', 'env-public.mjs')).href;

function resolveLibPath(specifier) {
  const relativePath = specifier.slice('$lib/'.length);
  const candidates = [
    path.join(libRoot, relativePath),
    path.join(libRoot, `${relativePath}.ts`),
    path.join(libRoot, `${relativePath}.js`),
    path.join(libRoot, relativePath, 'index.ts'),
    path.join(libRoot, relativePath, 'index.js')
  ];

  const match = candidates.find((candidate) => fs.existsSync(candidate));
  return match ? pathToFileURL(match).href : null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === '$env/dynamic/public') {
    return { shortCircuit: true, url: envStubUrl };
  }

  if (specifier.startsWith('$lib/')) {
    const url = resolveLibPath(specifier);
    if (url) {
      return { shortCircuit: true, url };
    }
  }

  return nextResolve(specifier, context);
}

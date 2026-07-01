import { Buffer } from "buffer";

interface BrowserProcess {
  browser: true;
  env: Record<string, string | undefined>;
  version: string;
  versions: Record<string, string>;
}

type BrowserGlobal = typeof globalThis & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
};

const browserGlobal = globalThis as BrowserGlobal;
const processGlobal = globalThis as unknown as { process?: BrowserProcess };

if (!browserGlobal.Buffer) {
  browserGlobal.Buffer = Buffer;
}

if (!browserGlobal.global) {
  browserGlobal.global = browserGlobal;
}

if (!processGlobal.process) {
  processGlobal.process = {
    browser: true,
    env: {
      NODE_ENV: import.meta.env.MODE,
      SHELBY_ENCODING: import.meta.env.VITE_SHELBY_ENCODING,
    },
    version: "",
    versions: {},
  };
}

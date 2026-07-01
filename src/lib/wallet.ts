export function resolveAccountAddress(account: unknown): string | null {
  if (!isRecord(account)) {
    return null;
  }

  return readAddressValue(account.accountAddress) ?? readAddressValue(account.address);
}

export function hasConnectedAccount(connected: boolean, account: unknown): boolean {
  return connected && resolveAccountAddress(account) !== null;
}

function readAddressValue(value: unknown): string | null {
  if (typeof value === "string") {
    return normalizeAddress(value);
  }

  if (!isRecord(value)) {
    return null;
  }

  const nestedAddress = readAddressValue(value.address);
  if (nestedAddress) {
    return nestedAddress;
  }

  const toString = value.toString;
  if (typeof toString !== "function") {
    return null;
  }

  const rendered = toString.call(value);
  return normalizeAddress(rendered);
}

function normalizeAddress(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "[object Object]") {
    return null;
  }
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

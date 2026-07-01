export function formatApt(octas: number): string {
  const apt = octas / 100_000_000;
  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: apt >= 1 ? 2 : 4,
    minimumFractionDigits: apt >= 1 ? 2 : 0,
  }).format(apt)} APT`;
}

export function parseAptToOctas(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,8})?$/.test(normalized)) {
    throw new Error("Price must be an APT amount with up to 8 decimals");
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  const paddedFraction = fraction.padEnd(8, "0");
  return Number(whole) * 100_000_000 + Number(paddedFraction);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

export function compactAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatDate(timestampMs: number): string {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestampMs));
}

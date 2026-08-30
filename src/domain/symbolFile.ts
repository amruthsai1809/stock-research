const windowsReservedFileName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Maps an exchange symbol to the stable filename used by generated static data.
 * Windows device names need a suffix even when a JSON extension is present.
 */
export function symbolFileSlug(symbol: string): string {
  const slug = symbol.trim().toLowerCase().replaceAll(".", "-");
  return windowsReservedFileName.test(slug) ? `${slug}-ticker` : slug;
}

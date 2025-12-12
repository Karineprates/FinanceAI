type ParsedReceipt = {
  amount?: number;
  date?: string;
  category?: string;
  note?: string;
};

const datePatterns = [
  /\b(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})\b/, // dd/mm/yyyy
  /\b(\d{4})[\/\-](\d{2})[\/\-](\d{2})\b/,   // yyyy-mm-dd
];

const currencyPatterns = [
  /R\$?\s*([-+]?\d{1,3}(?:\.\d{3})*,\d{2})/g,
  /([-+]?\d+\.\d{2})/g,
  /([-+]?\d+,\d{2})/g,
];

export function parseReceiptText(text: string): ParsedReceipt {
  const normalized = text.replace(/\s+[A-Z]{3}\s+/g, ' ');
  const lines = normalized.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const date = extractDate(lines.join(' '));
  const amount = extractAmount(lines.join(' '));
  const vendor = extractVendor(lines);

  return {
    amount,
    date,
    category: vendor ?? undefined,
    note: vendor ?? lines.slice(0, 2).join(' ').slice(0, 80),
  };
}

function extractDate(text: string): string | undefined {
  for (const pattern of datePatterns) {
    const match = pattern.exec(text);
    if (match) {
      if (match[3].length === 4) {
        const [year, month, day] = [match[1], match[2], match[3]];
        return `${year}-${month}-${day}`;
      }
      const [day, month, yearRaw] = [match[1], match[2], match[3]];
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
      return `${year}-${month}-${day}`;
    }
  }
  return undefined;
}

function extractAmount(text: string): number | undefined {
  const found: number[] = [];
  for (const pattern of currencyPatterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      const raw = m[1];
      const parsed = parseAmountRaw(raw);
      if (!Number.isNaN(parsed)) found.push(parsed);
    }
  }
  if (!found.length) return undefined;
  return found.sort((a, b) => b - a)[0];
}

function extractVendor(lines: string[]): string | undefined {
  for (const line of lines) {
    const clean = line.replace(/[^A-Za-zÀ-ÿ0-9\s]/g, '').trim();
    if (
      clean.length >= 4 &&
      !/total/i.test(clean) &&
      !/valor/i.test(clean) &&
      !/troco/i.test(clean) &&
      !/data/i.test(clean) &&
      !/\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(clean)
    ) {
      return clean.slice(0, 40);
    }
  }
  return undefined;
}

function parseAmountRaw(val: string) {
  if (!val) return NaN;
  const clean = val.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Number(clean);
}

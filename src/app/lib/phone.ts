/** US phone display: +1 (555) 123-4567 */
export const US_PHONE_PLACEHOLDER = '+1 (555) 123-4567';

function nationalDigits(value: string): string {
  let digits = String(value ?? '').replace(/\D/g, '');
  if (digits.startsWith('1') && (digits.length > 10 || String(value ?? '').includes('+'))) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function applyFormat(digits: string): string {
  if (!digits) return '';
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);
  if (digits.length < 3) return `+1 (${area}`;
  if (digits.length === 3) return `+1 (${area})`;
  if (digits.length < 7) return `+1 (${area}) ${prefix}`;
  return `+1 (${area}) ${prefix}-${line}`;
}

/** Backspace on ")" or "-" should remove a digit, not only the punctuation. */
function deletedFormattingChar(raw: string, formatted: string): boolean {
  if (!raw.startsWith('+1') || formatted.length !== raw.length + 1) return false;
  let i = 0;
  let extra = 0;
  for (let j = 0; j < formatted.length; j++) {
    if (i < raw.length && raw[i] === formatted[j]) i++;
    else extra++;
  }
  return extra === 1 && i === raw.length;
}

export function formatUsPhone(value: string): string {
  const digits = nationalDigits(value);
  const formatted = applyFormat(digits);
  if (deletedFormattingChar(value, formatted)) {
    return applyFormat(digits.slice(0, -1));
  }
  return formatted;
}

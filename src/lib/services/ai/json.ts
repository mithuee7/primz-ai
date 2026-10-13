/** Parses model output that should be a JSON object. Tolerates code fences / leading prose. */
export function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through
    }
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const extracted = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(extracted);
    } catch {
      // Try to fix common JSON issues
      try {
        const fixed = fixCommonJsonIssues(extracted);
        console.log(`[json] Fixed malformed JSON. Original length=${extracted.length}, fixed length=${fixed.length}`);
        return JSON.parse(fixed);
      } catch {
        // fall through
      }
    }
  }
  throw new Error("Model output was not valid JSON");
}

/** Attempts to fix common JSON formatting issues from LLMs */
function fixCommonJsonIssues(json: string): string {
  let fixed = json;

  // Fix trailing commas before closing braces/brackets
  fixed = fixed.replace(/,(\s*[}\]])/g, "$1");

  // Fix unquoted keys (simple cases)
  fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

  // Fix single quotes to double quotes (but be careful with escapes)
  fixed = fixed.replace(/'([^']*)'/g, (match, content) => {
    // Only replace if it looks like a simple string value
    if (!content.includes('"') && !content.includes('\\')) {
      return `"${content}"`;
    }
    return match;
  });

  return fixed;
}

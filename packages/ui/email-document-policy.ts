// Email HTML is a serialized document, never editor/application markup.
// SOT: docs/business/semantic-gestures.md
// SOT-KEYWORDS: email sandbox document CSP policy preview
export function emailPreviewDocument(html: string, showImages: boolean): string {
  if (!/^<!doctype html>/i.test(html) || !html.includes('<head>')) throw new Error('Expected a generated email document');
  const csp = `default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src ${showImages ? 'https:' : "'none'"}; form-action 'none'; base-uri 'none'`;
  return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`).replaceAll('<a ', '<a target="_blank" ');
}

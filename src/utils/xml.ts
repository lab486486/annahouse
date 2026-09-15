const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function stripInvalidXmlChars(value: string): string {
  return value.replace(INVALID_XML_CHARS, "");
}

export function cdata(value: string): string {
  const cleaned = stripInvalidXmlChars(value).replaceAll("]]>", "]]]]><![CDATA[>");
  return `<![CDATA[${cleaned}]]>`;
}

export function escapeXml(value: string): string {
  return stripInvalidXmlChars(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

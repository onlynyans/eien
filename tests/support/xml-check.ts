// A strict check that text is well-formed XML, for tests of what Eien writes
// as XML (an EPUB's XHTML, Word's parts): one root, every tag closed in
// order, attributes quoted and not repeated, only XML's own references, only
// characters XML allows, and every prefix (w:, epub:) declared where it's
// used. A reader (Apple Books, Word) refuses a file that fails any of these.

const NAME = /^[A-Za-z_][\w.:-]*$/u;
// biome-ignore lint/suspicious/noControlCharactersInRegex: the control characters are what's refused
const NOT_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]|\p{Cs}/u;
const REFERENCE = /&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/uy;

function checkText(text: string, where: string): void {
  if (NOT_XML.test(text)) throw new Error(`A character XML can't hold, ${where}`);
  if (text.includes('<')) throw new Error(`A bare "<", ${where}`);
  for (let at = text.indexOf('&'); at !== -1; at = text.indexOf('&', at + 1)) {
    REFERENCE.lastIndex = at;
    const match = REFERENCE.exec(text);
    if (!match)
      throw new Error(`A bare "&" or an unknown reference, ${where}: ${text.slice(at, at + 12)}`);
    const numeric = /^&#(x?)([0-9a-fA-F]+);$/u.exec(match[0]);
    if (numeric) {
      const code = Number.parseInt(numeric[2] as string, numeric[1] ? 16 : 10);
      const char = code <= 0x10ffff ? String.fromCodePoint(code) : '￾';
      if (NOT_XML.test(char) || (code >= 0xd800 && code <= 0xdfff))
        throw new Error(`A reference to a character XML can't hold, ${where}`);
    }
  }
}

/** Throws, saying where, unless `xml` is well-formed XML with its prefixes declared. */
export function assertWellFormedXml(xml: string): void {
  let rest = xml.replace(/^<\?xml[^?]*\?>\s*/u, '').replace(/^<!DOCTYPE html>\s*/u, '');
  const open: { name: string; prefixes: Set<string> }[] = [];
  let roots = 0;
  const declared = (prefix: string) => prefix === 'xml' || open.some((e) => e.prefixes.has(prefix));
  while (rest.length > 0) {
    const lt = rest.indexOf('<');
    const text = lt === -1 ? rest : rest.slice(0, lt);
    if (text) {
      if (open.length === 0 && text.trim() !== '')
        throw new Error(`Text outside the root: ${text.slice(0, 40)}`);
      checkText(text, `in ${open.at(-1)?.name ?? 'the prolog'}`);
    }
    if (lt === -1) break;
    rest = rest.slice(lt);
    if (rest.startsWith('<!--')) {
      const end = rest.indexOf('-->');
      if (end === -1) throw new Error('A comment not closed');
      rest = rest.slice(end + 3);
      continue;
    }
    const close = /^<\/([^\s>]+)\s*>/u.exec(rest);
    if (close) {
      const top = open.pop();
      if (!top || top.name !== close[1])
        throw new Error(`</${close[1]}> closes <${top?.name ?? 'nothing'}>`);
      rest = rest.slice(close[0].length);
      continue;
    }
    const tag = /^<([^\s/>]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/u.exec(rest);
    if (!tag) throw new Error(`Not a tag: ${rest.slice(0, 60)}`);
    const name = tag[1] as string;
    if (!NAME.test(name)) throw new Error(`A bad element name: ${name}`);
    const attrs = new Map<string, string>();
    for (const attr of (tag[2] ?? '').matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
      const key = attr[1] as string;
      if (!NAME.test(key)) throw new Error(`A bad attribute name: ${key}`);
      if (attrs.has(key)) throw new Error(`<${name}> has ${key} twice`);
      const value = attr[2] ?? attr[3] ?? '';
      checkText(value, `in <${name} ${key}>`);
      attrs.set(key, value);
    }
    if (open.length === 0 && ++roots > 1) throw new Error('More than one root');
    const prefixes = new Set(
      [...attrs.keys()].filter((key) => key.startsWith('xmlns:')).map((key) => key.slice(6)),
    );
    const element = { name, prefixes };
    open.push(element);
    for (const used of [name, ...attrs.keys()]) {
      const prefix = used.includes(':') ? used.slice(0, used.indexOf(':')) : null;
      if (prefix && prefix !== 'xmlns' && !declared(prefix))
        throw new Error(`The prefix ${prefix}: isn't declared, on <${name}>`);
    }
    if (tag[3]) open.pop();
    rest = rest.slice(tag[0].length);
  }
  if (open.length) throw new Error(`<${open.at(-1)?.name}> is never closed`);
  if (roots !== 1) throw new Error('No root');
}

/**
 * As assertWellFormedXml, and what an EPUB's checker asks of XHTML besides:
 * no link inside a link, no id twice, no link without words.
 */
export function assertSoundXhtml(xhtml: string): void {
  assertWellFormedXml(xhtml);
  let depth = 0;
  for (const tag of xhtml.matchAll(/<(\/?)a\b[^>]*>/gu)) {
    depth += tag[1] ? -1 : 1;
    if (depth > 1) throw new Error('A link inside a link');
  }
  const ids = [...xhtml.matchAll(/\sid="([^"]*)"/gu)].map((match) => match[1]);
  const twice = ids.find((id, i) => ids.indexOf(id) !== i);
  if (twice !== undefined) throw new Error(`The id ${twice} twice`);
  for (const link of xhtml.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gu)) {
    if ((link[1] as string).replace(/<[^>]*>/gu, '').trim() === '')
      throw new Error('A link with no words');
  }
}

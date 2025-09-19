export function sanitizeHtml(input) {
  if (!input) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  const allowedTags = new Set(['b','i','em','strong','u','p','br','ul','ol','li','code','pre','span','div','h1','h2','h3','blockquote']);
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const toRemove = [];
  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!allowedTags.has(el.tagName.toLowerCase())) { toRemove.push(el); continue; }
    [...el.attributes].forEach(attr => {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on')) el.removeAttribute(n);
      if (n === 'href' || n === 'src') {
        const v = attr.value.trim().toLowerCase();
        if (v.startsWith('javascript:')) el.removeAttribute(n);
      }
    });
  }
  toRemove.forEach(n => n.replaceWith(n.textContent || ''));
  return doc.body.innerHTML;
}

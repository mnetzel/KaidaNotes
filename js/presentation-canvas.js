// Paint this app's presentation primitives directly. No foreignObject snapshot:
// Safari can clip/offset one when the source lives in a scaled modal dialog.
const number = value => parseFloat(value) || 0;
const font = style => `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

function baseline(context, top, height) {
  const metrics = context.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent ?? metrics.actualBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent ?? metrics.actualBoundingBoxDescent;
  return top + (height - ascent - descent) / 2 + ascent;
}

function paintText(context, element, box) {
  const style = getComputedStyle(element);
  context.font = font(style);
  context.fillStyle = style.color;
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  for (const text of element.childNodes) {
    if (text.nodeType !== Node.TEXT_NODE || !text.textContent.trim()) continue;
    const range = document.createRange();
    const lines = [];
    // Range respects the browser's actual wrapping, including explicit newlines
    // in notes. Measure Unicode code points without splitting surrogate pairs.
    let offset = 0;
    for (const character of text.textContent) {
      range.setStart(text, offset);
      offset += character.length;
      range.setEnd(text, offset);
      const rect = box(range.getBoundingClientRect());
      if (character === '\n' || !rect.width) continue;
      let line = lines.at(-1);
      if (!line || Math.abs(line.top - rect.top) > .5) {
        line = { ...rect, text: '' };
        lines.push(line);
      }
      line.text += character;
      line.right = rect.right;
    }
    for (const line of lines) {
      const measured = context.measureText(line.text).width;
      if (!measured) continue;
      context.save();
      context.translate(line.left, baseline(context, line.top, line.height));
      // Also preserves the narrow Bayan arrow and any letter spacing.
      context.scale((line.right - line.left) / measured, 1);
      context.fillText(line.text, 0, 0);
      context.restore();
    }
  }
}

function paintTimeline(context, svg, box) {
  const rect = box(svg.getBoundingClientRect());
  const view = svg.viewBox.baseVal;
  const scale = Math.min(rect.width / view.width, rect.height / view.height);
  context.save();
  context.translate(rect.left + (rect.width - view.width * scale) / 2, rect.top + (rect.height - view.height * scale) / 2);
  context.scale(scale, scale);
  context.translate(-view.x, -view.y);
  for (const node of svg.children) {
    const style = getComputedStyle(node);
    const value = name => number(node.getAttribute(name));
    context.save();
    context.globalAlpha = number(style.opacity);
    context.fillStyle = style.fill;
    context.strokeStyle = style.stroke;
    context.lineWidth = number(style.strokeWidth);
    context.setLineDash(style.strokeDasharray === 'none' ? [] : style.strokeDasharray.split(/[ ,]+/).map(number));
    context.beginPath();
    if (node.localName === 'rect') {
      context.roundRect(value('x'), value('y'), value('width'), value('height'), value('rx'));
    } else if (node.localName === 'line') {
      context.moveTo(value('x1'), value('y1'));
      context.lineTo(value('x2'), value('y2'));
    } else if (node.localName === 'circle') {
      context.arc(value('cx'), value('cy'), value('r'), 0, Math.PI * 2);
    } else if (node.localName === 'text') {
      context.font = font(style);
      context.textAlign = { middle: 'center', end: 'right' }[style.textAnchor] || 'left';
      context.textBaseline = 'alphabetic';
      const y = style.dominantBaseline === 'central'
        ? baseline(context, value('y'), 0) : value('y');
      context.fillText(node.textContent, value('x'), y);
    }
    if (style.fill !== 'none' && node.localName !== 'line') context.fill();
    if (style.stroke !== 'none') context.stroke();
    context.restore();
  }
  context.restore();
}

export function renderPresentationCanvas(content) {
  const width = content.offsetWidth, height = content.offsetHeight;
  const origin = content.getBoundingClientRect();
  if (!width || !height || !origin.width || !origin.height) throw new Error('Presentation is not laid out');
  // Undo the preview's translation AND scale for every measured coordinate.
  // This stays independent of viewport size, scroll position and orientation.
  const sx = width / origin.width, sy = height / origin.height;
  const box = rect => ({
    left: (rect.left - origin.left) * sx, top: (rect.top - origin.top) * sy,
    right: (rect.right - origin.left) * sx, width: rect.width * sx, height: rect.height * sy,
  });
  const ratio = Math.min(2, 8192 / width, 8192 / height, Math.sqrt(14000000 / (width * height)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * ratio); canvas.height = Math.ceil(height * ratio);
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(ratio, ratio);
  for (const element of content.querySelectorAll('*')) {
    if (element instanceof SVGElement) {
      if (element.localName === 'svg') paintTimeline(context, element, box);
      continue;
    }
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const rect = box(element.getBoundingClientRect());
    context.save();
    if (element.matches('.count, .membrane-control-marker')) {
      context.fillStyle = style.backgroundColor;
      context.beginPath();
      context.ellipse(rect.left + rect.width / 2, rect.top + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, 2 * Math.PI);
      context.fill();
    }
    if (element.matches('.matra')) {
      context.fillStyle = style.borderRightColor;
      const border = number(style.borderRightWidth);
      context.fillRect(rect.right - border, rect.top, border, rect.height);
    }
    paintText(context, element, box);
    context.restore();
  }
  return canvas;
}

// Cron式のバリデーションと前処理

export function isCronExpression(text) {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 7) return false;

  return parts.every(part => {
    return part === '*' ||
           part === '?' ||
           /^\d+$/.test(part) ||
           /^\d+-\d+$/.test(part) ||
           /^\d+(-\d+)?(,\d+(-\d+)?)+$/.test(part) ||
           /^\*\/\d+$/.test(part) ||
           /^\d+\/\d+$/.test(part) ||
           /^[A-Z]{3}$/i.test(part) ||
           /^[A-Z]{3}([,-][A-Z]{3})+$/i.test(part) ||
           /^[A-Z]{3}-[A-Z]{3}$/i.test(part) ||
           /^\d+L?W?$/.test(part) ||
           /^L$/.test(part) ||
           /^\d+#\d+$/.test(part) ||
           /^\d+#\d+(,\d+#\d+)+$/.test(part) ||
           /^\d+L(,\d+L)+$/.test(part);
  });
}

// 括弧付きcron式（cron(...)）から内部の式を抽出
export function extractCronFromParentheses(text) {
  if (!text.startsWith('cron')) {
    return { display: text, expression: text, isParentheses: false };
  }
  const match = text.match(/cron\s*\(([^)]+)\)/);
  if (match) {
    const inner = match[1].trim().replace(/^['"]|['"]$/g, '');
    return { display: text, expression: inner, isParentheses: true };
  }
  return { display: text, expression: text, isParentheses: false };
}

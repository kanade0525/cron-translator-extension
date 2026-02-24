import { createCronTestRegex, createCronMatchRegex } from './constants.js';
import { isCronExpression, extractCronFromParentheses } from './validator.js';
import { translateCron } from './translator.js';

// DOM操作に関連する全関数

let processedElements = new WeakSet();
let isProcessing = false;

// Bug #2 修正: scrollリスナーを全ツールチップで共有
let scrollListenerAttached = false;
const activeTooltips = new Set();

function attachGlobalScrollListener() {
  if (scrollListenerAttached) return;
  scrollListenerAttached = true;
  window.addEventListener('scroll', () => {
    for (const tooltip of activeTooltips) {
      if (tooltip.style.display === 'block') {
        tooltip.style.display = 'none';
      }
    }
  }, { passive: true });
}

export function scanVisibleArea() {
  if (isProcessing) return;
  isProcessing = true;

  const viewportHeight = window.innerHeight;
  const scrollTop = window.scrollY;
  const visibleBottom = scrollTop + viewportHeight;

  const elements = document.querySelectorAll('p, li, td, pre, code, span, div');
  let processed = 0;

  for (const element of elements) {
    if (processed >= 50) break;

    const rect = element.getBoundingClientRect();
    const absoluteTop = rect.top + scrollTop;

    if (absoluteTop < visibleBottom && absoluteTop + rect.height > scrollTop) {
      if (!processedElements.has(element) && element.textContent && element.textContent.includes('*')) {
        processElement(element);
        processedElements.add(element);
        processed++;
      }
    }
  }

  isProcessing = false;
}

export function setupMutationObserver() {
  let mutationTimeout;

  const observer = new MutationObserver((mutations) => {
    clearTimeout(mutationTimeout);
    mutationTimeout = setTimeout(() => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE && node.textContent && node.textContent.includes('*')) {
              if (!processedElements.has(node)) {
                processElement(node);
                processedElements.add(node);
              }
            }
          }
        }
      }
    }, 100);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

function processElement(element) {
  if (element.querySelector('.cron-wrapper')) return;

  // Bug #1 修正: グローバルフラグなしのテスト用正規表現を使用
  const testRegex = createCronTestRegex();

  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (parent.tagName === 'SCRIPT' ||
            parent.tagName === 'STYLE' ||
            parent.classList.contains('cron-wrapper') ||
            parent.classList.contains('cron-tooltip')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const nodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.textContent && testRegex.test(node.textContent)) {
      nodesToProcess.push(node);
    }
  }

  nodesToProcess.forEach(n => highlightCronInNode(n));
}

function highlightCronInNode(textNode) {
  const text = textNode.textContent;
  // Bug #1 修正: 毎回新規のグローバル正規表現を使用
  const matchRegex = createCronMatchRegex();
  const matches = [...text.matchAll(matchRegex)];

  if (matches.length === 0) return;

  const parent = textNode.parentElement;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of matches) {
    const cronExpression = match[0];
    const index = match.index;

    if (index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex, index)));
    }

    // 括弧付き形式の処理を統合ヘルパーで実行
    const { expression: actualExpression } = extractCronFromParentheses(cronExpression);

    if (isCronExpression(actualExpression)) {
      const wrapper = createCronWrapper(cronExpression, actualExpression);
      fragment.appendChild(wrapper);
    } else {
      fragment.appendChild(document.createTextNode(cronExpression));
    }

    lastIndex = index + cronExpression.length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
  }

  parent.replaceChild(fragment, textNode);
  updateTranslationCount();
}

export function createCronWrapper(displayExpression, actualExpression, settings = {}) {
  attachGlobalScrollListener();

  const expressionToTranslate = actualExpression || displayExpression;

  const wrapper = document.createElement('span');
  wrapper.className = 'cron-wrapper';
  wrapper.style.cssText = `
    position: relative;
    background: linear-gradient(to bottom, transparent 60%, rgba(76, 175, 80, 0.2) 60%);
    padding: 0 2px;
    cursor: help;
    border-radius: 2px;
  `;
  wrapper.textContent = displayExpression;

  const tooltip = document.createElement('div');
  tooltip.className = 'cron-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    background: #333;
    color: white;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
    white-space: normal;
    z-index: 2147483647;
    display: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    max-width: 500px;
    min-width: 200px;
    pointer-events: none;
    line-height: 1.5;
    word-wrap: break-word;
  `;

  const arrow = document.createElement('span');
  arrow.style.cssText = `
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #333;
    width: 0;
    height: 0;
  `;
  tooltip.appendChild(arrow);

  const translation = translateCron(expressionToTranslate);
  tooltip.insertBefore(document.createTextNode(translation), arrow);

  // Bug #2 修正: ツールチップを共有Setに登録
  activeTooltips.add(tooltip);

  let hoverTimeout;
  wrapper.addEventListener('mouseenter', () => {
    hoverTimeout = setTimeout(() => {
      if (!document.body.contains(tooltip)) {
        document.body.appendChild(tooltip);
      }

      const rect = wrapper.getBoundingClientRect();
      const tooltipHeight = 50;

      let top = rect.top - tooltipHeight - 10;

      if (top < 10) {
        top = rect.bottom + 10;
        arrow.style.borderTopColor = 'transparent';
        arrow.style.borderBottomColor = '#333';
        arrow.style.top = '-12px';
      } else {
        arrow.style.borderBottomColor = 'transparent';
        arrow.style.borderTopColor = '#333';
        arrow.style.top = '100%';
      }

      tooltip.style.display = 'block';

      const tooltipRect = tooltip.getBoundingClientRect();
      let left = rect.left + rect.width / 2 - tooltipRect.width / 2;

      const margin = 10;
      if (left < margin) {
        left = margin;
      } else if (left + tooltipRect.width > window.innerWidth - margin) {
        left = window.innerWidth - tooltipRect.width - margin;
      }

      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
    }, settings.translationDelay || 500);
  });

  wrapper.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimeout);
    if (tooltip) {
      tooltip.style.display = 'none';
    }
  });

  // Bug #2 修正: 個別のscrollリスナーは不要（グローバルリスナーで処理）

  return wrapper;
}

function updateTranslationCount() {
  const today = new Date().toDateString();
  chrome.storage.sync.get(['lastCountDate', 'todayCount'], (result) => {
    let count = result.todayCount || 0;

    if (result.lastCountDate !== today) {
      count = 0;
    }

    count++;

    chrome.storage.sync.set({
      lastCountDate: today,
      todayCount: count,
    });
  });
}

export function removeAllTranslations() {
  document.querySelectorAll('.cron-wrapper').forEach(wrapper => {
    const text = wrapper.textContent;
    const textNode = document.createTextNode(text);
    wrapper.parentNode.replaceChild(textNode, wrapper);
  });
  processedElements = new WeakSet();
}

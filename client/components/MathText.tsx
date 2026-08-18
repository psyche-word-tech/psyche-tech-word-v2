import { Text, Platform } from 'react-native';
import { useMemo, useEffect } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// 注入 CSS 覆盖 KaTeX 默认样式
if (Platform.OS === 'web') {
  const styleId = 'katex-override-style';
  if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .katex-display { margin: 0.1em 0 !important; }
      .katex { font-size: 1em !important; }
      .katex-display > .katex { margin: 0 !important; }
    `;
    document.head.appendChild(style);
  }
}

interface MathTextProps {
  text: string;
  style?: any;
}

/**
 * 渲染包含 LaTeX 公式的文本
 * 支持 $...$ 行内公式和 $$...$$ 块级公式
 * Web 端使用 KaTeX 渲染，Native 端直接显示文本
 */
export function MathText({ text, style }: MathTextProps) {
  const html = useMemo(() => {
    if (Platform.OS !== 'web' || !text) return null;
    return renderMathInHtml(text);
  }, [text]);

  if (Platform.OS !== 'web') {
    return <Text style={style}>{text}</Text>;
  }

  // Web 端使用 div 渲染 HTML，强制覆盖 KaTeX 的默认 margin
  return (
    <div
      style={{
        ...style,
        margin: 0,
        padding: 0,
        lineHeight: '1.5',
      }}
      dangerouslySetInnerHTML={{ __html: html || '' }}
    />
  );
}

function renderMathInHtml(text: string): string {
  if (!text) return '';

  // 先转义 HTML 特殊字符
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 处理块级公式 $$...$$
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
    try {
      return '<span style="display: block; margin: 4px 0; text-align: center;">' +
        katex.renderToString(decodeHtmlEntities(formula.trim()), {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        }) +
        '</span>';
    } catch (e) {
      return `<span style="color: red;">[公式错误]</span>`;
    }
  });

  // 处理行内公式 $...$
  result = result.replace(/\$([^\$\n]+?)\$/g, (match, formula) => {
    try {
      return katex.renderToString(decodeHtmlEntities(formula.trim()), {
        displayMode: false,
        throwOnError: false,
        output: 'html',
      });
    } catch (e) {
      return `<span style="color: red;">[公式错误]</span>`;
    }
  });

  // 处理换行（减少间距）
  result = result.replace(/\n/g, '<br style="line-height: 1.2;"/>');

  return result;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

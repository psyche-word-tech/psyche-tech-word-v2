import { View, Text, Platform } from 'react-native';
import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

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

  return (
    <View
      style={style}
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
      return '<div style="margin: 8px 0; text-align: center;">' +
        katex.renderToString(decodeHtmlEntities(formula.trim()), {
          displayMode: true,
          throwOnError: false,
          output: 'html',
        }) +
        '</div>';
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

  // 处理换行
  result = result.replace(/\n/g, '<br/>');

  return result;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

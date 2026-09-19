import React, { useState, useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import katex from 'katex';

const KATEX_CSS =
  'https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css';

interface MathViewProps {
  text: string;
  style?: any;
  fontSize?: number;
  mathColor?: string;
  textColor?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 命中即视为文本里含有需要排版的数学公式（裸 LaTeX，未加 $ 包裹）
const LATEX_CMD_RE =
  /\\(?:boxed|frac|dfrac|tfrac|sqrt|left|right|sum|prod|int|iint|oint|lim|infty|cdot|times|div|pm|mp|leq?|geq?|neq?|approx|equiv|sim|propto|alpha|beta|gamma|delta|varepsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|vec|hat|bar|overline|underline|overrightarrow|begin|end|text|mathrm|mathbf|mathit|mathsf|mathcal|mathbb|operatorname|displaystyle|quad|qquad|binom|dbinom|langle|rangle|lfloor|rfloor|to|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|mapsto|cup|cap|setminus|subset|supset|subseteq|supseteq|in|notin|forall|exists|emptyset|partial|nabla|angle|perp|cong|triangle|circ|degree)\b/;

/**
 * 归一化数学分隔符：
 * 1. \(...\) -> $...$，\[...\] -> $$...$$
 * 2. 若整段没有任何 $ 分隔符、但明显含 LaTeX 命令（如 \boxed/\dfrac），
 *    则把整段当作块级公式包裹成 $$...$$，保证裸 LaTeX 也能被 KaTeX 渲染。
 */
function normalizeMathDelimiters(text: string): string {
  let t = text;
  t = t.replace(/\\\(([\s\S]*?)\\\)/g, (_m, inner) => '$' + inner + '$');
  t = t.replace(/\\\[([\s\S]*?)\\\]/g, (_m, inner) => '$$' + inner + '$$');
  if (!t.includes('$') && LATEX_CMD_RE.test(t)) {
    t = '$$' + t + '$$';
  }
  return t;
}

/**
 * 把文本中的数学公式（$$...$$ 块级、$...$ 行内）用 KaTeX 渲染成真正的排版，
 * 非公式文字正常展示。摘除后端非标准半角符号（如 x^24、4v(3)）导致的错排。
 */
function buildHtml(text: string, fontSize: number, textColor: string) {
  text = normalizeMathDelimiters(text);
  const parts: string[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(escapeHtml(text.slice(last, m.index)));
    }
    const latex = (m[1] != null ? m[1] : m[2])?.trim() ?? '';
    if (!latex) {
      last = m.index + m[0].length;
      continue;
    }
    try {
      parts.push(
        katex.renderToString(latex, {
          throwOnError: false,
          displayMode: m[1] != null,
          strict: false,
        })
      );
    } catch {
      parts.push(escapeHtml(m[0]));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push(escapeHtml(text.slice(last)));
  }

  const joined = parts.join(' ');
  return {
    head: `<link rel="stylesheet" href="${KATEX_CSS}"/>`,
    body: joined,
  };
}

const injectResize = `
  var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + 4;
  try { window.ReactNativeWebView.postMessage(String(h)); } catch(e) {}
  true;
`;

export function MathView({
  text,
  style,
  fontSize = 15,
  mathColor = '#333333',
  textColor = '#333333',
}: MathViewProps) {
  const [height, setHeight] = useState(40);
  const bg = (style as any)?.backgroundColor || 'transparent';
  const { head, body } = buildHtml(text, fontSize, textColor);
  const outerStyle = [
    { color: textColor, fontSize, lineHeight: fontSize * 1.7 },
    style,
  ];

  // 注入 KaTeX 样式（Web 端）
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (document.getElementById('katex-style')) return;
    const link = document.createElement('link');
    link.id = 'katex-style';
    link.rel = 'stylesheet';
    link.href = KATEX_CSS;
    document.head.appendChild(link);
  }, []);

  if (text == null || text === '') {
    return <Text style={outerStyle} />;
  }

  if (Platform.OS === 'web') {
    // Web/preview 端用真实 HTML 渲染 KaTeX，保证分式/根号/上下标正确排版
    return React.createElement('div', {
      dangerouslySetInnerHTML: {
        __html: `<div style="font-size:${fontSize}px;color:${textColor};line-height:${fontSize * 1.7}px;background:${bg}">${body}</div>`,
      },
      style: { width: '100%' },
    });
  }

  // 原生端：WebView + 自适应高度
  return (
    <View>
      <WebView
        originWhitelist={['*']}
        source={{
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"/>
            <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
            ${head}<style>html,body{margin:0;padding:0;background:transparent}
            body{font-size:${fontSize}px;color:${textColor};background:${bg};line-height:${fontSize * 1.7}px}
            .katex-display{margin:4px 0;text-align:left}</style></head><body>${body}</body></html>`,
        }}
        style={[
          { backgroundColor: 'transparent', height, width: '100%' },
          style,
        ]}
        androidLayerType="none"
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        onMessage={(e) => {
          const h = parseInt(e.nativeEvent.data, 10);
          if (!isNaN(h) && h > 0) setHeight(h);
        }}
        injectedJavaScript={`${injectResize} setTimeout(function(){${injectResize}},300);`}
      />
    </View>
  );
}
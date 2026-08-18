import { Text } from 'react-native';
import { useMemo } from 'react';

interface MathTextProps {
  text: string;
  style?: any;
}

/**
 * 简单的 LaTeX 到 Unicode 转换
 * 将常见的 LaTeX 公式转换为 Unicode 字符
 */
function simpleLatexToUnicode(text: string): string {
  if (!text) return '';
  
  return text
    // 分数 \frac{a}{b} → a/b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    // 平方根 \sqrt{x} → √x
    .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
    // 上标 x^{n} → xⁿ (简化处理)
    .replace(/\^\{([^}]+)\}/g, '^$1')
    // 下标 x_{n} → x_n
    .replace(/_\{([^}]+)\}/g, '_$1')
    // 常见符号
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\mp/g, '∓')
    .replace(/\\cdot/g, '·')
    .replace(/\\cdots/g, '⋯')
    .replace(/\\ldots/g, '…')
    .replace(/\\vdots/g, '')
    .replace(/\\ddots/g, '⋱')
    .replace(/\\infty/g, '∞')
    .replace(/\\partial/g, '')
    .replace(/\\nabla/g, '∇')
    .replace(/\\forall/g, '∀')
    .replace(/\\exists/g, '∃')
    .replace(/\\in/g, '∈')
    .replace(/\\notin/g, '∉')
    .replace(/\\subset/g, '⊂')
    .replace(/\\supset/g, '⊃')
    .replace(/\\subseteq/g, '')
    .replace(/\\supseteq/g, '⊇')
    .replace(/\\cup/g, '∪')
    .replace(/\\cap/g, '∩')
    .replace(/\\emptyset/g, '∅')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\Leftarrow/g, '⇐')
    .replace(/\\leftrightarrow/g, '↔')
    .replace(/\\Leftrightarrow/g, '⇔')
    .replace(/\\uparrow/g, '↑')
    .replace(/\\downarrow/g, '↓')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\epsilon/g, 'ε')
    .replace(/\\zeta/g, 'ζ')
    .replace(/\\eta/g, 'η')
    .replace(/\\theta/g, 'θ')
    .replace(/\\iota/g, 'ι')
    .replace(/\\kappa/g, 'κ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\nu/g, 'ν')
    .replace(/\\xi/g, 'ξ')
    .replace(/\\pi/g, 'π')
    .replace(/\\rho/g, 'ρ')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\tau/g, 'τ')
    .replace(/\\upsilon/g, 'υ')
    .replace(/\\phi/g, 'φ')
    .replace(/\\chi/g, 'χ')
    .replace(/\\psi/g, 'ψ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Gamma/g, 'Γ')
    .replace(/\\Lambda/g, 'Λ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\Phi/g, 'Φ')
    .replace(/\\Pi/g, 'Π')
    .replace(/\\Psi/g, 'Ψ')
    .replace(/\\Sigma/g, 'Σ')
    .replace(/\\Theta/g, 'Θ')
    .replace(/\\Upsilon/g, 'Υ')
    .replace(/\\Xi/g, 'Ξ')
    // 移除剩余的 LaTeX 命令
    .replace(/\\[a-zA-Z]+/g, '')
    // 移除多余的大括号
    .replace(/[{}]/g, '')
    // 清理多余的空格
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 渲染包含 LaTeX 公式的文本
 * Web 端使用简单的 Unicode 转换，Native 端直接显示文本
 */
export function MathText({ text, style }: MathTextProps) {
  const displayText = useMemo(() => {
    if (!text) return '';
    return simpleLatexToUnicode(text);
  }, [text]);

  return <Text style={style}>{displayText}</Text>;
}

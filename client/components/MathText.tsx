import { Text } from 'react-native';

interface MathTextProps {
  text: string;
  style?: any;
}

/**
 * 简单的 LaTeX 清理
 * 移除 LaTeX 标记，保留可读文本
 */
function cleanLatex(text: string): string {
  if (!text) return '';
  
  return text
    // 移除 $$ 和 $ 标记
    .replace(/\$\$/g, '')
    .replace(/\$/g, '')
    // 分数 \frac{a}{b} → a/b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    // 平方根 \sqrt{x} → √x
    .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
    // 上标
    .replace(/\^\{([^}]+)\}/g, '^$1')
    // 下标
    .replace(/_\{([^}]+)\}/g, '_$1')
    // 常见符号
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\cdot/g, '·')
    .replace(/\\cdots/g, '⋯')
    .replace(/\\ldots/g, '…')
    .replace(/\\infty/g, '∞')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\leftarrow/g, '←')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\gamma/g, 'γ')
    .replace(/\\delta/g, 'δ')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\mu/g, 'μ')
    .replace(/\\pi/g, 'π')
    .replace(/\\sigma/g, 'σ')
    .replace(/\\phi/g, 'φ')
    .replace(/\\omega/g, 'ω')
    .replace(/\\Delta/g, 'Δ')
    .replace(/\\Gamma/g, 'Γ')
    .replace(/\\Lambda/g, 'Λ')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\Phi/g, 'Φ')
    .replace(/\\Psi/g, '')
    .replace(/\\Sigma/g, 'Σ')
    // 移除剩余的 LaTeX 命令
    .replace(/\\[a-zA-Z]+/g, '')
    // 移除多余的大括号
    .replace(/[{}]/g, '')
    // 清理多余的空格
    .replace(/\s+/g, ' ')
    .trim();
}

export function MathText({ text, style }: MathTextProps) {
  const cleaned = cleanLatex(text);
  
  return <Text style={style}>{cleaned}</Text>;
}

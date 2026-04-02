/**
 * Ajusta a luminosidade de uma cor hexadecimal para melhor contraste no dark mode
 */
export function adjustColorForDarkMode(hexColor: string | null | undefined, isDarkMode: boolean): string {
  // Validar entrada
  if (!hexColor || typeof hexColor !== 'string') {
    console.warn('[v0] Invalid color provided to adjustColorForDarkMode:', hexColor);
    return isDarkMode ? '#888888' : '#666666'; // Cor padrão cinza
  }

  // Remove o # se existir
  const hex = hexColor.replace('#', '');
  
  // Validar formato hex
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    console.warn('[v0] Invalid hex color format:', hexColor);
    return isDarkMode ? '#888888' : '#666666';
  }
  
  // Converte para RGB
  const r = Number.parseInt(hex.substring(0, 2), 16);
  const g = Number.parseInt(hex.substring(2, 4), 16);
  const b = Number.parseInt(hex.substring(4, 6), 16);
  
  if (isDarkMode) {
    // No dark mode, aumenta a luminosidade de cores escuras
    const factor = 1.5;
    const newR = Math.min(255, Math.floor(r * factor));
    const newG = Math.min(255, Math.floor(g * factor));
    const newB = Math.min(255, Math.floor(b * factor));
    
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
  }
  
  // No light mode, retorna a cor original
  return hexColor;
}

/**
 * Verifica se está em dark mode
 */
export function isDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  return document.documentElement.classList.contains('dark');
}

/**
 * Obtém uma cor com bom contraste para o tema atual
 */
export function getThemeAwareColor(hexColor: string | null | undefined): string {
  return adjustColorForDarkMode(hexColor, isDarkMode());
}

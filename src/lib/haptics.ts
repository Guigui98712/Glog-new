/**
 * Biblioteca de feedback tátil para melhorar a experiência em dispositivos móveis
 */

/**
 * Verifica se o dispositivo suporta vibração
 */
export const hasVibrationSupport = (): boolean => {
  return 'vibrate' in navigator;
};

/**
 * Tipos de feedback tátil
 */
export enum HapticType {
  LIGHT = 'light',
  MEDIUM = 'medium',
  HEAVY = 'heavy',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  SELECTION = 'selection',
}

/**
 * Duração das vibrações em milissegundos
 */
const VIBRATION_PATTERNS = {
  [HapticType.LIGHT]: [10],
  [HapticType.MEDIUM]: [35],
  [HapticType.HEAVY]: [50],
  [HapticType.SUCCESS]: [10, 30, 50],
  [HapticType.WARNING]: [30, 50, 30],
  [HapticType.ERROR]: [50, 30, 50, 30, 50],
  [HapticType.SELECTION]: [5],
};

/**
 * Executa feedback tátil
 * @param type Tipo de feedback tátil
 */
export const hapticFeedback = (type: HapticType = HapticType.LIGHT): void => {
  if (!hasVibrationSupport()) return;
  
  try {
    navigator.vibrate(VIBRATION_PATTERNS[type]);
  } catch (error) {
    console.error('Erro ao executar feedback tátil:', error);
  }
};

/**
 * Hook para usar feedback tátil em componentes React
 */
export const useHapticFeedback = () => {
  return {
    trigger: hapticFeedback,
    types: HapticType,
    isSupported: hasVibrationSupport(),
  };
};

/**
 * Executa feedback tátil ao clicar em um elemento
 * @param element Elemento HTML
 * @param type Tipo de feedback tátil
 */
export const addHapticFeedbackToElement = (
  element: HTMLElement,
  type: HapticType = HapticType.LIGHT
): (() => void) => {
  if (!element) return () => {};
  
  const handleClick = () => hapticFeedback(type);
  element.addEventListener('click', handleClick);
  
  // Retorna função para remover o evento
  return () => {
    element.removeEventListener('click', handleClick);
  };
};

/**
 * Executa feedback tátil ao clicar em elementos com uma classe específica
 * @param className Nome da classe CSS
 * @param type Tipo de feedback tátil
 */
export const addHapticFeedbackToClass = (
  className: string,
  type: HapticType = HapticType.LIGHT
): (() => void) => {
  const elements = document.querySelectorAll(`.${className}`);
  const cleanupFunctions: Array<() => void> = [];
  
  elements.forEach((element) => {
    const cleanup = addHapticFeedbackToElement(element as HTMLElement, type);
    cleanupFunctions.push(cleanup);
  });
  
  // Retorna função para remover todos os eventos
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
};

export default {
  trigger: hapticFeedback,
  types: HapticType,
  isSupported: hasVibrationSupport(),
  addToElement: addHapticFeedbackToElement,
  addToClass: addHapticFeedbackToClass,
}; 
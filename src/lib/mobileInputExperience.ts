type Disposable = {
  remove: () => void;
};

const NON_CORRECTABLE_TYPES = new Set([
  'password',
  'email',
  'number',
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
  'file',
  'hidden',
  'color',
  'range'
]);

const shouldEnableTextAssistance = (input: HTMLInputElement | HTMLTextAreaElement) => {
  if (input.tagName.toLowerCase() === 'textarea') {
    return true;
  }

  const htmlInput = input as HTMLInputElement;
  const type = (htmlInput.type || 'text').toLowerCase();
  return !NON_CORRECTABLE_TYPES.has(type);
};

const applyTextAssistance = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (!shouldEnableTextAssistance(target)) {
      return;
    }

    if (!target.hasAttribute('autocorrect')) {
      target.setAttribute('autocorrect', 'on');
    }

    if (!target.hasAttribute('autocapitalize')) {
      target.setAttribute('autocapitalize', 'sentences');
    }

    if (!target.hasAttribute('spellcheck')) {
      target.setAttribute('spellcheck', 'true');
    }

    if (!target.hasAttribute('lang')) {
      target.setAttribute('lang', 'pt-BR');
    }

    return;
  }

  if (target.isContentEditable) {
    if (!target.hasAttribute('autocorrect')) {
      target.setAttribute('autocorrect', 'on');
    }

    if (!target.hasAttribute('autocapitalize')) {
      target.setAttribute('autocapitalize', 'sentences');
    }

    if (!target.hasAttribute('spellcheck')) {
      target.setAttribute('spellcheck', 'true');
    }

    if (!target.hasAttribute('lang')) {
      target.setAttribute('lang', 'pt-BR');
    }
  }
};

export async function setupMobileInputExperience(): Promise<() => void> {
  const onFocusIn = (event: FocusEvent) => {
    applyTextAssistance(event.target);
  };

  document.addEventListener('focusin', onFocusIn, true);

  const disposables: Disposable[] = [];
  let visualViewportListener: (() => void) | null = null;

  try {
    const [{ Capacitor }, { Keyboard }] = await Promise.all([
      import('@capacitor/core'),
      import('@capacitor/keyboard')
    ]);

    if (!Capacitor.isNativePlatform()) {
      return () => {
        document.removeEventListener('focusin', onFocusIn, true);
      };
    }

    const setKeyboardState = (open: boolean, keyboardHeight = 0) => {
      document.body.classList.toggle('keyboard-open', open);
      document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);

      if (open) {
        const active = document.activeElement as HTMLElement | null;
        if (active) {
          setTimeout(() => {
            active.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }, 60);
        }
      }
    };

    disposables.push(
      await Keyboard.addListener('keyboardWillShow', (info) => {
        setKeyboardState(true, info.keyboardHeight ?? 0);
      })
    );

    disposables.push(
      await Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardState(false, 0);
      })
    );

    if (window.visualViewport) {
      visualViewportListener = () => {
        const viewport = window.visualViewport;
        if (!viewport) {
          return;
        }

        const keyboardHeight = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
        document.documentElement.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      };

      window.visualViewport.addEventListener('resize', visualViewportListener);
      window.visualViewport.addEventListener('scroll', visualViewportListener);
      visualViewportListener();
    }
  } catch {
    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
    };
  }

  return () => {
    document.removeEventListener('focusin', onFocusIn, true);
    disposables.forEach((disposable) => disposable.remove());

    if (window.visualViewport && visualViewportListener) {
      window.visualViewport.removeEventListener('resize', visualViewportListener);
      window.visualViewport.removeEventListener('scroll', visualViewportListener);
    }
  };
}

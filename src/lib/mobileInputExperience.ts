type Disposable = {
  remove: () => void;
};

const NON_CORRECTABLE_TYPES = new Set([
  'password',
  'email',
  'url',
  'tel',
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

const KEYBOARD_ASSIST_DISABLE_ATTR = 'data-keyboard-assist';
const KEYBOARD_PROFILE_ATTR = 'data-keyboard-profile';

type KeyboardProfile = 'text' | 'name' | 'email' | 'password' | 'numeric';

const getKeyboardProfile = (input: HTMLInputElement | HTMLTextAreaElement): KeyboardProfile | null => {
  const explicitProfile = input.getAttribute(KEYBOARD_PROFILE_ATTR) as KeyboardProfile | null;
  if (explicitProfile) {
    return explicitProfile;
  }

  if (input.tagName.toLowerCase() === 'textarea') {
    return 'text';
  }

  const htmlInput = input as HTMLInputElement;
  const type = (htmlInput.type || 'text').toLowerCase();

  if (type === 'email') return 'email';
  if (type === 'password') return 'password';
  if (type === 'number') return 'numeric';
  return 'text';
};

const shouldEnableTextAssistance = (input: HTMLInputElement | HTMLTextAreaElement) => {
  if (input.getAttribute(KEYBOARD_ASSIST_DISABLE_ATTR) === 'off') {
    return false;
  }

  if (input.tagName.toLowerCase() === 'textarea') {
    return true;
  }

  const htmlInput = input as HTMLInputElement;
  const type = (htmlInput.type || 'text').toLowerCase();
  return !NON_CORRECTABLE_TYPES.has(type);
};

const setAttrIfChanged = (target: HTMLElement, name: string, value: string) => {
  if (target.getAttribute(name) !== value) {
    target.setAttribute(name, value);
  }
};

const forceTextAttributes = (target: HTMLElement) => {
  setAttrIfChanged(target, 'autocorrect', 'on');
  setAttrIfChanged(target, 'autocapitalize', 'sentences');
  setAttrIfChanged(target, 'spellcheck', 'true');
  setAttrIfChanged(target, 'autocomplete', 'on');

  if (!target.getAttribute('lang')) {
    target.setAttribute('lang', 'pt-BR');
  }
};

const forceSensitiveTextAttributes = (target: HTMLElement) => {
  setAttrIfChanged(target, 'autocorrect', 'off');
  setAttrIfChanged(target, 'autocapitalize', 'none');
  setAttrIfChanged(target, 'spellcheck', 'false');
};

const applyProfile = (target: HTMLInputElement | HTMLTextAreaElement) => {
  const profile = getKeyboardProfile(target);

  if (profile === 'email') {
    if (target instanceof HTMLInputElement) {
      if (target.type !== 'email') {
        target.type = 'email';
      }
      setAttrIfChanged(target, 'inputmode', 'email');
      setAttrIfChanged(target, 'autocomplete', 'email');
      setAttrIfChanged(target, 'enterkeyhint', 'next');
    }
    forceSensitiveTextAttributes(target);
    return;
  }

  if (profile === 'password') {
    if (target instanceof HTMLInputElement) {
      if (target.type !== 'password') {
        target.type = 'password';
      }
      setAttrIfChanged(target, 'autocomplete', target.getAttribute('autocomplete') || 'current-password');
      setAttrIfChanged(target, 'enterkeyhint', 'done');
      setAttrIfChanged(target, 'inputmode', 'text');
    }
    forceSensitiveTextAttributes(target);
    return;
  }

  if (profile === 'numeric') {
    if (target instanceof HTMLInputElement) {
      setAttrIfChanged(target, 'inputmode', 'numeric');
      setAttrIfChanged(target, 'enterkeyhint', 'next');
    }
    forceSensitiveTextAttributes(target);
    return;
  }

  forceTextAttributes(target);

  if (target instanceof HTMLInputElement) {
    if (profile === 'name') {
      setAttrIfChanged(target, 'autocapitalize', 'words');
      setAttrIfChanged(target, 'autocomplete', target.getAttribute('autocomplete') || 'name');
    }

    if (!target.hasAttribute('inputmode') || target.getAttribute('inputmode') === 'none') {
      setAttrIfChanged(target, 'inputmode', 'text');
    }

    setAttrIfChanged(target, 'enterkeyhint', 'next');
  }
};

const applyTextAssistance = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    if (!shouldEnableTextAssistance(target)) {
      const profile = getKeyboardProfile(target);
      if (profile === 'email' || profile === 'password' || profile === 'numeric') {
        applyProfile(target);
      } else {
        forceSensitiveTextAttributes(target);
      }
      return;
    }

    applyProfile(target);

    return;
  }

  if (target.isContentEditable) {
    if (target.getAttribute(KEYBOARD_ASSIST_DISABLE_ATTR) === 'off') {
      return;
    }

    forceTextAttributes(target);
  }
};

const applyTextAssistanceToTree = (root: ParentNode) => {
  const elements = root.querySelectorAll<HTMLElement>('input, textarea, [contenteditable="true"]');
  elements.forEach((element) => applyTextAssistance(element));
};

export async function setupMobileInputExperience(): Promise<() => void> {
  const onFocusIn = (event: FocusEvent) => {
    applyTextAssistance(event.target);
  };

  document.addEventListener('focusin', onFocusIn, true);
  applyTextAssistanceToTree(document);

  const mutationObserver = new MutationObserver((mutationList) => {
    for (const mutation of mutationList) {
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLElement) {
        applyTextAssistance(mutation.target);
        continue;
      }

      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) {
          return;
        }

        applyTextAssistance(node);
        applyTextAssistanceToTree(node);
      });
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
  });

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
        mutationObserver.disconnect();
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
      mutationObserver.disconnect();
    };
  }

  return () => {
    document.removeEventListener('focusin', onFocusIn, true);
    mutationObserver.disconnect();
    disposables.forEach((disposable) => disposable.remove());

    if (window.visualViewport && visualViewportListener) {
      window.visualViewport.removeEventListener('resize', visualViewportListener);
      window.visualViewport.removeEventListener('scroll', visualViewportListener);
    }
  };
}

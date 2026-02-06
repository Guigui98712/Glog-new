import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  enableSpellCheck?: boolean;
}

/**
 * Input padrão do app GLog.
 * Sempre usa autocorreção, capitalização de frases, corretor e idioma pt-BR para melhor experiência mobile e web.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    const resolvedType = props.type ?? "text";
    const resolvedInputMode = props.inputMode ?? (resolvedType === "text" ? "text" : undefined);
    const inputProps = {
      autoCapitalize: "sentences",
      autoCorrect: "on",
      autoComplete: "on",
      spellCheck: true,
      lang: "pt-BR",
      type: resolvedType,
      inputMode: resolvedInputMode,
      ...props
    };

    return (
      <input
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...inputProps}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }

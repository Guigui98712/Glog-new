import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  enableSpellCheck?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, enableSpellCheck = true, ...props }, ref) => {
    // Aplica autocorreção e capitalização em todos os campos, exceto se enableSpellCheck for false
    const inputProps = enableSpellCheck ? {
      autoCapitalize: "sentences",
      autoCorrect: "on",
      spellCheck: "true",
      lang: "pt-BR",
      ...props
    } : props;

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

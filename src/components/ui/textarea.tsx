import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  enableSpellCheck?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, enableSpellCheck = true, ...props }, ref) => {
    const resolvedInputMode = props.inputMode ?? "text";
    const textareaProps = enableSpellCheck ? {
      autoCapitalize: "sentences",
      autoCorrect: "on",
      autoComplete: "on",
      spellCheck: true,
      lang: "pt-BR",
      inputMode: resolvedInputMode,
      ...props
    } : {
      inputMode: resolvedInputMode,
      ...props
    };

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...textareaProps}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

// Shared label+error wrapper so every form field (across auth, onboarding, content, payout...)
// gets the same validation-error styling without re-deriving it per page.
function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="font-body text-sm font-medium text-text-primary">
        {label}
      </label>
      {children}
      {error ? (
        <p className="font-body text-sm text-error">{error}</p>
      ) : hint ? (
        <p className="font-body text-sm text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "h-10 w-full rounded-input border border-border bg-surface px-3 font-body text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const fieldId = id ?? `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint}>
        <input
          ref={ref}
          id={fieldId}
          className={cn(controlClasses, error && "border-error", className)}
          aria-invalid={!!error}
          {...props}
        />
      </FieldShell>
    );
  },
);
TextField.displayName = "TextField";

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, hint, id, className, ...props }, ref) => {
    const fieldId = id ?? `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint}>
        <textarea
          ref={ref}
          id={fieldId}
          className={cn(controlClasses, "h-auto min-h-24 py-2", error && "border-error", className)}
          aria-invalid={!!error}
          {...props}
        />
      </FieldShell>
    );
  },
);
TextAreaField.displayName = "TextAreaField";

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  hint?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, id, className, children, ...props }, ref) => {
    const fieldId = id ?? `field-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
      <FieldShell label={label} htmlFor={fieldId} error={error} hint={hint}>
        <select
          ref={ref}
          id={fieldId}
          className={cn(controlClasses, error && "border-error", className)}
          aria-invalid={!!error}
          {...props}
        >
          {children}
        </select>
      </FieldShell>
    );
  },
);
SelectField.displayName = "SelectField";

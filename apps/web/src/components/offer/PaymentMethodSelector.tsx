import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@sofsavdo/ui";
import { resolvePaymentMethodMeta } from "@/lib/payment-methods";

export interface PaymentMethodSelectorProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  /** The offer-supported payment method ids, in the order Offer.paymentOptions lists them. */
  methodIds: string[];
  error?: string;
}

// A flat list of short, clear tiles — one per real payment method (Click, Naqd pul, Bo'lib
// to'lash), no category grouping/headers. With one method per category in practice, a category
// header above each single tile was just repeating the same information twice. Each option is a
// native radio input (works with react-hook-form's `register` exactly like a <select> did).
// `logo` is optional on the underlying data model and rendered here as a reserved slot — a real
// logo image can replace the emoji/initial fallback later without touching this layout.
export const PaymentMethodSelector = forwardRef<HTMLInputElement, PaymentMethodSelectorProps>(
  ({ methodIds, error, name, className, ...radioProps }, ref) => {
    const methods = methodIds.map(resolvePaymentMethodMeta);

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <p className="font-body text-sm font-medium text-text-primary">To&apos;lov usuli</p>
        <div role="radiogroup" aria-invalid={!!error} className="flex flex-col gap-2">
          {methods.map((method) => (
            <label
              key={method.id}
              htmlFor={`payment-method-${method.id}`}
              className="flex cursor-pointer items-center gap-3 rounded-input border border-border bg-surface p-3 has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg font-body text-sm text-text-secondary">
                {method.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={method.logo} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  method.displayName.charAt(0)
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-body text-sm font-medium text-text-primary">{method.displayName}</span>
                <span className="font-body text-xs text-text-secondary">{method.description}</span>
              </span>
              <input
                ref={ref}
                id={`payment-method-${method.id}`}
                type="radio"
                name={name}
                value={method.id}
                className="h-4 w-4 shrink-0 accent-accent"
                {...radioProps}
              />
            </label>
          ))}
        </div>
        {error ? <p className="font-body text-sm text-error">{error}</p> : null}
      </div>
    );
  },
);
PaymentMethodSelector.displayName = "PaymentMethodSelector";

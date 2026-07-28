import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@rosti/ui";
import { PAYMENT_METHOD_CATEGORY_META, groupPaymentMethods } from "@/lib/payment-methods";

export interface PaymentMethodSelectorProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  /** The offer-supported payment method ids, in the order Offer.paymentOptions lists them. */
  methodIds: string[];
  error?: string;
}

// Groups the offer's real, backend-sourced payment options (unchanged data) into labeled
// categories with a brand name + short description each — replaces the old flat <select> so
// brand names (Click, Paylater, Uzum Nasiya) read clearly instead of being flattened into one
// generic dropdown. Each option is a native radio input (works with react-hook-form's `register`
// exactly like the old <select> did), styled as a card. `logo` is optional on the underlying data
// model and rendered here as a reserved slot — a real logo image can replace the emoji/initial
// fallback later without touching this layout.
export const PaymentMethodSelector = forwardRef<HTMLInputElement, PaymentMethodSelectorProps>(
  ({ methodIds, error, name, className, ...radioProps }, ref) => {
    const groups = groupPaymentMethods(methodIds);

    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <p className="font-body text-sm font-medium text-text-primary">To&apos;lov usuli</p>
        <div role="radiogroup" aria-invalid={!!error} className="flex flex-col gap-4">
          {groups.map(({ category, methods }) => {
            const categoryMeta = PAYMENT_METHOD_CATEGORY_META[category];
            return (
              <div key={category} className="flex flex-col gap-2">
                <p className="font-body text-xs font-medium tracking-wide text-text-secondary">
                  <span aria-hidden="true">{categoryMeta.icon}</span> {categoryMeta.label}
                </p>
                <div className="flex flex-col gap-2">
                  {methods.map((method) => (
                    <label
                      key={method.id}
                      htmlFor={`payment-method-${method.id}`}
                      className="flex cursor-pointer items-center gap-3 rounded-input border border-border bg-surface p-3 has-[:checked]:border-accent has-[:checked]:ring-1 has-[:checked]:ring-accent"
                    >
                      {/* Reserved logo slot — swap this span for an <img src={method.logo}> once brand logos are supplied. */}
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg font-body text-sm text-text-secondary">
                        {method.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={method.logo} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          method.displayName.charAt(0)
                        )}
                      </span>
                      <span className="flex flex-1 flex-col">
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
              </div>
            );
          })}
        </div>
        {error ? <p className="font-body text-sm text-error">{error}</p> : null}
      </div>
    );
  },
);
PaymentMethodSelector.displayName = "PaymentMethodSelector";

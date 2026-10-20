import {
  Children,
  isValidElement,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";

// A required control must never silently lose its visible required indicator.
function hasRequiredControl(children: ReactNode): boolean {
  return Children.toArray(children).some(
    (child) =>
      isValidElement<{ required?: boolean; children?: ReactNode }>(child) &&
      (child.props.required === true || hasRequiredControl(child.props.children)),
  );
}

export function Field({
  label,
  children,
  hint,
  required,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
  htmlFor?: string;
}) {
  const isRequired = required || hasRequiredControl(children);
  return (
    <label htmlFor={htmlFor} className="block min-w-0 space-y-2 text-[13px] font-medium text-brand-secondary">
      <span className="inline-flex items-center">
        {label}
        {isRequired && <span aria-hidden="true" className="ml-1 text-[#DC2626]">*</span>}
      </span>
      {children}
      {hint && (
        <span className="block text-xs font-normal text-brand-muted">{hint}</span>
      )}
    </label>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full min-w-0 rounded-xl border border-brand-input bg-white px-3.5 py-2.5 text-sm font-normal text-brand-ink outline-none transition-colors placeholder:text-brand-muted hover:border-brand-cool focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 ${props.className ?? ""}`}
    />
  );
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-11 w-full min-w-0 rounded-xl border border-brand-input bg-white px-3.5 py-2.5 text-sm font-normal text-brand-ink outline-none transition-colors hover:border-brand-cool focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 ${props.className ?? ""}`}
    />
  );
}
export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full min-w-0 resize-y rounded-xl border border-brand-input bg-white px-3.5 py-2.5 text-sm font-normal text-brand-ink outline-none transition-colors placeholder:text-brand-muted hover:border-brand-cool focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/10 ${props.className ?? ""}`}
    />
  );
}


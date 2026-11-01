import { forwardRef, type SelectHTMLAttributes } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  options: string[];
  placeholder?: string;
};

/** A select that always offers its current value, even a removed option on an old record. */
export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { options, placeholder, ...props },
  ref,
) {
  return (
    <select ref={ref} {...props}>
      {placeholder === undefined ? null : <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
});

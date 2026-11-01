import { forwardRef, type Ref, type SelectHTMLAttributes } from 'react';
import { useSettings } from '../store/tracker';
import { Field } from './Field';
import { Select } from './Select';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  placeholder?: string;
  error?: string | undefined;
};

/** The value a member field starts with. A single member needs no choosing. */
export function useDefaultMember() {
  const { familyMembers } = useSettings();
  return familyMembers.length === 1 ? (familyMembers[0] ?? '') : '';
}

/** Family members to choose from. With one member or none, the field stays hidden. */
export const MemberField = forwardRef<HTMLSelectElement, Props>(function MemberField(
  { label = 'Family Member', placeholder = '-- Select family member --', error, ...props },
  ref,
) {
  const { familyMembers } = useSettings();
  if (familyMembers.length < 2) {
    return (
      <input
        hidden
        name={props.name}
        onBlur={props.onBlur as never}
        onChange={props.onChange as never}
        ref={ref as unknown as Ref<HTMLInputElement>}
      />
    );
  }
  return (
    <Field error={error} label={label}>
      <Select options={familyMembers} placeholder={placeholder} ref={ref} {...props} />
    </Field>
  );
});

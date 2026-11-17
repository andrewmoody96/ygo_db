import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

export function Field(props: { label: string; children: ComponentChildren; wide?: boolean }) {
  return (
    <label class={`field${props.wide ? ' wide' : ''}`}>
      <span class="field-label">{props.label}</span>
      {props.children}
    </label>
  );
}

/** Text input with suggestions; any value can be typed (new values get remembered). */
export function ChoiceInput(props: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (v: string | undefined) => void;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <Field label={props.label} wide={props.wide}>
      <input
        list={id}
        value={props.value ?? ''}
        onInput={(e) => props.onChange((e.currentTarget.value || undefined) as string | undefined)}
        autocomplete="off"
      />
      <datalist id={id}>
        {props.options.map((o) => (
          <option value={o} key={o} />
        ))}
      </datalist>
    </Field>
  );
}

export function Select(props: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (v: string | undefined) => void;
  blank?: string;
}) {
  return (
    <Field label={props.label}>
      <select value={props.value ?? ''} onChange={(e) => props.onChange(e.currentTarget.value || undefined)}>
        <option value="">{props.blank ?? '—'}</option>
        {props.options.map((o) => (
          <option value={o} key={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function NumberInput(props: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number;
}) {
  return (
    <Field label={props.label}>
      <input
        type="number"
        inputMode="decimal"
        min={props.min}
        step={props.step}
        value={props.value ?? ''}
        onInput={(e) => {
          const v = e.currentTarget.value;
          props.onChange(v === '' ? undefined : Number(v));
        }}
      />
    </Field>
  );
}

export function Text(props: { label: string; value: string | undefined; onChange: (v: string | undefined) => void; wide?: boolean }) {
  return (
    <Field label={props.label} wide={props.wide}>
      <input value={props.value ?? ''} onInput={(e) => props.onChange(e.currentTarget.value || undefined)} />
    </Field>
  );
}

export function Check(props: { label: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <label class="check">
      <input type="checkbox" checked={!!props.value} onChange={(e) => props.onChange(e.currentTarget.checked)} />
      {props.label}
    </label>
  );
}

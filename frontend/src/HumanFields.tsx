import type { HumanField } from './types';

export function HumanFields({ fields, values, onChange, disabled }: {
  fields: HumanField[]; values: Record<string, string>; onChange: (values: Record<string, string>) => void; disabled: boolean;
}) {
  const shownGroups = new Set<string>();
  return <div className="human-fields">{fields.map(field => {
    const id = `human-${field.id}`;
    const update = (value: string) => onChange({ ...values, [field.id]: value });
    if (field.type === 'radio') {
      const groupKey = field.name ?? field.id;
      if (shownGroups.has(groupKey)) return null;
      shownGroups.add(groupKey);
      const group = fields.filter(item => item.type === 'radio' && (item.name ?? item.id) === groupKey);
      return <fieldset className="human-choice-group" key={field.id}>
        <legend>{field.question || groupKey}</legend>
        {group.map(option => <label className="checkbox" key={option.id} htmlFor={`human-${option.id}`}>
          <input id={`human-${option.id}`} type="radio" name={`human-group-${groupKey}`}
            checked={values[option.id] === 'true'} required disabled={disabled}
            onChange={() => {
              const next = { ...values };
              for (const sibling of group) next[sibling.id] = String(sibling.id === option.id);
              onChange(next);
            }} /><span>{option.label}</span>
        </label>)}
      </fieldset>;
    }
    if (field.type === 'checkbox') return <label className="checkbox" key={field.id} htmlFor={id}>
      <input id={id} type="checkbox" checked={values[field.id] === 'true'} required={field.required} disabled={disabled}
        onChange={event => update(String(event.target.checked))} /><span>{field.label}</span></label>;
    return <div key={field.id}><label htmlFor={id}>{field.label}{field.required ? ' *' : ''}</label>
      {field.tag === 'select' ? <select id={id} value={values[field.id] ?? ''} onChange={event => update(event.target.value)} required={field.required} disabled={disabled}>
        <option value="">Choose an option</option>{field.options?.filter(option => option.value !== '').map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select> : field.tag === 'textarea' ? <textarea id={id} value={values[field.id] ?? ''} onChange={event => update(event.target.value)} required={field.required} disabled={disabled} maxLength={field.maxLength} />
        : <input id={id} type={['email', 'tel', 'password', 'date', 'number', 'url'].includes(field.type) ? field.type : 'text'}
          value={values[field.id] ?? ''} onChange={event => update(event.target.value)} required={field.required} disabled={disabled}
          minLength={field.minLength} maxLength={field.maxLength} min={field.min} max={field.max} autoComplete="off" />}
    </div>;
  })}</div>;
}

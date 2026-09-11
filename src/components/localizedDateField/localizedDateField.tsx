import { useEffect, useId, useRef, useState } from 'react';
import { DayPicker } from '@daypicker/react';
import { ptBR } from '@daypicker/react/locale';
import { CalendarDays } from 'lucide-react';
import '@daypicker/react/style.css';
import './localizedDateField.css';

function parseIso(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatIso(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

type LocalizedDateFieldProps = {
  name: string;
  defaultValue: string;
  min?: string;
};

export function LocalizedDateField({ name, defaultValue, min }: LocalizedDateFieldProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => parseIso(defaultValue));
  const [open, setOpen] = useState(false);
  const minimum = min ? parseIso(min) : undefined;
  const endMonth = new Date(selected.getFullYear() + 8, 11, 1, 12);

  useEffect(() => {
    function close(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  return (
    <div className="localized-date-field" ref={root}>
      <input type="hidden" name={name} value={formatIso(selected)} />
      <button
        id={id}
        className="localized-date-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarDays aria-hidden="true" />
        <span>{selected.toLocaleDateString('pt-BR')}</span>
      </button>
      {open && (
        <div className="localized-date-popover" role="dialog" aria-label="Escolha uma data">
          <DayPicker
            animate
            mode="single"
            required
            locale={ptBR}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            startMonth={minimum}
            endMonth={endMonth}
            disabled={minimum ? { before: minimum } : undefined}
            onSelect={(date) => {
              setSelected(date);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

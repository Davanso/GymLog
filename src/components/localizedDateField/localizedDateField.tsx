import { useId, useMemo, useState } from 'react';
import './localizedDateField.css';

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function parts(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

type LocalizedDateFieldProps = {
  name: string;
  defaultValue: string;
  min?: string;
};

export function LocalizedDateField({ name, defaultValue, min }: LocalizedDateFieldProps) {
  const id = useId();
  const initial = parts(defaultValue);
  const minimum = parts(min || defaultValue);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);
  const daysInMonth = new Date(year, month, 0).getDate();
  const safeDay = Math.min(day, daysInMonth);
  const value = `${year}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  const years = useMemo(
    () => Array.from({ length: 8 }, (_, index) => minimum.year + index),
    [minimum.year],
  );
  function changeMonth(nextMonth: number) {
    setMonth(nextMonth);
    if (year === minimum.year && nextMonth === minimum.month && day < minimum.day)
      setDay(minimum.day);
  }
  function changeYear(nextYear: number) {
    setYear(nextYear);
    if (nextYear !== minimum.year) return;
    if (month < minimum.month) {
      setMonth(minimum.month);
      setDay(minimum.day);
    } else if (month === minimum.month && day < minimum.day) setDay(minimum.day);
  }

  return (
    <fieldset className="localized-date-field">
      <legend className="sr-only">Escolha a data</legend>
      <input type="hidden" name={name} value={value} />
      <label htmlFor={`${id}-day`}>
        Dia
        <select
          id={`${id}-day`}
          value={safeDay}
          onChange={(event) => setDay(Number(event.target.value))}
        >
          {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((value) => (
            <option
              key={value}
              value={value}
              disabled={year === minimum.year && month === minimum.month && value < minimum.day}
            >
              {String(value).padStart(2, '0')}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-month`}>
        Mês
        <select
          id={`${id}-month`}
          value={month}
          onChange={(event) => changeMonth(Number(event.target.value))}
        >
          {monthNames.map((name, index) => (
            <option
              key={name}
              value={index + 1}
              disabled={year === minimum.year && index + 1 < minimum.month}
            >
              {name}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={`${id}-year`}>
        Ano
        <select
          id={`${id}-year`}
          value={year}
          onChange={(event) => changeYear(Number(event.target.value))}
        >
          {years.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </label>
    </fieldset>
  );
}

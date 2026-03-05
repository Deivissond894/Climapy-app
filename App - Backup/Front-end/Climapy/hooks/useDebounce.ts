import { useEffect, useState } from 'react';

/**
 * Hook para debounce de valores
 * Útil para evitar chamadas excessivas à API durante digitação
 * 
 * @param value - Valor a ser "debouncado"
 * @param delay - Atraso em milissegundos (padrão: 500ms)
 * @returns Valor debounced
 * 
 * @example
 * const [searchText, setSearchText] = useState('');
 * const debouncedSearch = useDebounce(searchText, 300);
 * 
 * useEffect(() => {
 *   // Esta função só será chamada 300ms após o usuário parar de digitar
 *   fetchResults(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Agenda a atualização do valor
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpa o timeout se o valor mudar antes do delay
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

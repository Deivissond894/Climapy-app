import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('deve retornar o valor inicial imediatamente', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('deve debounce mudanças de valor', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Alterar valor
    rerender({ value: 'changed', delay: 500 });

    // Valor ainda não deve ter mudado
    expect(result.current).toBe('initial');

    // Avançar o tempo
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Aguardar atualização
    await waitFor(() => {
      expect(result.current).toBe('changed');
    });
  });

  it('deve cancelar debounce anterior quando valor muda rapidamente', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'first' } }
    );

    // Mudanças rápidas
    rerender({ value: 'second' });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    rerender({ value: 'third' });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Ainda deve estar no valor inicial
    expect(result.current).toBe('first');

    // Completar o delay
    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Aguardar atualização
    await waitFor(() => {
      expect(result.current).toBe('third');
    });
  });
});

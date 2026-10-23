import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWidgetApi, WidgetApiProvider } from '../../src/api/widget-api-context.js';
import type { WidgetApi } from '../../src/api/widget-api.js';

function fakeApi(): WidgetApi {
  return {
    list: vi.fn(),
    create: vi.fn(),
    updateText: vi.fn(),
    remove: vi.fn(),
  };
}

function Consumer({ onApi }: { onApi: (api: WidgetApi) => void }) {
  onApi(useWidgetApi());
  return <span>consumer</span>;
}

describe('WidgetApi context', () => {
  it('provides the injected client to descendants', () => {
    const api = fakeApi();
    const onApi = vi.fn();

    render(
      <WidgetApiProvider api={api}>
        <Consumer onApi={onApi} />
      </WidgetApiProvider>,
    );

    expect(screen.getByText('consumer')).toBeInTheDocument();
    expect(onApi).toHaveBeenCalledWith(api);
  });

  it('fails loudly when used outside a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer onApi={vi.fn()} />)).toThrow(
      'useWidgetApi must be used within a WidgetApiProvider',
    );
  });
});

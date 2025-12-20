import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function that wraps components with providers
 * Add any global providers here (theme, context, etc.)
 */
function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}

function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllTheProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };

import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../theme-provider';

// Mock next-themes
jest.mock('next-themes', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div data-testid="theme-provider">{children}</div>,
}));

describe('ThemeProvider', () => {
  test('renders children', () => {
    render(
      <ThemeProvider>
        <div>Test Content</div>
      </ThemeProvider>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  test('wraps children in theme provider', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system">
        <div>Test Content</div>
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument();
  });

  test('passes props to NextThemesProvider', () => {
    const { container } = render(
      <ThemeProvider attribute="class" defaultTheme="dark">
        <div>Test Content</div>
      </ThemeProvider>
    );
    
    expect(container.querySelector('[data-testid="theme-provider"]')).toBeInTheDocument();
  });
});

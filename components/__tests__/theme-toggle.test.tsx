import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../theme-toggle';

// Mock next-themes
const mockSetTheme = jest.fn();
jest.mock('next-themes', () => ({
  useTheme: jest.fn(() => ({
    theme: 'light',
    setTheme: mockSetTheme,
  })),
}));

const useTheme = require('next-themes').useTheme;

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders theme toggle button', () => {
    render(<ThemeToggle />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('shows moon icon in light mode', () => {
    useTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });
    
    const { container } = render(<ThemeToggle />);
    
    // Moon icon should be visible in light mode
    const moonIcon = container.querySelector('.lucide-moon');
    expect(moonIcon).toBeInTheDocument();
  });

  test('shows sun icon in dark mode', () => {
    useTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
    });
    
    const { container } = render(<ThemeToggle />);
    
    // Sun icon should be visible in dark mode
    const sunIcon = container.querySelector('.lucide-sun');
    expect(sunIcon).toBeInTheDocument();
  });

  test('toggles theme when clicked', async () => {
    const user = userEvent.setup();
    
    useTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });
    
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  test('toggles from dark to light when clicked', async () => {
    const user = userEvent.setup();
    
    useTheme.mockReturnValue({
      theme: 'dark',
      setTheme: mockSetTheme,
    });
    
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  test('has appropriate title attribute', () => {
    useTheme.mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });
    
    render(<ThemeToggle />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Switch to Dark Mode');
  });
});

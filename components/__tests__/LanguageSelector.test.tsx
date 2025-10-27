import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LanguageSelector from '../LanguageSelector';

// Mock react-i18next
const mockChangeLanguage = jest.fn();
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: 'en',
      changeLanguage: mockChangeLanguage,
    },
    t: (key: string) => key,
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
  })
) as jest.Mock;

describe('LanguageSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();
  });

  test('renders language selector button', () => {
    render(<LanguageSelector />);
    
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText(/English/i)).toBeInTheDocument();
  });

  test('changes language when option is selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    const viOption = screen.getByText(/Tiếng Việt/i);
    await user.click(viOption);
    
    expect(mockChangeLanguage).toHaveBeenCalledWith('vi');
    expect(localStorageMock.getItem('preferredLanguage')).toBe('vi');
  });

  test('saves language preference to backend', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    const zhOption = screen.getByText(/中文/i);
    await user.click(zhOption);
    
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/user/preferences',
      expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('zh')
      })
    );
  });

  test('displays all available languages', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    // Check for all language options by getting all text matches
    expect(screen.getAllByText(/English/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Tiếng Việt/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/中文/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/日本語/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/한국어/i).length).toBeGreaterThan(0);
  });
});

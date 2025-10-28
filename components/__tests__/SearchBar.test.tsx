import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchBar from '../SearchBar';

// Mock fetch
global.fetch = jest.fn();

describe('SearchBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders search input and button', () => {
    render(<SearchBar userId="user-123" />);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByText(/Semantic Search/i)).toBeInTheDocument();
  });

  test('performs search when form is submitted', async () => {
    const user = userEvent.setup();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 1, summary: 'Test result', similarity: 0.9 }] })
    });

    render(<SearchBar userId="user-123" />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test query');
    
    const form = input.closest('form');
    if (form) {
      await user.click(form.querySelector('button[type="submit"]') as Element);
    }

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/search',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('test query')
        })
      );
    });
  });

  test('displays error message when search fails', async () => {
    const user = userEvent.setup();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Search failed' })
    });

    render(<SearchBar userId="user-123" />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test query');
    
    const form = input.closest('form');
    if (form) {
      await user.click(form.querySelector('button[type="submit"]') as Element);
    }

    await waitFor(() => {
      expect(screen.getByText(/Search failed/i)).toBeInTheDocument();
    });
  });

  test('clears search results when clear button is clicked', async () => {
    const user = userEvent.setup();
    
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ id: 1, summary: 'Test result', similarity: 0.9 }] })
    });

    render(<SearchBar userId="user-123" />);
    
    const input = screen.getByRole('textbox');
    await user.type(input, 'test query');
    
    const form = input.closest('form');
    if (form) {
      await user.click(form.querySelector('button[type="submit"]') as Element);
    }

    await waitFor(() => {
      expect(screen.getByText(/Test result/i)).toBeInTheDocument();
    });

    // Find the clear button (icon button with X)
    const clearButtons = screen.getAllByRole('button');
    const clearButton = clearButtons.find(btn => btn.type === 'button' && btn.classList.contains('h-8'));
    if (clearButton) {
      await user.click(clearButton);
      expect(input).toHaveValue('');
    }
  });
});

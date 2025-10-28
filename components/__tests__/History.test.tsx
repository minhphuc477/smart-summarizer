import { render, screen } from '@testing-library/react';
import History from '../History';

// Mock dependencies
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    }))
  }
}));

jest.mock('@/lib/guestMode', () => ({
  getGuestHistory: jest.fn(() => []),
  deleteGuestNote: jest.fn(),
  type: { GuestNote: {} }
}));

describe('History', () => {
  test('renders history component', () => {
    render(<History />);
    
    expect(screen.getByText(/History/i)).toBeInTheDocument();
  });

  test('renders loading skeleton initially', () => {
    const { container } = render(<History />);
    
    // Should show loading state initially - check for skeleton elements
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  test('renders with guest mode prop', () => {
    render(<History isGuest={true} />);
    
    expect(screen.getByText(/History/i)).toBeInTheDocument();
  });

  test('renders with selectedFolderId prop', () => {
    render(<History selectedFolderId={123} />);
    
    // Component should handle folder filtering
    expect(screen.getByText(/History/i)).toBeInTheDocument();
  });
});

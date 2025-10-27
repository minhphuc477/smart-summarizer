import { render, screen } from '@testing-library/react';
import NavigationMenu from '../NavigationMenu';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <a href={href}>{children}</a>;
  };
});

const usePathname = require('next/navigation').usePathname;

describe('NavigationMenu', () => {
  test('renders all navigation links', () => {
    render(<NavigationMenu />);
    
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Canvas')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
  });

  test('highlights active link on home page', () => {
    usePathname.mockReturnValue('/');
    
    const { container } = render(<NavigationMenu />);
    
    const homeLink = screen.getByText('Home').closest('button');
    expect(homeLink).toHaveClass('bg-primary'); // Active button has primary background
  });

  test('highlights active link on canvas page', () => {
    usePathname.mockReturnValue('/canvas');
    
    const { container } = render(<NavigationMenu />);
    
    const canvasLink = screen.getByText('Canvas').closest('button');
    expect(canvasLink).toHaveClass('bg-primary');
  });

  test('highlights active link on analytics page', () => {
    usePathname.mockReturnValue('/analytics');
    
    const { container } = render(<NavigationMenu />);
    
    const analyticsLink = screen.getByText('Analytics').closest('button');
    expect(analyticsLink).toHaveClass('bg-primary');
  });

  test('renders navigation as links', () => {
    render(<NavigationMenu />);
    
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[1]).toHaveAttribute('href', '/canvas');
    expect(links[2]).toHaveAttribute('href', '/analytics');
  });
});

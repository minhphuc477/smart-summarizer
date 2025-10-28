import { render, screen } from '@testing-library/react';
import EncryptionDialog from '../EncryptionDialog';

// Mock encryption functions
jest.mock('@/lib/encryption', () => ({
  encryptText: jest.fn((text: string, password: string) => ({
    encrypted: 'encrypted_data',
    iv: 'iv_value',
    salt: 'salt_value'
  })),
  decryptText: jest.fn((encrypted: string, password: string, iv: string, salt: string) => 'decrypted_text'),
  validatePasswordStrength: jest.fn((password: string) => {
    if (password.length < 8) {
      return { strength: 'weak', score: 0 };
    }
    return { strength: 'strong', score: 4 };
  })
}));

describe('EncryptionDialog', () => {
  const mockOnResult = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders encryption dialog with trigger', () => {
    render(
      <EncryptionDialog 
        mode="encrypt" 
        content="test content" 
        onResult={mockOnResult}
        trigger={<button>Encrypt</button>}
      />
    );
    
    expect(screen.getByText('Encrypt')).toBeInTheDocument();
  });

  test('renders without trigger', () => {
    const { container } = render(
      <EncryptionDialog 
        mode="encrypt" 
        content="test content" 
        onResult={mockOnResult}
      />
    );
    
    // Component should render without errors
    expect(container).toBeInTheDocument();
  });

  test('accepts encrypt mode prop', () => {
    render(
      <EncryptionDialog 
        mode="encrypt" 
        content="test content" 
        onResult={mockOnResult}
        trigger={<button>Test</button>}
      />
    );
    
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  test('accepts decrypt mode prop', () => {
    render(
      <EncryptionDialog 
        mode="decrypt" 
        content='{"encrypted":"data","iv":"iv","salt":"salt"}' 
        onResult={mockOnResult}
        trigger={<button>Decrypt</button>}
      />
    );
    
    expect(screen.getByText('Decrypt')).toBeInTheDocument();
  });

  test('accepts content and onResult callback', () => {
    const testContent = "test content";
    const testCallback = jest.fn();
    
    render(
      <EncryptionDialog 
        mode="encrypt" 
        content={testContent} 
        onResult={testCallback}
        trigger={<button>Test</button>}
      />
    );
    
    // Component renders with props
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});

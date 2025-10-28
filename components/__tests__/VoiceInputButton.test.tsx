import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import VoiceInputButton from '../VoiceInputButton';

// Mock the useVoiceInput hook
const mockStartListening = jest.fn();
const mockStopListening = jest.fn();
const mockResetTranscript = jest.fn();

jest.mock('@/lib/useVoiceInput', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    isListening: false,
    transcript: '',
    interimTranscript: '',
    isSupported: true,
    startListening: mockStartListening,
    stopListening: mockStopListening,
    resetTranscript: mockResetTranscript,
  })),
}));

const useVoiceInput = require('@/lib/useVoiceInput').default;

describe('VoiceInputButton', () => {
  const mockOnTranscript = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders voice input button when supported', () => {
    render(<VoiceInputButton onTranscript={mockOnTranscript} />);
    
    expect(screen.getByRole('button', { name: /Voice Input/i })).toBeInTheDocument();
  });

  test('does not render when voice input is not supported', () => {
    useVoiceInput.mockReturnValueOnce({
      isListening: false,
      transcript: '',
      interimTranscript: '',
      isSupported: false,
      startListening: mockStartListening,
      stopListening: mockStopListening,
      resetTranscript: mockResetTranscript,
    });

    const { container } = render(<VoiceInputButton onTranscript={mockOnTranscript} />);
    
    expect(container.firstChild).toBeNull();
  });

  test('starts listening when button is clicked', async () => {
    const user = userEvent.setup();
    render(<VoiceInputButton onTranscript={mockOnTranscript} language="en-US" />);
    
    const button = screen.getByRole('button');
    await user.click(button);
    
    expect(mockResetTranscript).toHaveBeenCalled();
    expect(mockStartListening).toHaveBeenCalledWith('en-US');
  });

  test('stops listening when button is clicked while listening', async () => {
    useVoiceInput.mockReturnValueOnce({
      isListening: true,
      transcript: 'test transcript',
      interimTranscript: '',
      isSupported: true,
      startListening: mockStartListening,
      stopListening: mockStopListening,
      resetTranscript: mockResetTranscript,
    });

    const user = userEvent.setup();
    render(<VoiceInputButton onTranscript={mockOnTranscript} />);
    
    const button = screen.getByRole('button', { name: /Stop Recording/i });
    await user.click(button);
    
    expect(mockStopListening).toHaveBeenCalled();
  });

  test('shows interim transcript while listening', () => {
    useVoiceInput.mockReturnValueOnce({
      isListening: true,
      transcript: '',
      interimTranscript: 'speaking now...',
      isSupported: true,
      startListening: mockStartListening,
      stopListening: mockStopListening,
      resetTranscript: mockResetTranscript,
    });

    render(<VoiceInputButton onTranscript={mockOnTranscript} />);
    
    expect(screen.getByText(/Listening: speaking now.../i)).toBeInTheDocument();
  });

  test('calls onTranscript when transcript changes', () => {
    useVoiceInput.mockReturnValueOnce({
      isListening: true,
      transcript: 'new transcript',
      interimTranscript: '',
      isSupported: true,
      startListening: mockStartListening,
      stopListening: mockStopListening,
      resetTranscript: mockResetTranscript,
    });

    render(<VoiceInputButton onTranscript={mockOnTranscript} />);
    
    expect(mockOnTranscript).toHaveBeenCalledWith('new transcript');
  });
});

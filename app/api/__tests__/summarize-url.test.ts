// Mock dependencies before importing route
jest.mock('@/lib/groq', () => ({
  getGroqSummary: jest.fn().mockResolvedValue({
    summary: 'Mock summary',
    takeaways: ['a', 'b'],
    actions: [],
    tags: ['tag1'],
    sentiment: 'neutral'
  })
}));

// Mock JSDOM and Readability
jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: {}
    }
  }))
}));

jest.mock('@mozilla/readability', () => ({
  Readability: jest.fn().mockImplementation(() => ({
    parse: jest.fn().mockReturnValue({
      textContent: 'Extracted article content',
      title: 'Article Title'
    })
  }))
}));

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve('<html><body>Test content</body></html>'),
  })
) as jest.Mock;

let postHandler: (req: Request) => Promise<Response>;
beforeAll(async () => {
  ({ POST: postHandler } = await import('../summarize-url/route'));
});

describe('POST /api/summarize-url', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/summarize-url',
    headers: new Headers(),
    method: 'POST'
  } as unknown as Request);

  test('requires URL parameter', async () => {
    const req = mockRequest({ customPersona: 'Student' });
    const response = await postHandler(req);
    expect(response.status).toBe(400);
  });

  test('accepts valid URL request', async () => {
    const req = mockRequest({
      url: 'https://example.com/article',
      customPersona: 'Professional'
    });
    
    const response = await postHandler(req);
    expect(response.status).toBeLessThan(500);
  });

  test('handles URL without customPersona', async () => {
    const req = mockRequest({
      url: 'https://example.com/article'
    });
    
    const response = await postHandler(req);
    expect(response.status).toBeLessThan(500);
  });
});

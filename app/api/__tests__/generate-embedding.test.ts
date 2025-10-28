// Mock dependencies before importing route
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(async () => async () => ({ data: new Float32Array([0.1, 0.2, 0.3]) }))
}), { virtual: true } as any);

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn().mockResolvedValue({ data: { id: '123' }, error: null })
      }))
    }))
  }))
}));

let postHandler: (req: Request) => Promise<Response>;
beforeAll(async () => {
  ({ POST: postHandler } = await import('../generate-embedding/route'));
});

describe('POST /api/generate-embedding', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/generate-embedding',
    headers: new Headers(),
    method: 'POST'
  } as unknown as Request);

  test('requires noteId parameter', async () => {
    const req = mockRequest({ text: 'Some content' });
    const response = await postHandler(req);
    expect(response.status).toBe(400);
  });

  test('requires text parameter', async () => {
    const req = mockRequest({ noteId: '123' });
    const response = await postHandler(req);
    expect(response.status).toBe(400);
  });

  test('accepts valid embedding request', async () => {
    const req = mockRequest({
      noteId: '123',
      text: 'This is the note content to generate embedding for'
    });
    
    const response = await postHandler(req);
    expect(response.status).toBeLessThan(500);
  });

  test('handles long text by truncating', async () => {
    const longText = 'a'.repeat(10000);
    const req = mockRequest({
      noteId: '123',
      text: longText
    });
    
    const response = await postHandler(req);
    expect(response.status).toBeLessThan(500);
  });
});

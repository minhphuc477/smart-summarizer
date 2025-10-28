// Mock Supabase before importing route
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn()
    },
    from: jest.fn()
  }
}));

import { supabase } from '@/lib/supabase';

let getHandler: (req: Request) => Promise<Response>;
let patchHandler: (req: Request) => Promise<Response>;

beforeAll(async () => {
  ({ GET: getHandler, PATCH: patchHandler } = await import('../user/preferences/route'));
});

describe('GET /api/user/preferences', () => {
  const mockRequest = () => ({
    json: jest.fn(),
    url: 'http://localhost:3000/api/user/preferences',
    headers: new Headers(),
    method: 'GET'
  } as unknown as Request);

  test('requires authentication', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' }
    });

    const req = mockRequest();
    const response = await getHandler(req);
    expect(response.status).toBe(401);
  });

  test('returns user preferences when authenticated', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    const mockPreferences = {
      language: 'en',
      theme: 'dark',
      timezone: 'UTC'
    };

    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockPreferences,
            error: null
          })
        })
      })
    });

    const req = mockRequest();
    const response = await getHandler(req);
    expect(response.status).toBe(200);
  });
});

describe('PATCH /api/user/preferences', () => {
  const mockRequest = (body: any) => ({
    json: jest.fn().mockResolvedValue(body),
    url: 'http://localhost:3000/api/user/preferences',
    headers: new Headers(),
    method: 'PATCH'
  } as unknown as Request);

  test('requires authentication', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'Unauthorized' }
    });

    const req = mockRequest({ language: 'en' });
    const response = await patchHandler(req);
    expect(response.status).toBe(401);
  });

  test('updates user preferences when authenticated', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null
    });

    const updatedPreferences = {
      language: 'en',
      theme: 'dark'
    };

    (supabase.from as jest.Mock).mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: updatedPreferences,
            error: null
          })
        })
      })
    });

    const req = mockRequest(updatedPreferences);
    const response = await patchHandler(req);
    expect(response.status).toBe(200);
  });
});

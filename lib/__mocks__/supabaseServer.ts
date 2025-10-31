// Jest auto-mock for @/lib/supabaseServer
export const getServerSupabase = jest.fn(async () => {
  const mockData = { data: [], error: null };
  const mockUser = { 
    id: 'test-user-id',
    email: 'test@example.com',
    created_at: new Date().toISOString(),
  };
  
  return {
    auth: {
      getUser: jest.fn(async () => ({ 
        data: { user: mockUser }, 
        error: null 
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(async () => mockData),
      maybeSingle: jest.fn(async () => mockData),
      then: jest.fn(async (callback) => callback(mockData)),
    })),
    rpc: jest.fn(async () => mockData),
  };
});

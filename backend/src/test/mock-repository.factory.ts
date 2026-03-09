import { ObjectLiteral, Repository } from 'typeorm';

export type MockRepository<T extends ObjectLiteral = ObjectLiteral> = Partial<
  Record<keyof Repository<T>, jest.Mock>
>;

export function createMockRepository<T extends ObjectLiteral = ObjectLiteral>(): MockRepository<T> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    save: jest.fn().mockImplementation((entity) =>
      Promise.resolve({ id: 'mock-uuid', ...entity }),
    ),
    create: jest.fn().mockImplementation((entity) => entity),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

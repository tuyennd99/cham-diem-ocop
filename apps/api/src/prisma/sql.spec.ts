import { databaseObject } from './sql';

describe('databaseObject', () => {
  it('qualifies identifiers with the configured schema', () => {
    expect(databaseObject('products', 'postgresql://u:p@localhost/ocop_test?schema=ocop').text)
      .toBe('"ocop"."products"');
  });

  it('defaults to public when the URL has no schema', () => {
    expect(databaseObject('OtpPurpose', 'postgresql://u:p@localhost/ocop_test').text)
      .toBe('"public"."OtpPurpose"');
  });

  it('quotes identifier quotes from encoded schema names', () => {
    expect(databaseObject('users', 'postgresql://u:p@localhost/ocop_test?schema=a%22b').text)
      .toBe('"a""b"."users"');
  });

  it.each(['', 'a\0b'])('rejects invalid object name %s', (name) => {
    expect(() => databaseObject(name, 'postgresql://localhost/ocop_test')).toThrow();
  });

  it('escapes embedded quotes in object names', () => {
    expect(databaseObject('a"b', 'postgresql://localhost/ocop_test').text)
      .toBe('"public"."a""b"');
  });

  it('requires a database URL', () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      expect(() => databaseObject('products')).toThrow('DATABASE_URL is required');
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});

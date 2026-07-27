/**
 * Flattens a barrel namespace into the array of its class exports for use as
 * NestJS `controllers` / `providers`.
 *
 * Only function (class) exports are kept: barrel files use `export *`, which can
 * also re-export runtime constants/values. Those are not valid DI tokens and
 * would make Nest call `Reflect.getMetadata` on a non-class, throwing a
 * `TypeError` at startup. Filtering to functions keeps DI robust regardless of
 * what else a repository/service module exports.
 */
import { Type } from '@nestjs/common';

export const convertObjectToArray = (values: object): Type<unknown>[] => {
  return Object.values(values).filter((value): value is Type<unknown> => typeof value === 'function');
};

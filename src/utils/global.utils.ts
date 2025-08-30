import { HttpException } from '@nestjs/common';

export function roundNumber<T>(raw: T) {
  const number = Number(raw);
  if (isNaN(number)) {
    throw new HttpException('Error on utils', 500);
  }

  const roundedString = number.toFixed(2);
  const roundedNumber = Number(roundedString);
  if (roundedNumber === -0) return 0;

  return roundedNumber;
}

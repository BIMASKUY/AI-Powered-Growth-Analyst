import { BadRequestException } from '@nestjs/common';
import { format, parse } from 'date-fns';

export function roundNumber<T>(raw: T): number {
  const number = Number(raw);
  if (isNaN(number) || !isFinite(number)) {
    throw new BadRequestException('Invalid number');
  }

  const DECIMALS = 2; // 2 decimal after comma
  const factor = Math.pow(10, DECIMALS);
  const rounded = Math.round(number * factor) / factor;
  return rounded;
}

export function formatDate(date: string): string {
  const parsedDate = parse(date, 'yyyyMMdd', new Date());
  const formattedDate = format(parsedDate, 'yyyy-MM-dd');
  return formattedDate;
}

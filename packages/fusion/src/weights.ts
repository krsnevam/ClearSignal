import { Weights } from '@clearsignal/schema';
import { parse } from 'yaml';
import raw from '../weights.yaml';

export function parseWeights(text: string): Weights {
  return Weights.parse(parse(text));
}

export const defaultWeights: Weights = parseWeights(raw);
export const weightsYaml: string = raw;

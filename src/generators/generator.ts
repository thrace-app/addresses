import { type Account } from '../types/account'
import { type Logger } from 'winston'

export interface GeneratorFnOptions {
  log?: Logger
}

export type GeneratorFn = (
  networkId: number,
  options: GeneratorFnOptions
) => Promise<Record<string, Account[]>>

export interface Generator {
  resolve: GeneratorFn
  getSupportedNetworks(): number[]
}

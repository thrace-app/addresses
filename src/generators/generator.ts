import { type Account } from '../types/account'

export interface Generator {
  resolve: GeneratorFn
  getSupportedNetworks(): number[]
}

export type GeneratorFn = (
  networkId: number
) => Promise<Record<string, Account[]>>

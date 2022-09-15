import { type Account } from './../types/account'

export interface Resolver {
  resolve: ResolverFn
  getSupportedNetworks(): number[]
}

export type ResolverFn = (
  networkId: number
) => Promise<Record<string, Account[]>>
